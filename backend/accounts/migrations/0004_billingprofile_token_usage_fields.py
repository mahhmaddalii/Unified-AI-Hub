from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_billingprofile"),
    ]

    operations = [
        migrations.AddField(
            model_name="billingprofile",
            name="token_input_used",
            field=models.BigIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="billingprofile",
            name="token_output_used",
            field=models.BigIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="billingprofile",
            name="token_total_used",
            field=models.BigIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="billingprofile",
            name="token_usage_last_recorded_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="billingprofile",
            name="token_usage_reset_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
