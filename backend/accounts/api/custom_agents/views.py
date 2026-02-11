# backend/agents/api/custom_agents/views.py
import re
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from accounts.api.chat.documents import load_vectorstore
from .custom_agent_chat import get_custom_agent_response

# -------------------- Custom Agent Chat View --------------------
@csrf_exempt
def custom_agent_chat_view(request):
    if request.method != 'GET':
        return JsonResponse({"error": "GET required for streaming"}, status=405)
    
    agent_id = request.GET.get("agent_id", "").strip()
    purpose = request.GET.get("purpose", "general").strip()
    model_selection = request.GET.get("model", "gemini-flashlite").strip()
    is_auto_selected = request.GET.get("is_auto", "true").lower() == "true"
    custom_prompt = request.GET.get("system_prompt", "").strip()
    query = request.GET.get("text", "").strip()
    
    if not agent_id or not query:
        return JsonResponse({"error": "Agent ID and message are required"}, status=400)
    
    # No automatic RAG here — agent decides via tool
    
    def event_stream():
        try:
            for chunk in get_custom_agent_response(
                user_input=query,  # raw query
                agent_id=agent_id,
                purpose=purpose,
                model_selection=model_selection,
                is_auto_selected=is_auto_selected,
                custom_prompt=custom_prompt
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