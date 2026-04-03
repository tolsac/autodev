from django.contrib import admin

from .models import (
    CodeEmbedding,
    ProjectRepository,
    PullRequest,
    Repository,
    SCMConnection,
    WebhookEvent,
)


@admin.register(SCMConnection)
class SCMConnectionAdmin(admin.ModelAdmin):
    list_display = ["provider_type", "external_org_name", "organization", "created_at"]
    list_filter = ["provider_type"]


@admin.register(Repository)
class RepositoryAdmin(admin.ModelAdmin):
    list_display = ["full_name", "organization", "indexing_status", "last_indexed_at"]
    list_filter = ["indexing_status"]
    search_fields = ["full_name", "name"]


@admin.register(ProjectRepository)
class ProjectRepositoryAdmin(admin.ModelAdmin):
    list_display = ["project", "repository", "linked_at"]


@admin.register(PullRequest)
class PullRequestAdmin(admin.ModelAdmin):
    list_display = ["title", "ticket", "repository", "status", "created_at"]
    list_filter = ["status"]


@admin.register(WebhookEvent)
class WebhookEventAdmin(admin.ModelAdmin):
    list_display = ["source", "event_type", "status", "created_at"]
    list_filter = ["source", "status"]
    readonly_fields = ["headers", "payload"]


@admin.register(CodeEmbedding)
class CodeEmbeddingAdmin(admin.ModelAdmin):
    list_display = ["repository", "file_path", "chunk_index", "language"]
    list_filter = ["language"]
