# Payment Gestion

Sistema de gestión documental de pagos con flujos de trabajo configurables.

## Características

- **Gestión de peticiones de pago** con documentos adjuntos
- **Flujos de trabajo configurables** entre 6 áreas:
  - Demandante, Validadora, Aprobadora, Contabilidad, Pagadora, SAP
- **Dos tipos de flujo**:
  - **Con Factura**: demandante → validadora → aprobadora → contabilidad → pagadora → SAP
  - **Sin Factura**: demandante → aprobadora → pagadora → validadora → contabilidad → SAP
- **Múltiples divisas**: EUR, USD, GBP, CHF, JPY, CNY
- **Búsqueda** por número de petición, propuesta de gasto, orden de pago, número de factura, documento contable, fecha de pago
- **Estados por área** reversibles (PENDIENTE → EN_PROCESO → APROBADO)
- **Comentarios** con marca de tiempo y adjuntos
- **Gestión de usuarios** con roles

## Despliegue con Docker

La imagen incluye PostgreSQL embebido — no necesitás contenedores adicionales.

```bash
# Opción 1: Makefile (recomendado para desarrollo local)
make run        # Build frontend + docker-compose up --build

# Opción 2: Imagen publicada (Unraid / producción)
docker pull ghcr.io/pecha2k2/payment-gestion:latest
docker run -d \
  -p 8000:8000 \
  -v payment_pgdata:/var/lib/postgresql/data \
  -v /ruta/documentos:/app/documents \
  ghcr.io/pecha2k2/payment-gestion:latest
```

> La imagen se publica automáticamente en `ghcr.io/pecha2k2/payment-gestion:latest` con cada push a `main`.

## Desarrollo local

```bash
# Backend (requiere PostgreSQL corriendo)
cd app
pip install -r requirements.txt
alembic upgrade head       # Aplica migraciones de schema
uvicorn app.main:app --reload --port 8000

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev   # ← proxy automático a :8000, disponible en :5173
```

## Comandos Makefile

```bash
make run        # Build frontend + docker-compose up (primera vez)
make rebuild    # Rebuild frontend + restart contenedor
make dev        # Solo frontend en dev (:5173)
make logs       # Ver logs del contenedor
make stop       # Bajar contenedores
make backup-db  # pg_dump desde container a backups/database/
make shell      # Shell dentro del contenedor
```

## Acceso

- URL: http://localhost:8000
- Usuario: `admin` / Contraseña: `admin123`

> Cambiá la contraseña con la variable de entorno `ADMIN_PASSWORD` en producción.

## Usuarios demo

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| admin | admin123 | Administrador |
| demandante1 | demo123 | Demandante |
| validador1 | demo123 | Validador |
| aprobador1 | demo123 | Aprobador |
| contador1 | demo123 | Contador |
| pagador1 | demo123 | Pagador |
| sap1 | demo123 | SAP |

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/payment_gestion` | Conexión PostgreSQL |
| `ADMIN_PASSWORD` | `admin123` | Password del usuario admin inicial |
| `ALLOWED_ORIGINS` | `*` | CORS origins (comma-separated) |
| `DOCUMENTS_DIR` | `/app/documents` | Directorio de documentos subidos |
| `STATIC_DIR` | `/app/frontend` | Directorio del build del frontend |

## API Endpoints

### Autenticación
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Usuario actual

### Peticiones de pago
- `GET /api/payments?page=1&per_page=20` — Listar (paginadas) → `{ total, page, per_page, pages, items }`
- `POST /api/payments` — Crear petición
- `GET /api/payments/{id}` — Detalle
- `PUT /api/payments/{id}` — Actualizar
- `DELETE /api/payments/{id}` — Eliminar
- `POST /api/payments/{id}/cancel` — Cancelar

### Documentos
- `POST /api/payments/{id}/documents` — Subir documento
- `GET /api/documents/{id}/download` — Descargar (autenticado)
- `GET /api/documents/public/{id}/download` — Descargar (público)
- `GET /api/documents/public/{id}/view` — Ver en navegador

### Workflow
- `GET /api/payments/{id}/workflow` — Estados actuales
- `POST /api/payments/{id}/workflow/{area}/advance` — Avanzar estado
- `POST /api/payments/{id}/workflow/{area}/reverse` — Revertir estado
- `POST /api/payments/{id}/workflow/{area}/comment` — Comentar

### Workflow Configs (admin)
- `GET /api/workflow-configs` — Listar configuraciones
- `POST /api/workflow-configs` — Crear configuración
- `PUT /api/workflow-configs/{id}` — Actualizar configuración

### Usuarios (admin)
- `GET /api/users` — Listar usuarios
- `POST /api/users` — Crear usuario
- `PUT /api/users/{id}` — Actualizar usuario
- `DELETE /api/users/{id}` — Eliminar usuario

### Incidencias
- `GET /api/incidences/summary` — Resumen general
- `GET /api/incidences/my-pending` — Mis pendientes
- `GET /api/incidences/by-user/{user_id}` — Por usuario
- `GET /api/incidences/by-area/{area}` — Por área

### Búsqueda
- `GET /api/search?q=...&field=...` — Buscar por campo
