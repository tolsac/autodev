from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "avatar_url",
            "preferred_language",
            "preferred_notification_channel",
            "notify_on_agent_questions",
            "notify_on_plan_generated",
            "notify_on_pr_created",
            "notify_on_review_completed",
            "notify_on_fix_applied",
        ]
        read_only_fields = ["id", "email"]


class UserMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "full_name", "avatar_url"]
        read_only_fields = fields


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["email", "full_name", "password"]

    def create(self, validated_data):
        email = validated_data["email"]
        user = User.objects.create_user(
            username=email,
            email=email,
            full_name=validated_data.get("full_name", ""),
            password=validated_data["password"],
        )
        return user
