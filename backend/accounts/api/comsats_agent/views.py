import time

from django.http import HttpResponseRedirect, JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from .agent import get_comsats_response, reset_comsats_chat
from .gmail import build_gmail_result_redirect, handle_gmail_oauth_callback


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


@csrf_exempt
@require_GET
def comsats_stream(request):
    query = request.GET.get("text", "").strip()
    thread_id = request.GET.get("chat_id", "").strip() or request.GET.get("thread_id", "comsats_agent_chat")
    user = authenticate_query_token(request)

    if not query:
        return JsonResponse({"error": "Query is required"}, status=400)

    def stream_response():
        try:
            response = get_comsats_response(query, thread_id=thread_id, user=user)
            for word in response.split(" "):
                yield f"data: {word.replace(chr(10), '\\n')} \n\n"
                time.sleep(0.02)
            yield "data: [DONE]\n\n"
        except Exception as e:
            error_msg = f"[ERROR] {str(e)}"
            for word in error_msg.split(" "):
                yield f"data: {word.replace(chr(10), '\\n')} \n\n"
                time.sleep(0.02)
            yield "data: [DONE]\n\n"

    response = StreamingHttpResponse(
        stream_response(),
        content_type='text/event-stream'
    )
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
