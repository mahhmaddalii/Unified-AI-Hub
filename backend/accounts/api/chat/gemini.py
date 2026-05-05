from langchain.chat_models import init_chat_model
from langchain_tavily import TavilySearch
from langchain_community.callbacks.manager import get_openai_callback
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain.tools import Tool
import os,re
from dotenv import load_dotenv
from threading import Lock
from uuid import uuid4
from .documents import load_vectorstore
from accounts.api.billing.services import extract_token_usage, get_or_create_billing_profile, record_token_usage

# -------------------- Load Environment Variables --------------------
load_dotenv()

# -------------------- Model Map --------------------
MODEL_MAP = {
    "gpt5-nano": "openai/gpt-5-nano",
    "gemini-flashlite": "google/gemini-2.5-flash-lite-preview-09-2025",
    "deepseek-chat": "deepseek/deepseek-chat",
    "claude-3 haiku": "anthropic/claude-3-haiku",
    "mistral nemo": "mistralai/mistral-nemo",
    "llama guard 4": "meta-llama/llama-3-70b-instruct",
    "gpt-oss-120b": "openai/gpt-oss-120b:free",
    "models-router": "openrouter/free"
    
}

IMAGE_GENERATION_MODEL = "gemini-2.5-flash-image"
AUTO_MODEL_DEFAULT = "gemini-flashlite"

CODE_MODEL_PATTERNS = (
    r"\b(code|debug|bug|fix|error|exception|stack trace|algorithm|sql|query|regex)\b",
    r"\b(python|javascript|typescript|java|c\+\+|c#|react|next\.js|django|flask|api)\b",
)

WRITING_MODEL_PATTERNS = (
    r"\b(write|rewrite|rephrase|draft|email|essay|blog|caption|story|poem|creative)\b",
    r"\b(improve this writing|make this sound|tone|grammar)\b",
)

SUPPORT_MODEL_PATTERNS = (
    r"\b(support|customer support|refund|billing|subscription|order|account issue)\b",
    r"\b(can't log in|cannot log in|troubleshoot|issue with my account|help me with)\b",
)

REASONING_MODEL_PATTERNS = (
    r"\b(compare|analysis|analyze|reason|plan|architecture|design|tradeoff|step by step)\b",
    r"\b(math|proof|derive|explain why|strategy|approach)\b",
)

IMAGE_MODEL_PATTERNS = (
    r"\b(generate|create|make|draw|design|illustrate)\b.*\b(image|picture|photo|poster|logo|art|artwork|avatar|banner|wallpaper)\b",
    r"\b(image|picture|photo|poster|logo|art|artwork|avatar|banner|wallpaper)\b.*\b(generate|create|make|draw|design|illustrate)\b",
    r"\bturn this into an image\b",
    r"\bcreate an image of\b",
    r"\bgenerate an image of\b",
)

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


def resolve_normal_chat_model(user_input: str, requested_model: str) -> str:
    """
    Resolve the backend model for normal chat.

    Manual selection remains untouched. The `auto` option only routes between
    the existing text models in this module, while explicit image generation
    continues to use the separate branch in chat/views.py.
    """
    if requested_model == IMAGE_GENERATION_MODEL:
        return IMAGE_GENERATION_MODEL

    if requested_model != "auto":
        return requested_model if requested_model in MODEL_MAP else "gpt5-nano"

    normalized_input = (user_input or "").strip().lower()

    if any(re.search(pattern, normalized_input) for pattern in IMAGE_MODEL_PATTERNS):
        return IMAGE_GENERATION_MODEL

    if any(re.search(pattern, normalized_input) for pattern in CODE_MODEL_PATTERNS):
        return "gpt5-nano"

    if any(re.search(pattern, normalized_input) for pattern in WRITING_MODEL_PATTERNS):
        return "claude-3 haiku"

    if any(re.search(pattern, normalized_input) for pattern in SUPPORT_MODEL_PATTERNS):
        return "deepseek-chat"

    if any(re.search(pattern, normalized_input) for pattern in REASONING_MODEL_PATTERNS):
        return "gpt5-nano"

    if len(normalized_input) > 600:
        return "gpt5-nano"

    return AUTO_MODEL_DEFAULT

# -------------------- System Prompt --------------------
system_message = """
You are a helpful assistant with access to two tools:
1. document_search — Use this to search, summarize, or answer questions from uploaded PDFs/documents in this chat. Call it whenever the user mentions "PDF", "document", "uploaded file", "summary of document", "tell me from PDF", or similar. If a file is uploaded with the message, ALWAYS assume it's the relevant document and call this tool immediately with the query.

2. tavily_search — Use this for real-time web search (news, weather, cricket, stocks, current events). Call it for any time-sensitive info.

MANDATORY RULES:
- ALWAYS check if the query involves uploaded documents FIRST. If yes, call document_search IMMEDIATELY—do NOT ask for re-uploads, clarification on "which PDF", or say you can't access it. Assume any uploaded file is the target.
- For weather, news, cricket scores/matches, sports, stocks, live events, "latest", "today", "now", "current", "2025/2026" — YOU **MUST** CALL tavily_search IMMEDIATELY.
- DO NOT guess or use internal knowledge for time-sensitive info.
- DO NOT say "I couldn't retrieve" or list websites manually — always call the tool.
- If a tool returns no useful results, say: "I couldn't find relevant information right now." For document_search, add: "Please check if the file was uploaded correctly."

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

Be structured, accurate, and helpful like top AI assistants. ALWAYS prioritize tool calls over direct responses for the specified scenarios.

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
        provider_model = MODEL_MAP["gpt-oss-120b"]  
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
chat_lock = Lock()


def build_chat_history(history_messages=None):
    chat_history = InMemoryChatMessageHistory()
    for message in history_messages or []:
        text = getattr(message, "content_text", "") or ""
        role = getattr(message, "role", "")
        if not text:
            continue
        if role == "user":
            chat_history.add_message(HumanMessage(content=text))
        elif role == "assistant":
            chat_history.add_message(AIMessage(content=text))
        elif role == "system":
            chat_history.add_message(SystemMessage(content=text))
    return chat_history


# -------------------- Streaming Bot Response Function --------------------
def get_bot_response(user_input: str, model_id: str, history_messages=None, user=None, track_tokens=False):
    try:
        chat_history = build_chat_history(history_messages)
        resolved_model_id = resolve_normal_chat_model(user_input, model_id)
        provider_model = MODEL_MAP.get(resolved_model_id, "openai/gpt-5-nano")
        model = init_model(provider_model)
        
        tools = [search_tool, document_search_tool]
        
        agent = create_openai_tools_agent(model, tools, prompt)
        agent_executor = AgentExecutor(
            agent=agent,
            tools=tools,
            verbose=True,
            handle_parsing_errors=True
        )
        
        print("=== EXECUTING CHAT ===")
        print(f"Requested model: {model_id}")
        print(f"Resolved model: {resolved_model_id}")
        
        # Run the agent (tool calling happens here)
        with get_openai_callback() as callback:
            result = agent_executor.invoke({
                "input": user_input,
                "chat_history": chat_history.messages,
                "agent_scratchpad": []
            })
        
        final_answer = result["output"]
        usage = extract_token_usage(callback)

        if track_tokens and user:
            try:
                profile = get_or_create_billing_profile(user)
                record_token_usage(profile, **usage)
                print(
                    "Token usage recorded for chat: "
                    f"in={usage['input_tokens']} out={usage['output_tokens']} total={usage['total_tokens']}"
                )
            except Exception as usage_error:
                print(f"[WARN] Token usage recording failed for chat: {usage_error}")
        
        # stream final answer word-by-word
        words = final_answer.split(" ")
        for i, word in enumerate(words):
            yield word + " "
            # Small delay to simulate typing — adjust or remove
            import time
            time.sleep(0.006)  # ~15ms per word → natural speed
        
    except Exception as e:
        print(f"[ERROR] Chat: {str(e)}")
        yield f"Error: {str(e)}"
