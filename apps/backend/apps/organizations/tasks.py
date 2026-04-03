import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def reset_monthly_ai_counters():
    from apps.organizations.models import BillingAccount
    count = BillingAccount.objects.all().update(current_ai_runs_count=0)
    logger.info(f"Reset AI run counters for {count} billing accounts")
