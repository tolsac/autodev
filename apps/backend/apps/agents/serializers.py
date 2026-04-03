from rest_framework import serializers

from apps.users.serializers import UserMinimalSerializer

from .models import (
    AgentConfig,
    AgentRun,
    AgentRunStep,
    AIAnalysis,
    ImplementationPlan,
    PlanStep,
    ReviewFinding,
    ReviewResult,
)


class AgentRunSerializer(serializers.ModelSerializer):
    triggered_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = AgentRun
        fields = [
            "id",
            "ticket",
            "agent_type",
            "status",
            "triggered_by",
            "auto_triggered",
            "total_input_tokens",
            "total_output_tokens",
            "total_cost_usd",
            "total_steps",
            "result_summary",
            "error_message",
            "created_at",
            "started_at",
            "completed_at",
            "duration_seconds",
        ]
        read_only_fields = fields


class AgentRunStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentRunStep
        fields = [
            "id",
            "position",
            "step_type",
            "name",
            "model_used",
            "input_tokens",
            "output_tokens",
            "cost_usd",
            "is_success",
            "error_message",
            "duration_ms",
            "created_at",
        ]
        read_only_fields = fields


class AgentRunStepDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentRunStep
        fields = [
            "id",
            "position",
            "step_type",
            "name",
            "system_prompt",
            "user_prompt",
            "raw_response",
            "parsed_result",
            "model_used",
            "input_tokens",
            "output_tokens",
            "cost_usd",
            "is_success",
            "error_message",
            "duration_ms",
            "created_at",
        ]
        read_only_fields = fields


class AIAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIAnalysis
        fields = [
            "id",
            "agent_run",
            "completeness_score",
            "summary",
            "strengths",
            "weaknesses",
            "suggestions",
            "questions",
            "is_approved",
            "requires_input",
            "relevant_files",
            "created_at",
        ]
        read_only_fields = fields


class PlanStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanStep
        fields = [
            "id",
            "repository",
            "position",
            "step_type",
            "title",
            "description",
            "files_to_modify",
            "files_to_create",
        ]
        read_only_fields = fields


class ImplementationPlanSerializer(serializers.ModelSerializer):
    steps = PlanStepSerializer(many=True, read_only=True)
    approved_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = ImplementationPlan
        fields = [
            "id",
            "agent_run",
            "summary",
            "estimated_complexity",
            "estimated_hours",
            "approved_at",
            "approved_by",
            "steps",
            "created_at",
        ]
        read_only_fields = fields


class ReviewFindingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewFinding
        fields = [
            "id",
            "file_path",
            "start_line",
            "end_line",
            "severity",
            "category",
            "title",
            "description",
            "suggested_fix",
            "fix_status",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "file_path",
            "start_line",
            "end_line",
            "severity",
            "category",
            "title",
            "description",
            "suggested_fix",
            "created_at",
        ]


class ReviewResultSerializer(serializers.ModelSerializer):
    findings = ReviewFindingSerializer(many=True, read_only=True)

    class Meta:
        model = ReviewResult
        fields = [
            "id",
            "agent_run",
            "pull_request",
            "is_approved",
            "summary",
            "plan_conformity_score",
            "total_findings",
            "critical_count",
            "major_count",
            "minor_count",
            "suggestion_count",
            "findings",
            "created_at",
        ]
        read_only_fields = fields


class AgentConfigSerializer(serializers.ModelSerializer):
    trigger_move_source_column_name = serializers.CharField(
        source="trigger_move_source_column.name", read_only=True, default=None
    )
    trigger_move_target_column_name = serializers.CharField(
        source="trigger_move_target_column.name", read_only=True, default=None
    )
    post_move_to_column_name = serializers.CharField(
        source="post_move_to_column.name", read_only=True, default=None
    )

    class Meta:
        model = AgentConfig
        fields = [
            "id", "agent_type", "is_enabled",
            "llm_model", "temperature", "max_tokens",
            "system_prompt",
            "trigger_on_ticket_created", "trigger_on_ticket_moved",
            "trigger_move_source_column", "trigger_move_source_column_name",
            "trigger_move_target_column", "trigger_move_target_column_name",
            "trigger_on_ticket_modified", "trigger_on_pr_created", "trigger_on_pr_merged",
            "requires_challenge_approved", "requires_plan_approved",
            "requires_pr_created", "requires_review_completed",
            "post_move_to_column", "post_move_to_column_name",
            "post_notify_assignee", "post_notify_creator",
            "challenge_auto_approve_threshold",
            "fix_severity_filter", "fix_max_iterations",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "agent_type", "created_at", "updated_at"]

    def validate_llm_model(self, value):
        from .llm_models import AVAILABLE_LLM_MODEL_IDS
        if value not in AVAILABLE_LLM_MODEL_IDS:
            raise serializers.ValidationError(f"Modele non disponible: {value}")
        return value

    def validate_temperature(self, value):
        if value < 0.0 or value > 2.0:
            raise serializers.ValidationError("La temperature doit etre entre 0.0 et 2.0.")
        return value


class LLMModelSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    provider = serializers.CharField()
    context_window = serializers.IntegerField()
    input_price_per_m = serializers.FloatField()
    output_price_per_m = serializers.FloatField()
