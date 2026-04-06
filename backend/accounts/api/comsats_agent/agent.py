import os
from datetime import datetime
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage

# ─── LLM Setup ───
llm = ChatOpenAI(
    model="x-ai/grok-4.1-fast",
    openai_api_key=os.getenv("OPENROUTER_API_KEY"),
    openai_api_base="https://openrouter.ai/api/v1",
    temperature=0.4,
    streaming=False,
)

chat_history = []

SYSTEM_PROMPT = f"""You are a knowledgeable COMSATS campus assistant.
Today is {datetime.now().strftime('%B %d, %Y')}.

Rules:
- Answer concisely and accurately.
- Be helpful and friendly.
- Do not generate news or real-time updates.
"""

def get_comsats_response(query: str, thread_id="comsats_agent_chat"):
    global chat_history
    try:
        # Call LLM directly
        messages = [HumanMessage(content=query)]
        answer = llm(messages=messages)
        answer_text = answer.content.strip()

        # Update chat history
        chat_history.append(HumanMessage(content=query))
        chat_history.append(AIMessage(content=answer_text))
        if len(chat_history) > 10:
            chat_history = chat_history[-10:]
        return answer_text
    except Exception as e:
        return f"⚠️ Error: {str(e)}"

def reset_comsats_chat():
    global chat_history
    chat_history = []
    return True