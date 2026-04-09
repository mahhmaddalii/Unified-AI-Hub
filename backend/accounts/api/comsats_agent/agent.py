import os
from datetime import datetime
from threading import Lock

from django.contrib.auth.models import AnonymousUser
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.tools import StructuredTool
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from .gmail import build_gmail_oauth_url, is_gmail_connected, send_gmail_email

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


def get_or_create_chat_history(thread_id):
    with chat_lock:
        return chat_histories.setdefault(thread_id, InMemoryChatMessageHistory())


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


def get_comsats_response(query: str, thread_id="comsats_agent_chat", user=None):
    try:
        chat_history = get_or_create_chat_history(thread_id)
        tools = [build_email_tool_for_user(user)]

        agent = create_openai_tools_agent(llm, tools, prompt)
        agent_executor = AgentExecutor(
            agent=agent,
            tools=tools,
            verbose=True,
            handle_parsing_errors=True,
        )

        chat_history.add_user_message(query)
        result = agent_executor.invoke({
            "input": query,
            "chat_history": chat_history.messages,
            "agent_scratchpad": [],
        })
        answer_text = result["output"].strip()
        chat_history.add_ai_message(answer_text)
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
