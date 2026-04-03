from django.contrib import admin
from django.urls import include, path

from apps.agents import views as views_agents
from apps.notifications import views as notif_views
from apps.scm import views as scm_views

# Ticket-scoped paths (agents, analysis, plans, review, PRs)
ticket_patterns = [
    path("", include("apps.agents.urls")),
]

# Project-scoped paths
project_patterns = [
    path("", include("apps.projects.urls")),
]

# Org-scoped paths
org_patterns = [
    path("projects/", include(("apps.projects.urls", "projects"), namespace="org-projects")),
    path(
        "projects/<slug:project_slug>/",
        include(
            [
                path("tickets/", include(("apps.projects.ticket_urls", "tickets"), namespace="project-tickets")),
                path(
                    "tickets/<str:ticket_key>/",
                    include(("apps.agents.urls", "agents"), namespace="ticket-agents"),
                ),
                path(
                    "repositories/",
                    include(("apps.scm.urls", "scm"), namespace="project-scm"),
                ),
                # Agent configs (project-scoped)
                path("agents/", views_agents.AgentConfigListView.as_view(), name="agent-configs"),
                path("agents/<str:agent_type>/", views_agents.AgentConfigUpdateView.as_view(), name="agent-config-update"),
            ]
        ),
    ),
    path("", include(("apps.scm.urls", "scm"), namespace="org-scm")),
    path(
        "notification-channels/",
        notif_views.NotificationChannelListView.as_view(),
        name="notification-channels",
    ),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    # Auth
    path("api/v1/auth/", include("apps.users.urls")),
    # Organizations
    path("api/v1/orgs/", include("apps.organizations.urls")),
    # Org-scoped resources
    path("api/v1/orgs/<slug:org_slug>/", include(org_patterns)),
    # Notifications (user-scoped)
    path("api/v1/notifications/", include("apps.notifications.urls")),
    # Invitations (public)
    path(
        "api/v1/invitations/<str:token>/accept/",
        include([]),  # handled in organizations.urls
    ),
    # LLM Models + OpenRouter
    path("api/v1/llm-models/", views_agents.LLMModelsView.as_view(), name="llm-models"),
    path("api/v1/orgs/<slug:org_slug>/openrouter/validate/", views_agents.ValidateOpenRouterKeyView.as_view(), name="validate-openrouter-key"),
    # GitHub App callback (redirect from GitHub, not org-scoped)
    path("api/v1/scm/github/callback/", scm_views.GitHubCallbackView.as_view(), name="github-callback"),
    # Webhooks
    path("api/v1/webhooks/github/", scm_views.WebhookGitHubView.as_view(), name="webhook-github"),
    path("api/v1/webhooks/stripe/", scm_views.WebhookStripeView.as_view(), name="webhook-stripe"),
]
