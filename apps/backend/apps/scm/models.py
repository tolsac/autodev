import uuid

from django.conf import settings
from django.db import models


class SCMConnection(models.Model):
    class ProviderType(models.TextChoices):
        GITHUB = "github"
        BITBUCKET = "bitbucket"
        GITLAB = "gitlab"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="scm_connections",
    )
    provider_type = models.CharField(max_length=10, choices=ProviderType.choices)
    installation_id = models.CharField(max_length=255, blank=True)
    access_token = models.TextField(blank=True)
    refresh_token = models.TextField(blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    external_org_name = models.CharField(max_length=255, blank=True)
    external_org_id = models.CharField(max_length=255, blank=True)
    connected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "scm_connections"
        indexes = [
            models.Index(fields=["organization", "provider_type"]),
        ]

    def __str__(self):
        return f"{self.provider_type}: {self.external_org_name}"


class Repository(models.Model):
    class IndexingStatus(models.TextChoices):
        PENDING = "pending"
        INDEXING = "indexing"
        INDEXED = "indexed"
        FAILED = "failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="repositories",
    )
    scm_connection = models.ForeignKey(
        SCMConnection, on_delete=models.CASCADE, related_name="repositories"
    )
    name = models.CharField(max_length=255)
    full_name = models.CharField(max_length=500)
    external_id = models.CharField(max_length=255)
    clone_url = models.URLField(max_length=500)
    default_branch = models.CharField(max_length=255, default="main")
    html_url = models.URLField(max_length=500, blank=True)
    indexing_status = models.CharField(
        max_length=10,
        choices=IndexingStatus.choices,
        default=IndexingStatus.PENDING,
    )
    last_indexed_at = models.DateTimeField(null=True, blank=True)
    last_indexed_commit = models.CharField(max_length=40, blank=True)
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "repositories"
        unique_together = ("organization", "scm_connection", "external_id")
        indexes = [
            models.Index(fields=["organization"]),
            models.Index(fields=["indexing_status"]),
        ]

    def __str__(self):
        return self.full_name


class ProjectRepository(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="project_repositories",
    )
    repository = models.ForeignKey(
        Repository, on_delete=models.CASCADE, related_name="project_links"
    )
    target_branch_override = models.CharField(max_length=255, blank=True)
    linked_at = models.DateTimeField(auto_now_add=True)
    linked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="+",
    )

    class Meta:
        db_table = "project_repositories"
        unique_together = ("project", "repository")

    def __str__(self):
        return f"{self.project.name} <-> {self.repository.full_name}"


class CodeEmbedding(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    repository = models.ForeignKey(
        Repository, on_delete=models.CASCADE, related_name="embeddings"
    )
    file_path = models.CharField(max_length=1000)
    chunk_index = models.IntegerField()
    chunk_content = models.TextField()
    start_line = models.IntegerField()
    end_line = models.IntegerField()
    # pgvector field — will use raw SQL or pgvector Django integration
    # embedding = VectorField(dimensions=1536)  # Added via migration
    language = models.CharField(max_length=50, blank=True)
    commit_sha = models.CharField(max_length=40)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "code_embeddings"
        indexes = [
            models.Index(fields=["repository", "file_path"]),
        ]


class PullRequest(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft"
        OPEN = "open"
        MERGED = "merged"
        CLOSED = "closed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(
        "projects.Ticket", on_delete=models.CASCADE, related_name="pull_requests"
    )
    repository = models.ForeignKey(
        Repository, on_delete=models.CASCADE, related_name="pull_requests"
    )
    external_id = models.CharField(max_length=50)
    external_url = models.URLField(max_length=500)
    title = models.CharField(max_length=500)
    branch_name = models.CharField(max_length=255)
    target_branch = models.CharField(max_length=255)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.DRAFT
    )
    additions = models.IntegerField(default=0)
    deletions = models.IntegerField(default=0)
    files_changed = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    merged_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "pull_requests"
        indexes = [
            models.Index(fields=["ticket"]),
            models.Index(fields=["repository"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"PR#{self.external_id}: {self.title}"


class WebhookEvent(models.Model):
    class Source(models.TextChoices):
        GITHUB = "github"
        BITBUCKET = "bitbucket"
        GITLAB = "gitlab"
        STRIPE = "stripe"
        SLACK = "slack"

    class Status(models.TextChoices):
        RECEIVED = "received"
        PROCESSING = "processing"
        PROCESSED = "processed"
        FAILED = "failed"
        IGNORED = "ignored"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source = models.CharField(max_length=10, choices=Source.choices)
    event_type = models.CharField(max_length=100)
    external_id = models.CharField(max_length=255, blank=True)
    headers = models.JSONField(default=dict)
    payload = models.JSONField(default=dict)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.RECEIVED
    )
    error_message = models.TextField(blank=True)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "webhook_events"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["source", "event_type"]),
            models.Index(fields=["status"]),
            models.Index(fields=["created_at"]),
        ]
