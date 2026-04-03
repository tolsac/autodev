import logging
from apps.agents.models import AgentConfig

logger = logging.getLogger(__name__)


def should_agent_trigger(config: AgentConfig, ticket, event: str, **context) -> bool:
    if not config.is_enabled:
        return False

    # Check trigger
    trigger_match = False
    if event == "ticket_created" and config.trigger_on_ticket_created:
        trigger_match = True
    elif event == "ticket_moved" and config.trigger_on_ticket_moved:
        src = context.get("source_column_id")
        tgt = context.get("target_column_id")
        if config.trigger_move_source_column_id and str(config.trigger_move_source_column_id) != str(src):
            return False
        if config.trigger_move_target_column_id and str(config.trigger_move_target_column_id) != str(tgt):
            return False
        trigger_match = True
    elif event == "ticket_modified" and config.trigger_on_ticket_modified:
        trigger_match = True
    elif event == "pr_created" and config.trigger_on_pr_created:
        trigger_match = True
    elif event == "pr_merged" and config.trigger_on_pr_merged:
        trigger_match = True

    if not trigger_match:
        return False

    # Check prerequisites
    if config.requires_challenge_approved and ticket.challenge_status != "approved":
        return False
    if config.requires_plan_approved and ticket.plan_status != "approved":
        return False
    if config.requires_pr_created and ticket.code_status != "pr_created":
        return False
    if config.requires_review_completed and ticket.review_status not in ("approved", "changes_requested"):
        return False

    return True


def evaluate_triggers_for_event(project, ticket, event: str, **context):
    from apps.agents.tasks import (
        run_challenge_agent, run_plan_agent, run_code_agent,
        run_review_agent, run_fix_agent,
    )
    from apps.agents.models import AgentRun

    task_map = {
        "challenge": run_challenge_agent,
        "plan": run_plan_agent,
        "code": run_code_agent,
        "review": run_review_agent,
        "fix": run_fix_agent,
    }

    configs = AgentConfig.objects.filter(project=project)
    for config in configs:
        if should_agent_trigger(config, ticket, event, **context):
            run = AgentRun.objects.create(
                ticket=ticket,
                agent_type=config.agent_type,
                status="queued",
                auto_triggered=True,
            )
            task = task_map.get(config.agent_type)
            if task:
                task.delay(str(run.id))
                logger.info(f"Auto-triggered {config.agent_type} agent for {ticket.ticket_key}")
