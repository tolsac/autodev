from django.urls import path

from . import views

app_name = "notifications"

urlpatterns = [
    path("", views.NotificationListView.as_view(), name="list"),
    path("<uuid:notification_id>/read/", views.NotificationReadView.as_view(), name="read"),
    path("read-all/", views.NotificationReadAllView.as_view(), name="read-all"),
    path("unread-count/", views.UnreadCountView.as_view(), name="unread-count"),
]
