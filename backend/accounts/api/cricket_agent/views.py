import time
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .agent import get_cricket_response, reset_cricket_chat

@csrf_exempt
@require_GET
def cricket_stream(request):
    query = request.GET.get("text", "").strip()
    
    if not query:
        return JsonResponse({"error": "Query is required"}, status=400)
    
    print(f"🏏 Cricket request: {query[:50]}...")
    
    def stream_response():
        try:
            response = get_cricket_response(query)
            
            words = response.split(" ")
            for word in words:
                escaped_chunk = word.replace('\n', '\\n')
                yield f"data: {escaped_chunk} \n\n"
                time.sleep(0.02)
            
            yield "data: [DONE]\n\n"
            
        except Exception as e:
            print(f"Stream error: {e}")
            yield "data: [ERROR] Failed to get cricket updates\n\n"
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
def cricket_reset(request):
    try:
        reset_cricket_chat()
        return JsonResponse({"status": "success", "message": "Cricket chat reset"})
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)