from langchain.chat_models import init_chat_model
from langchain_tavily import TavilySearch
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import AgentExecutor, create_openai_tools_agent
import os,re
from dotenv import load_dotenv

# -------------------- Load Environment Variables --------------------
load_dotenv()

# -------------------- Model Map --------------------
MODEL_MAP = {
    "gpt5-nano": "openai/gpt-5-nano",
    "gemini-flashlite": "google/gemini-2.0-flash-lite-001",
    "deepseek-chat": "deepseek/deepseek-chat",
    "claude-3 haiku": "anthropic/claude-3-haiku",
    "mistral nemo": "mistralai/mistral-nemo",
    "llama guard 4": "meta-llama/llama-4-maverick" 
}

# -------------------- API Keys --------------------
os.environ["TAVILY_API_KEY"] = os.getenv("TAVILY_API_KEY")

# -------------------- Chat History --------------------
chat_history = InMemoryChatMessageHistory()

# -------------------- Tavily Search Tool --------------------
search_tool = TavilySearch(max_results=3)

# -------------------- Model Initialization --------------------
def init_model(model_id: str = "openai/gpt-5-nano"):
    """Initialize a chat model using OpenRouter."""
    return init_chat_model(
        model_id,
        model_provider="openai",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url="https://openrouter.ai/api/v1",
        streaming=True  # Enable streaming
    )

# -------------------- System Prompt --------------------
system_message = """
You are a helpful assistant with access to two knowledge sources:
1. PDF/document content (if provided as context).
2. The Tavily search tool for real-time or external information.

Rules:
- If the user asks about information that is time-sensitive (weather, news, live events, stock prices, etc.), ALWAYS call the Tavily search tool automatically. Do NOT ask for permission.
- If the user's query matches the context from documents, answer from that context.
- If the document context is irrelevant, ignore it and answer from your own knowledge or Tavily.
- Never tell the user "the document does not contain this"; instead, fall back to your knowledge or search.

Format your responses with proper formatting:
- Use bullet points with "- " for lists
- Use numbered lists with "1. ", "2. ", etc.
- Use line breaks between paragraphs
- Use clear section headers
- Structure your response for easy reading

"""

# -------------------- Prompt Template --------------------
prompt = ChatPromptTemplate.from_messages([
    ("system", system_message),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad")
])

# -------------------- Streaming Bot Response Function --------------------
def get_bot_response(user_input: str, model_id: str):
    """
    Get AI response with proper formatting that works with SSE streaming.
    Returns the complete formatted response.
    """
    try:
        provider_model = MODEL_MAP.get(model_id, "openai/gpt-5-nano")  
        model = init_model(provider_model)

        # Create the agent with tools
        agent = create_openai_tools_agent(model, [search_tool], prompt)
        agent_executor = AgentExecutor(agent=agent, tools=[search_tool], verbose=True)

        # Add user message to history
        chat_history.add_user_message(user_input)

        # Let agent decide on action
        print("=== AGENT EXECUTION START ===")
        agent_result = agent_executor.invoke({
            "input": user_input,
            "chat_history": chat_history.messages,
            "agent_scratchpad": []
        })
        print("=== AGENT EXECUTION COMPLETE ===")

        final_response = agent_result["output"]
        
        print("=== BACKEND DEBUG ===")
        print("Final response:", repr(final_response))
        print("Response length:", len(final_response))
        print("Contains newlines:", final_response.count('\n'))
        print("=== END DEBUG ===")
        
        # Return the complete response as a single chunk
        yield final_response
        
        # Save the complete response to chat history
        chat_history.add_ai_message(final_response)
        
    except Exception as e:
        print(f"=== ERROR in get_bot_response ===")
        print(f"Error: {str(e)}")
        print(f"=== END ERROR ===")
        yield f"Error: {str(e)}"