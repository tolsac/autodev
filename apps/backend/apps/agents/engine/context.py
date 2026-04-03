from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class AgentContext:
    """Context passed to all tools during agent execution via PydanticAI deps."""

    agent_run_id: str
    agent_config_id: str
    ticket_id: str
    project_id: str
    organization_id: str

    # Cloned repo paths: repo_id -> local path
    repo_paths: dict[str, Path] = field(default_factory=dict)

    # Ticket metadata (loaded at startup)
    ticket_key: str = ""
    ticket_title: str = ""
    ticket_description: str = ""
    ticket_acceptance_criteria: str = ""
    ticket_priority: str = ""
    assigned_to_name: str = ""
    created_by_name: str = ""
    created_by_id: str = ""

    # Impacted repos: [{"id": "...", "full_name": "...", "path": Path(...)}]
    impacted_repos: list[dict] = field(default_factory=list)

    # Step tracking
    current_step_position: int = 0

    # API key
    openrouter_api_key: str = ""
