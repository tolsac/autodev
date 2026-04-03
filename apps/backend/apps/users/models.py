import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom user model — email-based login."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255, blank=True)
    avatar_url = models.URLField(blank=True)
    preferred_language = models.CharField(
        max_length=5,
        choices=[("fr", "Fran\u00e7ais"), ("en", "English")],
        default="fr",
    )
    preferred_notification_channel = models.CharField(
        max_length=10,
        choices=[("in_app", "In-App"), ("slack", "Slack"), ("email", "Email")],
        default="in_app",
    )
    notify_on_agent_questions = models.BooleanField(default=True)
    notify_on_plan_generated = models.BooleanField(default=True)
    notify_on_pr_created = models.BooleanField(default=True)
    notify_on_review_completed = models.BooleanField(default=True)
    notify_on_fix_applied = models.BooleanField(default=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        db_table = "users"

    def __str__(self):
        return self.full_name or self.email
