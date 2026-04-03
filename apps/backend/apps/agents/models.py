import uuid

from django.conf import settings
from django.db import models


class AgentRun(models.Model):
    class AgentType(models.TextChoices):
        CHALLENGE = "challenge"
        PLAN = "plan"
        CODE = "code"
        REVIEW = "review"
        FIX = "fix"

    class Status(models.TextChoices):
        QUEUED = "queued"
        RUNNING = "running"
        WAITING = "waiting"
        COMPLETED = "completed"
        FAILED = "failed"
        CANCELLED = "cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(
        "projects.Ticket", on_delete=models.CASCADE, related_name="agent_runs"
    )
    agent_type = models.CharField(max_length=10, choices=AgentType.choices)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.QUEUED
    )
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="+",
    )
    auto_triggered = models.BooleanField(default=False)
    total_input_tokens = models.IntegerField(default=0)
    total_output_tokens = models.IntegerField(default=0)
    total_cost_usd = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    total_steps = models.IntegerField(default=0)
    result_summary = models.TextField(blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.IntegerField(null=True, blank=True)
    conversation_state = models.JSONField(default=None, null=True, blank=True)

    class Meta:
        db_table = "agent_runs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["ticket", "agent_type"]),
            models.Index(fields=["status"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"{self.agent_type} run on {self.ticket.ticket_key} ({self.status})"


class AgentRunStep(models.Model):
    class StepType(models.TextChoices):
        CONTEXT_RETRIEVAL = "context_retrieval"
        ANALYSIS = "analysis"
        QUESTION_GEN = "question_gen"
        PLAN_GEN = "plan_gen"
        CODE_GEN = "code_gen"
        CODE_REVIEW = "code_review"
        REVIEW_ANALYSIS = "review_analysis"
        FIX_GEN = "fix_gen"
        REFINEMENT = "refinement"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agent_run = models.ForeignKey(
        AgentRun, on_delete=models.CASCADE, related_name="steps"
    )
    position = models.IntegerField()
    step_type = models.CharField(max_length=20, choices=StepType.choices)
    name = models.CharField(max_length=255)
    system_prompt = models.TextField(blank=True)
    user_prompt = models.TextField(blank=True)
    raw_response = models.TextField(blank=True)
    parsed_result = models.JSONField(default=dict, blank=True)
    model_used = models.CharField(max_length=100, default="claude-sonnet-4-20250514")
    input_tokens = models.IntegerField(default=0)
    output_tokens = models.IntegerField(default=0)
    cost_usd = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    is_success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)
    duration_ms = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "agent_run_steps"
        ordering = ["position"]
        indexes = [
            models.Index(fields=["agent_run", "position"]),
        ]

    def __str__(self):
        return f"Step {self.position}: {self.name}"


class AIAnalysis(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agent_run = models.OneToOneField(
        AgentRun, on_delete=models.CASCADE, related_name="analysis"
    )
    ticket = models.ForeignKey(
        "projects.Ticket", on_delete=models.CASCADE, related_name="analyses"
    )
    completeness_score = models.IntegerField(default=0)
    summary = models.TextField(blank=True)
    strengths = models.JSONField(default=list)
    weaknesses = models.JSONField(default=list)
    suggestions = models.JSONField(default=list)
    questions = models.JSONField(default=list)
    is_approved = models.BooleanField(default=False)
    requires_input = models.BooleanField(default=False)
    relevant_files = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ai_analyses"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["ticket"]),
        ]

    def __str__(self):
        return f"Analysis for {self.ticket.ticket_key} ({self.completeness_score}/100)"


class ImplementationPlan(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agent_run = models.OneToOneField(
        AgentRun, on_delete=models.CASCADE, related_name="plan"
    )
    ticket = models.ForeignKey(
        "projects.Ticket", on_delete=models.CASCADE, related_name="plans"
    )
    summary = models.TextField(blank=True)
    estimated_complexity = models.CharField(
        max_length=2,
        choices=[("xs", "XS"), ("s", "S"), ("m", "M"), ("l", "L"), ("xl", "XL")],
        blank=True,
    )
    estimated_hours = models.DecimalField(
        max_digits=5, decimal_places=1, null=True, blank=True
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "implementation_plans"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["ticket"]),
        ]

    def __str__(self):
        return f"Plan for {self.ticket.ticket_key}"


class PlanStep(models.Model):
    class StepType(models.TextChoices):
        BACKEND = "backend"
        FRONTEND = "frontend"
        TEST = "test"
        MIGRATION = "migration"
        CONFIG = "config"
        DOCS = "docs"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(
        ImplementationPlan, on_delete=models.CASCADE, related_name="steps"
    )
    repository = models.ForeignKey(
        "scm.Repository", on_delete=models.CASCADE, related_name="+"
    )
    position = models.IntegerField()
    step_type = models.CharField(max_length=10, choices=StepType.choices)
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    files_to_modify = models.JSONField(default=list)
    files_to_create = models.JSONField(default=list)

    class Meta:
        db_table = "plan_steps"
        ordering = ["position"]
        indexes = [
            models.Index(fields=["plan", "position"]),
        ]

    def __str__(self):
        return f"{self.step_type}: {self.title}"


class ReviewResult(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agent_run = models.OneToOneField(
        AgentRun, on_delete=models.CASCADE, related_name="review_result"
    )
    ticket = models.ForeignKey(
        "projects.Ticket", on_delete=models.CASCADE, related_name="reviews"
    )
    pull_request = models.ForeignKey(
        "scm.PullRequest", on_delete=models.CASCADE, related_name="reviews"
    )
    is_approved = models.BooleanField(default=False)
    summary = models.TextField(blank=True)
    plan_conformity_score = models.IntegerField(null=True, blank=True)
    total_findings = models.IntegerField(default=0)
    critical_count = models.IntegerField(default=0)
    major_count = models.IntegerField(default=0)
    minor_count = models.IntegerField(default=0)
    suggestion_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "review_results"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["ticket"]),
            models.Index(fields=["pull_request"]),
        ]

    def __str__(self):
        verdict = "Approved" if self.is_approved else "Changes Requested"
        return f"Review for {self.ticket.ticket_key}: {verdict}"


class ReviewFinding(models.Model):
    class Severity(models.TextChoices):
        CRITICAL = "critical"
        MAJOR = "major"
        MINOR = "minor"
        SUGGESTION = "suggestion"

    class Category(models.TextChoices):
        BUG = "bug"
        SECURITY = "security"
        PERFORMANCE = "performance"
        STYLE = "style"
        TEST = "test"
        PLAN_DRIFT = "plan_drift"
        LOGIC = "logic"

    class FixStatus(models.TextChoices):
        OPEN = "open"
        FIXED = "fixed"
        WONTFIX = "wontfix"
        IGNORED = "ignored"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    review_result = models.ForeignKey(
        ReviewResult, on_delete=models.CASCADE, related_name="findings"
    )
    file_path = models.CharField(max_length=1000)
    start_line = models.IntegerField(null=True, blank=True)
    end_line = models.IntegerField(null=True, blank=True)
    severity = models.CharField(max_length=10, choices=Severity.choices)
    category = models.CharField(max_length=15, choices=Category.choices)
    title = models.CharField(max_length=500)
    description = models.TextField()
    suggested_fix = models.TextField(blank=True)
    fix_status = models.CharField(
        max_length=10, choices=FixStatus.choices, default=FixStatus.OPEN
    )
    fixed_by_run = models.ForeignKey(
        AgentRun,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "review_findings"
        ordering = ["severity", "file_path", "start_line"]
        indexes = [
            models.Index(fields=["review_result", "severity"]),
            models.Index(fields=["fix_status"]),
        ]

    def __str__(self):
        return f"[{self.severity}] {self.title}"


class AgentConfig(models.Model):
    class AgentType(models.TextChoices):
        CHALLENGE = "challenge"
        PLAN = "plan"
        CODE = "code"
        REVIEW = "review"
        FIX = "fix"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="agent_configs")
    agent_type = models.CharField(max_length=20, choices=AgentType.choices)
    is_enabled = models.BooleanField(default=True)

    # LLM via OpenRouter
    llm_model = models.CharField(max_length=200, default="anthropic/claude-sonnet-4-20250514")
    temperature = models.FloatField(default=0.3)
    max_tokens = models.IntegerField(null=True, blank=True)

    # Prompt
    system_prompt = models.TextField(blank=True, default="")

    # Triggers
    trigger_on_ticket_created = models.BooleanField(default=False)
    trigger_on_ticket_moved = models.BooleanField(default=False)
    trigger_move_source_column = models.ForeignKey(
        "projects.Column", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    trigger_move_target_column = models.ForeignKey(
        "projects.Column", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    trigger_on_ticket_modified = models.BooleanField(default=False)
    trigger_on_pr_created = models.BooleanField(default=False)
    trigger_on_pr_merged = models.BooleanField(default=False)

    # Prerequisites
    requires_challenge_approved = models.BooleanField(default=False)
    requires_plan_approved = models.BooleanField(default=False)
    requires_pr_created = models.BooleanField(default=False)
    requires_review_completed = models.BooleanField(default=False)

    # Post-execution
    post_move_to_column = models.ForeignKey(
        "projects.Column", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    post_notify_assignee = models.BooleanField(default=True)
    post_notify_creator = models.BooleanField(default=False)

    # Agent-specific settings
    challenge_auto_approve_threshold = models.IntegerField(null=True, blank=True)
    fix_severity_filter = models.JSONField(default=list, blank=True)
    fix_max_iterations = models.IntegerField(default=3)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "agent_configs"
        unique_together = [("project", "agent_type")]

    def __str__(self):
        return f"{self.get_agent_type_display()} Agent — {self.project.name}"
