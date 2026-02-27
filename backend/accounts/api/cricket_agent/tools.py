# backend/accounts/api/cricket_agent/tools.py
from langchain.tools import Tool
from langchain_community.tools.tavily_search import TavilySearchResults
import requests
from datetime import datetime
import os, re
from django.core.cache import cache  # ← Django cache (Redis backend)
from dotenv import load_dotenv

load_dotenv()

TODAY = datetime.now()
TODAY_STR = TODAY.strftime("%B %d, %Y")

RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")
RAPIDAPI_HOST = "livescore6.p.rapidapi.com"

HEADERS = {
    "X-RapidAPI-Key": RAPIDAPI_KEY,
    "X-RapidAPI-Host": RAPIDAPI_HOST
}

# Cache TTLs (in seconds)
DAILY_CACHE_TTL = 60      # 1 minute — good for daily overview
LIVE_CACHE_TTL = 30       # 30 seconds — live data changes fast
SPECIFIC_CACHE_TTL = 120   # 1 minute — per-query cache

# ────────────────────────────────────────────────
# Formatting helpers (unchanged)
# ────────────────────────────────────────────────

def clean_text(text: str) -> str:
    """
    Balanced cleaning for Tavily cricket content.
    Removes ONLY real noise (ads, boilerplate, UI junk, table junk).
    Preserves scores, players, match stats, meaningful sentences.
    """
    if not text or not isinstance(text, str):
        return ""

    # 1. Remove HTML tags (safe — cricket content rarely uses inline HTML)
    text = re.sub(r'<[^>]+>', '', text)

    # 2. Remove only the worst table junk (full rows or repeated pipes)
    text = re.sub(r'^\s*\|[\s\-|:]+.*\|.*\|.*$', '', text, flags=re.M)  # full table row
    text = re.sub(r'\|[\s\-|:]*\|', ' ', text)                          # | --- | → space

    # 3. Remove repeated long separators (keep short ones for section breaks)
    text = re.sub(r'[-=•*]{5,}', '', text)  # only very long lines

    # 4. Remove common non-cricket boilerplate / UI junk (very targeted)
    boilerplate = [
        r'(?i)advertisement|ad|ads|promoted|skip to content|skip navigation|share this|trending now|related articles|also read|sign up|subscribe|newsletter|cookie policy|privacy policy|terms of use|disclaimer|follow us|social media|home|about|contact|login|sign in|register|search|menu|navigation|footer|header|sidebar|copyright|all rights reserved|dark mode|light mode|share icon|mykhel|click on site settings|choose allow option|toi logo|envelope subscribe|liveblog|placeholder|alternate-small-m-t20wc-2026-logo|icc-',
        r'(?i)watch video|watch now|watch live|live stream|stream now|click here|tap here|download app|install now|view full coverage|more details|source link|original article|leave a reply|comment|comments|reply'
    ]
    for pattern in boilerplate:
        text = re.sub(pattern, '', text)

    # 5. Normalize spacing — do NOT remove newlines completely
    text = re.sub(r'\s{3,}', ' ', text)      # collapse excessive spaces
    text = re.sub(r'\n{3,}', '\n\n', text)   # keep paragraph breaks

    # 6. Final trim
    text = text.strip()

    # 7. Do NOT cut length — let meaningful cricket content stay full
    return text

def format_match_score_block(text: str) -> str | None:
    patterns = [
        r'([A-Za-z\s&]+)\s*(?:vs|v\/s|\|)\s*([A-Za-z\s&]+).*?(\d+[-\/]\d+(?:\s*\(\d+(?:\.\d)?\))?)(?:.*?target.*?(\d+))?',
        r'([A-Za-z\s&]+)\s*(\d+/\d+)\s*\((\d+\.?\d*)\).*?([A-Za-z\s&]+)\s*(\d+/\d+)\s*\((\d+\.?\d*)\)',
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            try:
                if len(match.groups()) >= 5:
                    team1, score1, ov1, team2, score2 = match.groups()[:5]
                    ov2 = match.group(6) if len(match.groups()) >= 6 else ""
                    target = match.group(4) if len(match.groups()) >= 4 else ""
                    target_str = f" (target {target})" if target else ""
                    return (
                        f"**{team1.strip().upper()}** {score1.strip()} ({ov1.strip()} ov)  \n"
                        f"**{team2.strip().upper()}** {score2.strip()} ({ov2.strip() or '?'} ov){target_str}"
                    )
            except:
                pass
    return None

def format_cricket_response(search_results: list, query: str) -> str:
    today = TODAY_STR
    lines = []
    has_scores = False
    score_blocks = []

    for result in search_results[:5]:
        # Clean title very aggressively
        title = result.get('title', 'Untitled')
        title = clean_text(title)                          # use the new clean_text
        title = title[:80]                                 # prevent very long titles
        
        content = result.get('content', '')
        content = clean_text(content)                      # clean snippet too
        url = result.get('url', '')

        score_md = format_match_score_block(content)
        if score_md:
            score_blocks.append(score_md)
            has_scores = True
            continue

        snippet = content[:160].strip() + "..." if len(content) > 160 else content
        lines.append(
            f"{len(lines)+1}. **{title}**  \n"
            f"   {snippet}  \n"
            f"   [Read more]({url})"
        )

    response = [f"# 🏏 Cricket Update – {today}\n"]

    if has_scores and score_blocks:
        response.append("## Current & Recent Match Scores\n")
        response.extend(score_blocks)
        response.append("")

    if lines:
        response.append("## Latest Cricket News & Updates\n")
        response.extend(lines)
        response.append("")

    sources = []
    for i, r in enumerate(search_results[:4], 1):
        t = clean_text(r.get('title', 'Untitled'))
        t = t[:80]  # short title
        u = r.get('url', '')
        sources.append(f"{i}. **{t}** → [Read more]({u})")

    if sources:
        response.append("**Sources:**")
        response.extend(sources)
        response.append("")

    response.append("---\n*Ask about specific matches, players, series or tournaments!* 🏏")

    return "\n".join(response).strip()

# ────────────────────────────────────────────────
# Tools with Redis/Django Cache
# ────────────────────────────────────────────────

search = TavilySearchResults(
    max_results=6,
    api_key=os.getenv("TAVILY_API_KEY"),
    search_depth="advanced",
    include_answer=True,
    include_raw_content=False,
)

def livescore6_daily(query: str) -> str:
    cache_key = f"cricket:daily:{datetime.now().strftime('%Y%m%d')}"
    
    cached = cache.get(cache_key)
    if cached:
        print("Cache HIT - daily matches")
        return cached + "\n*(cached — updated recently)*"
    
    try:
        today_str = datetime.now().strftime("%Y%m%d")
        resp = requests.get(
            f"https://{RAPIDAPI_HOST}/matches/v2/list-by-date",
            headers=HEADERS,
            params={"Category": "cricket", "Date": today_str},
            timeout=12
        )
        
        if resp.status_code == 200:
            content = format_livescore6_matches(resp.json(), query)
            if not content or not content.strip():
                content = "No cricket matches found today or data was empty."
        else:
            content = f"API returned status {resp.status_code}. No match data available."
        
        cache.set(cache_key, content, timeout=120)  # 1 minute
        return content
    
    except Exception as e:
        return f"livescore6_daily failed: {str(e)[:300]}"

def livescore6_live(query: str) -> str:
    cache_key = "cricket:live:current"
    
    cached = cache.get(cache_key)
    if cached:
        print("Cache HIT - live matches")
        return cached + "\n*(cached — updated recently)*"
    
    try:
        resp = requests.get(
            f"https://{RAPIDAPI_HOST}/matches/v2/list-live",
            headers=HEADERS,
            params={"Category": "cricket"},
            timeout=12
        )
        
        if resp.status_code == 200:
            content = format_livescore6_matches(resp.json(), query, live_only=True)
            if not content or not content.strip():
                content = "No live cricket matches right now."
        else:
            content = f"API returned status {resp.status_code}. No live data."
        
        cache.set(cache_key, content, timeout=120)  # 30 seconds for live
        return content
    
    except Exception as e:
        return f"livescore6_live failed: {str(e)[:300]}"

def livescore6_specific_match(query: str) -> str:
    """Improved specific match finder - works for men & women, full names, short forms, and vague queries"""
    
    # Normalize query for cache key
    normalized = re.sub(r'[^\w\s]', '', query.lower().strip())
    normalized = " ".join(normalized.split())
    normalized = normalized[:100]
    cache_key = f"cricket:specific:{normalized.replace(' ', '_')}"

    cached = cache.get(cache_key)
    if cached:
        print("Cache HIT - specific match")
        return cached + "\n*(cached — updated recently)*"

    try:
        today_str = datetime.now().strftime("%Y%m%d")
        resp = requests.get(
            f"https://{RAPIDAPI_HOST}/matches/v2/list-by-date",
            headers=HEADERS,
            params={"Category": "cricket", "Date": today_str},
            timeout=12
        )
        
        if resp.status_code == 200:
            data = resp.json()
            stages = data.get("Stages", [])

            query_lower = query.lower()
            query_words = set(re.findall(r'\w+', query_lower))

            found_matches = []
            best_score = 0
            best_event = None

            print(f"Searching for: {query_lower}")  # DEBUG

            # Comprehensive team mapping (full name → short forms)
            team_map = {
                "australia": ["aus", "au", "australia"],
                "india": ["ind", "in", "india"],
                "pakistan": ["pak", "pk", "pakistan"],
                "england": ["eng", "en", "england"],
                "south africa": ["sa", "rsa", "south africa"],
                "new zealand": ["nz", "new zealand"],
                "sri lanka": ["sl", "sri lanka"],
                "west indies": ["wi", "west indies"],
                "bangladesh": ["ban", "bd", "bangladesh"],
                "afghanistan": ["afg", "afghanistan"],
                # Women variants
                "australia women": ["aus w", "australia w", "aus women"],
                "india women": ["ind w", "india w", "ind women"],
                "pakistan women": ["pak w", "pakistan w"],
                "england women": ["eng w", "england w"],
                # Add more if needed
            }

            for stage in stages:
                for event in stage.get("Events", []):
                    match_name = (event.get("Esnm") or "").lower()
                    series = (event.get("Sn") or "").lower()
                    t1_full = event.get("T1", [{}])[0].get("Nm", "").lower()
                    t2_full = event.get("T2", [{}])[0].get("Nm", "").lower()
                    t1_short = event.get("T1", [{}])[0].get("Snm", "").lower()
                    t2_short = event.get("T2", [{}])[0].get("Snm", "").lower()

                    all_text = f"{match_name} {series} {t1_full} {t2_full} {t1_short} {t2_short}"

                    score = 0
                    for word in query_words:
                        # Full team name match (highest score)
                        if word in all_text:
                            score += 4
                        # Short form match
                        for full, shorts in team_map.items():
                            if word in shorts and (full in all_text or any(s in all_text for s in shorts)):
                                score += 6  # Very high score for short forms
                                break

                    print(f"Match: {t1_full} vs {t2_full} | Score: {score}")  # DEBUG

                    if score > best_score:
                        best_score = score
                        best_event = event

            # Lower threshold to catch more valid matches
            if best_event and best_score >= 4:
                t1_name = best_event.get("T1", [{}])[0].get("Nm", "Team 1")
                t2_name = best_event.get("T2", [{}])[0].get("Nm", "Team 2")
                score1 = f"{best_event.get('Tr1C1', '?')}/{best_event.get('Tr1CW1', '?')} ({best_event.get('Tr1CO1', '?')})"
                score2 = f"{best_event.get('Tr2C1', '?')}/{best_event.get('Tr2CW1', '?')} ({best_event.get('Tr2CO1', '?')})"
                status = best_event.get("EpsL", "N/A")
                result_text = best_event.get("ECo", "")

                content = f"# 🏏 {t1_name} vs {t2_name}\n\n"
                content += f"**{t1_name}** {score1} vs **{t2_name}** {score2}\n"
                content += f"Status: *{status}*\n"
                if result_text:
                    content += f"Result: {result_text}\n"
                content += "\n**Sources:** LiveScore6 via RapidAPI"

                cache.set(cache_key, content, timeout=10)
                return content
            else:
                print(f"No good match found (best score: {best_score}) → fallback to Tavily")

        # === FALLBACK TO TAVILY ===
        fallback_query = f"{query} full scorecard OR detailed result OR match summary OR score OR runs wickets overs"
        print(f"LiveScore6 no match → falling back to Tavily: {fallback_query}")
        return cricket_search_tool(fallback_query)

    except Exception as e:
        return f"Error fetching match details: {str(e)[:200]}"

def cricket_search_tool(query: str) -> str:
    # Normalize very aggressively
    normalized = re.sub(r'[^\w\s]', '', query.lower().strip())  # remove punctuation
    normalized = " ".join(normalized.split())                   # collapse spaces
    normalized = normalized[:100]                               # limit length

    cache_key = f"cricket:news:{normalized.replace(' ', '_')}"  # stable key

    print(f"Tavily cache key: {cache_key}")

    cached = cache.get(cache_key)
    if cached:
        print("Cache HIT - Tavily news")
        return cached + "\n*(cached news — updated recently)*"

    print("Cache MISS - fetching fresh Tavily news")

    try:
        enhanced_query = query.strip()

        if any(word in query.lower() for word in ["score", "result", "live", "today", "current", "match"]):
            enhanced_query = f"{query} {TODAY_STR} live score OR result"
        elif any(word in query.lower() for word in ["news", "update", "headline", "squad", "selection"]):
            enhanced_query = f"cricket news {query} {TODAY_STR}"
        else:
            enhanced_query = f"cricket {query} {TODAY_STR}"

        print(f"→ Tavily query: {enhanced_query}")

        raw = search.invoke({"query": enhanced_query})

        if not raw:
            content = f"No recent cricket information found for: **{query}**"
        else:
            content = format_cricket_response(raw, query)
            if not content or content.strip() == "":
                content = "No useful information found from search."

        print(f"Storing in cache: {cache_key[:50]}... (length {len(content)} chars)")
        cache.set(cache_key, content, timeout=10)  # 15 min

        return content

    except Exception as e:
        return f"cricket_search tool failed: {str(e)[:200]}"

def format_livescore6_matches(data: dict, query: str, live_only: bool = False) -> str:
    lines = [f"# 🏏 Cricket Update – {TODAY_STR}\n"]

    stages = data.get("Stages", [])
    if not stages:
        return "No cricket matches found today."

    if live_only:
        lines.append("## Currently Live Matches\n")
    else:
        lines.append("## Today's Matches\n")

    for stage in stages:
        stage_name = stage.get("name") or "Cricket"
        events = stage.get("Events", [])
        if not events:
            continue

        lines.append(f"### {stage_name}")
        for event in events[:5]:
            name = event.get("Esnm") or "Match"
            status = event.get("EpsL") or "N/A"
            result = event.get("ECo") or ""
            t1 = event.get("T1", [{}])[0].get("Nm", "T1")
            t2 = event.get("T2", [{}])[0].get("Nm", "T2")
            score1 = f"{event.get('Tr1C1', '?')}/{event.get('Tr1CW1', '?')} ({event.get('Tr1CO1', '?')})"
            score2 = f"{event.get('Tr2C1', '?')}/{event.get('Tr2CW1', '?')} ({event.get('Tr2CO1', '?')})"

            lines.append(f"**{t1}** {score1} vs **{t2}** {score2}")
            lines.append(f"Status: {status}")
            if result:
                lines.append(f"Result: {result}")
            lines.append("")

    lines.append("---\n*Live cricket data* 🏏")
    return "\n".join(lines)

# ─── Tool wrappers ───

tavily_cricket = Tool.from_function(
    func=cricket_search_tool,
    name="cricket_search",
    description="Search for real-time cricket scores, match results, news, player stats, series information."
)

livescore6_daily_tool = Tool.from_function(
    func=livescore6_daily,
    name="livescore6_daily",
    description="Get today's cricket matches (live, recent, upcoming, finished)."
)

livescore6_live_tool = Tool.from_function(
    func=livescore6_live,
    name="livescore6_live",
    description="Get only currently live cricket matches with real-time scores."
)

livescore6_specific_tool = Tool.from_function(
    func=livescore6_specific_match,
    name="livescore6_specific",
    description="Get live or recent score for a SPECIFIC match or team (e.g. 'India vs Australia score', 'Pakistan latest match'). Use this when user mentions a particular team or match."
)

# Final tools list
tools = [livescore6_daily_tool, livescore6_live_tool, livescore6_specific_tool, tavily_cricket]