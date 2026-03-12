# backend/accounts/api/politics_agent/tools.py
from langchain.tools import Tool
from langchain_community.tools.tavily_search import TavilySearchResults
import requests
import os
from datetime import datetime
import json

# ─── RapidAPI setup ───
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")
RAPIDAPI_HOST = "real-time-news-data.p.rapidapi.com"

HEADERS = {
    "X-RapidAPI-Key": RAPIDAPI_KEY,
    "X-RapidAPI-Host": RAPIDAPI_HOST
}

# ─── Tavily Search setup ───
tavily_search = TavilySearchResults(
    max_results=5,
    api_key=os.getenv("TAVILY_API_KEY"),
    search_depth="advanced",
    include_answer=True,
)

# ─── Helper functions ───
def format_articles(articles):
    if not articles:
        return None
    formatted = []
    for art in articles:
        title = art.get("title", "No title")
        link = art.get("link", "#")
        pub_date = art.get("published_datetime_utc", "No date")
        snippet = art.get("snippet", "No snippet")[:220] + "..." if art.get("snippet") else ""
        source = art.get("source_name", "Unknown")
        formatted.append(
            f"**{title}**\n"
            f"Published: {pub_date}\n"
            f"Source: {source}\n"
            f"{snippet}\n"
            f"[Read full article]({link})\n"
        )
    return "\n\n".join(formatted)


# ─── Real-Time News Search Tool ───
def real_time_news_search(query="politics", language="EN", limit=3):
    """
    Fetch latest political news via RapidAPI Real-Time News.
    Uses /search and falls back to /top-headlines if no results.
    """
    # ─ Search endpoint ─
    url_search = f"https://{RAPIDAPI_HOST}/search"
    params_search = {
        "query": query,
        "lang": language.upper(),
        "limit": limit
    }

    try:
        resp = requests.get(url_search, headers=HEADERS, params=params_search, timeout=10)
        if resp.status_code != 200:
            return f"News API error {resp.status_code}: {resp.text[:200]}"

        data = resp.json()
        articles = data.get("data", []) if isinstance(data, dict) else []

        if not articles:
            # ─ fallback to top-headlines ─
            url_headlines = f"https://{RAPIDAPI_HOST}/top-headlines"
            params_headlines = {
                "country": "PK",  # default to Pakistan for political news
                "lang": language.upper(),
                "limit": limit
            }
            resp = requests.get(url_headlines, headers=HEADERS, params=params_headlines, timeout=10)
            if resp.status_code != 200:
                return f"News API fallback error {resp.status_code}: {resp.text[:200]}"
            data = resp.json()
            articles = data.get("data", []) if isinstance(data, dict) else []
            if not articles:
                return f"No recent political news found for '{query}'."

        formatted = format_articles(articles)
        return formatted + "\n\n**Sources:** Real-Time News Data via RapidAPI"

    except Exception as e:
        return f"Failed to fetch news: {str(e)}"


# ─── Tool wrappers ───
real_time_news_tool = Tool.from_function(
    func=real_time_news_search,
    name="real_time_news",
    description=(
        "Fetch latest news articles on political topics, events, countries or persons. "
        "Use for current affairs, elections, statements, breaking news. Falls back to top headlines if no search results."
    )
)

tavily_politics = Tool.from_function(
    func=lambda q: tavily_search.invoke({"query": q}),
    name="tavily_politics_search",
    description="Deep search for political analysis, background, historical context or older news."
)

tools = [real_time_news_tool, tavily_politics]