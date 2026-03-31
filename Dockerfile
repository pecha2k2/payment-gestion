# Multi-stage Dockerfile optimizado para Unraid
# Incluye PostgreSQL embebido
FROM python:3.11-bookworm AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: Runtime - con PostgreSQL embebido
FROM python:3.11-bookworm AS runtime

WORKDIR /app

# Instalar PostgreSQL 15 y util-linux para 'su'
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-15 \
    libffi8 \
    libssl3 \
    util-linux \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de datos PostgreSQL
RUN mkdir -p /var/lib/postgresql/data && \
    chown -R postgres:postgres /var/lib/postgresql && \
    chmod 700 /var/lib/postgresql/data

# Copiar Python packages del builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copiar código de la aplicación
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .
COPY init_db.py .
COPY entrypoint.sh /entrypoint.sh

# Crear directorio de documentos y backups
RUN mkdir -p /app/documents /app/backups/database && \
    chown -R postgres:postgres /app/backups && \
    chmod +x /entrypoint.sh

ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PYTHONUSERBASE=/app/.local \
    DOCUMENTS_DIR=/app/documents \
    STATIC_DIR=/app/frontend \
    PGDATA=/var/lib/postgresql/data \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres \
    POSTGRES_DB=payment_gestion

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
