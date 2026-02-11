import os
import re
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain_tavily import TavilySearch
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain.tools import Tool
from accounts.api.chat.documents import load_vectorstore

load_dotenv()


MODEL_MAP = {
    "gpt5-nano": "openai/gpt-5-nano",
    "gemini-flashlite": "google/gemini-2.0-flash-lite-001",
    "deepseek-chat": "deepseek/deepseek-chat",
    "claude-3 haiku": "anthropic/claude-3-haiku",
    "mistral nemo": "mistralai/mistral-nemo",
    "llama guard 4": "meta-llama/llama-4-maverick",
    "auto": "gemini-flashlite"
}

CORE_FORMATTING_RULES = """ # Mandatory Formatting Rules (Follow in Every Response)

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

# Purpose to default model mapping for auto-selection
PURPOSE_MODEL_MAP = {
    "general": "gpt5-nano",
    "support": "deepseek-chat",
    "code": "gpt5-nano",
    "creative": "claude-3 haiku",
    "technical": "gpt5-nano",
    "research": "claude-3 haiku",
}

ROLE_PROMPTS = {
    "general": """You are a concise, accurate, and helpful assistant for general topics. Prioritize clarity and correctness.
If the question is too specialized or off-topic, politely redirect: "I'm best at general questions. For more specific topics, try a specialized agent.""",
    
    "support": """You are a customer support specialist. Be friendly, patient, and efficient. Only answer support-related questions (troubleshooting, product help, account issues).
If the question is not support-related, politely say: "I'm specialized in customer support. Please ask something relevant or try a general agent.""",
    
    "code": """You are a code assistant. Always use proper code blocks with language tags and explain clearly. Only answer coding, debugging, algorithms, or programming questions.
If the question is not about code, politely say: "I'm specialized in coding. Please ask something relevant or try a general agent.""",
    
    "creative": """You are a creative writing assistant. Be imaginative, expressive, and original. Only answer creative writing, storytelling, poetry, or idea-generation questions.
If the question is not creative, politely say: "I'm specialized in creative writing. Please ask something relevant or try a general agent.""",
    
    "technical": """You are a technical expert. Be precise, structured, and step-by-step. Only answer technical, engineering, science, or hardware/software questions.
If the question is not technical, politely say: "I'm specialized in technical topics. Please ask something relevant or try a general agent.""",
    
    "research": """You are a research assistant. Be thorough, evidence-based, and distinguish facts from assumptions. Only answer research, data analysis, or academic questions.
If the question is not research-related, politely say: "I'm specialized in research. Please ask something relevant or try a general agent."""
}


PURPOSE_PROMPTS = {
    purpose: f"""{role_prompt}

You have access to two tools:
1. document_search — for uploaded files/PDFs in this chat
2. tavily_search — for real-time web information

MANDATORY TAVILY RULES:
- For ANY time-sensitive or current information (weather, news, cricket scores, sports results, stocks, live events, "today", "now", "latest", "current", "2025", "2026") → YOU **MUST** CALL tavily_search IMMEDIATELY.
- DO NOT guess or use internal knowledge for recent/current topics.
- DO NOT say "I couldn't retrieve" or list websites manually — always call the tool.
- If tavily_search returns no useful results, say: "I couldn't find up-to-date information right now."

MANDATORY SOURCES FORMATTING (when using Tavily):
Always format Tavily results at the end like this:

**Sources:**
1. **[Title or Site Name]**
   Short summary from the content...
   [Read more](full-url-here)

2. **[Another Title]**
   Another short summary...
   [Read more](full-url-here)

- Use proper markdown links: [Read more](https://...)
- Never show raw JSON, plain URLs, or unformatted text.
- Make it clean, clickable, and professional.

DOCUMENT RULES:
- Documents MAY exist in this chat.
- ONLY call document_search when the user explicitly mentions "document", "pdf", "uploaded file", "file", "summary of document", "explain the document", "file content", or similar.
   
         
# DOMAIN RULES:
1. **Stay in {purpose} domain** - Only answer relevant questions
2. **Documents** - Documents MAY exist in this chat. ALWAYS call document_search when user mentions document, pdf, uploaded file, summary of document, explain document, file content, or similar.
3. **Search** - Auto-use Tavily for time-sensitive or {purpose}-specific info
4. **Custom prompts** - Follow if they fit your {purpose} role

{CORE_FORMATTING_RULES}"""
    for purpose, role_prompt in ROLE_PROMPTS.items()
}



custom_agent_histories = {}

def get_custom_agent_history(agent_id):
    """Get chat history for this agent (only one chat per agent)"""
    if agent_id not in custom_agent_histories:
        custom_agent_histories[agent_id] = InMemoryChatMessageHistory()
    
    return custom_agent_histories[agent_id]

#Initialize Model
def init_custom_agent_model(model_id):
    """Initialize model for custom agent"""
    if model_id not in MODEL_MAP:
        model_id = "gemini-flashlite"
    
    return init_chat_model(
        MODEL_MAP[model_id],
        model_provider="openai",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url="https://openrouter.ai/api/v1",
        streaming=True
    )

#Build Final System Prompt
def build_final_system_prompt(purpose, custom_prompt=""):
    """Combine purpose template with custom prompt"""
    base_prompt = PURPOSE_PROMPTS.get(purpose, PURPOSE_PROMPTS["general"])
    
    if custom_prompt and custom_prompt.strip():
        return f"""{base_prompt}

Additional instructions for this agent:
{custom_prompt.strip()}"""
    else:
        return base_prompt

# Determine Model to Use
def get_agent_model(model_selection, purpose, is_auto_selected):
    """Get model based on auto/manual selection"""
    if is_auto_selected:
        return PURPOSE_MODEL_MAP.get(purpose, "gemini-flashlite")
    else:
        return model_selection if model_selection in MODEL_MAP else "gemini-flashlite"


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


def get_custom_agent_response(user_input, agent_id, purpose, model_selection, is_auto_selected, custom_prompt=""):
    try:
        chat_history = get_custom_agent_history(agent_id)
        model_to_use = get_agent_model(model_selection, purpose, is_auto_selected)
        system_prompt = build_final_system_prompt(purpose, custom_prompt)
        model = init_custom_agent_model(model_to_use)
        
        search_tool = TavilySearch(max_results=3)
        tools = [search_tool, document_search_tool]
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad")
        ])
        
        agent = create_openai_tools_agent(model, tools, prompt)
        agent_executor = AgentExecutor(
            agent=agent,
            tools=tools,
            verbose=True,
            handle_parsing_errors=True
        )
        
        chat_history.add_user_message(user_input)
        
        print(f"=== CUSTOM AGENT CHAT ===")
        print(f"Agent ID: {agent_id}")
        print(f"Model: {model_to_use}")
        print(f"Purpose: {purpose}")
        print(f"Custom prompt: {custom_prompt}")
        
        # Run agent (tools are called here)
        result = agent_executor.invoke({
            "input": user_input,
            "chat_history": chat_history.messages,
            "agent_scratchpad": []
        })
        
        final_answer = result["output"]
        
        # Stream the final answer word-by-word
        words = final_answer.split(" ")
        for i, word in enumerate(words):
            yield word + " "
            import time
            time.sleep(0.004) 
        
        chat_history.add_ai_message(final_answer)
        
    except Exception as e:
        print(f"[ERROR] Custom agent {agent_id} failed: {str(e)}")
        yield f"Error: {str(e)}"