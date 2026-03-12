# backend/accounts/api/politics_agent/agent.py
import os
import re
from datetime import datetime

from langchain_openai import ChatOpenAI
from langchain.agents import create_openai_tools_agent, AgentExecutor
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from django.core.cache import cache

from .tools import real_time_news_tool, tavily_politics

# LLM
llm = ChatOpenAI(
    model="x-ai/grok-4.1-fast",
    openai_api_key=os.getenv("OPENROUTER_API_KEY"),
    openai_api_base="https://openrouter.ai/api/v1",
    temperature=0.4,
    streaming=False,
)

# System prompt (keep as is)
SYSTEM_PROMPT = f"""You are a knowledgeable Politics & Current Affairs Assistant. Today is {datetime.now().strftime("%B %d, %Y")}. Time in Pakistan: {datetime.now().strftime("%I:%M %p PKT")}.

CORE RULES:
- Be concise, accurate, neutral, and conversational.
- Always cite sources clearly — never hallucinate facts, dates, events or statements.
- Use tools ONLY for recent/current news, elections, statements, or real-time developments.
- For historical/political theory/context (pre-2020) → answer directly, no tool.
- Remain strictly neutral — report facts from multiple perspectives when controversial.

LIVE NEWS UPDATES FEATURE:
- If user asks for "live politics news", "automatic news updates", "keep sending news", "latest news updates", "news every few minutes" on a topic:
  - Respond exactly: "Starting live politics news updates for [topic]. Updates every 10 minutes. Press 'Stop' to end."
  - Extract the topic (e.g. "Pakistan politics", "US election", "Middle East conflict")
- If user says "stop news", "stop updates", "end news":
  - Respond: "Live politics news updates stopped. Ask me anything else! 📰"
- Do NOT call tools repeatedly — backend handles periodic fetching.

TOOL USAGE RULES — VERY STRICT:
- Choose **only the most relevant tool** — at most one call per turn.
- After tool result → give clean, summarized final answer immediately.
- If no useful info → say "Sorry, no reliable recent information found right now."
- For breaking news or fast-moving events → prefer real_time_news_search.
- For deeper analysis or older context → use tavily_politics_search.

QUERY TYPE RULES:
- "latest news on X", "what's happening in X", "news about Y" → use real_time_news_search
- "explain", "what is", "history of", "why did" → answer directly or tavily_politics_search
- "election results", "who won" (recent) → real_time_news_search
- Past elections/theory → answer directly or tavily_politics_search

NEWS FORMATTING:
- Use **bold** for key people, parties, countries, events
- Bullet points for multiple items
- Include date/time when available
- Always end news with **Sources:** and 1-3 links
- Keep responses factual and balanced

FINAL ANSWER GUIDELINES:
- Complete, self-contained answer — no "let me check"
- Neutral tone — report facts, not opinions
- End with "Ask me more about politics! 📰"

Follow these rules exactly — no exceptions.
""".strip()

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

# Assign the tools
tools = [real_time_news_tool, tavily_politics]

agent = create_openai_tools_agent(llm, tools, prompt)

agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,
    handle_parsing_errors=True,
    max_iterations=3,
    early_stopping_method="force"
)

chat_history = []

def get_politics_response(query: str, thread_id="politics_agent_chat"):
    global chat_history

    q = query.lower().strip()

    # Live update fast path (direct API call)
    if "live update" in q and cache.get(f"politics_news_active_{thread_id}"):
        topic_key = f"politics_news_topic_{thread_id}"
        topic = cache.get(topic_key)
        
        if topic:
            print(f"Getting live news update for topic: {topic} (thread: {thread_id})")
            update = real_time_news_tool.func(topic, limit=3)  # use the function directly
            return update

    # Normal agent flow
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
        return f"⚠️ Error: {str(e)}"

def reset_politics_chat():
    global chat_history
    chat_history = []
    return True