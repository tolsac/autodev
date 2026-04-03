import subprocess
from pathlib import Path
from pydantic_ai import RunContext
from apps.agents.engine.context import AgentContext


def register_common_tools(agent):
    """Register common tools shared by all agents."""

    @agent.tool
    def read_file(ctx: RunContext[AgentContext], repository_full_name: str, file_path: str) -> str:
        """Read a file from a cloned repository.

        Args:
            repository_full_name: Full repo name (e.g. "acme-corp/autodev-api")
            file_path: Relative file path (e.g. "src/models/user.py")
        """
        repo_path = _resolve_repo_path(ctx.deps, repository_full_name)
        if not repo_path:
            return f"Error: repository '{repository_full_name}' not found in cloned repos."

        full_path = repo_path / file_path
        if not full_path.exists() or not full_path.is_file():
            return f"Error: file '{file_path}' does not exist in {repository_full_name}."

        try:
            content = full_path.read_text(encoding="utf-8", errors="replace")
            if len(content) > 50000:
                content = content[:50000] + f"\n\n... [truncated, {len(content)} chars total]"
            return content
        except Exception as e:
            return f"Error reading file: {e}"

    @agent.tool
    def list_directory(ctx: RunContext[AgentContext], repository_full_name: str, directory_path: str = "") -> str:
        """List files and directories in a repo directory.

        Args:
            repository_full_name: Full repo name
            directory_path: Relative directory path (empty = repo root)
        """
        repo_path = _resolve_repo_path(ctx.deps, repository_full_name)
        if not repo_path:
            return f"Error: repository '{repository_full_name}' not found."

        target = repo_path / directory_path if directory_path else repo_path
        if not target.exists():
            return f"Error: directory '{directory_path}' does not exist."

        ignore = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build", ".next", "coverage", "target", "vendor"}
        entries = []
        for entry in sorted(target.iterdir()):
            if entry.name in ignore or entry.name.startswith("."):
                continue
            entries.append(f"{'dir' if entry.is_dir() else 'file'}: {entry.name}")

        return "\n".join(entries) if entries else "Empty directory."

    @agent.tool
    def get_file_tree(ctx: RunContext[AgentContext], repository_full_name: str, max_depth: int = 3) -> str:
        """Get the file tree of a repository.

        Args:
            repository_full_name: Full repo name
            max_depth: Max depth (default 3)
        """
        repo_path = _resolve_repo_path(ctx.deps, repository_full_name)
        if not repo_path:
            return f"Error: repository '{repository_full_name}' not found."

        ignore = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build", ".next", "coverage", "target", "vendor", ".idea", ".vscode"}
        lines = []

        def walk(path: Path, prefix: str, depth: int):
            if depth > max_depth:
                return
            try:
                entries = sorted(path.iterdir(), key=lambda e: (not e.is_dir(), e.name))
            except PermissionError:
                return
            filtered = [e for e in entries if e.name not in ignore and not e.name.startswith(".")]
            for i, entry in enumerate(filtered):
                is_last = i == len(filtered) - 1
                lines.append(f"{prefix}{'└── ' if is_last else '├── '}{entry.name}")
                if entry.is_dir():
                    walk(entry, prefix + ("    " if is_last else "│   "), depth + 1)

        walk(repo_path, "", 0)
        tree = "\n".join(lines)
        return tree[:30000] if len(tree) > 30000 else tree

    @agent.tool
    def search_code(ctx: RunContext[AgentContext], repository_full_name: str, pattern: str, file_extension: str = "") -> str:
        """Search for a pattern in repository files (grep).

        Args:
            repository_full_name: Full repo name
            pattern: Text or regex to search
            file_extension: Filter by extension (e.g. ".py"). Empty = all files.
        """
        repo_path = _resolve_repo_path(ctx.deps, repository_full_name)
        if not repo_path:
            return f"Error: repository '{repository_full_name}' not found."

        cmd = ["grep", "-rn"]
        if file_extension:
            cmd.extend(["--include=*" + file_extension])
        for d in [".git", "node_modules", "__pycache__", "dist", "build", ".venv", "venv", "coverage"]:
            cmd.append(f"--exclude-dir={d}")
        cmd.extend([pattern, str(repo_path)])

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        except subprocess.TimeoutExpired:
            return "Error: search timed out (30s)."

        if not result.stdout:
            return f"No results for '{pattern}'."

        lines = result.stdout.strip().split("\n")
        cleaned = [line.replace(str(repo_path) + "/", "") for line in lines[:50]]
        text = "\n".join(cleaned)
        if len(lines) > 50:
            text += f"\n\n... ({len(lines)} results total, 50 shown)"
        return text

    @agent.tool
    def add_comment(ctx: RunContext[AgentContext], body: str) -> str:
        """Post a comment on the current ticket.

        Args:
            body: Comment content (Markdown supported)
        """
        from apps.projects.models import Comment, Ticket
        from apps.agents.models import AgentRun

        run = AgentRun.objects.get(id=ctx.deps.agent_run_id)
        ticket = Ticket.objects.get(id=ctx.deps.ticket_id)

        Comment.objects.create(
            ticket=ticket,
            author_type="agent",
            agent_type=run.agent_type,
            body=body,
            is_question=False,
        )
        return "Comment posted."

    @agent.tool
    def ask_question(ctx: RunContext[AgentContext], question: str) -> str:
        """Ask a question to the ticket creator. The agent will be paused until they respond.

        Args:
            question: The question to ask
        """
        from apps.projects.models import Comment, Ticket
        from apps.agents.models import AgentRun
        from apps.agents.engine.exceptions import AgentPausedException

        ticket = Ticket.objects.get(id=ctx.deps.ticket_id)
        run = AgentRun.objects.get(id=ctx.deps.agent_run_id)

        Comment.objects.create(
            ticket=ticket,
            author_type="agent",
            agent_type=run.agent_type,
            body=question,
            is_question=True,
            is_resolved=False,
        )
        raise AgentPausedException(question)

    @agent.tool
    def get_ticket_details(ctx: RunContext[AgentContext], ticket_key: str) -> str:
        """Get details of another ticket in the same project.

        Args:
            ticket_key: The ticket key (e.g. "AD-42")
        """
        from apps.projects.models import Ticket

        try:
            t = Ticket.objects.select_related("column", "assigned_to").get(
                ticket_key=ticket_key, project_id=ctx.deps.project_id,
            )
        except Ticket.DoesNotExist:
            return f"Ticket '{ticket_key}' not found."

        return (
            f"Ticket: {t.ticket_key}\nTitle: {t.title}\nDescription: {t.description}\n"
            f"Acceptance Criteria: {t.acceptance_criteria}\nColumn: {t.column.name}\n"
            f"Priority: {t.priority}\nChallenge: {t.challenge_status}\nPlan: {t.plan_status}"
        )


def _resolve_repo_path(deps: AgentContext, full_name: str) -> Path | None:
    for info in deps.impacted_repos:
        if info["full_name"] == full_name:
            return info["path"]
    return None
