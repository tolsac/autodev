# Architecture

## Vue d'ensemble

AutoDev est compose de 4 domaines :

1. **Frontend** (`apps/frontend/`) — SPA React + Vite + shadcn/ui
2. **Backend** (`apps/backend/`) — API REST Django + DRF + PostgreSQL
3. **Service AI** (`apps/ai-service/`) — Agents autonomes (analyse, challenge, plans, PRs)
4. **Landing** (`apps/landing/`) — Site marketing statique

## Communication inter-services

- Frontend → Backend : API REST via `/api/v1/`
- Backend → AI Service : Celery tasks via Redis
- AI Service → Backend : Resultats via Celery result backend (Django DB)
- Mises a jour temps reel : Polling court (3-5s) ou SSE pour le MVP

## Base de donnees

- PostgreSQL 16 avec pgvector pour les embeddings de code
- Redis pour le cache, le broker Celery et le pub/sub

## Deploiement

- Dev : Docker Compose (`infra/docker-compose.dev.yml` pour les services tiers uniquement)
- Staging/Prod : Kubernetes (`infra/k8s/`)
