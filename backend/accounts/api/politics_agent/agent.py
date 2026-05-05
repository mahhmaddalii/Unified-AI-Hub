# backend/accounts/api/politics_agent/agent.py
import os
from datetime import datetime

from langchain_openai import ChatOpenAI
from langchain.agents import create_openai_tools_agent, AgentExecutor
from langchain_community.callbacks.manager import get_openai_callback
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import AIMessage, HumanMessage
from django.core.cache import cache

from .tools import real_time_news_search, real_time_news_cycle
from .tools import real_time_news_search_tool, tavily_politics_search_tool
from accounts.api.billing.services import extract_token_usage, get_or_create_billing_profile, record_token_usage

# ── LLM ────────────────────────────────────────────────────────────────────────

llm = ChatOpenAI(
    model="x-ai/grok-4.1-fast",
    openai_api_key=os.getenv("OPENROUTER_API_KEY"),
    openai_api_base="https://openrouter.ai/api/v1",
    temperature=0.4,
    streaming=False,
)

# ── System Prompt ──────────────────────────────────────────────────────────────

SYSTEM_PROMPT = f"""You are a knowledgeable Politics & Current Affairs Assistant. Today is {datetime.now().strftime("%B %d, %Y")}. Time in Pakistan: {datetime.now().strftime("%I:%M %p PKT")}.

CORE RULES:
- Be concise, accurate, neutral, and conversational.
- Always cite sources clearly — never hallucinate facts, dates, events or statements.
- Use tools ONLY for recent/current news, elections, statements, or real-time developments.
- For historical/political theory/context (pre-2020) → answer directly, no tool.
- Remain strictly neutral — report facts from multiple perspectives when controversial.

SCOPE — WHAT YOU COVER:
- Politics, government, elections, parliament, legislation, policy
- Geopolitics, international relations, war, diplomacy, treaties, sanctions
- Economy as it relates to government policy (budget, trade, fiscal reform, IMF)
- Social issues driven by policy (rights, justice, migration, climate policy)
- Institutions: courts, UN, EU, NATO, World Bank, G7/G20, etc.

SCOPE — WHAT YOU DO NOT COVER:
- Sports scores, cricket, football, entertainment, music, film, fashion
- Recipes, fitness, travel, cryptocurrency speculation, gaming
- Weather forecasts, personal advice, lifestyle topics
- If a user asks about these → politely redirect: "I specialise in politics and current affairs.
  For [topic], you'd be better served by a dedicated [sport/entertainment/etc.] assistant."

LIVE NEWS UPDATES FEATURE:
- Trigger phrases: "live politics news", "live news updates for", "automatic news updates for",
  "keep sending news for", "live updates for", "live news for"
- On trigger: respond "📡 Starting live politics news for **[topic]**. Updates every 10 seconds. Press Stop to end."
- On "stop", "stop news", "stop updates", "end news": respond "🛑 Live updates stopped. Ask me anything! 📰"
- ONLY start updates for political topics. For non-political topics say:
  "I can only provide live updates on political and current affairs topics."
- Do NOT call tools repeatedly — the backend loop handles periodic fetching.

TOOL USAGE RULES — VERY STRICT:
- At most ONE tool call per turn.
- After tool result → give a clean summarized final answer immediately.
- If no useful info → say "Sorry, no reliable recent information found right now."
- Breaking news / fast-moving events → real_time_news_search
- Deeper analysis / background / older events → tavily_politics_search

QUERY ROUTING:
- "latest news on X", "what's happening in X", "news about Y" → real_time_news_search
- "explain", "what is", "history of", "why did" → answer directly or tavily_politics_search
- "election results", "who won" (recent) → real_time_news_search
- Past events / theory / context → answer directly or tavily_politics_search

FORMATTING:
- **Bold** for key people, parties, countries, events
- Bullet points for multiple items
- Include date/time when known
- End news responses with **Sources:** and 1–3 links
- Keep responses factual and balanced

LIVE UPDATE SUGGESTION RULE:
- When discussing an ongoing political event (conflict, election, summit, crisis):
  Add once: 💡 Want continuous updates? Type: "live news updates for [topic]"
- Show this suggestion only once per topic in a conversation.

FINAL ANSWER GUIDELINES:
- Complete, self-contained — no "let me check" or incomplete sentences
- Neutral tone — facts only, no opinions
- End regular answers with "Ask me more about politics! 📰"

Follow these rules exactly.
""".strip()

# ── Prompt ─────────────────────────────────────────────────────────────────────

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

# ── Agent ──────────────────────────────────────────────────────────────────────

tools = [real_time_news_search_tool, tavily_politics_search_tool]

agent = create_openai_tools_agent(llm, tools, prompt)

agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,
    handle_parsing_errors=True,
    max_iterations=3,
    early_stopping_method="force",
)

def build_chat_history(history_messages=None):
    built_messages = []
    for message in history_messages or []:
        text = getattr(message, "content_text", "") or ""
        role = getattr(message, "role", "")
        if not text:
            continue
        if role == "user":
            built_messages.append(HumanMessage(content=text))
        elif role == "assistant":
            built_messages.append(AIMessage(content=text))
    return built_messages


def get_politics_response(query: str, thread_id: str = "politics_agent_chat", history_messages=None, user=None, track_tokens=False):
    q = query.lower().strip()
    chat_history = build_chat_history(history_messages)

    # Fast path — live loop calls this; skip the heavy agent invocation
    if "live update" in q and cache.get(f"politics_news_active_{thread_id}"):
        topic     = cache.get(f"politics_news_topic_{thread_id}")
        counter   = cache.get(f"politics_news_counter_{thread_id}", 1)
        if topic:
            print(f"🔴 Live news fast-path — topic: {topic} update #{counter}")
            result = real_time_news_cycle(topic, counter)
            cache.set(f"politics_news_counter_{thread_id}", counter + 1, timeout=3600)
            return result, None

    try:
        with get_openai_callback() as callback:
            result = agent_executor.invoke({
                "input": query,
                "chat_history": chat_history,
            })

        answer = result["output"].strip()
        usage = extract_token_usage(callback)

        if track_tokens and user:
            try:
                profile = get_or_create_billing_profile(user)
                record_token_usage(profile, **usage)
            except Exception as usage_error:
                print(f"[WARN] Politics token usage recording failed: {usage_error}")

        return answer, usage

    except Exception as e:
        print(f"Politics agent error: {type(e).__name__}: {str(e)}")
        return f"⚠️ Error: {str(e)}"


def reset_politics_chat() -> bool:
    return True
