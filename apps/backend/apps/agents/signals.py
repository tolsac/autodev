import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.projects.models import Comment, Project

logger = logging.getLogger(__name__)

AGENT_DEFAULTS = {
    "challenge": {
        "llm_model": "anthropic/claude-sonnet-4-20250514",
        "temperature": 0.3,
        "trigger_on_ticket_created": True,
        "challenge_auto_approve_threshold": 85,
    },
    "plan": {
        "llm_model": "anthropic/claude-sonnet-4-20250514",
        "temperature": 0.3,
        "requires_challenge_approved": True,
    },
    "code": {
        "llm_model": "anthropic/claude-sonnet-4-20250514",
        "temperature": 0.2,
        "requires_plan_approved": True,
    },
    "review": {
        "llm_model": "anthropic/claude-sonnet-4-20250514",
        "temperature": 0.3,
        "trigger_on_pr_created": True,
        "requires_pr_created": True,
    },
    "fix": {
        "llm_model": "anthropic/claude-sonnet-4-20250514",
        "temperature": 0.2,
        "requires_review_completed": True,
        "fix_severity_filter": ["critical", "major"],
        "fix_max_iterations": 3,
    },
}


@receiver(post_save, sender=Project)
def create_agent_configs(sender, instance, created, **kwargs):
    if not created:
        return
    from apps.agents.models import AgentConfig
    for agent_type, defaults in AGENT_DEFAULTS.items():
        if not AgentConfig.objects.filter(project=instance, agent_type=agent_type).exists():
            AgentConfig.objects.create(project=instance, agent_type=agent_type, **defaults)


@receiver(post_save, sender=Comment)
def handle_reply_to_agent_question(sender, instance, created, **kwargs):
    """When a human replies to an agent's question, auto-resume the agent."""
    if not created or instance.author_type != "human":
        return
    if not instance.parent or not instance.parent.is_question or instance.parent.author_type != "agent":
        return

    # Mark question as resolved
    instance.parent.is_resolved = True
    instance.parent.save(update_fields=["is_resolved"])

    # Find the waiting AgentRun
    from apps.agents.models import AgentRun
    from apps.agents.tasks import resume_agent

    waiting_run = AgentRun.objects.filter(
        ticket=instance.ticket,
        agent_type=instance.parent.agent_type,
        status="waiting",
    ).order_by("-created_at").first()

    if waiting_run:
        resume_agent.delay(str(waiting_run.id), instance.body)
        logger.info(f"Auto-resuming {waiting_run.agent_type} agent for {instance.ticket.ticket_key}")
