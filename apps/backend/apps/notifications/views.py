from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organizations.models import Organization

from .models import Notification, NotificationChannel
from .serializers import NotificationChannelSerializer, NotificationSerializer


class NotificationListView(APIView):
    def get(self, request):
        notifications = Notification.objects.filter(user=request.user)[:100]
        return Response(NotificationSerializer(notifications, many=True).data)


class NotificationReadView(APIView):
    def post(self, request, notification_id):
        notification = get_object_or_404(
            Notification, pk=notification_id, user=request.user
        )
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save(update_fields=["is_read", "read_at"])
        return Response(NotificationSerializer(notification).data)


class NotificationReadAllView(APIView):
    def post(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(
            is_read=True, read_at=timezone.now()
        )
        return Response({"success": True})


class UnreadCountView(APIView):
    def get(self, request):
        count = Notification.objects.filter(
            user=request.user, is_read=False
        ).count()
        return Response({"unread_count": count})


class NotificationChannelListView(APIView):
    def get(self, request, org_slug):
        org = get_object_or_404(Organization, slug=org_slug)
        channels = NotificationChannel.objects.filter(organization=org)
        return Response(NotificationChannelSerializer(channels, many=True).data)

    def post(self, request, org_slug):
        org = get_object_or_404(Organization, slug=org_slug)
        serializer = NotificationChannelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(organization=org)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
