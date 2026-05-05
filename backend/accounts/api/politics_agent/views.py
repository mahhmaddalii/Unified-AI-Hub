import time

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
from .agent import get_politics_response, reset_politics_chat
from .tools import classify_topic_relevance, real_time_news_cycle, real_time_news_first, real_time_news_search

UPDATE_INTERVAL = 10


def _stream_text(text: str):
    escaped = text.replace('\n', '\\n')
    for word in escaped.split(' '):
        yield f"data: {word} \n\n"
        time.sleep(0.02)


def is_live_news_request(query: str) -> bool:
    q_lower = (query or "").lower().strip()
    if q_lower in ["stop", "stop news", "stop updates", "end news", "live politics news"]:
        return True

    trigger_phrases = [
        "automatic news updates for",
        "keep sending news for",
        "latest news updates for",
        "news every few minutes for",
        "live news updates for",
        "live politics news for",
        "live updates for",
        "live news for",
        "live updates of",
        "live news of",
        "live news updates of",
        "live updates on",
        "live news on",
        "live news updates on",
        "live updates about",
        "live news about",
        "starting live updates",
        "start live updates",
        "start live news",
    ]
    return any(q_lower.startswith(phrase) for phrase in trigger_phrases)


@csrf_exempt
@require_GET
def politics_stream(request):
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

    builtin_agent = get_builtin_agent("builtin-politics")
    if builtin_agent:
        assign_agent_to_conversation(conversation, builtin_agent, conversation_type="domain_agent")

    if not query:
        return JsonResponse({"error": "Query is required"}, status=400)
    if not is_live_news_request(query) and billing_profile.token_total_used >= settings.PAID_MONTHLY_TOKEN_QUOTA:
        return sse_token_limit_response("Token limit reached. Please wait until subscription renewal.")

    previous_context = get_recent_context_messages(conversation, limit=10)
    create_message(conversation, role="user", user=user, content_text=query)

    flag_key = f"politics_news_active_{chat_id}"
    topic_key = f"politics_news_topic_{chat_id}"
    signal_key = f"politics_news_signal_{chat_id}"
    counter_key = f"politics_news_counter_{chat_id}"

    if query.lower() in ["stop", "stop news", "stop updates", "end news"]:
        cache.set(signal_key, True, timeout=60)
        assistant_message = create_message(conversation, role="assistant", content_text="Stopping live updates...", status="streaming")

        def stop_stream():
            text = "Stopping live updates..." if cache.get(flag_key) else "No active news updates to stop."
            if not cache.get(flag_key):
                cache.delete(signal_key)
            update_message(assistant_message, content_text=text, status="completed")
            yield from _stream_text(text)
            yield "data: [DONE]\n\n"

        response = StreamingHttpResponse(stop_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        response["Access-Control-Allow-Origin"] = "*"
        return response

    q_lower = query.lower()
    special_phrase = "live politics news"
    trigger_phrases = [
        "automatic news updates for",
        "keep sending news for",
        "latest news updates for",
        "news every few minutes for",
        "live news updates for",
        "live politics news for",
        "live updates for",
        "live news for",
        "live updates of",
        "live news of",
        "live news updates of",
        "live updates on",
        "live news on",
        "live news updates on",
        "live updates about",
        "live news about",
        "starting live updates",
        "start live updates",
        "start live news",
    ]

    topic = None
    if q_lower == special_phrase or (
        q_lower.startswith(special_phrase)
        and not q_lower.startswith("live politics news for")
        and not q_lower.startswith("live politics news of")
        and not q_lower.startswith("live politics news on")
    ):
        topic = "politics"
    else:
        for phrase in trigger_phrases:
            if q_lower.startswith(phrase):
                raw = q_lower[len(phrase):].strip()
                for filler in ["please", "now", "updates", "news", "automatically", "every", "minute", "minutes"]:
                    if raw.endswith(filler):
                        raw = raw[:-len(filler)].strip()
                topic = raw if raw else "politics"
                break

    if topic is not None:
        relevance = classify_topic_relevance(topic)
        if not relevance["relevant"]:
            assistant_message = create_message(conversation, role="assistant", content_text=relevance["reason"], status="completed")

            def reject_stream():
                yield from _stream_text(relevance["reason"])
                yield "data: [DONE]\n\n"

            response = StreamingHttpResponse(reject_stream(), content_type="text/event-stream")
            response["Cache-Control"] = "no-cache"
            response["X-Accel-Buffering"] = "no"
            response["Access-Control-Allow-Origin"] = "*"
            return response

        refined_topic = relevance["refined_query"]
        news_check = real_time_news_search(refined_topic, limit=2)
        if "No recent political news found" in news_check or news_check.startswith("Failed"):
            text = (
                f"Sorry, I couldn't find recent political news for **{topic}**. "
                f"Please try a more specific topic."
            )
            assistant_message = create_message(conversation, role="assistant", content_text=text, status="completed")

            def no_news_stream():
                yield from _stream_text(text)
                yield "data: [DONE]\n\n"

            response = StreamingHttpResponse(no_news_stream(), content_type="text/event-stream")
            response["Cache-Control"] = "no-cache"
            response["X-Accel-Buffering"] = "no"
            response["Access-Control-Allow-Origin"] = "*"
            return response

        assistant_message = create_message(
            conversation,
            role="assistant",
            content_text="",
            status="streaming",
            message_type="live_update",
        )
        cache.delete(signal_key)
        cache.set(flag_key, True, timeout=3600)
        cache.set(topic_key, refined_topic, timeout=3600)
        cache.set(counter_key, 2, timeout=3600)

        def live_stream():
            accumulated = ""
            try:
                start_msg = (
                    f"Starting live politics news for **{topic.title()}**.\n"
                    f"Updates every {UPDATE_INTERVAL} seconds. Press Stop to end."
                )
                accumulated += start_msg + "\n\n"
                yield from _stream_text(start_msg)

                first_block = real_time_news_first(refined_topic)
                accumulated += first_block + "\n\n"
                yield from _stream_text(first_block)

                while cache.get(flag_key):
                    stopped = False
                    for _ in range(UPDATE_INTERVAL):
                        if cache.get(signal_key):
                            cache.delete(signal_key)
                            cache.delete(flag_key)
                            cache.delete(topic_key)
                            cache.delete(counter_key)
                            stop_text = "\n\nLive updates stopped. Ask me anything else!"
                            accumulated += stop_text
                            yield from _stream_text(stop_text)
                            stopped = True
                            break
                        time.sleep(1)
                    if stopped:
                        break

                    counter = cache.get(counter_key, 2)
                    payload = real_time_news_cycle(refined_topic, counter)
                    cache.set(counter_key, counter + 1, timeout=3600)
                    accumulated += payload + "\n\n"
                    yield from _stream_text(payload)

                update_message(assistant_message, content_text=accumulated.strip(), status="completed")
            except Exception as exc:
                update_message(assistant_message, content_text=accumulated.strip(), status="failed")
                yield from _stream_text(f"[ERROR] {str(exc)}")
            yield "data: [DONE]\n\n"

        response = StreamingHttpResponse(live_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        response["Access-Control-Allow-Origin"] = "*"
        return response

    assistant_message = create_message(
        conversation,
        role="assistant",
        content_text="",
        status="streaming",
        model_used="x-ai/grok-4.1-fast",
    )

    def regular_stream():
        accumulated = ""
        try:
            response_text = get_politics_response(query, thread_id=chat_id, history_messages=previous_context, user=user, track_tokens=True)
            if isinstance(response_text, tuple):
                response_text, _ = response_text
            accumulated = response_text
            yield from _stream_text(response_text)
            update_message(assistant_message, content_text=accumulated.strip(), status="completed", model_used="x-ai/grok-4.1-fast")
        except Exception as exc:
            update_message(assistant_message, content_text=accumulated.strip(), status="failed", model_used="x-ai/grok-4.1-fast")
            yield from _stream_text(f"[ERROR] {str(exc)}")
        yield "data: [DONE]\n\n"

    response = StreamingHttpResponse(regular_stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    response["Access-Control-Allow-Origin"] = "*"
    return response


@csrf_exempt
@require_POST
def politics_reset(request):
    try:
        reset_politics_chat()
        return JsonResponse({"status": "success", "message": "Politics chat reset"})
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)
