import base64
import binascii
import mimetypes
import os
import uuid
from typing import Iterable, Optional

import requests
from django.core.files.base import ContentFile
from django.db import transaction
from django.db import models
from django.db.models import Max
from django.utils import timezone

from accounts.models import Agent, ChatAsset, Conversation, EmailRecord, Message


BUILTIN_AGENT_IDS = {
    "builtin-comsats",
    "builtin-cricket",
    "builtin-politics",
}
SHARED_CUSTOM_AGENT_IDS = {
    "agent-1",
    "agent-2",
}
DEFAULT_CUSTOM_AGENT_TEMPLATES = [
    {
        "template_id": "agent-1",
        "slug": "default-customer-support-bot",
        "name": "Customer Support Bot",
        "description": "Customer Support Bot - Customer Support AI Assistant",
        "purpose": "support",
        "model_preference": "deepseek-chat",
        "system_prompt": "Always respond in friendly tone",
        "is_auto_selected": False,
    },
    {
        "template_id": "agent-2",
        "slug": "default-code-assistant",
        "name": "Code Assistant",
        "description": "Code Assistant - Code Assistant AI Assistant",
        "purpose": "code",
        "model_preference": "gpt5-nano",
        "system_prompt": "Specialize in Python programming",
        "is_auto_selected": False,
    },
]


def build_custom_agent_id() -> str:
    return f"agent-{int(timezone.now().timestamp() * 1000)}-{uuid.uuid4().hex[:9]}"


def _default_user_agent_id(template_id: str, user_id) -> str:
    return f"{template_id}-user-{user_id}"


def _agent_conversation_title(agent: Optional[Agent]) -> str:
    if not agent:
        return "New Chat"
    return (agent.name or "").strip() or "New Chat"


def ensure_default_custom_agents_for_user(user):
    created_or_existing = []

    for template in DEFAULT_CUSTOM_AGENT_TEMPLATES:
        user_agent_id = _default_user_agent_id(template["template_id"], user.pk)
        agent = Agent.objects.filter(
            id=user_agent_id,
            owner_user=user,
            kind=Agent.Kind.CUSTOM,
        ).first()

        if agent is None:
            agent = Agent.objects.create(
                id=user_agent_id,
                owner_user=user,
                kind=Agent.Kind.CUSTOM,
                slug=f"{template['slug']}-{user.pk}",
                name=template["name"],
                description=template["description"],
                purpose=template["purpose"],
                model_preference=template["model_preference"],
                system_prompt=template["system_prompt"],
                is_editable=True,
                is_auto_selected=template["is_auto_selected"],
                status=Agent.Status.ACTIVE,
            )

        Conversation.objects.filter(
            user=user,
            agent_id=template["template_id"],
            conversation_type=Conversation.ConversationType.CUSTOM_AGENT,
        ).update(agent=agent)

        created_or_existing.append(agent)

    return created_or_existing


def _humanize_datetime(value):
    if not value:
        return "Never"

    now = timezone.now()
    safe_value = value
    if timezone.is_naive(safe_value):
        safe_value = timezone.make_aware(safe_value, timezone.get_current_timezone())

    delta = now - safe_value
    total_seconds = max(int(delta.total_seconds()), 0)

    if total_seconds < 60:
        return "Just now"

    total_minutes = total_seconds // 60
    if total_minutes < 60:
        return f"{total_minutes} minute{'s' if total_minutes != 1 else ''} ago"

    total_hours = total_minutes // 60
    if total_hours < 24:
        return f"{total_hours} hour{'s' if total_hours != 1 else ''} ago"

    total_days = total_hours // 24
    return f"{total_days} day{'s' if total_days != 1 else ''} ago"


def serialize_agent(agent: Agent) -> dict:
    return {
        "id": agent.id,
        "name": agent.name,
        "purpose": agent.purpose,
        "model": agent.model_preference or "gemini-flashlite",
        "status": agent.status,
        "customPrompt": agent.system_prompt or "",
        "isAutoSelected": agent.is_auto_selected,
        "isBuiltIn": agent.kind == Agent.Kind.SYSTEM,
        "isEditable": agent.is_editable,
        "description": agent.description or "",
        "lastActive": _humanize_datetime(agent.updated_at or agent.created_at),
        "createdAt": agent.created_at.isoformat() if agent.created_at else None,
        "updatedAt": agent.updated_at.isoformat() if agent.updated_at else None,
    }


def serialize_conversation(conversation: Conversation, request=None, include_messages: bool = False) -> dict:
    payload = {
        "id": str(conversation.id),
        "name": conversation.title or "New Chat",
        "title": conversation.title or "New Chat",
        "lastActive": _humanize_datetime(conversation.last_message_at or conversation.updated_at),
        "lastActiveAt": (
            (conversation.last_message_at or conversation.updated_at).isoformat()
            if (conversation.last_message_at or conversation.updated_at)
            else None
        ),
        "agentId": conversation.agent_id,
        "conversationType": conversation.conversation_type,
        "createdAt": conversation.created_at.isoformat() if conversation.created_at else None,
        "updatedAt": conversation.updated_at.isoformat() if conversation.updated_at else None,
    }
    if include_messages:
        payload["messages"] = [serialize_message(message, request=request) for message in conversation.messages.all()]
    return payload


def serialize_message(message: Message, request=None) -> dict:
    content_json = message.content_json or {}
    uploaded_files = []
    image_url = None

    for asset in message.assets.all():
        asset_url = asset.file.url if asset.file else ""
        if request and asset_url:
            asset_url = request.build_absolute_uri(asset_url)
        if asset.asset_type == ChatAsset.AssetType.GENERATED_IMAGE:
            image_url = asset_url
        elif asset.asset_type == ChatAsset.AssetType.UPLOADED_PDF:
            uploaded_files.append({
                "name": asset.original_name,
                "size": asset.size_bytes,
                "type": asset.mime_type or "application/pdf",
                "url": asset_url,
            })

    sent_record = message.email_records.filter(status=EmailRecord.Status.SENT).order_by("-created_at").first()
    email_draft = content_json.get("email_draft")

    payload = {
        "id": str(message.id),
        "role": message.role,
        "text": message.content_text or "",
        "createdAt": message.created_at.isoformat() if message.created_at else None,
        "status": message.status,
    }

    if image_url:
        payload["image"] = image_url
    if uploaded_files:
        payload["files"] = uploaded_files
    if email_draft:
        payload["emailDraft"] = email_draft
        payload["emailDraftReady"] = True
        payload["emailDraftDismissed"] = bool(content_json.get("email_draft_dismissed", False))
    if sent_record:
        payload["emailSent"] = True
        payload["gmailMessageId"] = sent_record.gmail_message_id
        payload["emailSentAt"] = sent_record.sent_at.isoformat() if sent_record.sent_at else None

    return payload


def get_custom_agents_for_user(user):
    ensure_default_custom_agents_for_user(user)
    return Agent.objects.filter(
        owner_user=user,
        kind=Agent.Kind.CUSTOM,
        status__in=[Agent.Status.ACTIVE, Agent.Status.INACTIVE],
    ).order_by("owner_user_id", "-updated_at", "name")


def get_builtin_agent(agent_id: str) -> Optional[Agent]:
    return Agent.objects.filter(id=agent_id, kind=Agent.Kind.SYSTEM).first()


def get_user_custom_agent(user, agent_id: str) -> Optional[Agent]:
    ensure_default_custom_agents_for_user(user)
    return Agent.objects.filter(
        id=agent_id,
        owner_user=user,
        kind=Agent.Kind.CUSTOM,
        status__in=[Agent.Status.ACTIVE, Agent.Status.INACTIVE],
    ).first()


def create_custom_agent(user, *, name: str, purpose: str, model: str, custom_prompt: str, is_auto_selected: bool, description: str) -> Agent:
    return Agent.objects.create(
        id=build_custom_agent_id(),
        owner_user=user,
        kind=Agent.Kind.CUSTOM,
        slug=uuid.uuid4().hex[:16],
        name=name,
        description=description,
        purpose=purpose,
        model_preference=model,
        system_prompt=custom_prompt,
        is_editable=True,
        is_auto_selected=is_auto_selected,
        status=Agent.Status.ACTIVE,
    )


def update_custom_agent(agent: Agent, *, name: str, model: str, custom_prompt: str, is_auto_selected: bool, description: str) -> Agent:
    agent.name = name
    agent.model_preference = model
    agent.system_prompt = custom_prompt
    agent.is_auto_selected = is_auto_selected
    agent.description = description
    agent.save(update_fields=[
        "name",
        "model_preference",
        "system_prompt",
        "is_auto_selected",
        "description",
        "updated_at",
    ])
    return agent


def archive_custom_agent(agent: Agent):
    agent.status = Agent.Status.ARCHIVED
    agent.save(update_fields=["status", "updated_at"])


def toggle_custom_agent_status(agent: Agent) -> Agent:
    agent.status = Agent.Status.INACTIVE if agent.status == Agent.Status.ACTIVE else Agent.Status.ACTIVE
    agent.save(update_fields=["status", "updated_at"])
    return agent


def get_user_conversation(user, conversation_id) -> Optional[Conversation]:
    return Conversation.objects.filter(user=user, id=conversation_id, status=Conversation.Status.ACTIVE).first()


def list_user_conversations(user):
    ensure_default_custom_agents_for_user(user)
    return (
        Conversation.objects.filter(user=user, status=Conversation.Status.ACTIVE)
        .select_related("agent")
        .prefetch_related("messages__assets", "messages__email_records")
        .order_by("-last_message_at", "-created_at")
    )


def create_conversation(user, *, conversation_type=Conversation.ConversationType.NORMAL, agent: Agent = None, title: str = "New Chat") -> Conversation:
    return Conversation.objects.create(
        user=user,
        agent=agent,
        conversation_type=conversation_type,
        title=title or "New Chat",
    )


def get_or_create_custom_agent_conversation(user, agent: Agent) -> tuple[Conversation, bool]:
    existing = (
        Conversation.objects.filter(
            user=user,
            agent=agent,
            conversation_type=Conversation.ConversationType.CUSTOM_AGENT,
            status=Conversation.Status.ACTIVE,
        )
        .order_by("-updated_at")
        .first()
    )
    if existing:
        return existing, False

    return create_conversation(
        user,
        conversation_type=Conversation.ConversationType.CUSTOM_AGENT,
        agent=agent,
        title=_agent_conversation_title(agent),
    ), True


def assign_agent_to_conversation(conversation: Conversation, agent: Agent, conversation_type: Optional[str] = None):
    fields = []
    if conversation.agent_id != agent.id:
        conversation.agent = agent
        fields.append("agent")
    if conversation_type and conversation.conversation_type != conversation_type:
        conversation.conversation_type = conversation_type
        fields.append("conversation_type")
    if conversation.title == "New Chat" and agent:
        conversation.title = _agent_conversation_title(agent)
        fields.append("title")
    if fields:
        fields.append("updated_at")
        conversation.save(update_fields=fields)


def rename_conversation(conversation: Conversation, title: str):
    conversation.title = (title or "New Chat").strip() or "New Chat"
    conversation.save(update_fields=["title", "updated_at"])


def soft_delete_conversation(conversation: Conversation):
    conversation.status = Conversation.Status.DELETED
    conversation.save(update_fields=["status", "updated_at"])


def get_recent_context_messages(conversation: Conversation, limit: int = 10) -> list[Message]:
    return list(
        conversation.messages.filter(status__in=[Message.Status.COMPLETED, Message.Status.STREAMING])
        .order_by("-sequence_no")[:limit]
    )[::-1]


@transaction.atomic
def create_message(
    conversation: Conversation,
    *,
    role: str,
    user=None,
    content_text: str = "",
    message_type: str = Message.MessageType.NORMAL,
    status: str = Message.Status.COMPLETED,
    model_used: str = "",
    content_json: Optional[dict] = None,
    input_tokens: int = 0,
    output_tokens: int = 0,
    total_tokens: int = 0,
) -> Message:
    current_max = (
        Message.objects.select_for_update()
        .filter(conversation=conversation)
        .aggregate(max_sequence=Max("sequence_no"))
        .get("max_sequence")
        or 0
    )
    message = Message.objects.create(
        conversation=conversation,
        user=user,
        role=role,
        content_text=content_text,
        content_json=content_json or {},
        message_type=message_type,
        sequence_no=current_max + 1,
        model_used=model_used,
        status=status,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
    )
    conversation.last_message_at = message.created_at
    conversation.save(update_fields=["last_message_at", "updated_at"])
    return message


def update_message(
    message: Message,
    *,
    content_text: Optional[str] = None,
    content_json: Optional[dict] = None,
    status: Optional[str] = None,
    model_used: Optional[str] = None,
    input_tokens: Optional[int] = None,
    output_tokens: Optional[int] = None,
    total_tokens: Optional[int] = None,
):
    fields = []
    if content_text is not None:
        message.content_text = content_text
        fields.append("content_text")
    if content_json is not None:
        message.content_json = content_json
        fields.append("content_json")
    if status is not None:
        message.status = status
        fields.append("status")
    if model_used is not None:
        message.model_used = model_used
        fields.append("model_used")
    if input_tokens is not None:
        message.input_tokens = input_tokens
        fields.append("input_tokens")
    if output_tokens is not None:
        message.output_tokens = output_tokens
        fields.append("output_tokens")
    if total_tokens is not None:
        message.total_tokens = total_tokens
        fields.append("total_tokens")
    if fields:
        fields.append("updated_at")
        message.save(update_fields=fields)
        conversation = message.conversation
        conversation.last_message_at = timezone.now()
        conversation.save(update_fields=["last_message_at", "updated_at"])
    return message


def store_uploaded_assets(user, conversation: Conversation, files: Iterable) -> list[ChatAsset]:
    assets = []
    for uploaded_file in files:
        asset = ChatAsset(
            conversation=conversation,
            user=user,
            asset_type=ChatAsset.AssetType.UPLOADED_PDF,
            original_name=uploaded_file.name,
            mime_type=getattr(uploaded_file, "content_type", "") or "application/pdf",
            size_bytes=getattr(uploaded_file, "size", 0) or 0,
        )
        asset.file.save(uploaded_file.name, uploaded_file, save=False)
        asset.save()
        assets.append(asset)
    return assets


def attach_pending_assets_to_message(conversation: Conversation, message: Message):
    ChatAsset.objects.filter(conversation=conversation, message__isnull=True).update(message=message)


def _guess_file_extension(content_type: str, source_url: str) -> str:
    if content_type:
        guessed = mimetypes.guess_extension(content_type.split(";")[0].strip())
        if guessed:
            return guessed
    _, ext = os.path.splitext(source_url or "")
    return ext or ".png"


def _decode_generated_image_payload(source_url: str) -> tuple[bytes, str]:
    normalized = (source_url or "").strip()
    if not normalized:
        raise ValueError("Empty generated image payload.")

    if normalized.startswith("http://") or normalized.startswith("https://"):
        response = requests.get(normalized, timeout=60)
        response.raise_for_status()
        content_type = response.headers.get("Content-Type", "image/png")
        return response.content, content_type

    if normalized.startswith("data:image/"):
        header, _, encoded = normalized.partition(",")
        if not encoded:
            raise ValueError("Invalid data URL image payload.")
        mime_part = header.split(";", 1)[0]
        content_type = mime_part.replace("data:", "", 1) or "image/png"
        return base64.b64decode(encoded), content_type

    try:
        return base64.b64decode(normalized, validate=True), "image/png"
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Unsupported generated image payload format.") from exc


def save_remote_image_asset(user, conversation: Conversation, message: Message, *, source_url: str, prompt_text: str = "") -> Optional[ChatAsset]:
    if not source_url:
        return None

    payload_bytes, content_type = _decode_generated_image_payload(source_url)
    extension = _guess_file_extension(content_type, source_url)
    filename = f"{uuid.uuid4().hex}{extension}"

    asset = ChatAsset(
        conversation=conversation,
        message=message,
        user=user,
        asset_type=ChatAsset.AssetType.GENERATED_IMAGE,
        original_name=filename,
        mime_type=content_type,
        size_bytes=len(payload_bytes),
        source_url=source_url,
        prompt_text=prompt_text,
    )
    asset.file.save(filename, ContentFile(payload_bytes), save=False)
    asset.save()
    return asset


def create_email_record(*, conversation: Conversation, message: Optional[Message], user, agent: Optional[Agent], recipient_email: str, subject: str, body: str, gmail_message_id: str = "", status: str = EmailRecord.Status.SENT, error_message: str = "") -> EmailRecord:
    return EmailRecord.objects.create(
        conversation=conversation,
        message=message,
        user=user,
        agent=agent,
        recipient_email=recipient_email,
        subject=subject,
        body=body,
        gmail_message_id=gmail_message_id,
        status=status,
        sent_at=timezone.now() if status == EmailRecord.Status.SENT else None,
        error_message=error_message,
    )
