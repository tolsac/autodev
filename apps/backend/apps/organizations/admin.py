from django.contrib import admin

from .models import AuditLog, BillingAccount, Invitation, Membership, Organization


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "created_at"]
    search_fields = ["name", "slug"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ["user", "organization", "role", "joined_at"]
    list_filter = ["role"]


@admin.register(BillingAccount)
class BillingAccountAdmin(admin.ModelAdmin):
    list_display = ["organization", "plan", "current_ai_runs_count", "max_ai_runs_per_month"]
    list_filter = ["plan"]


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ["email", "organization", "role", "status", "created_at"]
    list_filter = ["status", "role"]


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["action", "user", "organization", "created_at"]
    list_filter = ["action"]
    readonly_fields = ["id", "organization", "user", "action", "metadata", "created_at"]
