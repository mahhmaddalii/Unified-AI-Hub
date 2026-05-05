from django.db import migrations


def seed_shared_custom_agents(apps, schema_editor):
    Agent = apps.get_model("accounts", "Agent")

    shared_agents = [
        {
            "id": "agent-1",
            "slug": "shared-customer-support-bot",
            "name": "Customer Support Bot",
            "description": "Customer Support Bot - Customer Support AI Assistant",
            "purpose": "support",
            "model_preference": "deepseek-chat",
            "system_prompt": "Always respond in friendly tone",
        },
        {
            "id": "agent-2",
            "slug": "shared-code-assistant",
            "name": "Code Assistant",
            "description": "Code Assistant - Code Assistant AI Assistant",
            "purpose": "code",
            "model_preference": "gpt5-nano",
            "system_prompt": "Specialize in Python programming",
        },
    ]

    for payload in shared_agents:
        Agent.objects.update_or_create(
            id=payload["id"],
            defaults={
                **payload,
                "owner_user": None,
                "kind": "custom",
                "is_editable": False,
                "is_auto_selected": False,
                "status": "active",
            },
        )


def unseed_shared_custom_agents(apps, schema_editor):
    Agent = apps.get_model("accounts", "Agent")
    Agent.objects.filter(id__in=["agent-1", "agent-2"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0006_seed_builtin_agents"),
    ]

    operations = [
        migrations.RunPython(seed_shared_custom_agents, unseed_shared_custom_agents),
    ]
