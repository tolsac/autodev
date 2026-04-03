import uuid

from django.conf import settings
from django.db import models


class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100, unique=True)
    logo_url = models.URLField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_organizations",
    )
    timezone = models.CharField(max_length=50, default="Europe/Paris")
    default_notification_channel = models.CharField(
        max_length=20,
        default="in_app",
        choices=[("in_app", "In-App"), ("slack", "Slack"), ("email", "Email")],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organizations"

    def __str__(self):
        return self.name


class Membership(models.Model):
    class Role(models.TextChoices):
        OWNER = "owner"
        ADMIN = "admin"
        MEMBER = "member"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="memberships"
    )
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        db_table = "memberships"
        unique_together = ("user", "organization")
        indexes = [
            models.Index(fields=["organization", "role"]),
        ]

    def __str__(self):
        return f"{self.user} @ {self.organization} ({self.role})"


class BillingAccount(models.Model):
    class Plan(models.TextChoices):
        FREE = "free"
        STARTER = "starter"
        PRO = "pro"
        ENTERPRISE = "enterprise"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        Organization, on_delete=models.CASCADE, related_name="billing"
    )
    plan = models.CharField(max_length=20, choices=Plan.choices, default=Plan.FREE)
    stripe_customer_id = models.CharField(max_length=255, blank=True)
    stripe_subscription_id = models.CharField(max_length=255, blank=True)
    max_projects = models.IntegerField(default=3)
    max_members = models.IntegerField(default=5)
    max_ai_runs_per_month = models.IntegerField(default=50)
    current_ai_runs_count = models.IntegerField(default=0)
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "billing_accounts"

    def __str__(self):
        return f"{self.organization} — {self.plan}"


class Invitation(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending"
        ACCEPTED = "accepted"
        EXPIRED = "expired"
        REVOKED = "revoked"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="invitations"
    )
    email = models.EmailField()
    role = models.CharField(
        max_length=10,
        choices=Membership.Role.choices,
        default=Membership.Role.MEMBER,
    )
    is_guest = models.BooleanField(default=False)
    guest_project_role = models.CharField(
        max_length=10,
        choices=[("member", "Member"), ("viewer", "Viewer")],
        default="viewer",
        blank=True,
    )
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    token = models.CharField(max_length=255, unique=True)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = "invitations"
        indexes = [
            models.Index(fields=["email", "organization"]),
            models.Index(fields=["token"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"Invite {self.email} to {self.organization} ({self.status})"


class AuditLog(models.Model):
    class Action(models.TextChoices):
        ORG_UPDATED = "org_updated"
        MEMBER_INVITED = "member_invited"
        MEMBER_REMOVED = "member_removed"
        MEMBER_ROLE_CHANGED = "member_role_changed"
        PROJECT_CREATED = "project_created"
        PROJECT_DELETED = "project_deleted"
        REPO_LINKED = "repo_linked"
        REPO_UNLINKED = "repo_unlinked"
        SCM_CONNECTED = "scm_connected"
        SCM_DISCONNECTED = "scm_disconnected"
        PLAN_CHANGED = "plan_changed"
        AGENT_TRIGGERED = "agent_triggered"
        AGENT_COMPLETED = "agent_completed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="audit_logs"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="+",
    )
    action = models.CharField(max_length=30, choices=Action.choices)
    resource_type = models.CharField(max_length=50)
    resource_id = models.UUIDField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "created_at"]),
            models.Index(fields=["action"]),
        ]

    def __str__(self):
        return f"{self.action} by {self.user} @ {self.created_at}"
