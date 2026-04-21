from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_gmailoauthcredential"),
    ]

    operations = [
        migrations.CreateModel(
            name="BillingProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("stripe_customer_id", models.CharField(blank=True, default="", max_length=255)),
                ("stripe_subscription_id", models.CharField(blank=True, default="", max_length=255)),
                ("stripe_checkout_session_id", models.CharField(blank=True, default="", max_length=255)),
                ("plan_name", models.CharField(default="free", max_length=50)),
                ("billing_interval", models.CharField(default="month", max_length=20)),
                ("billing_source", models.CharField(blank=True, default="", max_length=20)),
                ("billing_status", models.CharField(default="free", max_length=50)),
                ("current_period_end", models.DateTimeField(blank=True, null=True)),
                ("last_verified_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="billing_profile", to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
