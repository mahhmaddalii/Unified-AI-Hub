from langchain.chat_models import init_chat_model
from langchain_tavily import TavilySearch
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain.tools import Tool
import os,re
from dotenv import load_dotenv
from uuid import uuid4
from .documents import load_vectorstore

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
# -------------------- Document Search Tool --------------------
def document_search(query: str) -> str:
    """Search uploaded PDF documents for relevant information."""
    vectorstore = load_vectorstore()
    if not vectorstore:
        return "No documents have been uploaded in this conversation."
    
    results = vectorstore.similarity_search_with_score(query, k=3)  # increased to k=3
    if not results:
        return "No relevant documents found for your query."
    
    relevant = []
    for doc, score in results:
        if score > 0.65:  # slightly lower threshold for better recall
            relevant.append(doc.page_content.strip())
    
    if relevant:
        return "Relevant document content:\n" + "\n\n".join(relevant)
    
    return "No sufficiently relevant document content found."

document_search_tool = Tool.from_function(
    func=document_search,
    name="document_search",
    description="Search uploaded PDF documents for relevant information. Use when query relates to document content."
)

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
You are a helpful assistant with access to two tools:
1. document_search — for uploaded PDFs in this chat
2. tavily_search — for real-time web search (news, weather, cricket, stocks, current events)

MANDATORY RULES FOR TAVILY:
- For weather, news, cricket scores/matches, sports, stocks, live events, "latest", "today", "now", "current", "2025/2026" — YOU **MUST** CALL tavily_search IMMEDIATELY.
- DO NOT guess or use internal knowledge for time-sensitive info.
- DO NOT say "I couldn't retrieve" or list websites manually — always call the tool.
- If tavily_search returns no useful results, say: "I couldn't find up-to-date information right now."

HOW TO FORMAT TAVILY RESULTS (MANDATORY):
When you get results from tavily_search, ALWAYS format them like this at the end:

**Sources:**
1. **[Title from result]**
   Short summary from the content...
   [Read more](full-url-here)

2. **[Another Title]**
   Another short summary...
   [Read more](full-url-here)

- Use proper markdown links: [Read more](https://...)
- Never show raw JSON, plain URLs, or unformatted text.
- Make it clean, clickable, and professional.

For documents: always call document_search when user mentions pdf, document, uploaded file, summary of document, etc.

Be structured, accurate, and helpful like top AI assistants.

# Mandatory Formatting Rules (Follow in Every Response)

## Headers
Use markdown headers consistently:
- `#` for main title  
- `##` for section  
- `###` for sub-section  

## Code Blocks
Code Block Restriction Rule
Use code blocks only for real programming code or commands.
Never wrap plain text, explanations, or markdown examples in code blocks.

Always wrap code in fenced code blocks with the correct language tag:
```python
# Example
print("Hello")
```
When showing code output, expected output, console results, terminal output, or numbered sequences:
- ALWAYS wrap them in a proper fenced code block using triple backticks (```)
- Use ```text for plain text / numbered output
- Use ```python, ```bash, ```json etc. when appropriate

Examples:

Expected Output:
```text
1
2
3
4
5
```

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
```
Explanation
Explain how it works...

shell
Copy code

## Explanatory Question Example

# Topic Explanation

## Overview
Short overview...

## Key Concepts

Concept 1

Concept 2

## Details
Further explanation...

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
        
        tools = [search_tool, document_search_tool]
        
        agent = create_openai_tools_agent(model, tools, prompt)
        agent_executor = AgentExecutor(
            agent=agent,
            tools=tools,
            verbose=True,
            handle_parsing_errors=True
        )
        
        chat_history.add_user_message(user_input)
        print(f"=== EXECUTING CHAT {chat_id} ===")
        
        # Run the agent (tool calling happens here)
        result = agent_executor.invoke({
            "input": user_input,
            "chat_history": chat_history.messages,
            "agent_scratchpad": []
        })
        
        final_answer = result["output"]
        
        # stream final answer word-by-word
        words = final_answer.split(" ")
        for i, word in enumerate(words):
            yield word + " "
            # Small delay to simulate typing — adjust or remove
            import time
            time.sleep(0.006)  # ~15ms per word → natural speed
        
        
        
        chat_history.add_ai_message(final_answer)
        
    except Exception as e:
        print(f"[ERROR] Chat {chat_id}: {str(e)}")
        yield f"Error: {str(e)}"
