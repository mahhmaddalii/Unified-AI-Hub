from django.db import migrations


PREFIX = "Chat with "


def remove_chat_with_prefix(apps, schema_editor):
    Conversation = apps.get_model("accounts", "Conversation")

    conversations = Conversation.objects.filter(
        conversation_type__in=["custom_agent", "domain_agent"],
        title__startswith=PREFIX,
    )

    for conversation in conversations.iterator():
        stripped_title = (conversation.title or "")[len(PREFIX):].strip() or "New Chat"
        conversation.title = stripped_title
        conversation.save(update_fields=["title", "updated_at"])


def add_chat_with_prefix(apps, schema_editor):
    Conversation = apps.get_model("accounts", "Conversation")

    conversations = Conversation.objects.filter(
        conversation_type__in=["custom_agent", "domain_agent"],
    ).select_related("agent")

    for conversation in conversations.iterator():
        agent = getattr(conversation, "agent", None)
        agent_name = (getattr(agent, "name", "") or "").strip()
        title = (conversation.title or "").strip()

        if not title or title == "New Chat" or title.startswith(PREFIX):
            continue
        if agent_name and title == agent_name:
            conversation.title = f"{PREFIX}{agent_name}"
            conversation.save(update_fields=["title", "updated_at"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0007_seed_shared_custom_agents"),
    ]

    operations = [
        migrations.RunPython(remove_chat_with_prefix, add_chat_with_prefix),
    ]
