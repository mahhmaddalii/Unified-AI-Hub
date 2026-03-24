# backend/accounts/api/politics_agent/tools.py
import re
import requests
import os
import concurrent.futures
from datetime import datetime
from urllib.parse import urlparse

from langchain.tools import Tool
from langchain_community.tools.tavily_search import TavilySearchResults
from django.core.cache import cache

RAPIDAPI_KEY  = os.getenv("RAPIDAPI_KEY")
RAPIDAPI_HOST = "real-time-news-data.p.rapidapi.com"

HEADERS = {
    "X-RapidAPI-Key":  RAPIDAPI_KEY,
    "X-RapidAPI-Host": RAPIDAPI_HOST,
}

tavily_search = TavilySearchResults(
    max_results=5,
    api_key=os.getenv("TAVILY_API_KEY"),
    search_depth="advanced",
    include_answer=True,
)

# ── Topic Relevance Gate ───────────────────────────────────────────────────────

POLITICS_KEYWORDS = {
    "politics", "political", "government", "parliament", "congress", "senate",
    "election", "vote", "voter", "ballot", "campaign", "democracy", "republic",
    "president", "prime minister", "chancellor", "minister", "cabinet",
    "legislation", "law", "bill", "policy", "constitution", "referendum",
    "party", "democrat", "republican", "conservative", "liberal", "socialist",
    "left", "right", "wing", "coalition", "opposition",
    "war", "conflict", "military", "sanctions", "diplomacy", "treaty", "alliance",
    "nato", "un", "united nations", "eu", "european union", "g7", "g20",
    "foreign policy", "invasion", "ceasefire", "peace talks", "summit", "envoy",
    "nuclear", "missile", "arms", "coup", "protest", "revolt", "revolution",
    "economy", "economic", "budget", "inflation", "trade", "tariff", "debt",
    "imf", "world bank", "embargo", "tax", "fiscal", "reform",
    "corruption", "scandal", "investigation", "impeach", "resign",
    "rights", "justice", "court", "supreme court", "judge", "ruling", "verdict",
    "demonstration", "civil", "human rights", "refugee", "migration",
    "climate policy", "energy policy", "healthcare policy", "education policy",
    # Imprisonment / legal / political persecution
    "jail", "prison", "imprisoned", "arrested", "detained", "detention",
    "sentence", "convicted", "acquitted", "bail", "parole", "charges",
    "indicted", "indictment", "prosecution", "defendant", "tribunal",
    "political prisoner", "crackdown", "suppression",
    # Political leaders & figures (common names that are clearly political)
    "imran", "khan", "modi", "biden", "trump", "putin", "zelensky", "zelenskyy",
    "netanyahu", "xi", "erdogan", "macron", "starmer", "sunak", "scholz",
    "khamenei", "khomeini", "mbs", "bin salman", "lula", "bolsonaro",
    "sharif", "shehbaz", "nawaz", "bhutto", "zardari", "musharraf",
    # Countries / regions (political context)
    "pakistan", "india", "us", "usa", "uk", "china", "russia", "ukraine",
    "israel", "iran", "north korea", "saudi", "turkey", "france", "germany",
    "brazil", "mexico", "africa", "middle east", "asia", "europe",
    "afghanistan", "iraq", "syria", "yemen", "ethiopia", "myanmar",
    "taiwan", "kashmir", "gaza", "west bank", "venezuela", "cuba",
    # Institutions
    "presidency", "judiciary", "bureaucracy", "administration", "regime",
    "white house", "kremlin", "nato", "iaea", "icc", "interpol",
    "supreme court", "parliament", "senate", "congress", "assembly",
}

NON_POLITICS_KEYWORDS = {
    "cricket", "football", "soccer", "basketball", "tennis", "golf", "sports",
    "recipe", "cooking", "food", "restaurant", "fashion", "makeup", "beauty",
    "music", "song", "album", "movie", "film", "celebrity", "actor", "singer",
    "fitness", "workout", "gym", "yoga", "meditation",
    "cryptocurrency", "bitcoin", "ethereum", "nft", "gaming", "video game",
    "weather", "forecast", "rain", "temperature",
    "travel", "tourism", "hotel", "flight", "vacation",
}


def classify_topic_relevance(topic: str) -> dict:
    topic_lower = topic.lower().strip()
    words = set(re.findall(r'\b\w+\b', topic_lower))

    non_hits = words & NON_POLITICS_KEYWORDS
    if non_hits and not (words & POLITICS_KEYWORDS):
        rejected = next(iter(non_hits))
        return {
            "relevant": False,
            "reason": (
                f"'{topic}' appears to be about **{rejected}**, which is outside my focus.\n\n"
                f"I cover politics, government, elections, geopolitics, and current affairs.\n\n"
                f"**Try topics like:**\n"
                f"- *live news updates for Pakistan politics*\n"
                f"- *live news updates for US elections*\n"
                f"- *live news updates for Middle East conflict*"
            ),
            "refined_query": topic,
        }

    if words & POLITICS_KEYWORDS:
        return {"relevant": True, "reason": "", "refined_query": topic}

    vague_words = {"news", "latest", "updates", "update", "world", "global",
                   "current", "today", "breaking", "top", "headlines"}
    if words & vague_words:
        return {"relevant": True, "reason": "", "refined_query": f"political news {topic}"}

    return {
        "relevant": False,
        "reason": (
            f"I'm not sure '{topic}' relates to politics or current affairs.\n\n"
            f"I specialise in politics, government, elections, geopolitics, and policy.\n\n"
            f"**Try a specific political topic:**\n"
            f"- *live news updates for Iran nuclear deal*\n"
            f"- *live news updates for UK election*\n"
            f"- *live politics news*"
        ),
        "refined_query": topic,
    }


# ── Formatting helpers ─────────────────────────────────────────────────────────

def _format_date(pub_raw: str) -> str:
    """ISO datetime → 'Mar 12, 2026 · 3:45 PM'"""
    if not pub_raw:
        return ""
    try:
        dt = datetime.fromisoformat(pub_raw.replace("Z", "+00:00"))
        return dt.strftime("%b %d, %Y · %I:%M %p")
    except Exception:
        return ""


def _domain_from_url(url: str) -> str:
    """Extract bare domain: 'https://edition.cnn.com/...' → 'cnn.com'"""
    try:
        host = urlparse(url).netloc.lower()
        # Strip common subdomains
        host = re.sub(r'^(www\d?|edition|mobile|amp|news)\.', '', host)
        return host
    except Exception:
        return ""


def _favicon_html(domain: str) -> str:
    """
    Return an HTML <img> tag for the site favicon, sized to match inline text.
    Requires rehype-raw in ReactMarkdown — renders as a true inline image.
    sz=64 fetches a hi-res icon; width/height CSS pins it to 16px.
    """
    if not domain:
        return ""
    url = (
        f"https://www.google.com/s2/favicons?domain={domain}&sz=64"
    )
    return (
        f'<img src="{url}" '
        f'width="16" height="16" '
        f'style="display:inline;vertical-align:middle;'
        f'margin-right:4px;border-radius:2px;flex-shrink:0" '
        f'alt="" />'
    )


def _clean_snippet(text: str) -> str:
    """Remove boilerplate and normalise whitespace."""
    if not text:
        return ""
    text = re.sub(r'(?i)(read more|click here|subscribe|advertisement|sign up|newsletter)', '', text)
    text = re.sub(r'\s{2,}', ' ', text).strip()
    return text


def _scrape_article_text(url: str, timeout: int = 5) -> str:
    """
    Scrape the article URL and return clean prose sentences.
    Returns empty string on any failure — always safe to call.
    """
    if not url or url == "#":
        return ""

    # Skip known paywalled / JS-rendered domains
    BLOCKED = {
        "bloomberg.com", "nytimes.com", "ft.com", "wsj.com",
        "washingtonpost.com", "economist.com", "thetimes.co.uk",
        "telegraph.co.uk", "theathletic.com",
    }
    try:
        domain = _domain_from_url(url)
        if any(b in domain for b in BLOCKED):
            return ""
    except Exception:
        return ""

    try:
        resp = requests.get(
            url,
            timeout=timeout,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,*/*",
                "Accept-Language": "en-US,en;q=0.9",
            },
            allow_redirects=True,
        )
        if resp.status_code != 200:
            return ""

        html = resp.text

        # ── Step 1: Nuke entire non-content blocks before touching <p> tags ──
        # Remove <style>, <script>, <head>, <nav>, <header>, <footer>,
        # <aside>, <figure>, <noscript>, comments, and inline CSS/JS blobs
        for tag in ["style", "script", "head", "nav", "header", "footer",
                    "aside", "figure", "noscript", "iframe", "svg",
                    "form", "button", "select", "textarea"]:
            html = re.sub(
                rf'<{tag}[\s>].*?</{tag}>',
                ' ', html, flags=re.DOTALL | re.IGNORECASE
            )
        # Remove HTML comments
        html = re.sub(r'<!--.*?-->', ' ', html, flags=re.DOTALL)
        # Remove CSS @font-face / :root / @media blocks that leak into body
        html = re.sub(r'[@:][a-zA-Z\-]+\s*[{(][^}]*[})]', ' ', html)

        # ── Step 2: Extract <p> tag text only ────────────────────────────────
        raw_paras = re.findall(r'<p[^>]*>(.*?)</p>', html, re.DOTALL | re.IGNORECASE)

        def _strip(text: str) -> str:
            text = re.sub(r'<[^>]+>', '', text)          # strip all tags
            text = re.sub(r'&nbsp;', ' ', text)
            text = re.sub(r'&amp;', '&', text)
            text = re.sub(r'&lt;', '<', text)
            text = re.sub(r'&gt;', '>', text)
            text = re.sub(r'&#\d+;', '', text)
            text = re.sub(r'&[a-z]+;', '', text)         # remaining entities
            text = re.sub(r'\s+', ' ', text).strip()
            return text

        clean_paras = [_strip(p) for p in raw_paras]

        # ── Step 3: Filter to real prose sentences ────────────────────────────
        JUNK_PATTERNS = [
            r'^https?://',                              # raw URLs
            r'font-family|font-face|@media|@charset',  # leaked CSS
            r'function\s*\(|var\s+\w+\s*=',           # leaked JS
            r'^\s*{.*}\s*$',                           # JSON blobs
            r'Ad Feedback|Video Ad|play video',        # video widgets
            r'Source:\s*\w+',                          # "Source: CNN" labels
        ]
        JUNK_SUBSTRINGS = {
            "cookie", "subscribe", "sign in", "sign up", "advertisement",
            "javascript", "privacy policy", "terms of service",
            "all rights reserved", "follow us", "share this", "read more",
            "click here", "loading", "newsletter", "getty images",
            "associated press", "© 20", "copyright 20",
            "skip to content", "skip to main", "font-face", ":root{",
        }

        meaningful = []
        for p in clean_paras:
            if len(p) < 45:
                continue
            # Must contain at least one verb-like word to be a real sentence
            if not re.search(r'\b(is|are|was|were|has|have|said|says|will|told|found|shows|warns|calls|urges|strikes|attacks|launched|threatened|agreed|signed|voted|confirmed)\b', p, re.IGNORECASE):
                continue
            p_lower = p.lower()
            if any(b in p_lower for b in JUNK_SUBSTRINGS):
                continue
            if any(re.search(pat, p, re.IGNORECASE) for pat in JUNK_PATTERNS):
                continue
            meaningful.append(p)
            if sum(len(m) for m in meaningful) >= 800:
                break

        return " ".join(meaningful)[:800]

    except Exception:
        return ""


def _enrich_with_scraped_text(articles: list) -> list:
    """
    For each article, attempt to scrape full text in parallel (max 4 threads).
    Stores result in art['scraped_text']. Never blocks more than 6s total.
    """
    def _enrich_one(art: dict) -> dict:
        url = art.get("link") or art.get("url", "")
        scraped = _scrape_article_text(url, timeout=4)
        if scraped:
            art["scraped_text"] = scraped
        return art

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
            futures = {ex.submit(_enrich_one, art): art for art in articles}
            enriched = []
            for fut in concurrent.futures.as_completed(futures, timeout=6):
                try:
                    enriched.append(fut.result())
                except Exception:
                    enriched.append(futures[fut])
        return enriched
    except Exception:
        return articles


def _build_description(art: dict) -> str:
    """
    Build a rich 3-5 sentence description.
    Priority: scraped_text > full_description > full_content > body > snippet > sub_articles > title
    """

    def _sentences(text: str) -> list:
        t = _clean_snippet(text or "")
        if not t:
            return []
        t = re.sub(r'\s*\.\.\.\s*$', '.', t)
        parts = re.split(r'(?<=[.!?])\s+(?=[A-Z"\'(\d])', t)
        return [s.strip() for s in parts if len(s.strip()) > 25]

    candidates = []
    seen_keys: set = set()

    def _add(text: str):
        for sent in _sentences(text):
            key = re.sub(r'\s+', ' ', sent.lower().strip())[:60]
            if key not in seen_keys:
                seen_keys.add(key)
                candidates.append(sent)

    # scraped_text is richest — real article paragraphs fetched from the URL
    _add(art.get("scraped_text") or "")
    _add(art.get("full_description") or "")
    _add(art.get("full_content") or "")
    _add(art.get("body") or "")
    _add(art.get("snippet") or "")

    for sub in (art.get("sub_articles") or [])[:3]:
        _add(sub.get("snippet") or sub.get("title") or "")

    if not candidates:
        title = _clean_snippet(art.get("title") or "")
        if title:
            candidates = [title if title.endswith('.') else title + '.']

    if not candidates:
        return ""

    selected = candidates[:5]
    result = ' '.join(selected)

    if result and result[-1] not in '.!?':
        result += '.'

    if len(result) > 700:
        cut  = result[:700]
        last = max(cut.rfind('.'), cut.rfind('!'), cut.rfind('?'))
        result = cut[:last + 1] if last > 350 else cut.rstrip() + '…'

    return result


def _article_card(index: int, art: dict) -> str:
    title   = (art.get("title") or "Untitled").strip()
    link    = art.get("link", "#")
    source  = (art.get("source_name") or "").strip()
    pub_str = _format_date(art.get("published_datetime_utc", ""))
    domain  = _domain_from_url(link)
    favicon = _favicon_html(domain)

    if len(title) > 115:
        title = title[:112] + "…"

    description = _build_description(art)

    # Meta line: inline favicon img + bold source name + date
    # rehype-raw allows the <img> to render truly inline alongside text
    meta_parts = []
    if source:
        src_str = f"{favicon}**{source}**" if favicon else f"**{source}**"
        meta_parts.append(src_str)
    if pub_str:
        meta_parts.append(pub_str)
    meta_line = "  ·  ".join(meta_parts) if meta_parts else ""

    parts = [f"### {index}. {title}"]
    if description:
        parts.append(f"\n{description}")
    if meta_line:
        parts.append(f"\n{meta_line}")
    parts.append(f"\n🔗 [Read full article]({link})")

    return "\n".join(parts)


def _render_update_block(articles: list, topic: str, timestamp: str,
                          header_emoji: str = "🔴", label: str = "LIVE UPDATE",
                          update_number: int = None) -> str:
    """
    Full live-update payload:

        ---
        ## 🔴 LIVE UPDATE #2 · 3:45 PM  |  Iran War

        ### 1. Title
        ...

        ### 2. Title
        ...

        ---
    """
    num_str       = f" #{update_number}" if update_number else ""
    topic_display = topic.title()
    header = (
        f"\n\n---\n\n"
        f"## {header_emoji} {label}{num_str} · {timestamp}  |  {topic_display}\n"
    )

    if not articles:
        body = "\n*No new articles found for this cycle. Will retry shortly.*\n"
    else:
        cards = [_article_card(i, art) for i, art in enumerate(articles[:4], start=1)]
        body  = "\n\n".join(cards)

    footer = "\n\n---"
    return header + "\n" + body + footer


# ── Core fetch ─────────────────────────────────────────────────────────────────

def _fetch_articles_raw(query: str, limit: int = 4) -> list:
    """
    Fetch articles from RapidAPI, then enrich each one by scraping
    the actual article URL for full paragraph text in parallel.
    """
    try:
        resp = requests.get(
            f"https://{RAPIDAPI_HOST}/search",
            headers=HEADERS,
            params={"query": query, "lang": "EN", "limit": limit},
            timeout=12,
        )
        articles = resp.json().get("data", []) if resp.status_code == 200 else []
        if not articles:
            fb = requests.get(
                f"https://{RAPIDAPI_HOST}/top-headlines",
                headers=HEADERS,
                params={"country": "US", "lang": "EN", "limit": limit},
                timeout=12,
            )
            articles = fb.json().get("data", []) if fb.status_code == 200 else []

        if articles:
            articles = _enrich_with_scraped_text(articles)

        return articles
    except Exception:
        return []


def real_time_news_search(query: str = "politics", language: str = "EN",
                           limit: int = 4, for_live_update: bool = False,
                           update_number: int = None) -> str:
    """
    Fetch latest articles for query.
    - for_live_update=True  → formatted live block (bypasses cache).
    - for_live_update=False → plain Markdown cards for agent, cached 60s.
    Never raises.
    """
    cache_key = f"politics:news:{query.lower().replace(' ', '_')[:80]}"

    if not for_live_update:
        cached = cache.get(cache_key)
        if cached:
            print(f"Cache HIT — politics news: {query}")
            return cached

    try:
        articles  = _fetch_articles_raw(query, limit)
        timestamp = datetime.now().strftime('%I:%M %p')

        if not articles:
            return f"No recent political news found for '{query}'."

        if for_live_update:
            return _render_update_block(articles, query, timestamp,
                                         update_number=update_number)

        # Plain agent format
        today  = datetime.now().strftime("%B %d, %Y")
        cards  = [_article_card(i, art) for i, art in enumerate(articles[:4], start=1)]
        result = (
            f"## 📰 Politics News — {today}\n\n"
            + "\n\n".join(cards)
            + "\n\n**Sources:** Real-Time News Data via RapidAPI"
        )
        cache.set(cache_key, result, timeout=60)
        return result

    except Exception as e:
        return f"Failed to fetch news: {str(e)[:200]}"


def real_time_news_first(topic: str) -> str:
    """First update — distinct 'FIRST UPDATE' label."""
    articles  = _fetch_articles_raw(topic)
    timestamp = datetime.now().strftime('%I:%M %p')
    return _render_update_block(
        articles, topic, timestamp,
        header_emoji="📰", label="FIRST UPDATE",
        update_number=None
    )


def real_time_news_cycle(topic: str, update_number: int) -> str:
    """Subsequent cycles — numbered 🔴 LIVE UPDATE header."""
    return real_time_news_search(
        query=topic, limit=4,
        for_live_update=True, update_number=update_number
    )


def tavily_politics_search(query: str) -> str:
    try:
        raw = tavily_search.invoke({"query": query})
        if not raw:
            return "No relevant results found."
        lines = []
        for item in raw[:4]:
            title   = item.get("title", "No title")
            url     = item.get("url", "")
            # Build a synthetic art dict so we can reuse _build_description
            art     = {"snippet": item.get("content", ""), "title": title}
            desc    = _build_description(art)
            domain  = _domain_from_url(url)
            favicon = _favicon_html(domain)
            lines.append(f"**{title}**\n{desc}\n{favicon}[Read more]({url})")
        return "\n\n".join(lines)
    except Exception as e:
        return f"Tavily search failed: {str(e)[:200]}"


# ── LangChain Tool wrappers ────────────────────────────────────────────────────

real_time_news_search_tool = Tool.from_function(
    func=real_time_news_search,
    name="real_time_news_search",
    description=(
        "Fetch the latest news articles on political topics, events, countries or persons. "
        "Use for current affairs, elections, statements, and breaking news."
    ),
)

tavily_politics_search_tool = Tool.from_function(
    func=tavily_politics_search,
    name="tavily_politics_search",
    description="Deep search for political analysis, background, historical context or older news.",
)

tools = [real_time_news_search_tool, tavily_politics_search_tool]