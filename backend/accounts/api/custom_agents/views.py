import json

from django.conf import settings
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt

from accounts.api.access import (
    authenticate_request_user,
    get_user_billing_profile,
    json_auth_required_response,
    json_pro_required_response,
    json_token_limit_response,
    sse_error_response,
    sse_token_limit_response,
)
from accounts.api.persistence import (
    archive_custom_agent,
    attach_pending_assets_to_message,
    build_custom_agent_id,
    create_custom_agent,
    create_message,
    get_or_create_custom_agent_conversation,
    get_recent_context_messages,
    get_user_conversation,
    get_user_custom_agent,
    serialize_agent,
    update_custom_agent,
    update_message,
)
from .custom_agent_chat import get_custom_agent_response


def _has_paid_custom_agent_access(user):
    billing_profile = get_user_billing_profile(user, sync_remote=True)
    if not billing_profile or not billing_profile.is_paid:
        return None, json_pro_required_response("Upgrade to Pro to use custom agents.")
    if billing_profile.token_total_used >= settings.PAID_MONTHLY_TOKEN_QUOTA:
        return None, json_token_limit_response("Token limit reached. Please wait until subscription renewal.")
    return billing_profile, None


@csrf_exempt
def custom_agents_collection_view(request):
    user = authenticate_request_user(request)
    if not user:
        return json_auth_required_response()

    if request.method == "GET":
        from accounts.api.persistence import get_custom_agents_for_user

        agents = [serialize_agent(agent) for agent in get_custom_agents_for_user(user)]
        return JsonResponse({"agents": agents})

    if request.method != "POST":
        return JsonResponse({"error": "GET or POST required"}, status=405)

    _, error_response = _has_paid_custom_agent_access(user)
    if error_response:
        return error_response

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    name = (payload.get("name") or "").strip()
    if not name:
        return JsonResponse({"error": "name is required"}, status=400)

    agent = create_custom_agent(
        user,
        name=name,
        purpose=(payload.get("purpose") or "general").strip() or "general",
        model=(payload.get("model") or "gemini-flashlite").strip() or "gemini-flashlite",
        custom_prompt=(payload.get("customPrompt") or "").strip(),
        is_auto_selected=bool(payload.get("isAutoSelected", True)),
        description=(payload.get("description") or "").strip(),
    )
    return JsonResponse({"agent": serialize_agent(agent)}, status=201)


@csrf_exempt
def custom_agent_detail_view(request, agent_id):
    user = authenticate_request_user(request)
    if not user:
        return json_auth_required_response()

    agent = get_user_custom_agent(user, agent_id)
    if not agent:
        return JsonResponse({"error": "Custom agent not found."}, status=404)

    if request.method == "PATCH":
        if not agent.is_editable:
            return JsonResponse({"error": "This shared agent cannot be edited."}, status=403)
        _, error_response = _has_paid_custom_agent_access(user)
        if error_response:
            return error_response

        try:
            payload = json.loads(request.body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON body"}, status=400)

        new_status = (payload.get("status") or "").strip().lower()
        if new_status:
            if new_status not in {"active", "inactive"}:
                return JsonResponse({"error": "Invalid status."}, status=400)
            agent.status = new_status
            agent.save(update_fields=["status", "updated_at"])
            return JsonResponse({"agent": serialize_agent(agent)})

        name = (payload.get("name") or agent.name).strip()
        agent = update_custom_agent(
            agent,
            name=name,
            model=(payload.get("model") or agent.model_preference).strip(),
            custom_prompt=(payload.get("customPrompt") or "").strip(),
            is_auto_selected=bool(payload.get("isAutoSelected", agent.is_auto_selected)),
            description=(payload.get("description") or agent.description).strip(),
        )
        return JsonResponse({"agent": serialize_agent(agent)})

    if request.method == "DELETE":
        archive_custom_agent(agent)
        return JsonResponse({"status": "success"})

    return JsonResponse({"error": "PATCH or DELETE required"}, status=405)


@csrf_exempt
def create_custom_agent_id_view(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    user = authenticate_request_user(request)
    if not user:
        return json_auth_required_response()
    _, error_response = _has_paid_custom_agent_access(user)
    if error_response:
        return error_response

    return JsonResponse({"agent_id": build_custom_agent_id()})


@csrf_exempt
def get_or_create_custom_agent_chat_view(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    user = authenticate_request_user(request)
    if not user:
        return json_auth_required_response()
    _, error_response = _has_paid_custom_agent_access(user)
    if error_response:
        return error_response

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    agent_id = (payload.get("agent_id") or "").strip()
    if not agent_id:
        return JsonResponse({"error": "agent_id is required"}, status=400)

    agent = get_user_custom_agent(user, agent_id)
    if not agent:
        return JsonResponse({"error": "Custom agent not found."}, status=404)

    conversation, is_new = get_or_create_custom_agent_conversation(user, agent)
    return JsonResponse({"chat_id": str(conversation.id), "is_new": is_new})


@csrf_exempt
def custom_agent_chat_view(request):
    if request.method != "GET":
        return JsonResponse({"error": "GET required for streaming"}, status=405)

    user = authenticate_request_user(request, allow_query_token=True)
    if not user:
        return sse_error_response("Authentication required. Please sign in again.")

    billing_profile = get_user_billing_profile(user, sync_remote=True)
    if not billing_profile or not billing_profile.is_paid:
        return sse_error_response("Upgrade to Pro to use custom agents.")
    if billing_profile.token_total_used >= settings.PAID_MONTHLY_TOKEN_QUOTA:
        return sse_token_limit_response("Token limit reached. Please wait until subscription renewal.")

    agent_id = request.GET.get("agent_id", "").strip()
    chat_id = request.GET.get("chat_id", "").strip()
    purpose = request.GET.get("purpose", "general").strip()
    model_selection = request.GET.get("model", "gemini-flashlite").strip()
    is_auto_selected = request.GET.get("is_auto", "true").lower() == "true"
    custom_prompt = request.GET.get("system_prompt", "").strip()
    query = request.GET.get("text", "").strip()

    if not query:
        return JsonResponse({"error": "Message is required"}, status=400)

    conversation = get_user_conversation(user, chat_id)
    if not conversation:
        return sse_error_response("Conversation not found.")

    agent = get_user_custom_agent(user, agent_id)
    if not agent:
        return sse_error_response("Custom agent not found.")

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
        model_used=model_selection or agent.model_preference,
    )

    def event_stream():
        accumulated_text = ""
        try:
            for chunk in get_custom_agent_response(
                user_input=query,
                agent_id=agent.id,
                purpose=purpose,
                model_selection=model_selection,
                is_auto_selected=is_auto_selected,
                custom_prompt=custom_prompt,
                history_messages=previous_context,
                user=user,
                track_tokens=True,
            ):
                if chunk:
                    accumulated_text += chunk
                    yield f"data: {chunk.replace(chr(10), '\\n')}\n\n"

            update_message(
                assistant_message,
                content_text=accumulated_text.strip(),
                status="completed",
                model_used=model_selection or agent.model_preference,
            )
        except Exception as exc:
            update_message(
                assistant_message,
                content_text=accumulated_text.strip(),
                status="failed",
                model_used=model_selection or agent.model_preference,
            )
            yield f"data: [ERROR]{str(exc)}\n\n"
        yield "data: [DONE]\n\n"

    response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    response["Access-Control-Allow-Origin"] = "*"
    return response


@csrf_exempt
def custom_agent_upload_document(request):
    from accounts.api.chat.views import upload_document

    return upload_document(request)
