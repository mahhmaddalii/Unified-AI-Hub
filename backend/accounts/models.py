import uuid

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone


class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)

class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150, blank=True, null=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = CustomUserManager()

    def __str__(self):
        return self.email


class GmailOAuthCredential(models.Model):
    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="gmail_oauth_credential",
    )
    google_email = models.EmailField(blank=True, null=True)
    access_token = models.TextField(blank=True)
    refresh_token = models.TextField(blank=True)
    expires_at = models.DateTimeField(blank=True, null=True)
    scope = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.google_email or f"Gmail OAuth for {self.user.email}"


class BillingProfile(models.Model):
    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="billing_profile",
    )
    stripe_customer_id = models.CharField(max_length=255, blank=True, default="")
    stripe_subscription_id = models.CharField(max_length=255, blank=True, default="")
    stripe_checkout_session_id = models.CharField(max_length=255, blank=True, default="")
    plan_name = models.CharField(max_length=50, default="free")
    billing_interval = models.CharField(max_length=20, default="month")
    billing_source = models.CharField(max_length=20, blank=True, default="")
    billing_status = models.CharField(max_length=50, default="free")
    current_period_end = models.DateTimeField(blank=True, null=True)
    token_input_used = models.BigIntegerField(default=0)
    token_output_used = models.BigIntegerField(default=0)
    token_total_used = models.BigIntegerField(default=0)
    token_usage_reset_at = models.DateTimeField(blank=True, null=True)
    token_usage_last_recorded_at = models.DateTimeField(blank=True, null=True)
    last_verified_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_paid(self):
        active_statuses = {"active", "trialing"}
        if self.billing_status not in active_statuses:
            return False
        if self.current_period_end and self.current_period_end <= timezone.now():
            return False
        return True

    def __str__(self):
        return f"Billing for {self.user.email}"


class Agent(models.Model):
    class Kind(models.TextChoices):
        SYSTEM = "system", "System"
        CUSTOM = "custom", "Custom"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"
        ARCHIVED = "archived", "Archived"

    id = models.CharField(max_length=64, primary_key=True)
    owner_user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="owned_agents",
        blank=True,
        null=True,
    )
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.CUSTOM)
    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    purpose = models.CharField(max_length=50, default="general")
    model_preference = models.CharField(max_length=100, blank=True, default="gemini-flashlite")
    system_prompt = models.TextField(blank=True, default="")
    is_editable = models.BooleanField(default=True)
    is_auto_selected = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Conversation(models.Model):
    class ConversationType(models.TextChoices):
        NORMAL = "normal", "Normal"
        CUSTOM_AGENT = "custom_agent", "Custom Agent"
        DOMAIN_AGENT = "domain_agent", "Domain Agent"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ARCHIVED = "archived", "Archived"
        DELETED = "deleted", "Deleted"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="conversations")
    agent = models.ForeignKey(
        Agent,
        on_delete=models.SET_NULL,
        related_name="conversations",
        blank=True,
        null=True,
    )
    conversation_type = models.CharField(
        max_length=30,
        choices=ConversationType.choices,
        default=ConversationType.NORMAL,
    )
    title = models.CharField(max_length=255, blank=True, default="New Chat")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    last_message_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_message_at", "-created_at"]

    def __str__(self):
        return f"{self.user.email} - {self.title}"


class Message(models.Model):
    class Role(models.TextChoices):
        USER = "user", "User"
        ASSISTANT = "assistant", "Assistant"
        SYSTEM = "system", "System"
        TOOL = "tool", "Tool"

    class MessageType(models.TextChoices):
        NORMAL = "normal", "Normal"
        LIVE_UPDATE = "live_update", "Live Update"
        ERROR = "error", "Error"
        DRAFT = "draft", "Draft"
        TITLE = "title", "Title"

    class Status(models.TextChoices):
        STREAMING = "streaming", "Streaming"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        related_name="messages",
        blank=True,
        null=True,
    )
    role = models.CharField(max_length=20, choices=Role.choices)
    message_type = models.CharField(max_length=30, choices=MessageType.choices, default=MessageType.NORMAL)
    content_text = models.TextField(blank=True, default="")
    content_json = models.JSONField(blank=True, default=dict)
    sequence_no = models.PositiveIntegerField()
    model_used = models.CharField(max_length=100, blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.COMPLETED)
    input_tokens = models.BigIntegerField(default=0)
    output_tokens = models.BigIntegerField(default=0)
    total_tokens = models.BigIntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sequence_no", "created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["conversation", "sequence_no"],
                name="unique_message_sequence_per_conversation",
            )
        ]

    def __str__(self):
        return f"{self.conversation_id} #{self.sequence_no} {self.role}"


class ChatAsset(models.Model):
    class AssetType(models.TextChoices):
        GENERATED_IMAGE = "generated_image", "Generated Image"
        UPLOADED_PDF = "uploaded_pdf", "Uploaded PDF"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="assets")
    message = models.ForeignKey(
        Message,
        on_delete=models.SET_NULL,
        related_name="assets",
        blank=True,
        null=True,
    )
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        related_name="chat_assets",
        blank=True,
        null=True,
    )
    asset_type = models.CharField(max_length=30, choices=AssetType.choices)
    original_name = models.CharField(max_length=255, blank=True, default="")
    file = models.FileField(upload_to="chat_assets/%Y/%m/%d")
    mime_type = models.CharField(max_length=120, blank=True, default="")
    size_bytes = models.BigIntegerField(default=0)
    source_url = models.TextField(blank=True, default="")
    prompt_text = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return self.original_name or f"{self.asset_type} {self.id}"


class ComsatsTeacher(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=255)
    normalized_name = models.CharField(max_length=255, db_index=True)
    email = models.EmailField(blank=True, default="", db_index=True)
    department = models.CharField(max_length=255, blank=True, default="", db_index=True)
    current_courses = models.TextField(blank=True, default="")
    highest_qualification = models.CharField(max_length=255, blank=True, default="")
    field_of_qualification = models.CharField(max_length=255, blank=True, default="")
    areas_of_interest = models.TextField(blank=True, default="")
    office_location = models.CharField(max_length=255, blank=True, default="")
    office_hours_spring_2026 = models.TextField(blank=True, default="")
    preferred_contact_method = models.TextField(blank=True, default="")
    expected_response_time = models.TextField(blank=True, default="")
    teaching_method = models.TextField(blank=True, default="")
    recorded_lectures_available = models.CharField(max_length=255, blank=True, default="")
    recommended_resources = models.TextField(blank=True, default="")
    assignment_submission_platform = models.TextField(blank=True, default="")
    late_submissions_allowed = models.CharField(max_length=255, blank=True, default="")
    late_submission_penalty = models.TextField(blank=True, default="")
    typical_quiz_format = models.TextField(blank=True, default="")
    makeup_quizzes_allowed = models.CharField(max_length=255, blank=True, default="")
    fyp_domains_supervised = models.TextField(blank=True, default="")
    past_fyp_project_titles = models.TextField(blank=True, default="")
    supervises_industry_projects = models.CharField(max_length=255, blank=True, default="")
    preferred_fyp_work_type = models.TextField(blank=True, default="")
    source_batch = models.CharField(max_length=100, blank=True, default="", db_index=True)
    source_row_hash = models.CharField(max_length=64, blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["full_name"]
        indexes = [
            models.Index(fields=["normalized_name", "email"], name="teacher_name_email_idx"),
            models.Index(fields=["department", "is_active"], name="teacher_dept_active_idx"),
        ]

    def __str__(self):
        return self.full_name


class EmailRecord(models.Model):
    class Status(models.TextChoices):
        DRAFTED = "drafted", "Drafted"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="email_records")
    message = models.ForeignKey(
        Message,
        on_delete=models.SET_NULL,
        related_name="email_records",
        blank=True,
        null=True,
    )
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="email_records")
    agent = models.ForeignKey(
        Agent,
        on_delete=models.SET_NULL,
        related_name="email_records",
        blank=True,
        null=True,
    )
    recipient_email = models.EmailField()
    subject = models.CharField(max_length=255)
    body = models.TextField()
    gmail_message_id = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFTED)
    sent_at = models.DateTimeField(blank=True, null=True)
    error_message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.recipient_email} ({self.status})"
