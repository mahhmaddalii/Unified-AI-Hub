from django.db import migrations


def seed_builtin_agents(apps, schema_editor):
    Agent = apps.get_model("accounts", "Agent")

    builtin_agents = [
        {
            "id": "builtin-comsats",
            "slug": "builtin-comsats",
            "name": "Comsats Assistant",
            "description": "Official Comsats University assistant",
            "purpose": "support",
        },
        {
            "id": "builtin-cricket",
            "slug": "builtin-cricket",
            "name": "Cricket Expert",
            "description": "Cricket knowledge and match analysis",
            "purpose": "general",
        },
        {
            "id": "builtin-politics",
            "slug": "builtin-politics",
            "name": "Politics Analyst",
            "description": "Political analysis and current affairs",
            "purpose": "research",
        },
    ]

    for payload in builtin_agents:
        Agent.objects.update_or_create(
            id=payload["id"],
            defaults={
                **payload,
                "kind": "system",
                "model_preference": "gemini-flashlite",
                "system_prompt": "",
                "is_editable": False,
                "is_auto_selected": True,
                "status": "active",
                "owner_user": None,
            },
        )


def unseed_builtin_agents(apps, schema_editor):
    Agent = apps.get_model("accounts", "Agent")
    Agent.objects.filter(id__in=[
        "builtin-comsats",
        "builtin-cricket",
        "builtin-politics",
    ]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_agent_conversation_message_emailrecord_chatasset_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_builtin_agents, unseed_builtin_agents),
    ]
