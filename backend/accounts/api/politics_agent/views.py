# backend/accounts/api/politics_agent/views.py
import time
from datetime import datetime
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from django.core.cache import cache

from .agent import get_politics_response, reset_politics_chat
from .tools import real_time_news_search

@csrf_exempt
@require_GET
def politics_stream(request):
    query = request.GET.get("text", "").strip()
    thread_id = request.GET.get("thread_id", "politics_agent_chat")

    if not query:
        return JsonResponse({"error": "Query is required"}, status=400)
    
    print(f"📰 Politics Request: {query[:50]}... (thread: {thread_id})")
    
    def stream_response():
        try:
            # ─── STOP COMMAND ───
            if query.lower() in ["stop", "stop news", "stop updates", "end news"]:
                flag_key = f"politics_news_active_{thread_id}"
                topic_key = f"politics_news_topic_{thread_id}"
                signal_key = f"politics_news_signal_{thread_id}"
                
                cache.set(signal_key, True, timeout=60)
                
                if cache.get(flag_key):
                    cache.delete(flag_key)
                    cache.delete(topic_key)
                    print(f"Politics news STOPPED for {thread_id} - flags deleted")
                
                stop_msg = "🛑 Politics news updates stopped. Ask me anything else! 📰"
                for word in stop_msg.split(" "):
                    yield f"data: {word.replace('\n', '\\n')} \n\n"
                    time.sleep(0.02)
                yield "data: [DONE]\n\n"
                return
            
            # ─── LIVE NEWS ALREADY ACTIVE ───
            flag_key = f"politics_news_active_{thread_id}"
            topic_key = f"politics_news_topic_{thread_id}"
            signal_key = f"politics_news_signal_{thread_id}"
            
            if cache.get(flag_key):
                topic = cache.get(topic_key)
                update_interval = 10  # 10 minutes
                
                print(f"Entering politics news loop for {thread_id} - topic: {topic}")
                
                # Initial update already sent by agent — here we do subsequent
                while cache.get(flag_key):
                    stopped = False
                    for i in range(update_interval):
                        if cache.get(signal_key):
                            print(f"Stop signal DETECTED — exiting politics news loop for {thread_id}")
                            cache.delete(signal_key)
                            cache.delete(flag_key)
                            cache.delete(topic_key)
                            yield "data: \n\n🛑 Politics news updates stopped.\n\n"
                            stopped = True
                            break
                        
                        if not cache.get(flag_key):
                            stopped = True
                            break
                        time.sleep(1)
                    
                    if stopped:
                        break
                    
                    update = real_time_news_search(topic, limit=3)
                    timestamp = datetime.now().strftime('%I:%M %p')
                    separator = f"\n\n--- 🔴 Latest Politics Update ({timestamp}) ---\n\n"
                    yield f"data: {separator.replace('\n', '\\n')}{update.replace('\n', '\\n')}\n\n"
                
                print(f"Politics news loop ended for {thread_id}")
                yield "data: [DONE]\n\n"
                return
            
            # ─── NORMAL QUERY or START LIVE NEWS ───
            response = get_politics_response(query, thread_id=thread_id)
            
            words = response.split(" ")
            for word in words:
                escaped_chunk = word.replace('\n', '\\n')
                yield f"data: {escaped_chunk} \n\n"
                time.sleep(0.02)
            
            yield "data: [DONE]\n\n"
            
        except Exception as e:
            print(f"Stream error: {str(e)}")
            error_msg = f"[ERROR] {str(e)}"
            words = error_msg.split(" ")
            for word in words:
                escaped_chunk = word.replace('\n', '\\n')
                yield f"data: {escaped_chunk} \n\n"
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
def politics_reset(request):
    try:
        reset_politics_chat()
        return JsonResponse({"status": "success", "message": "Politics chat reset"})
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)