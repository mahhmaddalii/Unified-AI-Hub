import time
from datetime import datetime

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from accounts.api.access import (
    authenticate_request_user,
    get_user_billing_profile,
    sse_error_response,
    sse_token_limit_response,
)
from accounts.api.persistence import (
    assign_agent_to_conversation,
    create_message,
    get_builtin_agent,
    get_recent_context_messages,
    get_user_conversation,
    update_message,
)
from .agent import get_cricket_response, reset_cricket_chat
from .tools import livescore6_specific_match


def extract_concise_update(full_update):
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
            concise += f" - {status}"
        elif result:
            concise += f" - {result}"
        return concise
    return full_update


def format_initial_update(full_update):
    lines = full_update.split('\n')
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped and not line.startswith('#') and not line.startswith('**Sources:**'):
            new_lines.append('- ' + line)
        else:
            new_lines.append(line)
    return '\n'.join(new_lines)


def is_live_update_request(query: str) -> bool:
    q_lower = (query or "").lower().strip()
    if q_lower in ["stop", "stop updates", "end updates"]:
        return True

    trigger_phrases = [
        "keep sending updates for",
        "keep sending",
        "automatic updates for",
        "every minute updates for",
        "live updates for",
        "send updates for",
    ]
    return any(q_lower.startswith(phrase) for phrase in trigger_phrases)


@csrf_exempt
@require_GET
def cricket_stream(request):
    user = authenticate_request_user(request, allow_query_token=True)
    if not user:
        return sse_error_response("Authentication required. Please sign in again.")
    billing_profile = get_user_billing_profile(user, sync_remote=True)
    if not billing_profile or not billing_profile.is_paid:
        return sse_error_response("Upgrade to Pro to use domain agents.")

    query = request.GET.get("text", "").strip()
    chat_id = request.GET.get("chat_id", "").strip()
    conversation = get_user_conversation(user, chat_id)
    if not conversation:
        return sse_error_response("Conversation not found.")

    builtin_agent = get_builtin_agent("builtin-cricket")
    if builtin_agent:
        assign_agent_to_conversation(conversation, builtin_agent, conversation_type="domain_agent")

    if not query:
        return JsonResponse({"error": "Query is required"}, status=400)
    if not is_live_update_request(query) and billing_profile.token_total_used >= settings.PAID_MONTHLY_TOKEN_QUOTA:
        return sse_token_limit_response("Token limit reached. Please wait until subscription renewal.")

    previous_context = get_recent_context_messages(conversation, limit=10)
    user_message = create_message(conversation, role="user", user=user, content_text=query)

    q_lower = query.lower().strip()
    flag_key = f"cricket_live_update_active_{chat_id}"
    match_key = f"cricket_live_update_match_{chat_id}"
    stop_signal_key = f"cricket_stop_signal_{chat_id}"

    if q_lower in ["stop", "stop updates", "end updates"]:
        cache.set(stop_signal_key, True, timeout=60)
        assistant_message = create_message(
            conversation,
            role="assistant",
            content_text="Stopping live updates...",
            status="streaming",
            message_type="normal",
        )

        def stop_stream():
            text = "Stopping live updates..." if cache.get(flag_key) else "No active live updates to stop."
            if not cache.get(flag_key):
                cache.delete(stop_signal_key)
            update_message(assistant_message, content_text=text, status="completed")
            for word in text.split(" "):
                yield f"data: {word.replace(chr(10), '\\n')} \n\n"
                time.sleep(0.02)
            yield "data: [DONE]\n\n"

        response = StreamingHttpResponse(stop_stream(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        response['Access-Control-Allow-Origin'] = '*'
        return response

    trigger_phrases = [
        "keep sending updates for",
        "keep sending",
        "automatic updates for",
        "every minute updates for",
        "live updates for",
        "send updates for",
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
        if " vs " not in match_part:
            starts_with_trigger = False

    if starts_with_trigger:
        match_query = match_part
        for word in ["please", "now", "live", "updates", "automatically", "minute", "every"]:
            if match_query.endswith(word):
                match_query = match_query[:-len(word)].strip()

        initial_check = livescore6_specific_match(match_query)
        if initial_check.startswith("no matching match found"):
            message_text = (
                f"{match_query} exists but is not currently live. Only live matches can get updates."
                if "not currently live" in initial_check.lower()
                else f"Sorry, no live match found for {match_query} right now."
            )
            assistant_message = create_message(conversation, role="assistant", content_text=message_text, status="completed")

            def error_stream():
                for word in message_text.split(" "):
                    yield f"data: {word.replace(chr(10), '\\n')} \n\n"
                    time.sleep(0.02)
                yield "data: [DONE]\n\n"

            response = StreamingHttpResponse(error_stream(), content_type='text/event-stream')
            response['Cache-Control'] = 'no-cache'
            response['X-Accel-Buffering'] = 'no'
            response['Access-Control-Allow-Origin'] = '*'
            return response

        assistant_message = create_message(
            conversation,
            role="assistant",
            content_text="",
            status="streaming",
            message_type="live_update",
        )

        cache.delete(stop_signal_key)
        cache.set(flag_key, True, timeout=3600)
        cache.set(match_key, match_query, timeout=3600)

        def live_stream():
            accumulated = ""
            try:
                start_text = f"Starting live updates for **{match_query}**. Updates every 10 seconds. Say 'stop' to end."
                accumulated += start_text + "\n\n"
                for word in start_text.split(" "):
                    yield f"data: {word.replace(chr(10), '\\n')} \n\n"
                    time.sleep(0.02)

                initial_with_dashes = format_initial_update(initial_check)
                accumulated += initial_with_dashes + "\n\n"
                for word in initial_with_dashes.split(" "):
                    yield f"data: {word.replace(chr(10), '\\n')} \n\n"
                    time.sleep(0.02)

                while cache.get(flag_key):
                    stopped = False
                    for _ in range(10):
                        if cache.get(stop_signal_key):
                            cache.delete(stop_signal_key)
                            cache.delete(flag_key)
                            cache.delete(match_key)
                            stop_text = "\n\nLive updates stopped."
                            accumulated += stop_text
                            for word in stop_text.split(" "):
                                yield f"data: {word.replace(chr(10), '\\n')} \n\n"
                                time.sleep(0.02)
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
                        end_text = f"\n\n--- Match Ended ({timestamp}) ---\n\nThe match has finished or is no longer live. Live updates stopped."
                        accumulated += end_text
                        for word in end_text.split(" "):
                            yield f"data: {word.replace(chr(10), '\\n')} \n\n"
                            time.sleep(0.02)
                        break

                    concise = extract_concise_update(update)
                    block = f"\n\nLive Update ({timestamp})\n\n{concise}"
                    accumulated += block
                    for word in block.split(" "):
                        yield f"data: {word.replace(chr(10), '\\n')} \n\n"
                        time.sleep(0.02)

                update_message(assistant_message, content_text=accumulated.strip(), status="completed")
            except Exception as exc:
                update_message(assistant_message, content_text=accumulated.strip(), status="failed")
                error_text = f"[ERROR] {str(exc)}"
                for word in error_text.split(" "):
                    yield f"data: {word.replace(chr(10), '\\n')} \n\n"
                    time.sleep(0.02)
            yield "data: [DONE]\n\n"

        response = StreamingHttpResponse(live_stream(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        response['Access-Control-Allow-Origin'] = '*'
        return response

    assistant_message = create_message(
        conversation,
        role="assistant",
        content_text="",
        status="streaming",
        message_type="normal",
        model_used="x-ai/grok-4.1-fast",
    )

    def regular_stream():
        accumulated = ""
        try:
            response_text = get_cricket_response(query, thread_id=chat_id, history_messages=previous_context, user=user, track_tokens=True)
            if isinstance(response_text, tuple):
                response_text, _ = response_text
            accumulated = response_text
            for word in response_text.split(" "):
                yield f"data: {word.replace(chr(10), '\\n')} \n\n"
                time.sleep(0.02)
            update_message(assistant_message, content_text=accumulated.strip(), status="completed")
        except Exception as exc:
            update_message(assistant_message, content_text=accumulated.strip(), status="failed")
            error_text = f"[ERROR] {str(exc)}"
            for word in error_text.split(" "):
                yield f"data: {word.replace(chr(10), '\\n')} \n\n"
                time.sleep(0.02)
        yield "data: [DONE]\n\n"

    response = StreamingHttpResponse(regular_stream(), content_type='text/event-stream')
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
