import json
import time

from django.conf import settings
from django.http import HttpResponseRedirect, JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from accounts.api.access import (
    get_user_billing_profile,
    json_pro_required_response,
    sse_error_response,
    sse_token_limit_response,
)
from accounts.api.persistence import (
    attach_pending_assets_to_message,
    create_email_record,
    create_message,
    get_builtin_agent,
    get_recent_context_messages,
    get_user_conversation,
    update_message,
    assign_agent_to_conversation,
)
from accounts.models import Message
from .agent import EMAIL_DRAFT_TAG, extract_email_draft, get_comsats_response, reset_comsats_chat
from .gmail import (
    build_gmail_oauth_url,
    build_gmail_result_redirect,
    handle_gmail_oauth_callback,
    is_gmail_connected,
    send_gmail_email,
)


def authenticate_query_token(request):
    raw_token = request.GET.get("access_token", "").strip()
    if not raw_token:
        return None

    authenticator = JWTAuthentication()
    try:
        validated = authenticator.get_validated_token(raw_token)
        return authenticator.get_user(validated)
    except (InvalidToken, TokenError, Exception):
        return None


def authenticate_header_token(request):
    authenticator = JWTAuthentication()
    header = authenticator.get_header(request)
    if not header:
        return None

    raw_token = authenticator.get_raw_token(header)
    if not raw_token:
        return None

    try:
        validated = authenticator.get_validated_token(raw_token)
        return authenticator.get_user(validated)
    except (InvalidToken, TokenError, Exception):
        return None


@csrf_exempt
@require_GET
def comsats_stream(request):
    query = request.GET.get("text", "").strip()
    chat_id = request.GET.get("chat_id", "").strip()
    user = authenticate_query_token(request)

    if not user:
        return sse_error_response("Authentication required. Please sign in again.")
    billing_profile = get_user_billing_profile(user, sync_remote=True)
    if not billing_profile or not billing_profile.is_paid:
        return sse_error_response("Upgrade to Pro to use domain agents.")
    if billing_profile.token_total_used >= getattr(settings, "PAID_MONTHLY_TOKEN_QUOTA", 0):
        return sse_token_limit_response("Token limit reached. Please wait until subscription renewal.")
    if not query:
        return JsonResponse({"error": "Query is required"}, status=400)

    conversation = get_user_conversation(user, chat_id)
    if not conversation:
        return sse_error_response("Conversation not found.")

    builtin_agent = get_builtin_agent("builtin-comsats")
    if builtin_agent:
        assign_agent_to_conversation(conversation, builtin_agent, conversation_type="domain_agent")

    previous_context = get_recent_context_messages(conversation, limit=10)
    user_message = create_message(
        conversation,
        role="user",
        user=user,
        content_text=query,
    )
    attach_pending_assets_to_message(conversation, user_message)

    assistant_message = create_message(
        conversation,
        role="assistant",
        content_text="",
        status="streaming",
        model_used="x-ai/grok-4.1-fast",
    )

    def stream_response():
        raw_answer = ""
        try:
            response = get_comsats_response(
                query,
                thread_id=chat_id,
                history_messages=previous_context,
                user=user,
                track_tokens=True,
            )
            for word in response.split(" "):
                raw_answer += word + " "
                yield f"data: {word.replace(chr(10), '\\n')} \n\n"
                time.sleep(0.02)

            marker_index = raw_answer.find(EMAIL_DRAFT_TAG)
            stored_text = raw_answer.strip()
            content_json = {}
            if marker_index != -1:
                draft_payload = raw_answer[marker_index + len(EMAIL_DRAFT_TAG):].strip()
                stored_text = raw_answer[:marker_index].strip()
                draft = None
                if draft_payload:
                    try:
                        draft = json.loads(draft_payload)
                    except json.JSONDecodeError:
                        draft = extract_email_draft(stored_text)
                if draft:
                    content_json["email_draft"] = draft

            update_message(
                assistant_message,
                content_text=stored_text,
                content_json=content_json,
                status="completed",
                model_used="x-ai/grok-4.1-fast",
            )
            yield "data: [DONE]\n\n"
        except Exception as exc:
            update_message(
                assistant_message,
                content_text=raw_answer.strip(),
                status="failed",
                model_used="x-ai/grok-4.1-fast",
            )
            error_msg = f"[ERROR] {str(exc)}"
            for word in error_msg.split(" "):
                yield f"data: {word.replace(chr(10), '\\n')} \n\n"
                time.sleep(0.02)
            yield "data: [DONE]\n\n"

    response = StreamingHttpResponse(stream_response(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    response['Access-Control-Allow-Origin'] = '*'
    return response


@csrf_exempt
@require_POST
def comsats_reset(request):
    try:
        thread_id = request.GET.get("chat_id", "").strip() or request.POST.get("chat_id", "").strip() or None
        reset_comsats_chat(thread_id=thread_id)
        return JsonResponse({"status": "success", "message": "COMSATS chat reset"})
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


@csrf_exempt
@require_POST
def comsats_send_email(request):
    user = authenticate_header_token(request)
    if not user:
        return JsonResponse({"error": "Authentication required."}, status=401)
    billing_profile = get_user_billing_profile(user, sync_remote=True)
    if not billing_profile or not billing_profile.is_paid:
        return json_pro_required_response("Upgrade to Pro to use the Comsats agent.")

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON payload."}, status=400)

    recipient_email = (payload.get("recipient_email") or "").strip()
    subject = (payload.get("subject") or "").strip()
    body = (payload.get("body") or "").strip()
    message_id = (payload.get("message_id") or "").strip()

    if not recipient_email or not subject or not body:
        return JsonResponse({"error": "recipient_email, subject, and body are required."}, status=400)

    if not is_gmail_connected(user):
        connect_url = build_gmail_oauth_url(user)
        return JsonResponse(
            {
                "error": "Gmail is not connected for this user.",
                "requires_gmail_connect": True,
                "connect_url": connect_url,
            },
            status=409,
        )

    draft_message = None
    if message_id:
        draft_message = Message.objects.filter(
            id=message_id,
            conversation__user=user,
            conversation__status="active",
        ).select_related("conversation", "conversation__agent").first()

    try:
        payload = send_gmail_email(user, recipient_email, subject, body)
        gmail_message_id = payload.get("id", "")
        if draft_message:
            create_email_record(
                conversation=draft_message.conversation,
                message=draft_message,
                user=user,
                agent=draft_message.conversation.agent,
                recipient_email=recipient_email,
                subject=subject,
                body=body,
                gmail_message_id=gmail_message_id,
            )
        return JsonResponse(
            {
                "status": "success",
                "message": f"Email sent to {recipient_email}.",
                "gmail_message_id": gmail_message_id,
            }
        )
    except Exception as exc:
        if draft_message:
            create_email_record(
                conversation=draft_message.conversation,
                message=draft_message,
                user=user,
                agent=draft_message.conversation.agent,
                recipient_email=recipient_email,
                subject=subject,
                body=body,
                status="failed",
                error_message=str(exc),
            )
        return JsonResponse({"error": str(exc)}, status=500)


@csrf_exempt
@require_GET
def gmail_callback(request):
    code = request.GET.get("code", "").strip()
    state = request.GET.get("state", "").strip()
    error = request.GET.get("error", "").strip()

    if error:
        return HttpResponseRedirect(build_gmail_result_redirect(False, f"Google returned: {error}"))

    if not code or not state:
        return HttpResponseRedirect(build_gmail_result_redirect(False, "Missing Gmail callback parameters."))

    try:
        _, credential = handle_gmail_oauth_callback(code, state)
        success_message = f"Gmail connected for {credential.google_email or 'your account'}."
        return HttpResponseRedirect(build_gmail_result_redirect(True, success_message))
    except Exception as exc:
        return HttpResponseRedirect(build_gmail_result_redirect(False, str(exc)))
