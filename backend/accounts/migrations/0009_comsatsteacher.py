import uuid

from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_remove_chat_with_prefix_from_agent_conversations"),
    ]

    operations = [
        migrations.CreateModel(
            name="ComsatsTeacher",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("full_name", models.CharField(max_length=255)),
                ("normalized_name", models.CharField(db_index=True, max_length=255)),
                ("email", models.EmailField(blank=True, db_index=True, default="", max_length=254)),
                ("department", models.CharField(blank=True, db_index=True, default="", max_length=255)),
                ("current_courses", models.TextField(blank=True, default="")),
                ("highest_qualification", models.CharField(blank=True, default="", max_length=255)),
                ("field_of_qualification", models.CharField(blank=True, default="", max_length=255)),
                ("areas_of_interest", models.TextField(blank=True, default="")),
                ("office_location", models.CharField(blank=True, default="", max_length=255)),
                ("office_hours_spring_2026", models.TextField(blank=True, default="")),
                ("preferred_contact_method", models.TextField(blank=True, default="")),
                ("expected_response_time", models.TextField(blank=True, default="")),
                ("teaching_method", models.TextField(blank=True, default="")),
                ("recorded_lectures_available", models.CharField(blank=True, default="", max_length=255)),
                ("recommended_resources", models.TextField(blank=True, default="")),
                ("assignment_submission_platform", models.TextField(blank=True, default="")),
                ("late_submissions_allowed", models.CharField(blank=True, default="", max_length=255)),
                ("late_submission_penalty", models.TextField(blank=True, default="")),
                ("typical_quiz_format", models.TextField(blank=True, default="")),
                ("makeup_quizzes_allowed", models.CharField(blank=True, default="", max_length=255)),
                ("fyp_domains_supervised", models.TextField(blank=True, default="")),
                ("past_fyp_project_titles", models.TextField(blank=True, default="")),
                ("supervises_industry_projects", models.CharField(blank=True, default="", max_length=255)),
                ("preferred_fyp_work_type", models.TextField(blank=True, default="")),
                ("source_batch", models.CharField(blank=True, db_index=True, default="", max_length=100)),
                ("source_row_hash", models.CharField(blank=True, default="", max_length=64)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["full_name"],
            },
        ),
        migrations.AddIndex(
            model_name="comsatsteacher",
            index=models.Index(fields=["normalized_name", "email"], name="teacher_name_email_idx"),
        ),
        migrations.AddIndex(
            model_name="comsatsteacher",
            index=models.Index(fields=["department", "is_active"], name="teacher_dept_active_idx"),
        ),
    ]
