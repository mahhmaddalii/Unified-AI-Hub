from django.contrib import admin

from .models import BillingProfile, GmailOAuthCredential


@admin.register(GmailOAuthCredential)
class GmailOAuthCredentialAdmin(admin.ModelAdmin):
    list_display = ("user", "google_email", "updated_at")
    search_fields = ("user__email", "google_email")


@admin.register(BillingProfile)
class BillingProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "plan_name", "billing_status", "billing_interval", "current_period_end")
    search_fields = ("user__email", "stripe_customer_id", "stripe_subscription_id")
