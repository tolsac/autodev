from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "organizations"

router = DefaultRouter()
router.register("", views.OrganizationViewSet, basename="organization")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "invitations/<str:token>/accept/",
        views.AcceptInvitationView.as_view(),
        name="accept-invitation",
    ),
]
