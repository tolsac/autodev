import uuid

from django.conf import settings
from django.db import models


class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="projects",
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=10, blank=True)
    color = models.CharField(max_length=7, default="#6366F1")
    ticket_prefix = models.CharField(max_length=10, default="AD")
    ticket_counter = models.IntegerField(default=0)
    default_target_branch = models.CharField(max_length=255, default="main")
    branch_naming_template = models.CharField(
        max_length=255, default="feature/{prefix}-{ticket_id}-{slug}"
    )
    pr_title_template = models.CharField(
        max_length=255, default="[{prefix}-{ticket_id}] {ticket_title}"
    )
    # PR body template
    pr_body_template = models.TextField(
        blank=True,
        default="## Ticket\n{ticket_title}\n\n## Description\n{ticket_description}\n\n## Plan\n{plan_summary}",
    )
    # Agent settings
    llm_model = models.CharField(
        max_length=100,
        default="claude-sonnet-4-20250514",
        choices=[
            ("claude-sonnet-4-20250514", "Claude Sonnet 4"),
            ("claude-opus-4-20250514", "Claude Opus 4"),
        ],
    )
    agent_global_instructions = models.TextField(blank=True, default="")
    agent_custom_instructions = models.TextField(blank=True)
    agent_challenge_instructions = models.TextField(blank=True, default="")
    agent_plan_instructions = models.TextField(blank=True, default="")
    agent_code_instructions = models.TextField(blank=True, default="")
    agent_review_instructions = models.TextField(blank=True, default="")
    agent_fix_instructions = models.TextField(blank=True, default="")
    challenge_auto_approve_threshold = models.IntegerField(default=85)
    fix_severity_filter = models.JSONField(default=list, blank=True)
    fix_max_iterations = models.IntegerField(default=3)
    # Notifications
    notification_channel_override = models.CharField(
        max_length=20, blank=True, null=True,
        choices=[("in_app", "In-App"), ("slack", "Slack"), ("email", "Email")],
    )
    notify_agent_questions = models.BooleanField(default=True)
    notify_plan_generated = models.BooleanField(default=True)
    notify_pr_created = models.BooleanField(default=True)
    notify_review_completed = models.BooleanField(default=True)
    notify_fix_applied = models.BooleanField(default=True)
    # Archive
    is_archived = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)
    # OpenRouter API key override (encrypted)
    openrouter_api_key_override_encrypted = models.TextField(db_column="openrouter_api_key_override", blank=True, default="")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_projects",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "projects"
        unique_together = ("organization", "slug")
        indexes = [
            models.Index(fields=["organization"]),
        ]

    def __str__(self):
        return self.name

    def next_ticket_key(self):
        self.ticket_counter += 1
        self.save(update_fields=["ticket_counter"])
        return f"{self.ticket_prefix}-{self.ticket_counter}"

    @property
    def openrouter_api_key_override(self) -> str:
        from apps.core.encryption import decrypt_field
        return decrypt_field(self.openrouter_api_key_override_encrypted) if self.openrouter_api_key_override_encrypted else ""

    @openrouter_api_key_override.setter
    def openrouter_api_key_override(self, value: str):
        from apps.core.encryption import encrypt_field
        self.openrouter_api_key_override_encrypted = encrypt_field(value) if value else ""

    @property
    def has_openrouter_key_override(self) -> bool:
        return bool(self.openrouter_api_key_override_encrypted)


class ProjectMembership(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin"
        MEMBER = "member"
        VIEWER = "viewer"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_memberships",
    )
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="memberships"
    )
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "project_memberships"
        unique_together = ("user", "project")
        indexes = [
            models.Index(fields=["project", "role"]),
        ]


class Board(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.OneToOneField(
        Project, on_delete=models.CASCADE, related_name="board"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "boards"

    def __str__(self):
        return f"Board: {self.project.name}"


class Column(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name="columns")
    name = models.CharField(max_length=100)
    position = models.IntegerField(default=0)
    color = models.CharField(max_length=7, default="#E5E7EB")
    wip_limit = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "columns"
        ordering = ["position"]
        unique_together = ("board", "position")

    def __str__(self):
        return f"{self.name} ({self.board.project.name})"


class ColumnAgentTrigger(models.Model):
    class AgentType(models.TextChoices):
        CHALLENGE = "challenge"
        PLAN = "plan"
        CODE = "code"
        REVIEW = "review"
        FIX = "fix"

    class TriggerMode(models.TextChoices):
        AUTO = "auto"
        MANUAL = "manual"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    column = models.ForeignKey(
        Column, on_delete=models.CASCADE, related_name="triggers"
    )
    agent_type = models.CharField(max_length=10, choices=AgentType.choices)
    trigger_mode = models.CharField(
        max_length=10, choices=TriggerMode.choices, default=TriggerMode.MANUAL
    )
    position = models.IntegerField(default=0)
    # Conditions (AND logic)
    condition_challenge_approved = models.BooleanField(default=False)
    condition_plan_approved = models.BooleanField(default=False)
    condition_has_repos = models.BooleanField(default=False)
    condition_pr_created = models.BooleanField(default=False)
    condition_review_done = models.BooleanField(default=False)
    # Options
    notify_on_start = models.BooleanField(default=False)
    notify_on_complete = models.BooleanField(default=True)
    auto_move_on_complete = models.ForeignKey(
        Column,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "column_agent_triggers"
        ordering = ["position"]
        unique_together = ("column", "agent_type")
        indexes = [
            models.Index(fields=["column", "is_active"]),
        ]


class Label(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="labels"
    )
    name = models.CharField(max_length=50)
    color = models.CharField(max_length=7, default="#6366F1")

    class Meta:
        db_table = "labels"
        unique_together = ("project", "name")

    def __str__(self):
        return self.name


class Ticket(models.Model):
    class Priority(models.TextChoices):
        NONE = "none"
        LOW = "low"
        MEDIUM = "medium"
        HIGH = "high"
        URGENT = "urgent"

    class AgentStatus(models.TextChoices):
        NOT_STARTED = "not_started"
        IN_PROGRESS = "in_progress"
        WAITING_FOR_INPUT = "waiting_for_input"
        APPROVED = "approved"
        GENERATED = "generated"
        REJECTED = "rejected"
        PR_CREATED = "pr_created"
        PR_MERGED = "pr_merged"
        CHANGES_REQUESTED = "changes_requested"
        FIXED = "fixed"
        FAILED = "failed"

    class Complexity(models.TextChoices):
        XS = "xs"
        S = "s"
        M = "m"
        L = "l"
        XL = "xl"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="tickets"
    )
    column = models.ForeignKey(
        Column, on_delete=models.CASCADE, related_name="tickets"
    )
    ticket_key = models.CharField(max_length=20, unique=True)
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    acceptance_criteria = models.TextField(blank=True)
    priority = models.CharField(
        max_length=10, choices=Priority.choices, default=Priority.NONE
    )
    position = models.IntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_tickets",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_tickets",
    )
    labels = models.ManyToManyField(Label, blank=True, related_name="tickets")
    impacted_repos = models.ManyToManyField(
        "scm.Repository", blank=True, related_name="tickets"
    )
    # Agent statuses
    challenge_status = models.CharField(
        max_length=20, choices=AgentStatus.choices, default=AgentStatus.NOT_STARTED
    )
    plan_status = models.CharField(
        max_length=20, choices=AgentStatus.choices, default=AgentStatus.NOT_STARTED
    )
    code_status = models.CharField(
        max_length=20, choices=AgentStatus.choices, default=AgentStatus.NOT_STARTED
    )
    review_status = models.CharField(
        max_length=20, choices=AgentStatus.choices, default=AgentStatus.NOT_STARTED
    )
    fix_status = models.CharField(
        max_length=20, choices=AgentStatus.choices, default=AgentStatus.NOT_STARTED
    )
    estimated_complexity = models.CharField(
        max_length=2, choices=Complexity.choices, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tickets"
        ordering = ["position"]
        indexes = [
            models.Index(fields=["project", "column"]),
            models.Index(fields=["ticket_key"]),
            models.Index(fields=["assigned_to"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"{self.ticket_key}: {self.title}"


class Comment(models.Model):
    class AuthorType(models.TextChoices):
        HUMAN = "human"
        AGENT = "agent"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(
        Ticket, on_delete=models.CASCADE, related_name="comments"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="comments",
    )
    author_type = models.CharField(
        max_length=10, choices=AuthorType.choices, default=AuthorType.HUMAN
    )
    agent_type = models.CharField(max_length=10, blank=True)
    body = models.TextField()
    is_question = models.BooleanField(default=False)
    is_resolved = models.BooleanField(default=False)
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="replies",
    )
    source_channel = models.CharField(
        max_length=10,
        choices=[("in_app", "In-App"), ("slack", "Slack"), ("email", "Email")],
        default="in_app",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "comments"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["ticket", "created_at"]),
            models.Index(fields=["is_question", "is_resolved"]),
        ]

    def __str__(self):
        return f"Comment on {self.ticket.ticket_key} by {self.author or self.agent_type}"
