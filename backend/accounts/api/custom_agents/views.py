# backend/agents/api/custom_agents/views.py
import re
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from accounts.api.chat.documents import load_vectorstore
from .custom_agent_chat import get_custom_agent_response

# -------------------- Custom Agent Chat View --------------------
@csrf_exempt
def custom_agent_chat_view(request):
    """
    Handle streaming chat for custom agents.
    Similar to chat_view but simpler.
    """
    if request.method != 'GET':
        return JsonResponse({"error": "GET required for streaming"}, status=405)
    
    # Get all parameters from frontend
    agent_id = request.GET.get("agent_id", "").strip()
    purpose = request.GET.get("purpose", "general").strip()
    model_selection = request.GET.get("model", "gemini-flashlite").strip()
    is_auto_selected = request.GET.get("is_auto", "true").lower() == "true"
    custom_prompt = request.GET.get("system_prompt", "").strip()
    query = request.GET.get("text", "").strip()
    
    if not agent_id or not query:
        return JsonResponse({"error": "Agent ID and message are required"}, status=400)
    
    # Load vectorstore for RAG (same as regular chat)
    vectorstore = load_vectorstore()
    doc_context = ""
    
    if vectorstore:
        try:
            results = vectorstore.similarity_search_with_score(query, k=2)
            if results:
                top_doc, top_score = results[0]
                if top_score > 0.66:
                    doc_context = "\n\n".join([
                        doc.page_content for doc, score in results
                    ])
        except Exception as e:
            print(f"RAG error for custom agent: {e}")
    
    # Enrich query with document excerpts (same as regular chat)
    enriched_query = (
        f"Here are some PDF excerpts:\n{doc_context}\n\nUser: {query}"
        if doc_context else query
    )
    
    def event_stream():
        """Stream custom agent responses"""
        try:
            # Get custom agent response
            for chunk in get_custom_agent_response(
                user_input=enriched_query,
                agent_id=agent_id,
                purpose=purpose,
                model_selection=model_selection,
                is_auto_selected=is_auto_selected,
                custom_prompt=custom_prompt
            ):
                # Stream as-is, don't escape newlines
                if chunk:
                    # Replace actual newlines with escaped ones for SSE
                    escaped_chunk = chunk.replace('\n', '\\n')
                    yield f"data: {escaped_chunk}\n\n"
                    import time
                    time.sleep(0.02)  # Slightly faster
            
            yield "data: [DONE]\n\n"
            
        except Exception as e:
            print(f"❌ Custom agent chat error: {str(e)}")
            yield f"data: [ERROR]{str(e)}\n\n"
            yield "data: [DONE]\n\n"
    
    # Create streaming response (same as regular chat)
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