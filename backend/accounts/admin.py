from django.contrib import admin

from .models import Agent, BillingProfile, ChatAsset, Conversation, EmailRecord, GmailOAuthCredential, Message


@admin.register(GmailOAuthCredential)
class GmailOAuthCredentialAdmin(admin.ModelAdmin):
    list_display = ("user", "google_email", "updated_at")
    search_fields = ("user__email", "google_email")


@admin.register(BillingProfile)
class BillingProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "plan_name", "billing_status", "billing_interval", "current_period_end")
    search_fields = ("user__email", "stripe_customer_id", "stripe_subscription_id")


@admin.register(Agent)
class AgentAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "kind", "owner_user", "status", "updated_at")
    list_filter = ("kind", "status", "purpose")
    search_fields = ("id", "name", "slug", "owner_user__email")


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "conversation_type", "agent", "title", "last_message_at", "status")
    list_filter = ("conversation_type", "status")
    search_fields = ("title", "user__email", "agent__name")


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "sequence_no", "role", "message_type", "status", "created_at")
    list_filter = ("role", "message_type", "status")
    search_fields = ("conversation__title", "content_text")


@admin.register(ChatAsset)
class ChatAssetAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "message", "asset_type", "original_name", "created_at")
    list_filter = ("asset_type",)
    search_fields = ("original_name", "conversation__title")


@admin.register(EmailRecord)
class EmailRecordAdmin(admin.ModelAdmin):
    list_display = ("recipient_email", "user", "status", "gmail_message_id", "sent_at")
    list_filter = ("status",)
    search_fields = ("recipient_email", "subject", "gmail_message_id", "user__email")
