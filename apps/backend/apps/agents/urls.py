from django.urls import path

from . import views

app_name = "agents"

# These are nested under tickets: /orgs/{org}/projects/{project}/tickets/{key}/agents/...
urlpatterns = [
    # Start agents
    path("agents/<str:agent_type>/", views.StartAgentView.as_view(), name="start-agent"),
    # Agent runs
    path("agents/runs/", views.AgentRunListView.as_view(), name="agent-runs"),
    path("agents/runs/<uuid:run_id>/", views.AgentRunDetailView.as_view(), name="agent-run-detail"),
    path("agents/runs/<uuid:run_id>/steps/", views.AgentRunStepListView.as_view(), name="agent-run-steps"),
    path("agents/runs/<uuid:run_id>/steps/<uuid:step_id>/", views.AgentRunStepDetailView.as_view(), name="agent-run-step-detail"),
    path("agents/runs/<uuid:run_id>/cancel/", views.CancelAgentRunView.as_view(), name="cancel-agent-run"),
    # Analysis
    path("analysis/", views.AIAnalysisView.as_view(), name="analysis"),
    path("analyses/", views.AIAnalysisListView.as_view(), name="analyses"),
    # Plans
    path("plan/", views.ImplementationPlanView.as_view(), name="plan"),
    path("plans/", views.ImplementationPlanListView.as_view(), name="plans"),
    path("plan/approve/", views.ApprovePlanView.as_view(), name="approve-plan"),
    path("plan/reject/", views.RejectPlanView.as_view(), name="reject-plan"),
    # Review
    path("review/", views.ReviewResultView.as_view(), name="review"),
    path("review/findings/", views.ReviewFindingsView.as_view(), name="review-findings"),
    path("review/findings/<uuid:finding_id>/", views.UpdateFindingView.as_view(), name="update-finding"),
]
