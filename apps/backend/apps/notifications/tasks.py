import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def send_notification(notification_id: str):
    from apps.notifications.models import Notification
    try:
        notif = Notification.objects.get(id=notification_id)
    except Notification.DoesNotExist:
        logger.error(f"Notification {notification_id} not found")
        return
    logger.info(f"[STUB] Send notification {notif.notification_type} to {notif.user.email}")
    notif.channels_sent = ["in_app"]
    notif.save(update_fields=["channels_sent"])
