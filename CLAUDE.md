# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **Backend**: FastAPI + SQLAlchemy 2.x + PostgreSQL (Alembic for migrations)
- **Frontend**: React + Vite (no TypeScript, plain JSX)
- **Deployment**: Single Docker container with embedded PostgreSQL (for Unraid/self-hosted)
- **Image**: `ghcr.io/pecha2k2/payment-gestion:latest` — published automatically via GitHub Actions on push to `main`

## Commands

```bash
# Desarrollo local
make dev             # Frontend en :5173 (proxy automático a :8000)
make dev-backend     # Backend en :8000 (requiere PostgreSQL local)

# Docker (producción local)
make run             # Build frontend + docker-compose up --build (primera vez)
make rebuild         # Rebuild frontend + restart container
make logs            # Ver logs del contenedor

# Base de datos
docker exec payment-gestion alembic upgrade head   # Aplicar migraciones
docker exec payment-gestion alembic revision --autogenerate -m "descripción"  # Nueva migración

# Backup
make backup-db       # pg_dump desde container a backups/database/
```

> **Nunca buildear después de cambios** — el CI/CD publica automáticamente en ghcr.io.

## Arquitectura

### Backend (`app/`)

Estructura clásica FastAPI:
- `main.py` — app FastAPI, CORS, montaje de estáticos, startup hook (crea admin + configs de workflow por defecto)
- `database.py` — engine SQLAlchemy, `SessionLocal`, `Base`, `get_db()` dependency
- `models/` — SQLAlchemy ORM: `payment.py`, `workflow.py`, `user.py`
- `schemas/` — Pydantic schemas (create/update/response) para cada modelo
- `routers/` — un archivo por recurso, todos con prefijo `/api/`
- `services/` — lógica de negocio desacoplada de los routers (auth, payment, workflow)
- `utils/security.py` — hashing bcrypt + JWT

### Flujo de trabajo (core business logic)

`app/services/workflow.py` contiene toda la lógica:
- `AREA_TO_ROLES` — mapea cada área al rol que puede operarla
- `AREA_DEPENDENCIES` — restricciones de orden (pagadora depende de aprobadora, SAP de pagadora)
- El flujo se configura en `WorkflowConfig` (tabla DB), leído por `tipo_pago` (`CON_FACTURA` / `SIN_FACTURA`)
- `WorkflowState` registra el estado por área (`PENDIENTE → EN_PROCESO → APROBADO`)

### Frontend (`frontend/src/`)

SPA React sin router externo (navegación manejada con estado en `App.jsx`). Páginas:
- `LoginPage`, `DashboardPage`, `PaymentsListPage`, `PaymentDetailPage`, `NewPaymentPage`, `UsersPage`, `WorkflowConfigsPage`
- `api/index.js` — todas las llamadas a la API centralizadas aquí

### Docker / Persistencia

El container embebe PostgreSQL. Volúmenes críticos:
- `pgdata` (Docker managed) → `/var/lib/postgresql/data` — datos de PostgreSQL
- `./documents` → `/app/documents` — archivos subidos
- `./frontend/dist` → `/app/frontend` — frontend buildeado (override del build interno)
- `./backups` → `/app/backups` — backups de BD

El frontend se sirve en `/static/`, no en `/`. La raíz `/` redirige a `/static/index.html`.

### Migraciones

Alembic gestiona el schema. `sqlalchemy.url` se sobreescribe desde `DATABASE_URL` en `alembic/env.py`. **No usar `Base.metadata.create_all()`** — todo va por migraciones.

## Variables de entorno clave

| Variable | Default | Descripción |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/payment_gestion` | Conexión PostgreSQL |
| `ADMIN_PASSWORD` | `admin123` | Password del usuario admin inicial |
| `ALLOWED_ORIGINS` | `*` | CORS origins (comma-separated) |
| `DOCUMENTS_DIR` | `/app/documents` | Directorio de documentos subidos |
| `STATIC_DIR` | `/app/frontend` | Directorio del build del frontend |
