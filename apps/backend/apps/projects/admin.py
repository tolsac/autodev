from django.contrib import admin

from .models import (
    Board,
    Column,
    ColumnAgentTrigger,
    Comment,
    Label,
    Project,
    ProjectMembership,
    Ticket,
)


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ["name", "organization", "ticket_prefix", "created_at"]
    search_fields = ["name", "slug"]
    list_filter = ["organization"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(ProjectMembership)
class ProjectMembershipAdmin(admin.ModelAdmin):
    list_display = ["user", "project", "role", "joined_at"]
    list_filter = ["role"]


@admin.register(Board)
class BoardAdmin(admin.ModelAdmin):
    list_display = ["project", "created_at"]


@admin.register(Column)
class ColumnAdmin(admin.ModelAdmin):
    list_display = ["name", "board", "position", "wip_limit"]
    list_filter = ["board__project"]


@admin.register(ColumnAgentTrigger)
class ColumnAgentTriggerAdmin(admin.ModelAdmin):
    list_display = ["column", "agent_type", "trigger_mode", "is_active"]
    list_filter = ["agent_type", "trigger_mode", "is_active"]


@admin.register(Label)
class LabelAdmin(admin.ModelAdmin):
    list_display = ["name", "project", "color"]


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ["ticket_key", "title", "priority", "column", "assigned_to"]
    search_fields = ["ticket_key", "title"]
    list_filter = ["priority", "challenge_status", "plan_status"]


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ["ticket", "author", "author_type", "is_question", "created_at"]
    list_filter = ["author_type", "is_question"]
