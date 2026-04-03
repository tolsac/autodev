from django.contrib import admin

from .models import (
    AgentRun,
    AgentRunStep,
    AIAnalysis,
    ImplementationPlan,
    PlanStep,
    ReviewFinding,
    ReviewResult,
)


@admin.register(AgentRun)
class AgentRunAdmin(admin.ModelAdmin):
    list_display = ["ticket", "agent_type", "status", "triggered_by", "created_at"]
    list_filter = ["agent_type", "status"]


@admin.register(AgentRunStep)
class AgentRunStepAdmin(admin.ModelAdmin):
    list_display = ["agent_run", "position", "step_type", "name", "is_success"]
    list_filter = ["step_type", "is_success"]


@admin.register(AIAnalysis)
class AIAnalysisAdmin(admin.ModelAdmin):
    list_display = ["ticket", "completeness_score", "is_approved", "created_at"]


@admin.register(ImplementationPlan)
class ImplementationPlanAdmin(admin.ModelAdmin):
    list_display = ["ticket", "estimated_complexity", "approved_at", "created_at"]


@admin.register(PlanStep)
class PlanStepAdmin(admin.ModelAdmin):
    list_display = ["plan", "position", "step_type", "title"]
    list_filter = ["step_type"]


@admin.register(ReviewResult)
class ReviewResultAdmin(admin.ModelAdmin):
    list_display = ["ticket", "is_approved", "total_findings", "created_at"]


@admin.register(ReviewFinding)
class ReviewFindingAdmin(admin.ModelAdmin):
    list_display = ["title", "severity", "category", "fix_status"]
    list_filter = ["severity", "category", "fix_status"]
