from langchain.chat_models import init_chat_model
from langchain_tavily import TavilySearch
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import AgentExecutor, create_openai_tools_agent
import os
from dotenv import load_dotenv

load_dotenv()

os.environ["GOOGLE_API_KEY"] = os.getenv("GOOGLE_API_KEY")
os.environ["TAVILY_API_KEY"] = os.getenv("TAVILY_API_KEY")

chat_history = InMemoryChatMessageHistory()
search_tool = TavilySearch(max_results=3)  # little more generous
model = init_chat_model("gemini-2.0-flash", model_provider="google_genai")

#  Stronger system message
system_message = """
You are a helpful assistant with access to two knowledge sources:
1. PDF/document content (if provided as context).
2. The Tavily search tool for real-time or external information.

Rules:
- If the user asks about information that is time-sensitive (weather, news, live events, stock prices, etc.),
  ALWAYS call the Tavily search tool automatically. Do NOT ask for permission.
- If the user's query matches the context from documents, answer from that context.
- If the document context is irrelevant, ignore it and answer from your own knowledge or Tavily.
- Never tell the user "the document does not contain this"; instead, fall back to your knowledge or search.
"""

prompt = ChatPromptTemplate.from_messages([
    ("system", system_message),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad")
])

agent = create_openai_tools_agent(model, [search_tool], prompt)
agent_executor = AgentExecutor(agent=agent, tools=[search_tool], verbose=True)

def get_bot_response(user_input: str) -> str:
    chat_history.add_user_message(user_input)
    result = agent_executor.invoke({
        "input": user_input,
        "chat_history": chat_history.messages,
        "agent_scratchpad": []
    })
    bot_reply = result["output"]
    chat_history.add_ai_message(bot_reply)
    return bot_reply
