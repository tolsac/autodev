from rest_framework import serializers

from .models import Notification, NotificationChannel


class NotificationChannelSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationChannel
        fields = [
            "id",
            "channel_type",
            "is_active",
            "is_default",
            "is_deletable",
            "created_at",
        ]
        read_only_fields = ["id", "is_deletable", "created_at"]


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "notification_type",
            "title",
            "body",
            "action_url",
            "ticket",
            "is_read",
            "read_at",
            "created_at",
        ]
        read_only_fields = fields
