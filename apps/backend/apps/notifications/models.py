import uuid

from django.conf import settings
from django.db import models


class NotificationChannel(models.Model):
    class ChannelType(models.TextChoices):
        IN_APP = "in_app"
        SLACK = "slack"
        EMAIL = "email"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="notification_channels",
    )
    channel_type = models.CharField(max_length=10, choices=ChannelType.choices)
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    is_deletable = models.BooleanField(default=True)
    # Slack config
    slack_workspace_id = models.CharField(max_length=255, blank=True)
    slack_bot_token = models.TextField(blank=True)
    slack_webhook_url = models.URLField(blank=True)
    # Email config
    email_provider = models.CharField(max_length=20, blank=True)
    email_config = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notification_channels"
        unique_together = ("organization", "channel_type")

    def __str__(self):
        return f"{self.channel_type} ({self.organization})"


class Notification(models.Model):
    class NotificationType(models.TextChoices):
        AGENT_QUESTION = "agent_question"
        AGENT_COMPLETED = "agent_completed"
        PLAN_GENERATED = "plan_generated"
        PR_CREATED = "pr_created"
        PR_MERGED = "pr_merged"
        REVIEW_COMPLETED = "review_completed"
        REVIEW_APPROVED = "review_approved"
        REVIEW_CHANGES = "review_changes"
        FIX_APPLIED = "fix_applied"
        TICKET_ASSIGNED = "ticket_assigned"
        MENTION = "mention"
        INVITATION = "invitation"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    notification_type = models.CharField(max_length=20, choices=NotificationType.choices)
    title = models.CharField(max_length=500)
    body = models.TextField(blank=True)
    action_url = models.URLField(blank=True)
    ticket = models.ForeignKey(
        "projects.Ticket",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="+",
    )
    agent_run = models.ForeignKey(
        "agents.AgentRun",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="+",
    )
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    channels_sent = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_read", "created_at"]),
        ]

    def __str__(self):
        return f"{self.notification_type}: {self.title}"
