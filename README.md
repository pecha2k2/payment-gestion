# Payment Gestion

Sistema de gestión documental de pagos con flujos de trabajo configurables por área.

[![Docker Image](https://img.shields.io/badge/ghcr.io-pecha2k2%2Fpayment--gestion-blue)](https://ghcr.io/pecha2k2/payment-gestion)

---

## Índice

1. [Características](#características)
2. [Arquitectura](#arquitectura)
3. [Despliegue rápido con Docker](#despliegue-rápido-con-docker)
4. [Despliegue con docker-compose](#despliegue-con-docker-compose)
5. [Desarrollo local](#desarrollo-local)
6. [Variables de entorno](#variables-de-entorno)
7. [Volúmenes persistentes](#volúmenes-persistentes)
8. [Migraciones de base de datos](#migraciones-de-base-de-datos)
9. [Primer acceso y usuarios](#primer-acceso-y-usuarios)
10. [API Reference](#api-reference)
11. [Comandos Makefile](#comandos-makefile)
12. [Backups](#backups)
13. [Actualizar la aplicación](#actualizar-la-aplicación)
14. [Resolución de problemas](#resolución-de-problemas)

---

## Características

- **Peticiones de pago** con documentos adjuntos (PDF, imágenes, Office, ZIP — hasta 50 MB)
- **Flujos de trabajo configurables** entre 6 áreas: Demandante, Validadora, Aprobadora, Contabilidad, Pagadora, SAP
- **Dos flujos predefinidos** + posibilidad de crear flujos custom desde la UI:
  - **Con Factura**: Demandante → Validadora → Aprobadora → Contabilidad → Pagadora → SAP
  - **Sin Factura**: Demandante → Aprobadora → Pagadora → Validadora → Contabilidad → SAP
- **Estados reversibles** por área (Pendiente → Aprobado) con comentarios y adjuntos
- **Búsqueda** con wildcards (`*`, `?`) por número de petición, propuesta de gasto, orden de pago, factura, documento contable, fecha
- **Gestión de usuarios** con 7 roles diferenciados y activación/desactivación
- **Descarga ZIP** de todos los documentos de una petición
- **Dashboard** con estadísticas en tiempo real e incidencias pendientes por área
- **Múltiples divisas**: EUR, USD, GBP, CHF, JPY, CNY

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                     Contenedor único                         │
│                                                              │
│   ┌─────────────────┐      ┌──────────────────────────┐    │
│   │  PostgreSQL 15  │◄────►│  FastAPI + React (SPA)   │    │
│   │  localhost:5432 │      │  puerto 8000             │    │
│   └─────────────────┘      └──────────────────────────┘    │
│                                                              │
│   Volúmenes externos (persistentes):                         │
│     /var/lib/postgresql/data  ← datos PostgreSQL            │
│     /app/documents            ← archivos subidos            │
│     /app/backups              ← backups                     │
└─────────────────────────────────────────────────────────────┘
```

**Stack:**
- Backend: FastAPI + SQLAlchemy 2.x (Python 3.11)
- Frontend: React + Vite (SPA embebida en la imagen Docker, servida en `/static/`)
- Base de datos: PostgreSQL 15 (embebida en el contenedor — no se necesita un contenedor DB separado)
- Migraciones: Alembic (se aplican automáticamente en cada arranque)

---

## Despliegue rápido con Docker

La imagen incluye PostgreSQL, el backend y el frontend. **No se necesita ningún contenedor adicional.**

### Requisitos

- Docker 20.10+
- 512 MB RAM mínimo (recomendado 1 GB)
- 5 GB espacio en disco

### 1. Crear directorios persistentes

```bash
mkdir -p ~/payment-gestion/{postgres,documents,backups}
```

### 2. Ejecutar el contenedor

```bash
docker run -d \
  --name payment-gestion \
  --restart unless-stopped \
  -p 8000:8000 \
  -e TZ="Europe/Madrid" \
  -e ADMIN_PASSWORD="cambia-esto-en-produccion" \
  -e POSTGRES_USER="postgres" \
  -e POSTGRES_PASSWORD="postgres" \
  -e POSTGRES_DB="payment_gestion" \
  -e PGDATA="/var/lib/postgresql/data" \
  -e DATABASE_URL="postgresql://postgres:postgres@localhost:5432/payment_gestion" \
  -e DOCUMENTS_DIR="/app/documents" \
  -e STATIC_DIR="/app/frontend" \
  -e SECRET_KEY="$(openssl rand -hex 32)" \
  -e ALLOWED_ORIGINS="http://localhost:8000" \
  -v ~/payment-gestion/postgres:/var/lib/postgresql/data \
  -v ~/payment-gestion/documents:/app/documents \
  -v ~/payment-gestion/backups:/app/backups \
  ghcr.io/pecha2k2/payment-gestion:latest
```

> **Producción:**
> - Sustituye `cambia-esto-en-produccion` por una contraseña segura.
> - Genera `SECRET_KEY` una sola vez y guárdala: `openssl rand -hex 32`.
> - Pon en `ALLOWED_ORIGINS` la URL real del servidor, ej: `http://192.168.1.100:8000`.

### 3. Verificar el arranque

```bash
docker logs -f payment-gestion
```

Startup correcto:
```
=== Payment Gestion - Starting ===
[4] Starting PostgreSQL...
server started
[7] Running database migrations...
[8] Seeding initial data...
=== Starting FastAPI application ===
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 4. Acceder

Abrí **http://localhost:8000** — la raíz redirige automáticamente al frontend.

---

## Despliegue con docker-compose

Opción recomendada para tener la configuración en un archivo versionable.

### `docker-compose.yml`

```yaml
services:
  app:
    image: ghcr.io/pecha2k2/payment-gestion:latest
    # Para construir desde el código fuente:
    # build: .
    container_name: payment-gestion
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - TZ=Europe/Madrid
      - PYTHONUNBUFFERED=1
      # ⚠️ Cambiar en producción:
      - ADMIN_PASSWORD=cambia-esto-en-produccion
      - SECRET_KEY=genera-con-openssl-rand-hex-32
      # PostgreSQL embebido:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=payment_gestion
      - PGDATA=/var/lib/postgresql/data
      - DATABASE_URL=postgresql://postgres:postgres@localhost:5432/payment_gestion
      # Rutas internas (no cambiar salvo que sepas lo que hacés):
      - DOCUMENTS_DIR=/app/documents
      - STATIC_DIR=/app/frontend
      # CORS — pon tu IP/dominio real en producción:
      - ALLOWED_ORIGINS=http://localhost:8000
    volumes:
      # ⚠️ CRÍTICO: sin pgdata los datos se pierden al recrear el contenedor
      - pgdata:/var/lib/postgresql/data
      - ./documents:/app/documents
      - ./backups:/app/backups
      # Opcional: override del frontend buildeado (útil en desarrollo)
      # - ./frontend/dist:/app/frontend

volumes:
  pgdata:
```

### Comandos

```bash
# Primera vez — inicializa DB y aplica migraciones automáticamente
docker compose up -d

# Ver logs en tiempo real
docker compose logs -f app

# Reiniciar
docker compose restart app

# Parar sin eliminar datos
docker compose down

# Parar y eliminar todos los datos (¡IRREVERSIBLE!)
docker compose down -v
```

### Construir la imagen desde el código fuente

```bash
# 1. Build del frontend (obligatorio — genera frontend/dist/)
cd frontend && npm install && npm run build && cd ..

# 2. Build de la imagen Docker con el frontend embebido
docker compose build

# 3. Arrancar
docker compose up -d
```

---

## Desarrollo local

Para desarrollar con hot-reload en frontend y backend simultáneamente.

### Requisitos

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+ corriendo (local o en Docker)

### Opción A: PostgreSQL en Docker (más rápido para empezar)

```bash
docker run -d \
  --name pg-dev \
  --restart unless-stopped \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=payment_gestion \
  postgres:15
```

### Opción B: PostgreSQL local instalado en el sistema

```bash
# macOS
brew install postgresql@15
brew services start postgresql@15

# Ubuntu/Debian
sudo apt install postgresql-15
sudo systemctl start postgresql
sudo -u postgres createdb payment_gestion
```

### Backend

```bash
# Instalar dependencias
pip install -r requirements.txt

# Variables de entorno (también podés crear un archivo .env en la raíz)
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/payment_gestion"
export ADMIN_PASSWORD="admin123"
export SECRET_KEY="dev-secret-no-usar-en-produccion"
export ALLOWED_ORIGINS="http://localhost:5173,http://localhost:8000"
export DOCUMENTS_DIR="./documents"

# Aplicar migraciones (primera vez y después de cada nueva migración)
alembic upgrade head

# Arrancar con hot-reload
uvicorn app.main:app --reload --port 8000
```

El backend queda en **http://localhost:8000** con Swagger en **http://localhost:8000/docs**.

### Frontend

En otra terminal:

```bash
cd frontend
npm install

# Arrancar con hot-reload y proxy automático a :8000
npm run dev
```

El frontend queda en **http://localhost:5173**. Todas las llamadas a `/api/*` se reenvían al backend en `:8000` automáticamente (configurado en `vite.config.js`).

### Archivo `.env` para desarrollo (opcional)

Creá un `.env` en la raíz del proyecto (no se commitea):

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/payment_gestion
ADMIN_PASSWORD=admin123
SECRET_KEY=dev-secret-no-usar-en-produccion
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8000
DOCUMENTS_DIR=./documents
```

---

## Variables de entorno

| Variable | Default | ¿Cambiar en producción? | Descripción |
|----------|---------|------------------------|-------------|
| `ADMIN_PASSWORD` | `admin123` | **Sí — obligatorio** | Contraseña del usuario `admin`. Solo se aplica en la primera ejecución. |
| `SECRET_KEY` | `changeme` | **Sí — obligatorio** | Clave para firmar JWTs. Generá con `openssl rand -hex 32` y guárdala. |
| `ALLOWED_ORIGINS` | `*` | **Sí — recomendado** | Orígenes CORS permitidos (comma-separated). Con `*` se desactivan las cookies con credenciales. Ej: `http://192.168.1.100:8000` |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/payment_gestion` | No (usa la embedded) | URL completa de conexión a PostgreSQL. |
| `POSTGRES_USER` | `postgres` | No | Usuario de PostgreSQL (usado por el entrypoint para inicializar). |
| `POSTGRES_PASSWORD` | `postgres` | No | Contraseña de PostgreSQL. |
| `POSTGRES_DB` | `payment_gestion` | No | Nombre de la base de datos. |
| `PGDATA` | `/var/lib/postgresql/data` | No | Directorio interno de datos de PostgreSQL. |
| `DOCUMENTS_DIR` | `/app/documents` | No | Ruta interna de almacenamiento de archivos subidos. |
| `STATIC_DIR` | `/app/frontend` | No | Ruta del build del frontend React. |
| `TZ` | `UTC` | Recomendado | Zona horaria. Ej: `Europe/Madrid`, `America/Buenos_Aires`. |
| `PYTHONUNBUFFERED` | `1` | No | Desactiva buffering de logs Python. Dejar en `1`. |
| `REDIS_URL` | *(vacío)* | No | URL de Redis para rate limiting distribuido. Sin Redis, cada proceso tiene su propio contador. Ej: `redis://redis:6379` |

### Nota sobre `ALLOWED_ORIGINS` y CORS

Cuando `ALLOWED_ORIGINS=*` (wildcard), el servidor deshabilita automáticamente `Access-Control-Allow-Credentials` para cumplir con la especificación CORS (RFC 6454). Esto no afecta al uso normal en desarrollo local (mismo origen), pero **en producción con frontend y backend en IPs distintas hay que especificar los orígenes explícitos**.

```bash
# Correcto para producción (un origen)
ALLOWED_ORIGINS=http://192.168.1.100:8000

# Correcto para múltiples orígenes (dev + prod)
ALLOWED_ORIGINS=http://localhost:5173,http://192.168.1.100:8000
```

---

## Volúmenes persistentes

| Contenido | Ruta en el contenedor | Descripción |
|-----------|----------------------|-------------|
| Base de datos PostgreSQL | `/var/lib/postgresql/data` | **CRÍTICO** — sin este volumen todos los datos se pierden al recrear el contenedor |
| Archivos subidos | `/app/documents` | Documentos adjuntos a las peticiones de pago |
| Backups | `/app/backups` | Backups generados por `make backup-db` o scripts manuales |

> El frontend React va **embebido en la imagen Docker** — no necesitás montarlo externamente. Si montás `./frontend/dist:/app/frontend`, el build externo tiene prioridad sobre el embebido (útil durante el desarrollo).

---

## Migraciones de base de datos

Las migraciones se gestionan con **Alembic** y se aplican **automáticamente** en cada arranque del contenedor.

### Flujo de arranque

```
PostgreSQL arranca
  └─► alembic upgrade head       ← aplica todas las migraciones pendientes
        └─► python init_db.py    ← seed de datos iniciales (solo si la DB está vacía)
              └─► uvicorn        ← inicia la API
```

### Comportamiento según escenario

| Escenario | Qué hace |
|-----------|----------|
| Primera instalación (DB vacía) | Crea todas las tablas desde cero y carga datos iniciales |
| DB existente con Alembic | Solo aplica las migraciones pendientes (idempotente) |
| DB existente sin tabla `alembic_version` | Ejecuta `alembic stamp head` automáticamente antes de continuar |

### Crear una nueva migración (solo para desarrollo del código)

```bash
# Con el venv activado o dentro del contenedor
alembic revision --autogenerate -m "descripcion del cambio"

# Revisar el archivo generado en alembic/versions/ antes de aplicar
alembic upgrade head

# Ver historial
alembic history

# Ver versión actual de la DB
alembic current
```

### Rollback de migraciones

```bash
# Revertir la última migración
docker exec payment-gestion alembic downgrade -1

# Revertir a una revisión específica
docker exec payment-gestion alembic downgrade <revision_id>
```

---

## Primer acceso y usuarios

### URLs de acceso

| URL | Descripción |
|-----|-------------|
| `http://localhost:8000/` | Aplicación (redirige automáticamente al frontend React) |
| `http://localhost:8000/static/index.html` | Acceso directo al frontend |
| `http://localhost:8000/docs` | Swagger UI — documentación interactiva de la API |
| `http://localhost:8000/redoc` | ReDoc — documentación alternativa |

### Credenciales por defecto

> La contraseña del `admin` se fija con `ADMIN_PASSWORD` **antes del primer arranque**. Una vez creado el usuario, cambiar la variable no modifica la contraseña — hay que hacerlo desde la UI de gestión de usuarios.

| Usuario | Contraseña | Rol | Puede operar |
|---------|------------|-----|--------------|
| `admin` | `admin123` | Administrador | Todas las áreas |
| `demandante1` | `demo123` | Demandante | Área Demandante |
| `validador1` | `demo123` | Validador | Área Validadora |
| `aprobador1` | `demo123` | Aprobador | Área Aprobadora |
| `contador1` | `demo123` | Contador | Contabilidad y SAP |
| `pagador1` | `demo123` | Pagador | Área Pagadora |
| `sap1` | `demo123` | SAP | Área SAP |

### Roles del sistema

| Rol | Descripción |
|-----|-------------|
| `admin` | Acceso total: gestión de usuarios, configuración de flujos, opera cualquier área |
| `demandante` | Crea peticiones y opera el área Demandante |
| `validador` | Opera el área Validadora |
| `aprobador` | Opera el área Aprobadora |
| `contador` | Opera Contabilidad y SAP |
| `pagador` | Opera el área Pagadora |
| `sap` | Opera el área SAP |

---

## API Reference

La documentación interactiva completa está en **`/docs`** (Swagger UI). Podés probar todos los endpoints directamente desde el navegador tras hacer login con el botón "Authorize".

### Autenticación

```bash
# Login — devuelve JWT Bearer token
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin123"
# → {"access_token": "eyJ...", "token_type": "bearer"}

# Usuario actual (incluye accessible_areas calculadas por el servidor)
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer <token>"
```

### Peticiones de pago

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/payments` | Listar paginadas — parámetros: `page`, `per_page`, `estado_general`, `area`, `numero_peticion`, `propuesta_gasto`, `orden_pago`, `numero_factura`, `n_documento_contable`, `fecha_pago` |
| `GET` | `/api/payments/stats` | Contadores reales por estado (COUNT en BD, sin cargar entidades) |
| `POST` | `/api/payments` | Crear nueva petición |
| `GET` | `/api/payments/{id}` | Detalle completo con workflow, comentarios y documentos |
| `PUT` | `/api/payments/{id}` | Actualizar (solo creador o admin) |
| `DELETE` | `/api/payments/{id}` | Eliminar — admin puede eliminar en cualquier estado |
| `POST` | `/api/payments/{id}/cancel` | Cancelar (solo creador o admin) |

### Documentos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/payments/{id}/documents` | Subir documento (multipart/form-data: `file`, `tipo`, `n_documento_contable`, `comment_id`) |
| `POST` | `/api/documents/{id}/request-token` | Obtener token efímero (60 s) para descargar |
| `GET` | `/api/documents/public/{id}/download?token=…` | Descargar con token efímero |
| `GET` | `/api/documents/public/{id}/view?token=…` | Ver en el navegador con token efímero |
| `DELETE` | `/api/documents/{id}` | Eliminar (uploader o admin) |
| `POST` | `/api/documents/payment/{id}/request-zip-token` | Obtener token efímero para descarga ZIP |
| `GET` | `/api/documents/payment/{id}/download-all?token=…` | Descargar ZIP con todos los documentos del pago |

### Workflow

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/payments/{id}/workflow` | Estados actuales de todas las áreas |
| `POST` | `/api/payments/{id}/workflow/{area}/advance` | Avanzar área a APROBADO — body: `{"comentario": "opcional"}` |
| `POST` | `/api/payments/{id}/workflow/{area}/reverse` | Revertir área a PENDIENTE — body: `{"comentario": "obligatorio"}` |
| `POST` | `/api/payments/{id}/workflow/{area}/comment` | Añadir comentario sin cambiar estado — body: `{"contenido": "texto"}` |

Áreas válidas: `demandante`, `validadora`, `aprobadora`, `contabilidad`, `pagadora`, `sap`.

### Búsqueda

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/search?q=texto` | Búsqueda global en todos los campos de texto |
| `GET` | `/api/search?q=texto&field=campo` | Búsqueda en un campo específico |

Campos: `propuesta_gasto`, `numero_peticion`, `orden_pago`, `numero_factura`, `n_documento_contable`, `fecha_pago`.

Wildcards: `*` (cualquier cadena), `?` (un carácter). Ejemplos:
```
PAY-2026-*          → todas las peticiones de 2026
*factura*           → contiene "factura"
123?                → 1230, 1231, ..., 1239
```

### Configuración de flujos (solo admin)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/workflow-configs` | Listar configuraciones activas |
| `POST` | `/api/workflow-configs` | Crear flujo custom |
| `PUT` | `/api/workflow-configs/{id}` | Actualizar flujo |

Body de creación:
```json
{
  "nombre": "Mi Flujo Especial",
  "descripcion": "Flujo simplificado",
  "tipo_pago": "CON_FACTURA",
  "flujo_json": ["demandante", "aprobadora", "pagadora"],
  "es_default": false,
  "activo": true
}
```

### Usuarios (solo admin)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/users` | Listar usuarios |
| `POST` | `/api/users` | Crear usuario |
| `PUT` | `/api/users/{id}` | Actualizar datos o contraseña |
| `DELETE` | `/api/users/{id}` | Desactivar usuario (soft-delete) |
| `POST` | `/api/users/{id}/reactivate` | Reactivar usuario desactivado |

### Incidencias

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/incidences/summary` | Conteo de pendientes por área + mis pendientes |
| `GET` | `/api/incidences/my-pending` | Mis incidencias pendientes |
| `GET` | `/api/incidences/by-user/{user_id}` | Incidencias de un usuario |
| `GET` | `/api/incidences/by-area/{area}` | Incidencias de un área |

---

## Comandos Makefile

```bash
make run          # Build frontend + docker-compose up --build (primera vez)
make rebuild      # Rebuild frontend + restart del contenedor
make dev          # Solo frontend en modo dev (:5173) — proxy automático a :8000
make dev-backend  # Solo backend en :8000 (requiere PostgreSQL local)
make logs         # Ver logs del contenedor en tiempo real
make stop         # Bajar contenedores
make backup-db    # pg_dump desde el contenedor a backups/database/
make shell        # Shell interactivo dentro del contenedor
```

---

## Backups

### Backup manual de la base de datos

```bash
# Sin compresión
docker exec payment-gestion pg_dump -U postgres payment_gestion \
  > ./backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Con compresión gzip (recomendado)
docker exec payment-gestion pg_dump -U postgres payment_gestion \
  | gzip > ./backups/backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restaurar

```bash
# Desde SQL sin comprimir
docker exec -i payment-gestion psql -U postgres -d payment_gestion \
  < ./backups/backup_20260401.sql

# Desde SQL comprimido
gunzip < ./backups/backup_20260401.sql.gz \
  | docker exec -i payment-gestion psql -U postgres -d payment_gestion
```

### Script de backup automatizado (cron)

```bash
# Guardar como backup.sh y dar permisos
cat > backup.sh << 'EOF'
#!/bin/bash
set -e
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR/database" "$BACKUP_DIR/documents"

echo "[$(date)] Iniciando backup: $DATE"

# Base de datos
docker exec payment-gestion pg_dump -U postgres payment_gestion \
  | gzip > "$BACKUP_DIR/database/backup_$DATE.sql.gz"
echo "[$(date)] DB completada"

# Documentos
tar -czf "$BACKUP_DIR/documents/docs_$DATE.tar.gz" ./documents/
echo "[$(date)] Documentos completados"

# Limpiar backups de más de 30 días
find "$BACKUP_DIR" -name "backup_*" -o -name "docs_*" | \
  xargs -I{} find {} -mtime +30 -delete 2>/dev/null || true
echo "[$(date)] Backup completado: $DATE"
EOF

chmod +x backup.sh

# Añadir a crontab (backup diario a las 3:00 AM)
(crontab -l 2>/dev/null; echo "0 3 * * * $(pwd)/backup.sh >> $(pwd)/backups/backup.log 2>&1") | crontab -
```

---

## Actualizar la aplicación

La imagen se publica automáticamente con cada push a `main`.

```bash
# 1. Backup previo (recomendado siempre)
docker exec payment-gestion pg_dump -U postgres payment_gestion \
  | gzip > ./backups/pre-update_$(date +%Y%m%d).sql.gz

# 2. Descargar la nueva imagen
docker pull ghcr.io/pecha2k2/payment-gestion:latest

# 3a. Con docker-compose
docker compose down && docker compose up -d

# 3b. Con docker run
docker stop payment-gestion && docker rm payment-gestion
# Volver a ejecutar el comando docker run del paso de instalación

# 4. Las migraciones se aplican automáticamente al arrancar
docker logs -f payment-gestion
```

---

## Resolución de problemas

### El contenedor no arranca

```bash
# Ver logs completos
docker logs payment-gestion

# Verificar que PostgreSQL levantó correctamente
docker exec payment-gestion pg_isready -U postgres

# Ver logs específicos de PostgreSQL
docker exec payment-gestion cat /tmp/postgresql.log
```

### El frontend muestra JSON en lugar de la UI

Síntoma: al abrir `http://localhost:8000/` aparece `{"message":"Payment Gestion API","version":"1.0.0"}`.

```bash
# Verificar que el frontend está en la imagen
docker exec payment-gestion ls /app/frontend/index.html

# Si no existe, actualizar la imagen
docker pull ghcr.io/pecha2k2/payment-gestion:latest
docker stop payment-gestion && docker rm payment-gestion
# Volver a ejecutar el docker run

# Ver cuándo fue construida la imagen
docker inspect ghcr.io/pecha2k2/payment-gestion:latest --format='{{.Created}}'
```

### Error de migraciones Alembic al arrancar

```bash
# Ver versión actual de la DB
docker exec payment-gestion alembic current

# Ver historial de migraciones
docker exec payment-gestion alembic history

# Si la DB tiene datos pero no tiene la tabla alembic_version:
docker exec payment-gestion alembic stamp head
docker restart payment-gestion
```

### No puedo hacer login (error CORS en el navegador)

```bash
# Ver qué ALLOWED_ORIGINS tiene el contenedor
docker exec payment-gestion env | grep ALLOWED_ORIGINS

# Problema: ALLOWED_ORIGINS=* y accedés desde una IP remota
# Solución: recrear el contenedor con el origen explícito
-e ALLOWED_ORIGINS="http://192.168.1.100:8000"
```

### Los datos se pierden al reiniciar el contenedor

El volumen de PostgreSQL no está montado correctamente. Verificar:

```bash
# Ver volúmenes montados en el contenedor
docker inspect payment-gestion --format='{{json .Mounts}}' | python3 -m json.tool

# Debe aparecer un mount con Destination: /var/lib/postgresql/data
# Si no está, recrear el contenedor con el flag -v correcto
```

### Acceder directamente a PostgreSQL

```bash
# Shell psql interactivo
docker exec -it payment-gestion su -s /bin/bash postgres -c "psql -d payment_gestion"

# Consulta directa sin entrar al shell
docker exec payment-gestion su -s /bin/bash postgres -c \
  "psql -d payment_gestion -c 'SELECT id, username, role, active FROM users;'"
```

### Ver recursos del contenedor

```bash
docker stats payment-gestion --no-stream
```

---

## Despliegue en Unraid

Para instrucciones detalladas específicas de Unraid (comandos exactos, rutas de volúmenes, configuración desde la UI gráfica de Docker), consultá [`docs/UNRAID_DEPLOYMENT.md`](docs/UNRAID_DEPLOYMENT.md).

---

*Imagen: `ghcr.io/pecha2k2/payment-gestion:latest` — publicada automáticamente en cada push a `main` vía GitHub Actions.*
