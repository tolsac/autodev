import os
import shutil
import subprocess
import tempfile
import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


# ── Main agent tasks ──

@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def run_agent(self, agent_run_id: str):
    """Execute an agent using the PydanticAI engine."""
    from apps.agents.models import AgentRun
    from apps.agents.engine.runner import AgentRunner

    try:
        agent_run = AgentRun.objects.select_related(
            "ticket__project__organization",
            "ticket__assigned_to",
            "ticket__created_by",
        ).get(id=agent_run_id)
    except AgentRun.DoesNotExist:
        logger.error(f"AgentRun {agent_run_id} not found")
        return

    runner = AgentRunner(agent_run)
    runner.run()


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def resume_agent(self, agent_run_id: str, human_response: str):
    """Resume an agent after a human response."""
    from apps.agents.models import AgentRun
    from apps.agents.engine.runner import AgentRunner

    try:
        agent_run = AgentRun.objects.select_related(
            "ticket__project__organization",
            "ticket__assigned_to",
            "ticket__created_by",
        ).get(id=agent_run_id)
    except AgentRun.DoesNotExist:
        logger.error(f"AgentRun {agent_run_id} not found")
        return

    if agent_run.status != "waiting":
        logger.warning(f"AgentRun {agent_run_id} not waiting (current: {agent_run.status})")
        return

    runner = AgentRunner(agent_run)
    runner.resume(human_response)


# ── Legacy wrappers (backward compat with trigger_evaluator) ──

@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def run_challenge_agent(self, agent_run_id: str):
    run_agent(agent_run_id)

@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def run_plan_agent(self, agent_run_id: str):
    run_agent(agent_run_id)

@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def run_code_agent(self, agent_run_id: str):
    run_agent(agent_run_id)

@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def run_review_agent(self, agent_run_id: str):
    run_agent(agent_run_id)

@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def run_fix_agent(self, agent_run_id: str):
    run_agent(agent_run_id)


# ── Indexation task ──

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def index_repository(self, repo_id: str):
    from apps.scm.models import Repository

    try:
        repo = Repository.objects.select_related("scm_connection").get(id=repo_id)
    except Repository.DoesNotExist:
        logger.error(f"Repository {repo_id} not found")
        return

    logger.info(f"Starting indexation of {repo.full_name}")
    repo.indexing_status = "indexing"
    repo.save(update_fields=["indexing_status"])

    tmp_dir = None
    try:
        tmp_dir = tempfile.mkdtemp(prefix=f"autodev-{repo.name}-")
        conn = repo.scm_connection
        if conn.provider_type == "github":
            from apps.scm.providers.github import GitHubProvider
            GitHubProvider().clone_repo(int(conn.installation_id), repo.clone_url, tmp_dir)

        source_exts = {".py", ".js", ".ts", ".jsx", ".tsx", ".go", ".rs", ".java", ".html", ".css", ".json", ".yaml", ".yml", ".md", ".sql", ".sh", ".toml"}
        ignore_dirs = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build", "coverage", "target", "vendor"}
        file_count = 0
        for root, dirs, files in os.walk(tmp_dir):
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            for f in files:
                if os.path.splitext(f)[1].lower() in source_exts:
                    file_count += 1

        result = subprocess.run(["git", "-C", tmp_dir, "rev-parse", "HEAD"], capture_output=True, text=True)
        head_sha = result.stdout.strip() if result.returncode == 0 else ""

        repo.indexing_status = "indexed"
        repo.last_indexed_at = timezone.now()
        repo.last_indexed_commit = head_sha
        repo.save(update_fields=["indexing_status", "last_indexed_at", "last_indexed_commit"])
        logger.info(f"Indexed {repo.full_name}: {file_count} files, HEAD={head_sha[:8]}")

    except Exception as e:
        logger.error(f"Indexation failed for {repo.full_name}: {e}")
        repo.indexing_status = "failed"
        repo.save(update_fields=["indexing_status"])
        raise self.retry(exc=e)
    finally:
        if tmp_dir and os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir, ignore_errors=True)


# ── Periodic tasks ──

@shared_task
def cleanup_old_agent_run_steps():
    from apps.agents.models import AgentRunStep
    from datetime import timedelta
    cutoff = timezone.now() - timedelta(days=90)
    deleted, _ = AgentRunStep.objects.filter(created_at__lt=cutoff).delete()
    logger.info(f"Cleaned up {deleted} old AgentRunSteps")

@shared_task
def reindex_stale_repos():
    from apps.scm.models import Repository
    from datetime import timedelta
    cutoff = timezone.now() - timedelta(hours=24)
    stale = Repository.objects.filter(indexing_status="indexed", last_indexed_at__lt=cutoff)
    count = 0
    for repo in stale:
        repo.indexing_status = "pending"
        repo.save(update_fields=["indexing_status"])
        index_repository.delay(str(repo.id))
        count += 1
    logger.info(f"Queued reindexation for {count} stale repos")
