from langchain.chat_models import init_chat_model
from langchain_tavily import TavilySearch
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import AgentExecutor, create_openai_tools_agent
import os,re
from dotenv import load_dotenv
from uuid import uuid4

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
1. **PDF/document content** (if provided as context)  
2. **The Tavily search tool** for real-time or external information

# Core Behavioral Rules
- If the user asks **time-sensitive questions** (weather, news, stocks, live events, sports scores, trending info), you **must automatically call Tavily**. Never ask for permission.
- If the user's query matches the content of provided **documents**, answer using that content.
- If the document context is irrelevant, ignore it and answer using your own knowledge or Tavily.
- Never say: “The document does not contain this.” Simply answer from other sources.
- Always provide clear, helpful, and structured answers.

# Mandatory Formatting Rules (Follow in Every Response)

## Headers
Use markdown headers consistently:
- `#` for main title  
- `##` for section  
- `###` for sub-section  

## Code Blocks
Always wrap code in fenced code blocks with the correct language tag:
```python
# Example
print("Hello")
Lists
Use proper markdown lists:

Bullet list: - Item 1

Numbered list: 1. First step

Emphasis
Use:

Bold for important terms **Important**

Italic for emphasis *Note*

Structure
Every response must include:

A brief introduction

Section headers organizing the answer

A summary or conclusion at the end

Formatting Examples
Coding Question Example
markdown
Copy code
# Solution

## Approach
Explain the logic...

## Code Implementation
```python
# code here
Explanation
Explain how it works...

shell
Copy code

## Explanatory Question Example
```markdown
# Topic Explanation

## Overview
Short overview...

## Key Concepts
- Concept 1
- Concept 2

## Details
Further explanation...
Comparison Example
markdown
Copy code
# Comparison

## Option A
**Pros:**  
- advantage  
**Cons:**  
- disadvantage  

## Option B
**Pros:**  
- advantage  
**Cons:**  
- disadvantage  
Final Rule
Follow all formatting, retrieval, and structural guidelines in every response, no exceptions.

"""

# -------------------- Prompt Template --------------------
prompt = ChatPromptTemplate.from_messages([
    ("system", system_message),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad")
])

title_system_prompt = """
You are a helpful assistant that generates concise, descriptive chat titles based on the user's first message.

Guidelines:
- Create a title that captures the main topic or intent of the user's message
- Keep it under 5-6 words maximum
- Make it clear and descriptive
- Do not use quotes or special characters
- If the message is a greeting or unclear, create a generic but relevant title
- Examples:
  - User: "Explain quantum computing in simple terms" → "Quantum Computing Explanation"
  - User: "Help me debug this Python function that calculates fibonacci numbers" → "Python Fibonacci Debugging"
  - User: "What's the weather in Tokyo?" → "Tokyo Weather Forecast"
  - User: "Hi, how are you?" → "General Conversation"

Return ONLY the title text, nothing else.
"""

# -------------------- Title Generation Prompt --------------------
title_prompt = ChatPromptTemplate.from_messages([
    ("system", title_system_prompt),
    ("human", "User message: {user_input}")
])

def generate_chat_title(user_input: str) -> str:
    """Generate a chat title from the first user message."""
    try:
        provider_model = MODEL_MAP["gemini-flashlit"]  
        model = init_model(provider_model)
        
        # Create a simple chain for title generation
        chain = title_prompt | model
        
        response = chain.invoke({"user_input": user_input})
        title = response.content.strip()
        
        # Clean up the title - remove any quotes or extra spaces
        title = re.sub(r'^["\']|["\']$', '', title)
        title = title.strip()
        
        # Truncate if too long
        if len(title) > 40:
            title = title[:37] + "..."
            
        print(f"🎯 Generated chat title: '{title}' from user input: '{user_input}'")
        return title
        
    except Exception as e:
        print(f"[ERROR] Title generation failed: {str(e)}")
        # Fallback: use first 30 characters of user input
        fallback_title = user_input[:30] + "..." if len(user_input) > 30 else user_input
        return fallback_title

# -------------------- Chat History (per chat_id) --------------------

chat_histories = {}

def get_chat_history(chat_id=None):
    """Return chat history object for given chat_id. Create one if not exists."""
    if not chat_id:
        chat_id = str(uuid4())
    if chat_id not in chat_histories:
        chat_histories[chat_id] = InMemoryChatMessageHistory()
    return chat_id, chat_histories[chat_id]


# -------------------- Streaming Bot Response Function --------------------
def get_bot_response(user_input: str, model_id: str, chat_id: str = None):
    try:
        chat_id, chat_history = get_chat_history(chat_id)

        provider_model = MODEL_MAP.get(model_id, "openai/gpt-5-nano")
        model = init_model(provider_model)

        agent = create_openai_tools_agent(model, [search_tool], prompt)
        agent_executor = AgentExecutor(agent=agent, tools=[search_tool], verbose=True)

        chat_history.add_user_message(user_input)

        print(f"=== EXECUTING CHAT {chat_id} ===")
        agent_result = agent_executor.invoke({
            "input": user_input,
            "chat_history": chat_history.messages,
            "agent_scratchpad": []
        })

        final_response = agent_result["output"]
        yield final_response

        chat_history.add_ai_message(final_response)

    except Exception as e:
        print(f"[ERROR] Chat {chat_id}: {str(e)}")
        yield f"Error: {str(e)}"
