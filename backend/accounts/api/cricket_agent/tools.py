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

# backend/accounts/api/cricket_agent/tools.py

def livescore6_specific_match(query: str) -> str:
    """Get live score for a specific match - ONLY returns exact match, no fallbacks"""
    
    # First, extract clean team names from query
    query_lower = query.lower()
    
    # Parse the "team1 vs team2" pattern
    vs_parts = re.split(r'\s+vs?\s+', query_lower)
    if len(vs_parts) != 2:
        return "no matching match found - invalid query format"
    
    team1_raw = vs_parts[0].strip()
    team2_raw = vs_parts[1].strip()
    
    # Remove common words
    team1_clean = re.sub(r'\b(keep|sending|updates|for|live|automatic|every|minute|second|please|now|the)\b', '', team1_raw).strip()
    team2_clean = re.sub(r'\b(keep|sending|updates|for|live|automatic|every|minute|second|please|now|the)\b', '', team2_raw).strip()
    
    # Sort team names to ensure consistent cache key regardless of order
    teams = sorted([team1_clean, team2_clean])
    cache_key = f"cricket:match:{teams[0]}:{teams[1]}:{datetime.now().strftime('%Y%m%d')}"
    
    print(f"🔑 Cache key: {cache_key}")

    # Check cache
    cached = cache.get(cache_key)
    if cached:
        if cached.startswith("no matching match"):
            print(f"Cache contained 'no match' for {query}, ignoring cache")
            cache.delete(cache_key)
        else:
            print(f"Cache HIT - specific match: {query}")
            return cached

    try:
        today_str = datetime.now().strftime("%Y%m%d")
        resp = requests.get(
            f"https://{RAPIDAPI_HOST}/matches/v2/list-by-date",
            headers=HEADERS,
            params={"Category": "cricket", "Date": today_str},
            timeout=12
        )
        
        if resp.status_code != 200:
            return f"API error: {resp.status_code}"
        
        data = resp.json()
        stages = data.get("Stages", [])
        
        # Comprehensive team map (full name → possible variations)
        # Order matters: more specific entries first
        team_map = {
            # International men
            "australia": ["australia", "aus"],
            "india": ["india", "ind"],
            "pakistan": ["pakistan", "pak"],
            "england": ["england", "eng"],
            "south africa": ["south africa", "sa", "rsa"],
            "new zealand": ["new zealand", "nz"],
            "sri lanka": ["sri lanka", "sl"],
            "west indies": ["west indies", "wi"],
            "bangladesh": ["bangladesh", "ban"],
            "afghanistan": ["afghanistan", "afg"],
            "zimbabwe": ["zimbabwe", "zim"],
            "ireland": ["ireland", "ire"],
            "scotland": ["scotland", "sco"],
            "netherlands": ["netherlands", "ned"],
            
            # Women
            "australia women": ["australia women", "aus w", "australia w"],
            "india women": ["india women", "ind w", "india w"],
            "england women": ["england women", "eng w", "england w"],
            "new zealand women": ["new zealand women", "nz w", "new zealand w"],
            
            # New Zealand domestic
            "auckland aces": ["auckland aces", "auckland", "aces"],
            "canterbury kings": ["canterbury kings", "canterbury", "kings"],
            "wellington firebirds": ["wellington firebirds", "wellington", "firebirds"],
            "otago volts": ["otago volts", "otago", "volts"],
            "northern districts": ["northern districts", "northern"],
            "central districts": ["central districts", "central"],
            
            # South Africa domestic
            "eastern cape iinyathi": ["eastern cape iinyathi", "eastern cape", "iinyathi"],
            "eastern storm": ["eastern storm", "storm"],
            "limpopo impalas": ["limpopo impalas", "limpopo", "impalas"],
            "mpumalanga rhinos": ["mpumalanga rhinos", "mpumalanga", "rhinos"],
            "knights": ["knights", "free state"],
            "dolphins": ["dolphins", "kzn"],
            "lions": ["lions", "gauteng"],
            "titans": ["titans", "northerns"],
            "warriors": ["warriors", "border"],
            "western province": ["western province", "wp"],
        }
        
        def normalize_team(team_name):
            """Convert team name to standard form using whole-word matching"""
            team_lower = team_name.lower()
            for standard, variations in team_map.items():
                for var in variations:
                    # Use word boundaries to avoid substring false positives
                    pattern = r'\b' + re.escape(var) + r'\b'
                    if re.search(pattern, team_lower):
                        return standard
            return team_lower  # fallback: return as-is
        
        team1_norm = normalize_team(team1_clean)
        team2_norm = normalize_team(team2_clean)
        
        print(f"Normalized: '{team1_norm}' vs '{team2_norm}'")
        
        exact_match = None
        
        # Search through all events
        for stage in stages:
            for event in stage.get("Events", []):
                # Get team names from API
                t1_full = event.get("T1", [{}])[0].get("Nm", "").lower()
                t2_full = event.get("T2", [{}])[0].get("Nm", "").lower()
                t1_short = event.get("T1", [{}])[0].get("Snm", "").lower()
                t2_short = event.get("T2", [{}])[0].get("Snm", "").lower()
                
                # Normalize API team names as well
                event_team1_norm = normalize_team(t1_full)
                event_team2_norm = normalize_team(t2_full)
                
                # Check if this match matches the query (in either order)
                if (team1_norm == event_team1_norm and team2_norm == event_team2_norm) or \
                   (team1_norm == event_team2_norm and team2_norm == event_team1_norm):
                    # Found exact match
                    exact_match = event
                    print(f"✓ Found exact match: {t1_full} vs {t2_full}")
                    break
                
                # Also try short names if exact match not found
                if (team1_norm in t1_short and team2_norm in t2_short) or \
                   (team1_norm in t2_short and team2_norm in t1_short):
                    # Verify it's the same teams by checking full names
                    if (team1_norm in event_team1_norm or team1_norm in event_team2_norm) and \
                       (team2_norm in event_team1_norm or team2_norm in event_team2_norm):
                        exact_match = event
                        print(f"✓ Found via short names: {t1_full} vs {t2_full}")
                        break
            if exact_match:
                break
        
        if exact_match:
            # Check if match is live
            status = exact_match.get("EpsL", "").lower()
            is_live = any(word in status for word in ["live", "progress", "stump", "innings", "rain", "delay"])
            
            if not is_live:
                print(f"Match found but not live: {status}")
                return f"no matching match found - {t1_full} vs {t2_full} is not currently live (Status: {status})"
            
            # Format the response
            t1_name = exact_match.get("T1", [{}])[0].get("Nm", "Team 1")
            t2_name = exact_match.get("T2", [{}])[0].get("Nm", "Team 2")
            
            # Get scores
            t1_runs = exact_match.get('Tr1C1', '?')
            t1_wickets = exact_match.get('Tr1CW1', '?')
            t1_overs = exact_match.get('Tr1CO1', '?')
            t2_runs = exact_match.get('Tr2C1', '?')
            t2_wickets = exact_match.get('Tr2CW1', '?')
            t2_overs = exact_match.get('Tr2CO1', '?')
            
            # Format scores nicely
            t1_score = f"{t1_runs}/{t1_wickets}" if t1_wickets != '?' else t1_runs
            t2_score = f"{t2_runs}/{t2_wickets}" if t2_wickets != '?' else t2_runs
            
            result_text = exact_match.get("ECo", "")
            
            content = f"# 🏏 **{t1_name} vs {t2_name}**\n\n"
            content += f"**{t1_name}:** {t1_score} ({t1_overs} ov)\n"
            content += f"**{t2_name}:** {t2_score} ({t2_overs} ov)\n"
            content += f"**Status:** *{status}*\n"
            if result_text:
                content += f"**Result:** {result_text}\n"
            
            
            cache.set(cache_key, content, timeout=10)
            return content
        
        # No match found
        print(f"❌ No match found for {team1_clean} vs {team2_clean}")
        return "no matching match found"
        
    except Exception as e:
        print(f"Error in livescore6_specific_match: {str(e)}")
        return f"Error fetching match details"

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