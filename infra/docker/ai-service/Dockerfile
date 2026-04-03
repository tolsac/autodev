FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev git && \
    rm -rf /var/lib/apt/lists/*

COPY apps/ai-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/ai-service/ .

CMD ["celery", "-A", "main", "worker", "--loglevel=info", "--concurrency=2"]
