import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from backend directory
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

from celery import Celery

app = Celery("autodev")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
