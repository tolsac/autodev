from pydantic_ai import Agent
from apps.agents.models import AgentConfig
from apps.agents.engine.context import AgentContext
from apps.agents.engine.tools.common import register_common_tools

BASE_PROMPTS = {
    "challenge": (
        "Tu es un tech lead senior qui review les tickets avant implementation. "
        "Analyse si le ticket contient assez d'informations pour etre implemente sans ambiguite. "
        "Examine la codebase pour comprendre le contexte. "
        "Si le ticket est clair, approuve-le avec approve_ticket. "
        "Si tu as des questions, utilise ask_question. "
        "Commence TOUJOURS par explorer l'arborescence du repo avec get_file_tree."
    ),
    "plan": (
        "Tu es un architecte logiciel. Cree un plan d'implementation detaille pour le ticket. "
        "Analyse la codebase, identifie les fichiers a modifier/creer, propose un plan etape par etape."
    ),
    "code": (
        "Tu es un developpeur senior. Implemente le plan en ecrivant le code necessaire."
    ),
    "review": (
        "Tu es un code reviewer exigeant. Analyse les PRs et identifie bugs, securite, performance."
    ),
    "fix": (
        "Tu es un developpeur qui corrige les problemes identifies en review."
    ),
}


def create_agent(config: AgentConfig, openrouter_api_key: str) -> Agent[AgentContext]:
    """Create a PydanticAI agent configured from an AgentConfig."""

    # Build system prompt
    prompt = BASE_PROMPTS.get(config.agent_type, "")
    if config.system_prompt:
        prompt += f"\n\nInstructions supplementaires:\n{config.system_prompt}"

    # Create agent with OpenAI-compatible provider (OpenRouter is OpenAI-compatible)
    model_settings = {"temperature": config.temperature}
    if config.max_tokens:
        model_settings["max_tokens"] = config.max_tokens

    agent = Agent(
        f"openai:{config.llm_model}",
        deps_type=AgentContext,
        system_prompt=prompt,
        model_settings=model_settings,
    )

    # Register tools
    register_common_tools(agent)

    if config.agent_type == "challenge":
        from apps.agents.engine.tools.challenge import register_challenge_tools
        register_challenge_tools(agent)
    elif config.agent_type == "plan":
        from apps.agents.engine.tools.plan import register_plan_tools
        register_plan_tools(agent)
    elif config.agent_type == "code":
        from apps.agents.engine.tools.code import register_code_tools
        register_code_tools(agent)
    elif config.agent_type == "review":
        from apps.agents.engine.tools.review import register_review_tools
        register_review_tools(agent)
    elif config.agent_type == "fix":
        from apps.agents.engine.tools.fix import register_fix_tools
        register_fix_tools(agent)

    return agent
