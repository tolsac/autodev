def get_openrouter_api_key(project) -> str:
    """Resolve OpenRouter API key: project override > organization."""
    if project.openrouter_api_key_override:
        return project.openrouter_api_key_override
    return project.organization.openrouter_api_key
