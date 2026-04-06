import json
import secrets
import string
import time
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from accounts.api.chat.gemini import chat_histories
from .custom_agent_chat import (
    agent_chat_map,
    get_agent_id_from_chat_id,
    get_custom_agent_response,
    get_or_create_custom_agent_chat,
)


def _generate_custom_agent_id():
    random_part = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(9))
    return f"agent-{int(time.time() * 1000)}-{random_part}"


@csrf_exempt
def create_custom_agent_id_view(request):
    if request.method != 'POST':
        return JsonResponse({"error": "POST required"}, status=405)

    return JsonResponse({"agent_id": _generate_custom_agent_id()})


@csrf_exempt
def get_or_create_custom_agent_chat_view(request):
    if request.method != 'POST':
        return JsonResponse({"error": "POST required"}, status=405)

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    agent_id = (payload.get("agent_id") or "").strip()
    if not agent_id:
        return JsonResponse({"error": "agent_id is required"}, status=400)

    chat_id, is_new = get_or_create_custom_agent_chat(agent_id)
    return JsonResponse({"chat_id": chat_id, "is_new": is_new})

# -------------------- Custom Agent Chat View --------------------
@csrf_exempt
def custom_agent_chat_view(request):
    if request.method != 'GET':
        return JsonResponse({"error": "GET required for streaming"}, status=405)
    
    agent_id = request.GET.get("agent_id", "").strip()
    chat_id = request.GET.get("chat_id", "").strip()
    purpose = request.GET.get("purpose", "general").strip()
    model_selection = request.GET.get("model", "gemini-flashlite").strip()
    is_auto_selected = request.GET.get("is_auto", "true").lower() == "true"
    custom_prompt = request.GET.get("system_prompt", "").strip()
    query = request.GET.get("text", "").strip()
    
    if not query:
        return JsonResponse({"error": "Message is required"}, status=400)

    if chat_id:
        if chat_id not in chat_histories:
            return JsonResponse({"error": "Invalid chat_id"}, status=400)
        resolved_agent_id = agent_id or get_agent_id_from_chat_id(chat_id)
        if not resolved_agent_id:
            return JsonResponse({"error": "No agent found for chat_id"}, status=400)
    elif agent_id:
        chat_id = agent_chat_map.get(agent_id)
        if not chat_id:
            return JsonResponse({"error": "Call get-or-create-chat first"}, status=400)
        resolved_agent_id = agent_id
    else:
        return JsonResponse({"error": "chat_id or agent_id is required"}, status=400)
    
    # No automatic RAG here — agent decides via tool
    
    def event_stream():
        try:
            for chunk in get_custom_agent_response(
                user_input=query,  # raw query
                agent_id=resolved_agent_id,
                purpose=purpose,
                model_selection=model_selection,
                is_auto_selected=is_auto_selected,
                custom_prompt=custom_prompt,
                chat_id=chat_id
            ):
                if chunk:
                    escaped_chunk = chunk.replace('\n', '\\n')
                    yield f"data: {escaped_chunk}\n\n"
                    import time
                    time.sleep(0.02)
            
            yield "data: [DONE]\n\n"
            
        except Exception as e:
            print(f"❌ Custom agent chat error: {str(e)}")
            yield f"data: [ERROR]{str(e)}\n\n"
            yield "data: [DONE]\n\n"
    
    response = StreamingHttpResponse(
        event_stream(),
        content_type='text/event-stream'
    )
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    response['Access-Control-Allow-Origin'] = '*'
    return response

# -------------------- Upload Document (reuse from chat) --------------------
@csrf_exempt
def custom_agent_upload_document(request):
    """
    Use the SAME upload endpoint as regular chat
    """
    from accounts.api.chat.views import upload_document
    return upload_document(request)
