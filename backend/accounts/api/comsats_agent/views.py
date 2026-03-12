import time
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from .agent import get_comsats_response, reset_comsats_chat

@csrf_exempt
@require_GET
def comsats_stream(request):
    query = request.GET.get("text", "").strip()
    thread_id = request.GET.get("thread_id", "comsats_agent_chat")

    if not query:
        return JsonResponse({"error": "Query is required"}, status=400)

    def stream_response():
        try:
            response = get_comsats_response(query, thread_id=thread_id)
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
        reset_comsats_chat()
        return JsonResponse({"status": "success", "message": "COMSATS chat reset"})
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)