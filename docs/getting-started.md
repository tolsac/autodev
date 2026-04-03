# Getting Started

## Prerequisites

- Python 3.12+
- Node.js 22+
- PostgreSQL 16 (avec pgvector)
- Redis 7

## Setup rapide avec Docker Compose

```bash
# Lancer les services tiers (Postgres + Redis)
cd infra && docker compose -f docker-compose.dev.yml up -d
```

## Backend

```bash
cd apps/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements/dev.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

## Frontend

```bash
cd apps/frontend
npm install
npm run dev
```

## Service AI

```bash
cd apps/ai-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
celery -A main worker --loglevel=info
```
