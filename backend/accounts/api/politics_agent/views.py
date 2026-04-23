# backend/accounts/api/politics_agent/views.py
import time
from datetime import datetime
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from django.core.cache import cache

from accounts.api.access import authenticate_request_user, sse_error_response, user_has_pro_access
from accounts.api.domain_agent_sessions import get_or_create_domain_thread_id
from .agent import get_politics_response, reset_politics_chat
from .tools import (
    real_time_news_search,
    real_time_news_first,
    real_time_news_cycle,
    classify_topic_relevance,
)

UPDATE_INTERVAL = 10   # seconds — change to 600 for production


def _stream_text(text: str):
    """
    Split text on spaces and yield each token as an SSE chunk.
    Newlines embedded in a token survive because we escape them as \\n
    before splitting — the frontend un-escapes them when rendering.
    """
    # Escape real newlines so they survive the word-split intact
    escaped = text.replace('\n', '\\n')
    for word in escaped.split(' '):
        yield f"data: {word} \n\n"
        time.sleep(0.02)


@csrf_exempt
@require_GET
def politics_stream(request):
    user = authenticate_request_user(request, allow_query_token=True)
    if not user:
        return sse_error_response("Authentication required. Please sign in again.")
    if not user_has_pro_access(user):
        return sse_error_response("Upgrade to Pro to use domain agents.")

    query = request.GET.get("text", "").strip()
    chat_id = request.GET.get("chat_id", "").strip()
    thread_id = get_or_create_domain_thread_id(
        "politics",
        chat_id=chat_id or None
    )

    if not query:
        return JsonResponse({"error": "Query is required"}, status=400)

    print(f"📰 Politics request: {query[:60]}… (chat: {chat_id or 'none'}, thread: {thread_id})")

    def stream_response():
        try:
            flag_key    = f"politics_news_active_{thread_id}"
            topic_key   = f"politics_news_topic_{thread_id}"
            signal_key  = f"politics_news_signal_{thread_id}"
            counter_key = f"politics_news_counter_{thread_id}"

            # ── STOP COMMAND ──────────────────────────────────────────────────
            if query.lower() in ["stop", "stop news", "stop updates", "end news"]:
                cache.set(signal_key, True, timeout=60)

                if cache.get(flag_key):
                    cache.delete(flag_key)
                    cache.delete(topic_key)
                    cache.delete(counter_key)
                    print(f"Politics news STOPPED for {thread_id}")
                    # Don't yield a message here — the live loop yields it
                    # (mirrors cricket agent pattern to avoid double/disappearing messages)
                else:
                    yield from _stream_text("No active news updates to stop.")

                yield "data: [DONE]\n\n"
                return

            # ── LIVE LOOP ALREADY ACTIVE (re-connection) ──────────────────────
            if cache.get(flag_key):
                topic   = cache.get(topic_key, "politics")
                counter = cache.get(counter_key, 1)
                print(f"Re-entering live news loop for {thread_id} — topic: {topic}")
                cache.delete(signal_key)

                # Immediate update on reconnect
                payload = real_time_news_cycle(topic, counter)
                cache.set(counter_key, counter + 1, timeout=3600)
                yield from _stream_text(payload)

                while cache.get(flag_key):
                    stopped = False
                    for _ in range(UPDATE_INTERVAL):
                        if cache.get(signal_key):
                            cache.delete(signal_key)
                            cache.delete(flag_key)
                            cache.delete(topic_key)
                            cache.delete(counter_key)
                            yield from _stream_text("\n\n🛑 Live updates stopped. Ask me anything else! 📰")
                            stopped = True
                            break
                        if not cache.get(flag_key):
                            stopped = True
                            break
                        time.sleep(1)

                    if stopped:
                        break

                    counter = cache.get(counter_key, 1)
                    payload = real_time_news_cycle(topic, counter)
                    cache.set(counter_key, counter + 1, timeout=3600)

                    for word in payload.replace('\n', '\\n').split(' '):
                        if cache.get(signal_key) or not cache.get(flag_key):
                            break
                        yield f"data: {word} \n\n"
                        time.sleep(0.02)

                print(f"Politics live news loop ended for {thread_id}")
                yield "data: [DONE]\n\n"
                return

            # ── TRIGGER PHRASE DETECTION ──────────────────────────────────────
            q_lower = query.lower()

            SPECIAL_PHRASE = "live politics news"

            trigger_phrases = [
                # "for" variants
                "automatic news updates for",
                "keep sending news for",
                "latest news updates for",
                "news every few minutes for",
                "live news updates for",
                "live politics news for",
                "live updates for",
                "live news for",
                # "of" variants — catches "live updates of X"
                "live updates of",
                "live news of",
                "live news updates of",
                # "on" variants — catches "live updates on X"
                "live updates on",
                "live news on",
                "live news updates on",
                # "about" variants
                "live updates about",
                "live news about",
                # plain starts
                "starting live updates",
                "start live updates",
                "start live news",
            ]

            topic = None

            if q_lower == SPECIAL_PHRASE or (
                q_lower.startswith(SPECIAL_PHRASE)
                and not q_lower.startswith("live politics news for")
                and not q_lower.startswith("live politics news of")
                and not q_lower.startswith("live politics news on")
            ):
                topic = "politics"
            else:
                for phrase in trigger_phrases:
                    if q_lower.startswith(phrase):
                        raw = q_lower[len(phrase):].strip()
                        # Strip trailing filler words
                        for filler in ["please", "now", "updates", "news",
                                       "automatically", "every", "minute", "minutes"]:
                            if raw.endswith(filler):
                                raw = raw[:-len(filler)].strip()
                        # If nothing left after stripping, default to general politics
                        topic = raw if raw else "politics"
                        break

            if topic is not None:
                print(f"📰 Live trigger fired — raw topic: '{topic}'")

                # ── Relevance gate ────────────────────────────────────────────
                check = classify_topic_relevance(topic)
                if not check["relevant"]:
                    print(f"❌ Topic rejected: '{topic}'")
                    yield from _stream_text(check["reason"])
                    yield "data: [DONE]\n\n"
                    return

                # Use the refined query (e.g. "political news world" for vague inputs)
                refined_topic = check["refined_query"]
                print(f"✅ Topic accepted — refined: '{refined_topic}'")

                # ── Pre-flight news check ─────────────────────────────────────
                news_check = real_time_news_search(refined_topic, limit=2)
                if "No recent political news found" in news_check or news_check.startswith("Failed"):
                    yield from _stream_text(
                        f"Sorry, I couldn't find recent political news for **{topic}**. "
                        f"Please try a more specific topic."
                    )
                    yield "data: [DONE]\n\n"
                    return

                # ── Set cache flags ───────────────────────────────────────────
                cache.delete(signal_key)
                cache.set(flag_key,    True,          timeout=3600)
                cache.set(topic_key,   refined_topic, timeout=3600)
                cache.set(counter_key, 2,             timeout=3600)  # first = #1, next = #2

                # ── Intro message ─────────────────────────────────────────────
                topic_display = topic.title()
                start_msg = (
                    f"📡 Starting live politics news for **{topic_display}**.\n"
                    f"Updates every {UPDATE_INTERVAL} seconds · Say **'stop news'** to end."
                )
                yield from _stream_text(start_msg)

                # ── First update (distinct header style) ─────────────────────
                first_block = real_time_news_first(refined_topic)
                yield from _stream_text(first_block)

                # ── Live update loop ──────────────────────────────────────────
                while cache.get(flag_key):
                    stopped = False
                    for _ in range(UPDATE_INTERVAL):
                        if cache.get(signal_key):
                            cache.delete(signal_key)
                            cache.delete(flag_key)
                            cache.delete(topic_key)
                            cache.delete(counter_key)
                            yield from _stream_text("\n\n🛑 Live updates stopped. Ask me anything else! 📰")
                            stopped = True
                            break
                        if not cache.get(flag_key):
                            stopped = True
                            break
                        time.sleep(1)

                    if stopped:
                        break

                    counter = cache.get(counter_key, 2)
                    payload = real_time_news_cycle(refined_topic, counter)
                    cache.set(counter_key, counter + 1, timeout=3600)

                    for word in payload.replace('\n', '\\n').split(' '):
                        if cache.get(signal_key) or not cache.get(flag_key):
                            break
                        yield f"data: {word} \n\n"
                        time.sleep(0.02)

                yield "data: [DONE]\n\n"
                return

            # ── REGULAR QUERY ─────────────────────────────────────────────────
            response = get_politics_response(query, thread_id=thread_id)
            yield from _stream_text(response)
            yield "data: [DONE]\n\n"

        except Exception as e:
            print(f"Politics stream error: {str(e)}")
            yield from _stream_text(f"[ERROR] {str(e)}")
            yield "data: [DONE]\n\n"

    resp = StreamingHttpResponse(stream_response(), content_type="text/event-stream")
    resp["Cache-Control"]            = "no-cache"
    resp["X-Accel-Buffering"]        = "no"
    resp["Access-Control-Allow-Origin"] = "*"
    return resp


@csrf_exempt
@require_POST
def politics_reset(request):
    try:
        reset_politics_chat()
        return JsonResponse({"status": "success", "message": "Politics chat reset"})
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)
