# backend/accounts/api/cricket_agent/agent.py
import os
import re
from datetime import datetime

from langchain_openai import ChatOpenAI
from langchain.agents import create_openai_tools_agent, AgentExecutor
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage

from .tools import (
    livescore6_daily_tool,
    livescore6_live_tool,
    livescore6_specific_tool,
    tavily_cricket
)

# ────────────────────────────────────────────────
# LLM — grok-4.1-fast via OpenRouter
# ────────────────────────────────────────────────

llm = ChatOpenAI(
    model="x-ai/grok-4.1-fast",
    openai_api_key=os.getenv("OPENROUTER_API_KEY"),
    openai_api_base="https://openrouter.ai/api/v1",
    temperature=0.3,
    streaming=False,
)

# ────────────────────────────────────────────────
# System Prompt — updated with ambiguous team rule
# ────────────────────────────────────────────────

SYSTEM_PROMPT = f"""You are a helpful Cricket Update Assistant. Today is {datetime.now().strftime("%B %d, %Y")}. Time in Pakistan: {datetime.now().strftime("%I:%M %p PKT")}.

CORE RULES:
- Be concise, accurate, friendly, and conversational.
- Use tools ONLY when needed for current/live/recent cricket data or news.
- For general knowledge (rules, terms, history, records before 2020) → answer directly — NO tool.
- NEVER hallucinate scores, dates, players or events.

TOOL USAGE RULES — VERY STRICT:
- Choose **only the most relevant tool** — at most one call per turn.
- After receiving a tool result → give a clean, summarized final answer immediately.
- Do NOT repeat the same tool or refine endlessly.
- If livescore6 tools return "no matching match found" or empty data → immediately use tavily_cricket to search for latest result, scorecard, news or upcoming fixture.
- If no useful info after tools → say "Sorry, no reliable information found right now" and stop.

PAST / FUTURE / AMBIGUOUS MATCH QUERIES RULE:
- If query mentions a **year** (2024, 2025, 2026, etc.) or words like "last", "previous", "past", "who won", "result of", "final of", "semi final", "t20 world cup 2022", etc.:
  - Do NOT use livescore6_specific, daily or live — they only have current/today's data.
  - Use tavily_cricket directly to search for the historical result, scorecard, summary or news.
- If user says just "teamA vs teamB" (e.g. "pak vs eng", "india vs aus", "nz vs sa") with **no time word** ("today", "live", "now", "upcoming", "next", "schedule", "last", "past", "2024", etc.):
  - Assume they mean the **most recent match**.
  - Use tavily_cricket to search for "teamA vs teamB most recent match result OR scorecard OR who won OR summary".
- Only use livescore6 tools when query clearly says "today", "live", "now", "current", "upcoming", or mentions today's date.

MATCH RESULT / SCORE RULES:
- When giving match results or scores: always include key numbers (total runs, wickets, overs, top scorers, best bowler) if available.
- Prefer exact figures over vague summaries like "England won".

NEWS / SQUAD UPDATE RULES:
- When using tavily_cricket for news, squad announcements or updates:
  - Give 2–4 key bullet points with meaningful detail (main facts, key quotes, context, players involved).
  - Do NOT just list headlines — summarize the most important information.

TOOL PRIORITY (choose ONE):
1. livescore6_live → "live scores right now", "current live matches"
2. livescore6_specific → specific team/match queries (only when clearly current/today)
3. livescore6_daily → general "today's matches", "all matches today"
4. tavily_cricket → news, squad announcements, PCB/BCCI, past/future matches, or when LiveScore6 has no data

SOURCE RULES:
- **Sources:** only when using tavily_cricket — list 1–3 links
- For LiveScore6 tools — end with "**Sources:** LiveScore6 via RapidAPI"

FORMATTING:
- # for main titles
- ## for sections
- **bold** teams/scores/key players
- *italic* status/notes
- Numbered list for news
- End with "Ask me more! 🏏"

FINAL ANSWER GUIDELINES:
- Always give a complete, self-contained answer — do NOT end early or say "let me check".
- For scores/results: include numbers and key players.
- For news: give 2–4 meaningful bullet points with details.
- Keep responses helpful and to the point.

Follow these rules exactly — no exceptions.
""".strip()

# ────────────────────────────────────────────────
# Prompt Template
# ────────────────────────────────────────────────

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

# ────────────────────────────────────────────────
# Tools (your existing ones)
# ────────────────────────────────────────────────

tools = [
    livescore6_daily_tool,
    livescore6_live_tool,
    livescore6_specific_tool,
    tavily_cricket
]

# ────────────────────────────────────────────────
# Create agent
# ────────────────────────────────────────────────

agent = create_openai_tools_agent(llm, tools, prompt)

agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,
    handle_parsing_errors=True,
    max_iterations=3,
    early_stopping_method="force"
)

# ────────────────────────────────────────────────
# Chat history (simple list — can be per-user later)
# ────────────────────────────────────────────────

chat_history = []

def get_cricket_response(query: str):
    global chat_history

    # NO pre-check for year or team pairs — let the agent decide

    try:
        result = agent_executor.invoke({
            "input": query,
            "chat_history": chat_history
        })

        answer = result["output"].strip()

        chat_history.append(HumanMessage(content=query))
        chat_history.append(AIMessage(content=answer))

        if len(chat_history) > 10:
            chat_history = chat_history[-10:]

        return answer

    except Exception as e:
        print(f"Agent error: {type(e).__name__}: {str(e)}")
        return f"⚠️ Sorry, something went wrong. Try again in a moment."
    
def reset_cricket_chat():
    global chat_history
    chat_history = []
    return True