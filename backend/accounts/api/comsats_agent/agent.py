import json
import os
import re
from datetime import datetime
from threading import Lock

from django.contrib.auth.models import AnonymousUser
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_community.callbacks.manager import get_openai_callback
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.tools import StructuredTool
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
from accounts.api.billing.services import extract_token_usage, get_or_create_billing_profile, record_token_usage

from .gmail import build_gmail_oauth_url, is_gmail_connected, send_gmail_email

EMAIL_DRAFT_TAG = "[EMAIL_DRAFT]"

llm = ChatOpenAI(
    model="x-ai/grok-4.1-fast",
    openai_api_key=os.getenv("OPENROUTER_API_KEY"),
    openai_api_base="https://openrouter.ai/api/v1",
    temperature=0.4,
    streaming=False,
)

chat_histories = {}
chat_lock = Lock()

SYSTEM_PROMPT = f"""You are a knowledgeable COMSATS campus assistant.
Today is {datetime.now().strftime('%B %d, %Y')}.

Rules:
- Answer concisely, accurately, and helpfully.
- Stay focused on COMSATS university issues, campus processes, and student support questions.
- Do not invent faculty email addresses. If the exact official recipient email is not known, ask the user for it.
- Only use the email tool after the user explicitly confirms they want the email sent.
- Before sending, make sure the final email has a clear recipient, subject, and body.
- If Gmail is not connected, guide the user to connect it using the link returned by the tool.
- Only send to official COMSATS addresses ending in @cuilahore.edu.pk.
- When the user asks for an email draft but has not explicitly confirmed sending, produce the draft in this exact format:
  To: recipient@cuilahore.edu.pk
  Subject: Short subject
  Body:
  Full email body here
"""

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])


class SendUniversityEmailInput(BaseModel):
    recipient_email: str = Field(description="Official COMSATS recipient email address ending in @cuilahore.edu.pk")
    subject: str = Field(description="Clear subject line for the email")
    body: str = Field(description="Final email body to send")


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
        elif role == "system":
            built_messages.append(SystemMessage(content=text))
    return built_messages


def build_email_tool_for_user(user):
    def _send_university_email(recipient_email: str, subject: str, body: str):
        if not user or isinstance(user, AnonymousUser) or not getattr(user, "is_authenticated", False):
            return "You need to be logged in before I can send an email from your Gmail account."

        if not is_gmail_connected(user):
            connect_url = build_gmail_oauth_url(user)
            return (
                "Your Gmail account is not connected yet. "
                f"Open this link to connect it first: {connect_url}"
            )

        payload = send_gmail_email(
            user=user,
            recipient_email=recipient_email.strip(),
            subject=subject.strip(),
            body=body.strip(),
        )
        message_id = payload.get("id", "unknown")
        return (
            f"Email sent successfully from {user.email} to {recipient_email.strip()}. "
            f"Gmail message id: {message_id}"
        )

    return StructuredTool.from_function(
        func=_send_university_email,
        name="send_university_email",
        description=(
            "Send an email from the logged-in student's Gmail account to an official COMSATS recipient. "
            "Use only after the user explicitly confirms they want the email sent and you have the final "
            "recipient_email, subject, and body."
        ),
        args_schema=SendUniversityEmailInput,
    )


def extract_email_draft(answer_text: str):
    normalized = answer_text.replace("**", "").strip()
    match = re.search(
        r"(?:^|\n)(?:to|recipient)\s*:\s*(?P<recipient>[^\n]+)\n+subject\s*:\s*(?P<subject>[^\n]+)\n+body\s*:\s*(?P<body>.+)$",
        normalized,
        re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return None

    recipient_email = match.group("recipient").strip()
    subject = match.group("subject").strip()
    body = match.group("body").strip()

    if not recipient_email or not subject or not body:
        return None

    if "@cuilahore.edu.pk" not in recipient_email.lower():
        return None

    return {
        "recipient_email": recipient_email,
        "subject": subject,
        "body": body,
    }


def get_comsats_response(query: str, thread_id="comsats_agent_chat", history_messages=None, user=None, track_tokens=False):
    try:
        chat_history = build_chat_history(history_messages)
        tools = [build_email_tool_for_user(user)]

        agent = create_openai_tools_agent(llm, tools, prompt)
        agent_executor = AgentExecutor(
            agent=agent,
            tools=tools,
            verbose=True,
            handle_parsing_errors=True,
        )

        with get_openai_callback() as callback:
            result = agent_executor.invoke({
                "input": query,
                "chat_history": chat_history,
                "agent_scratchpad": [],
            })
        answer_text = result["output"].strip()
        usage = extract_token_usage(callback)
        if "email sent successfully" not in answer_text.lower():
            draft = extract_email_draft(answer_text)
            if draft:
                answer_text = f"{answer_text}\n\n{EMAIL_DRAFT_TAG}{json.dumps(draft)}"
        if track_tokens and user:
            try:
                profile = get_or_create_billing_profile(user)
                record_token_usage(profile, **usage)
            except Exception as usage_error:
                print(f"[WARN] Comsats token usage recording failed: {usage_error}")
        return answer_text
    except Exception as e:
        return f"⚠️ Error: {str(e)}"


def reset_comsats_chat(thread_id=None):
    global chat_histories
    with chat_lock:
        if thread_id:
            chat_histories.pop(thread_id, None)
        else:
            chat_histories = {}
    return True
