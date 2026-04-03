"""AutoDev AI Service - Entry point."""
import os

from celery import Celery

redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

app = Celery("ai_service", broker=redis_url, backend=redis_url)
app.autodiscover_tasks(["agents", "workers", "embeddings"])
