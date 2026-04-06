# backend/accounts/api/cricket_agent/views.py
import time
import re
from datetime import datetime
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from django.core.cache import cache

from accounts.api.domain_agent_sessions import get_or_create_domain_thread_id
from .agent import get_cricket_response, reset_cricket_chat
from .tools import livescore6_specific_match

def extract_concise_update(full_update):
    """Extract a concise one‑line update from the full match info."""
    lines = full_update.split('\n')
    score_lines = []
    status = ""
    result = ""
    for line in lines:
        if line.startswith('**') and ':**' in line and 'vs' not in line:
            clean = line.replace('**', '').replace(':**', ':').strip()
            score_lines.append(clean)
        elif line.startswith('**Status:**'):
            status = line.replace('**Status:**', '').strip().strip('*')
        elif line.startswith('**Result:**'):
            result = line.replace('**Result:**', '').strip()
    if len(score_lines) >= 2:
        concise = f"{score_lines[0]} vs {score_lines[1]}"
        if status:
            concise += f" – {status}"
        elif result:
            concise += f" – {result}"
        return concise
    return full_update

def format_initial_update(full_update):
    """Add Markdown list dashes to the body lines so each appears on a new line with a bullet."""
    lines = full_update.split('\n')
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped and not line.startswith('#') and not line.startswith('**Sources:**'):
            new_lines.append('- ' + line)
        else:
            new_lines.append(line)
    return '\n'.join(new_lines)

@csrf_exempt
@require_GET
def cricket_stream(request):
    query = request.GET.get("text", "").strip()
    chat_id = request.GET.get("chat_id", "").strip()
    thread_id = get_or_create_domain_thread_id(
        "cricket",
        chat_id=chat_id or None
    )

    if not query:
        return JsonResponse({"error": "Query is required"}, status=400)
    
    print(f"🏏 Request: {query[:50]}... (chat: {chat_id or 'none'}, thread: {thread_id})")
    
    def stream_response():
        try:
            # ─── STOP COMMAND HANDLING ───
            if query.lower() in ["stop", "stop updates", "end updates"]:
                cache_key_flag = f"cricket_live_update_active_{thread_id}"
                cache_key_match = f"cricket_live_update_match_{thread_id}"
                cache_key_signal = f"cricket_stop_signal_{thread_id}"
                
                cache.set(cache_key_signal, True, timeout=60)
                
                if cache.get(cache_key_flag):
                    cache.delete(cache_key_flag)
                    cache.delete(cache_key_match)
                    print(f"Live updates STOPPED for {thread_id} - flags deleted")
                else:
                    stop_msg = "No active live updates to stop."
                
                words = stop_msg.split(" ")
                for word in words:
                    escaped_chunk = word.replace('\n', '\\n')
                    yield f"data: {escaped_chunk} \n\n"
                    time.sleep(0.02)
                
                yield "data: [DONE]\n\n"
                return
            
            # ─── LIVE UPDATES ALREADY ACTIVE ───
            flag_key = f"cricket_live_update_active_{thread_id}"
            match_key = f"cricket_live_update_match_{thread_id}"
            stop_signal_key = f"cricket_stop_signal_{thread_id}"
            
            if cache.get(flag_key):
                match_query = cache.get(match_key)
                update_interval = 10  # seconds between updates
                
                print(f"Entering live update loop for {thread_id} with match: {match_query}")
                
                cache.delete(stop_signal_key)
                
                # Fetch initial update
                update = livescore6_specific_match(match_query)
                timestamp = datetime.now().strftime('%I:%M %p')
                
                if update.startswith("no matching match found") or "not currently live" in update.lower():
                    cache.delete(flag_key)
                    cache.delete(match_key)
                    end_msg = f"Sorry, {match_query} is no longer live. Live updates stopped."
                    words = end_msg.split(" ")
                    for word in words:
                        escaped_chunk = word.replace('\n', '\\n')
                        yield f"data: {escaped_chunk} \n\n"
                        time.sleep(0.02)
                    yield "data: [DONE]\n\n"
                    return
                
                # Send the initial update with Markdown list dashes
                initial_with_dashes = format_initial_update(update)
                full_update = f"\n\n{initial_with_dashes}\n\n"
                words = full_update.split(" ")
                for word in words:
                    escaped_chunk = word.replace('\n', '\\n')
                    yield f"data: {escaped_chunk} \n\n"
                    time.sleep(0.02)
                
                # Subsequent updates – concise version
                while cache.get(flag_key):
                    stopped = False
                    for i in range(update_interval):
                        if cache.get(stop_signal_key):
                            print(f"Stop signal DETECTED — exiting live loop for {thread_id}")
                            cache.delete(stop_signal_key)
                            cache.delete(flag_key)
                            cache.delete(match_key)
                            
                            end_msg = "\n\n🛑 Live updates stopped."
                            words = end_msg.split(" ")
                            for word in words:
                                escaped_chunk = word.replace('\n', '\\n')
                                yield f"data: {escaped_chunk} \n\n"
                                time.sleep(0.02)
                            stopped = True
                            break
                        
                        if not cache.get(flag_key):
                            print(f"Flag deleted during wait — exiting live loop for {thread_id}")
                            stopped = True
                            break
                        
                        time.sleep(1)
                    
                    if stopped:
                        break
                    
                    update = livescore6_specific_match(match_query)
                    timestamp = datetime.now().strftime('%I:%M %p')
                    
                    if update.startswith("no matching match found") or "not currently live" in update.lower():
                        cache.delete(flag_key)
                        cache.delete(match_key)
                        end_msg = f"\n\n--- Match Ended ({timestamp}) ---\n\nThe match has finished or is no longer live. Live updates stopped."
                        words = end_msg.split(" ")
                        for word in words:
                            escaped_chunk = word.replace('\n', '\\n')
                            yield f"data: {escaped_chunk} \n\n"
                            time.sleep(0.02)
                        break
                    
                    concise = extract_concise_update(update)
                    separator = f"\n\n🔴 Live Update ({timestamp})\n\n"
                    full_update = separator + concise
                    words = full_update.split(" ")
                    for word in words:
                        if cache.get(stop_signal_key) or not cache.get(flag_key):
                            break
                        escaped_chunk = word.replace('\n', '\\n')
                        yield f"data: {escaped_chunk} \n\n"
                        time.sleep(0.02)
                
                print(f"Stream ending normally for {thread_id}")
                yield "data: [DONE]\n\n"
                return
            
            # ─── TRIGGER PHRASE DETECTION & START ───
            q_lower = query.lower()
            
            trigger_phrases = [
                "keep sending updates for",
                "keep sending",
                "automatic updates for",
                "every minute updates for",
                "live updates for",
                "send updates for"
            ]
            
            starts_with_trigger = False
            matched_phrase = ""
            for phrase in trigger_phrases:
                if q_lower.startswith(phrase):
                    starts_with_trigger = True
                    matched_phrase = phrase
                    break
            
            if starts_with_trigger:
                match_part = q_lower[len(matched_phrase):].strip()
                
                if " vs " in match_part:
                    match_query = match_part
                    
                    for word in ["please", "now", "live", "updates", "automatically", "minute", "every"]:
                        if match_query.endswith(word):
                            match_query = match_query[:-len(word)].strip()
                    
                    print(f"Attempting to start live updates for: {match_query}")
                    
                    match_check = livescore6_specific_match(match_query)
                    
                    if match_check.startswith("no matching match found"):
                        if "not currently live" in match_check.lower():
                            error_msg = f"{match_query} exists but is not currently live. Only live matches can get updates."
                        else:
                            error_msg = f"Sorry, no live match found for {match_query} right now."
                        
                        words = error_msg.split(" ")
                        for word in words:
                            escaped_chunk = word.replace('\n', '\\n')
                            yield f"data: {escaped_chunk} \n\n"
                            time.sleep(0.02)
                        yield "data: [DONE]\n\n"
                        return
                    elif match_check.startswith("API error") or match_check.startswith("Error"):
                        error_msg = f"Sorry, couldn't check if {match_query} is live. Please try again."
                        words = error_msg.split(" ")
                        for word in words:
                            escaped_chunk = word.replace('\n', '\\n')
                            yield f"data: {escaped_chunk} \n\n"
                            time.sleep(0.02)
                        yield "data: [DONE]\n\n"
                        return
                    else:
                        cache.delete(f"cricket_stop_signal_{thread_id}")
                        
                        cache.set(f"cricket_live_update_active_{thread_id}", True, timeout=3600)
                        cache.set(f"cricket_live_update_match_{thread_id}", match_query, timeout=3600)
                        
                        response = f"Starting live updates for **{match_query}**. Updates every 10 seconds. Say 'stop' to end."
                        words = response.split(" ")
                        for word in words:
                            escaped_chunk = word.replace('\n', '\\n')
                            yield f"data: {escaped_chunk} \n\n"
                            time.sleep(0.02)
                        
                        # First update – with Markdown list dashes
                        initial_with_dashes = format_initial_update(match_check)
                        full_update = f"\n\n{initial_with_dashes}\n\n"
                        words = full_update.split(" ")
                        for word in words:
                            escaped_chunk = word.replace('\n', '\\n')
                            yield f"data: {escaped_chunk} \n\n"
                            time.sleep(0.02)
                        
                        update_interval = 10
                        stop_signal_key = f"cricket_stop_signal_{thread_id}"
                        active_key = f"cricket_live_update_active_{thread_id}"
                        match_cache_key = f"cricket_live_update_match_{thread_id}"
                        
                        # Subsequent updates – concise
                        while cache.get(active_key):
                            stopped = False
                            for i in range(update_interval):
                                if cache.get(stop_signal_key):
                                    print(f"Stop signal DETECTED — exiting live loop for {thread_id}")
                                    cache.delete(stop_signal_key)
                                    cache.delete(active_key)
                                    cache.delete(match_cache_key)
                                    
                                    end_msg = "\n\n🛑 Live updates stopped."
                                    words = end_msg.split(" ")
                                    for word in words:
                                        escaped_chunk = word.replace('\n', '\\n')
                                        yield f"data: {escaped_chunk} \n\n"
                                        time.sleep(0.02)
                                    stopped = True
                                    break
                                
                                if not cache.get(active_key):
                                    stopped = True
                                    break
                                time.sleep(1)
                            
                            if stopped:
                                break
                            
                            update = livescore6_specific_match(match_query)
                            timestamp = datetime.now().strftime('%I:%M %p')
                            
                            if update.startswith("no matching match found") or "not currently live" in update.lower():
                                cache.delete(active_key)
                                cache.delete(match_cache_key)
                                end_msg = f"\n\n--- Match Ended ({timestamp}) ---\n\nThe match has finished or is no longer live. Live updates stopped."
                                words = end_msg.split(" ")
                                for word in words:
                                    escaped_chunk = word.replace('\n', '\\n')
                                    yield f"data: {escaped_chunk} \n\n"
                                    time.sleep(0.02)
                                break
                            
                            concise = extract_concise_update(update)
                            separator = f"\n\n🔴 Live Update ({timestamp})\n\n"
                            full_update = separator + concise
                            words = full_update.split(" ")
                            for word in words:
                                if cache.get(stop_signal_key) or not cache.get(active_key):
                                    break
                                escaped_chunk = word.replace('\n', '\\n')
                                yield f"data: {escaped_chunk} \n\n"
                                time.sleep(0.02)
                        
                        yield "data: [DONE]\n\n"
                        return
                else:
                    print(f"Trigger phrase found but no 'vs' pattern: {match_part}")
                    # Fall through to regular query
            
            # ─── REGULAR QUERY ───
            response = get_cricket_response(query, thread_id=thread_id)
            
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
def cricket_reset(request):
    try:
        reset_cricket_chat()
        return JsonResponse({"status": "success", "message": "Cricket chat reset"})
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)
