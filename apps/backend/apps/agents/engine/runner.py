import logging
import os
import shutil
import tempfile
from pathlib import Path

from django.utils import timezone

from apps.agents.models import AgentConfig, AgentRun, AgentRunStep
from apps.agents.engine.context import AgentContext
from apps.agents.engine.exceptions import AgentPausedException
from apps.agents.engine.factory import create_agent

logger = logging.getLogger(__name__)

MAX_TOOL_CALLS = 20


class AgentRunner:
    """Orchestrates PydanticAI agent execution with pause/resume support."""

    def __init__(self, agent_run: AgentRun):
        self.agent_run = agent_run
        self.ticket = agent_run.ticket
        self.project = self.ticket.project
        self.organization = self.project.organization
        self.config = AgentConfig.objects.get(
            project=self.project, agent_type=agent_run.agent_type,
        )
        self.tmp_dirs: list[str] = []

    def run(self):
        """Main agent execution."""
        self.agent_run.status = "running"
        self.agent_run.started_at = timezone.now()
        self.agent_run.save(update_fields=["status", "started_at"])

        try:
            api_key = self._resolve_api_key()
            if not api_key:
                raise ValueError("No OpenRouter API key configured.")

            # Set the API key for OpenAI-compatible calls via OpenRouter
            os.environ["OPENAI_API_KEY"] = api_key
            os.environ["OPENAI_BASE_URL"] = "https://openrouter.ai/api/v1"

            repo_infos = self._clone_repos()
            context = self._build_context(api_key, repo_infos)
            agent = create_agent(self.config, api_key)
            user_prompt = self._build_user_prompt()

            message_history = None
            if self.agent_run.conversation_state:
                message_history = self.agent_run.conversation_state

            result = agent.run_sync(
                user_prompt,
                deps=context,
                message_history=message_history,
            )

            self._save_result(result)

        except AgentPausedException as e:
            self._handle_pause(e)
        except Exception as e:
            self._handle_error(e)
        finally:
            self._cleanup()

    def resume(self, human_response: str):
        """Resume agent after human response."""
        self.agent_run.status = "running"
        self.agent_run.save(update_fields=["status"])

        try:
            api_key = self._resolve_api_key()
            os.environ["OPENAI_API_KEY"] = api_key
            os.environ["OPENAI_BASE_URL"] = "https://openrouter.ai/api/v1"

            repo_infos = self._clone_repos()
            context = self._build_context(api_key, repo_infos)
            agent = create_agent(self.config, api_key)

            message_history = self.agent_run.conversation_state
            if not message_history:
                raise ValueError("No conversation state for resume.")

            result = agent.run_sync(
                f"Reponse du createur du ticket: {human_response}",
                deps=context,
                message_history=message_history,
            )

            self._save_result(result)

        except AgentPausedException as e:
            self._handle_pause(e)
        except Exception as e:
            self._handle_error(e)
        finally:
            self._cleanup()

    def _resolve_api_key(self) -> str:
        if hasattr(self.project, "openrouter_api_key_override") and self.project.openrouter_api_key_override:
            return self.project.openrouter_api_key_override
        if hasattr(self.organization, "openrouter_api_key") and self.organization.openrouter_api_key:
            return self.organization.openrouter_api_key
        return ""

    def _clone_repos(self) -> list[dict]:
        from apps.scm.providers.github import GitHubProvider

        repo_infos = []
        for repo in self.ticket.impacted_repos.select_related("scm_connection").all():
            tmp_dir = tempfile.mkdtemp(prefix=f"autodev-agent-{repo.name}-")
            self.tmp_dirs.append(tmp_dir)

            conn = repo.scm_connection
            if conn.provider_type == "github":
                try:
                    GitHubProvider().clone_repo(int(conn.installation_id), repo.clone_url, tmp_dir)
                except Exception as e:
                    logger.warning(f"Failed to clone {repo.full_name}: {e}")
                    continue

            repo_infos.append({"id": str(repo.id), "full_name": repo.full_name, "path": Path(tmp_dir)})

        return repo_infos

    def _build_context(self, api_key: str, repo_infos: list[dict]) -> AgentContext:
        return AgentContext(
            agent_run_id=str(self.agent_run.id),
            agent_config_id=str(self.config.id),
            ticket_id=str(self.ticket.id),
            project_id=str(self.project.id),
            organization_id=str(self.organization.id),
            ticket_key=self.ticket.ticket_key,
            ticket_title=self.ticket.title,
            ticket_description=self.ticket.description,
            ticket_acceptance_criteria=self.ticket.acceptance_criteria,
            ticket_priority=self.ticket.priority,
            assigned_to_name=getattr(self.ticket.assigned_to, "full_name", ""),
            created_by_name=getattr(self.ticket.created_by, "full_name", ""),
            created_by_id=str(self.ticket.created_by.id) if self.ticket.created_by else "",
            repo_paths={info["id"]: info["path"] for info in repo_infos},
            impacted_repos=repo_infos,
            openrouter_api_key=api_key,
        )

    def _build_user_prompt(self) -> str:
        repos = "\n".join(f"- {r.full_name}" for r in self.ticket.impacted_repos.all())
        return (
            f"Ticket: {self.ticket.ticket_key}\n"
            f"Titre: {self.ticket.title}\n\n"
            f"Description:\n{self.ticket.description}\n\n"
            f"Criteres d'acceptation:\n{self.ticket.acceptance_criteria}\n\n"
            f"Priorite: {self.ticket.priority}\n"
            f"Cree par: {getattr(self.ticket.created_by, 'full_name', 'Inconnu')}\n\n"
            f"Repositories impactes:\n{repos}\n\n"
            f"Analyse ce ticket et utilise les tools pour explorer la codebase."
        )

    def _save_result(self, result):
        self.agent_run.status = "completed"
        self.agent_run.completed_at = timezone.now()
        self.agent_run.result_summary = str(result.data)[:5000] if result.data else ""

        if hasattr(result, "usage") and callable(result.usage):
            usage = result.usage()
            if usage:
                self.agent_run.total_input_tokens = getattr(usage, "request_tokens", 0) or 0
                self.agent_run.total_output_tokens = getattr(usage, "response_tokens", 0) or 0

        if self.agent_run.started_at:
            self.agent_run.duration_seconds = int((timezone.now() - self.agent_run.started_at).total_seconds())

        try:
            self.agent_run.conversation_state = result.all_messages_json()
        except Exception:
            pass

        self.agent_run.save()
        self._execute_post_actions()
        logger.info(f"Agent {self.agent_run.agent_type} completed for {self.ticket.ticket_key}")

    def _handle_pause(self, exc: AgentPausedException):
        self.agent_run.status = "waiting"
        self.agent_run.save(update_fields=["status", "conversation_state"])
        self.ticket.challenge_status = "waiting_for_input"
        self.ticket.save(update_fields=["challenge_status"])
        logger.info(f"Agent {self.agent_run.agent_type} paused for {self.ticket.ticket_key}")

    def _handle_error(self, exc: Exception):
        self.agent_run.status = "failed"
        self.agent_run.error_message = str(exc)[:2000]
        self.agent_run.completed_at = timezone.now()
        if self.agent_run.started_at:
            self.agent_run.duration_seconds = int((timezone.now() - self.agent_run.started_at).total_seconds())
        self.agent_run.save()
        logger.error(f"Agent {self.agent_run.agent_type} failed for {self.ticket.ticket_key}: {exc}", exc_info=True)

    def _execute_post_actions(self):
        if self.config.post_move_to_column:
            self.ticket.column = self.config.post_move_to_column
            self.ticket.save(update_fields=["column"])

    def _cleanup(self):
        for d in self.tmp_dirs:
            try:
                if d and Path(d).exists():
                    shutil.rmtree(d, ignore_errors=True)
            except Exception:
                pass
