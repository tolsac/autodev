from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.projects.models import Ticket

from apps.projects.models import Project

from .models import (
    AgentConfig,
    AgentRun,
    AgentRunStep,
    AIAnalysis,
    ImplementationPlan,
    ReviewFinding,
    ReviewResult,
)
from .serializers import (
    AgentConfigSerializer,
    AgentRunSerializer,
    AgentRunStepDetailSerializer,
    AgentRunStepSerializer,
    AIAnalysisSerializer,
    ImplementationPlanSerializer,
    LLMModelSerializer,
    ReviewFindingSerializer,
    ReviewResultSerializer,
)


def _get_ticket(kwargs):
    return get_object_or_404(
        Ticket,
        project__organization__slug=kwargs["org_slug"],
        project__slug=kwargs["project_slug"],
        ticket_key=kwargs["ticket_key"],
    )


class StartAgentView(APIView):
    """POST to start an agent run on a ticket."""

    def post(self, request, agent_type, **kwargs):
        ticket = _get_ticket(kwargs)
        run = AgentRun.objects.create(
            ticket=ticket,
            agent_type=agent_type,
            triggered_by=request.user,
            status=AgentRun.Status.QUEUED,
        )
        # TODO: dispatch Celery task
        return Response(AgentRunSerializer(run).data, status=status.HTTP_202_ACCEPTED)


class AgentRunListView(APIView):
    def get(self, request, **kwargs):
        ticket = _get_ticket(kwargs)
        runs = AgentRun.objects.filter(ticket=ticket)
        return Response(AgentRunSerializer(runs, many=True).data)


class AgentRunDetailView(APIView):
    def get(self, request, run_id, **kwargs):
        ticket = _get_ticket(kwargs)
        run = get_object_or_404(AgentRun, pk=run_id, ticket=ticket)
        return Response(AgentRunSerializer(run).data)


class AgentRunStepListView(APIView):
    def get(self, request, run_id, **kwargs):
        ticket = _get_ticket(kwargs)
        steps = AgentRunStep.objects.filter(
            agent_run_id=run_id, agent_run__ticket=ticket
        )
        return Response(AgentRunStepSerializer(steps, many=True).data)


class AgentRunStepDetailView(APIView):
    def get(self, request, run_id, step_id, **kwargs):
        ticket = _get_ticket(kwargs)
        step = get_object_or_404(
            AgentRunStep, pk=step_id, agent_run_id=run_id, agent_run__ticket=ticket
        )
        return Response(AgentRunStepDetailSerializer(step).data)


class CancelAgentRunView(APIView):
    def post(self, request, run_id, **kwargs):
        ticket = _get_ticket(kwargs)
        run = get_object_or_404(AgentRun, pk=run_id, ticket=ticket)
        if run.status in (AgentRun.Status.QUEUED, AgentRun.Status.RUNNING):
            run.status = AgentRun.Status.CANCELLED
            run.completed_at = timezone.now()
            run.save(update_fields=["status", "completed_at"])
        return Response(AgentRunSerializer(run).data)


class AIAnalysisView(APIView):
    def get(self, request, **kwargs):
        ticket = _get_ticket(kwargs)
        analysis = AIAnalysis.objects.filter(ticket=ticket).first()
        if not analysis:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(AIAnalysisSerializer(analysis).data)


class AIAnalysisListView(APIView):
    def get(self, request, **kwargs):
        ticket = _get_ticket(kwargs)
        analyses = AIAnalysis.objects.filter(ticket=ticket)
        return Response(AIAnalysisSerializer(analyses, many=True).data)


class ImplementationPlanView(APIView):
    def get(self, request, **kwargs):
        ticket = _get_ticket(kwargs)
        plan = (
            ImplementationPlan.objects.filter(ticket=ticket)
            .prefetch_related("steps")
            .first()
        )
        if not plan:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(ImplementationPlanSerializer(plan).data)


class ImplementationPlanListView(APIView):
    def get(self, request, **kwargs):
        ticket = _get_ticket(kwargs)
        plans = ImplementationPlan.objects.filter(ticket=ticket).prefetch_related(
            "steps"
        )
        return Response(ImplementationPlanSerializer(plans, many=True).data)


class ApprovePlanView(APIView):
    def post(self, request, **kwargs):
        ticket = _get_ticket(kwargs)
        plan = ImplementationPlan.objects.filter(ticket=ticket).first()
        if not plan:
            return Response(status=status.HTTP_404_NOT_FOUND)
        plan.approved_at = timezone.now()
        plan.approved_by = request.user
        plan.save(update_fields=["approved_at", "approved_by"])
        ticket.plan_status = Ticket.AgentStatus.APPROVED
        ticket.save(update_fields=["plan_status"])
        return Response(ImplementationPlanSerializer(plan).data)


class RejectPlanView(APIView):
    def post(self, request, **kwargs):
        ticket = _get_ticket(kwargs)
        ticket.plan_status = Ticket.AgentStatus.REJECTED
        ticket.save(update_fields=["plan_status"])
        return Response({"success": True})


class ReviewResultView(APIView):
    def get(self, request, **kwargs):
        ticket = _get_ticket(kwargs)
        review = (
            ReviewResult.objects.filter(ticket=ticket)
            .prefetch_related("findings")
            .first()
        )
        if not review:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(ReviewResultSerializer(review).data)


class ReviewFindingsView(APIView):
    def get(self, request, **kwargs):
        ticket = _get_ticket(kwargs)
        review = ReviewResult.objects.filter(ticket=ticket).first()
        if not review:
            return Response(status=status.HTTP_404_NOT_FOUND)
        findings = ReviewFinding.objects.filter(review_result=review)
        severity = request.query_params.get("severity")
        if severity:
            findings = findings.filter(severity__in=severity.split(","))
        fix_status = request.query_params.get("status")
        if fix_status:
            findings = findings.filter(fix_status__in=fix_status.split(","))
        return Response(ReviewFindingSerializer(findings, many=True).data)


class UpdateFindingView(APIView):
    def patch(self, request, finding_id, **kwargs):
        ticket = _get_ticket(kwargs)
        finding = get_object_or_404(
            ReviewFinding,
            pk=finding_id,
            review_result__ticket=ticket,
        )
        new_status = request.data.get("fix_status")
        if new_status:
            finding.fix_status = new_status
            finding.save(update_fields=["fix_status"])
        return Response(ReviewFindingSerializer(finding).data)


# ── Agent Config ──

class AgentConfigListView(APIView):
    def get(self, request, org_slug, project_slug):
        project = get_object_or_404(Project, organization__slug=org_slug, slug=project_slug)
        configs = AgentConfig.objects.filter(project=project).select_related(
            "trigger_move_source_column", "trigger_move_target_column", "post_move_to_column",
        )
        return Response(AgentConfigSerializer(configs, many=True).data)


class AgentConfigUpdateView(APIView):
    def patch(self, request, org_slug, project_slug, agent_type):
        project = get_object_or_404(Project, organization__slug=org_slug, slug=project_slug)
        config = get_object_or_404(AgentConfig, project=project, agent_type=agent_type)
        serializer = AgentConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(AgentConfigSerializer(config).data)


class LLMModelsView(APIView):
    def get(self, request):
        from .llm_models import AVAILABLE_LLM_MODELS
        return Response(LLMModelSerializer(AVAILABLE_LLM_MODELS, many=True).data)


class ValidateOpenRouterKeyView(APIView):
    def post(self, request, org_slug):
        import httpx
        api_key = request.data.get("api_key", "")
        if not api_key:
            return Response({"valid": False, "error": "Cle API manquante."}, status=400)
        try:
            resp = httpx.get(
                "https://openrouter.ai/api/v1/auth/key",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json().get("data", {})
                return Response({
                    "valid": True,
                    "label": data.get("label", ""),
                    "usage": data.get("usage", 0),
                    "limit": data.get("limit"),
                    "limit_remaining": data.get("limit_remaining"),
                })
            return Response({"valid": False, "error": "Cle invalide ou expiree."}, status=400)
        except httpx.TimeoutException:
            return Response({"valid": False, "error": "OpenRouter timeout."}, status=502)
        except Exception as e:
            return Response({"valid": False, "error": str(e)}, status=502)
