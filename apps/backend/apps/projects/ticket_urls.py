from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "tickets"

router = DefaultRouter()
router.register("", views.TicketViewSet, basename="ticket")

urlpatterns = [
    path("", include(router.urls)),
]
