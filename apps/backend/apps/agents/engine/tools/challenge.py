from pydantic_ai import RunContext
from apps.agents.engine.context import AgentContext


def register_challenge_tools(agent):
    """Tools specific to the Challenge Agent."""

    @agent.tool
    def approve_ticket(ctx: RunContext[AgentContext], analysis_summary: str, completeness_score: int) -> str:
        """Approve the ticket after analysis. The ticket has enough detail to be implemented.

        Args:
            analysis_summary: Summary of the analysis (strengths, suggestions)
            completeness_score: Completeness score from 0 to 100
        """
        from apps.projects.models import Ticket
        from apps.agents.models import AgentRun, AIAnalysis

        ticket = Ticket.objects.get(id=ctx.deps.ticket_id)
        run = AgentRun.objects.get(id=ctx.deps.agent_run_id)

        AIAnalysis.objects.create(
            agent_run=run, ticket=ticket,
            completeness_score=completeness_score,
            summary=analysis_summary,
            is_approved=True, requires_input=False,
        )

        ticket.challenge_status = "approved"
        ticket.save(update_fields=["challenge_status"])

        return f"Ticket approved with score {completeness_score}/100."

    @agent.tool
    def reject_ticket(ctx: RunContext[AgentContext], reason: str, completeness_score: int) -> str:
        """Reject the ticket. It's too vague or incomplete even after questions.

        Args:
            reason: Rejection reason with improvement suggestions
            completeness_score: Completeness score from 0 to 100
        """
        from apps.projects.models import Ticket
        from apps.agents.models import AgentRun, AIAnalysis

        ticket = Ticket.objects.get(id=ctx.deps.ticket_id)
        run = AgentRun.objects.get(id=ctx.deps.agent_run_id)

        AIAnalysis.objects.create(
            agent_run=run, ticket=ticket,
            completeness_score=completeness_score,
            summary=reason,
            is_approved=False, requires_input=False,
        )

        ticket.challenge_status = "failed"
        ticket.save(update_fields=["challenge_status"])

        return f"Ticket rejected (score: {completeness_score}/100)."
