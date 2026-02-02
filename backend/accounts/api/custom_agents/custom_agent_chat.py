import os
import re
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain_tavily import TavilySearch
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import AgentExecutor, create_openai_tools_agent

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
    "general": "You are a concise, accurate, and helpful assistant. Prioritize clarity and correctness.",
    "support": "You are a customer support specialist. Be friendly, patient, and efficient.",
    "code": "You are a code assistant. Always use code blocks with proper language tags for code and explain briefly.",
    "creative": "You are a creative writing assistant. Be imaginative and expressive.",
    "technical": "You are a technical expert. Be precise, structured, and step-by-step. Avoid assumptions.",
    "research": "You are a research assistant. Be thorough and evidence-based. Distinguish facts from assumptions.",
}


PURPOSE_PROMPTS = {
    purpose: f"""{role_prompt}
    
# DOMAIN RULES:
1. **Stay in {purpose} domain** - Only answer relevant questions
2. **Documents** - Use only if relevant to {purpose}, else ignore
3. **Search** - Auto-use for time-sensitive or {purpose}-specific info
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

def get_custom_agent_response(user_input, agent_id, purpose, model_selection, is_auto_selected, custom_prompt=""):
    """
    Main function - similar to get_bot_response but for custom agents
    Each agent_id has only one chat history
    """
    try:
        # Get the single chat history for this agent
        chat_history = get_custom_agent_history(agent_id)
        
        # Determine which model to use
        model_to_use = get_agent_model(model_selection, purpose, is_auto_selected)
        
        # Build final system prompt
        system_prompt = build_final_system_prompt(purpose, custom_prompt)
        
        # Initialize model
        model = init_custom_agent_model(model_to_use)
        
        # Search tool (same as regular chat)
        search_tool = TavilySearch(max_results=3)
        
        # Create prompt with custom system message
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad")
        ])
        
        # Create agent (same as regular chat)
        agent = create_openai_tools_agent(model, [search_tool], prompt)
        agent_executor = AgentExecutor(agent=agent, tools=[search_tool], verbose=True)
        
        # Add to history
        chat_history.add_user_message(user_input)
        
        print(f"=== CUSTOM AGENT CHAT ===")
        print(f"Agent ID: {agent_id}")
        print(f"Model: {model_to_use}")
        print(f"purpose: {purpose}")
        print(f"custom prompt: {custom_prompt}")
        
        
        result = agent_executor.invoke({
            "input": user_input,
            "chat_history": chat_history.messages,
            "agent_scratchpad": []
        })
        
        response = result["output"]
        chat_history.add_ai_message(response)
        
        
        tokens = re.findall(r'\S+\s*', response)
        
        for token in tokens:
            if token.strip():
                yield token
        
    except Exception as e:
        print(f"[ERROR] Custom agent {agent_id} failed: {str(e)}")
        yield f"Error: {str(e)}"