# Payment Gestion — Guía de Despliegue en Unraid

Sistema de gestión documental de pagos sobre Docker con PostgreSQL embebido.

---

## Índice

1. [Arquitectura](#arquitectura)
2. [Requisitos Previos](#requisitos-previos)
3. [Instalación Paso a Paso](#instalación-paso-a-paso)
4. [Variables de Entorno](#variables-de-entorno)
5. [Volúmenes Persistentes](#volúmenes-persistentes)
6. [Migraciones de Base de Datos](#migraciones-de-base-de-datos)
7. [Verificación Post-Despliegue](#verificación-post-despliegue)
8. [Backups](#backups)
9. [Actualizaciones](#actualizaciones)
10. [Resolución de Problemas](#resolución-de-problemas)
11. [Despliegue Manual sin Docker Compose](#despliegue-manual-sin-docker-compose)

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                          UNRAID                              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          payment-gestion  (contenedor único)          │   │
│  │                                                       │   │
│  │   ┌─────────────────┐    ┌─────────────────────┐    │   │
│  │   │  PostgreSQL 15  │◄───│   FastAPI + React   │    │   │
│  │   │  localhost:5432 │    │      :8000          │    │   │
│  │   └─────────────────┘    └─────────────────────┘    │   │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  Almacenamiento persistente: /mnt/user/appdata/payment-gestion/
│    ├── pgdata/        (volumen Docker — DB)                  │
│    ├── documents/     (archivos subidos)                     │
│    └── backups/       (backups)                              │
│                                                              │
│  Frontend React: embebido en la imagen Docker                │
└─────────────────────────────────────────────────────────────┘
```

**Stack:**
- Backend: FastAPI (Python 3.11) en puerto 8000
- Frontend: React (archivos estáticos servidos desde el mismo contenedor en `/static/`)
- Base de datos: PostgreSQL 15 (embebido en el contenedor)
- Migraciones: Alembic (se aplican automáticamente al arrancar)

### URLs de acceso

| URL | Descripción |
|-----|-------------|
| `http://<IP-UNRAID>:<PUERTO>/` | Aplicación (redirige automáticamente al frontend) |
| `http://<IP-UNRAID>:<PUERTO>/static/index.html` | Acceso directo al frontend |
| `http://<IP-UNRAID>:<PUERTO>/docs` | Swagger / API Docs |

### Credenciales por defecto

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| admin | admin123 | Administrador |
| demandante1 | demo123 | Demandante |
| validador1 | demo123 | Validador |
| aprobador1 | demo123 | Aprobador |
| contador1 | demo123 | Contador |
| pagador1 | demo123 | Pagador |
| sap1 | demo123 | SAP |

> **Producción:** cambiá la contraseña del admin con la variable `ADMIN_PASSWORD` antes del primer arranque.

---

## Requisitos Previos

En Unraid:
- **Docker Plugin** instalado y activo
- **Espacio en disco**: mínimo 5 GB (aplicación + documentos)
- Acceso SSH o terminal de Unraid

---

## Instalación Paso a Paso

La imagen está publicada en `ghcr.io/pecha2k2/payment-gestion:latest`. No hace falta código fuente ni compilar nada en Unraid.

### 1. Crear estructura de directorios

```bash
mkdir -p /mnt/user/appdata/payment-gestion/{documents,backups}
```

### 2. Ejecutar el contenedor

Config confirmada y funcionando en Unraid (hostname: Nuc, puerto 8888):

```bash
docker run \
-d \
--name='payment-gestion' \
--net='bridge' \
--pids-limit 2048 \
-e TZ="Europe/Paris" \
-e HOST_OS="Unraid" \
-e HOST_HOSTNAME="Nuc" \
-e HOST_CONTAINERNAME="payment-gestion" \
-e ADMIN_PASSWORD='admin123' \
-l net.unraid.docker.managed=dockerman \
-p '8888:8000/tcp' \
-v '/mnt/user/appdata/payment-gestion/documents':'/app/documents':'rw' \
-v '/mnt/user/appdata/payment-gestion/backups':'/app/backups':'rw' \
-v '/mnt/user/appdata/payment-gestion/postgres':'/var/lib/postgresql/data':'rw' \
--restart unless-stopped \
'ghcr.io/pecha2k2/payment-gestion:latest'
```

> **Producción:** cambiá `ADMIN_PASSWORD` por algo seguro antes del primer uso.

> **Nota:** El frontend React va **embebido en la imagen** — no hace falta montar ningún directorio adicional para él.

### 3. Verificar arranque

```bash
docker logs payment-gestion
```

Startup correcto se ve así:
```
=== Payment Gestion - Starting ===
[1] Creating data directory...
[2] PostgreSQL already initialized
[3] Configuring pg_hba.conf...
[4] Starting PostgreSQL...
waiting for server to start.... done
server started
[5] Waiting for PostgreSQL...
PostgreSQL is ready!
[6] Ensuring database exists...
[7] Running database migrations...
[8] Seeding initial data...
Database already initialized. Skipping...
=== Starting FastAPI application ===
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

La aplicación estará disponible en `http://<IP-UNRAID>:8888/`

---

## Variables de Entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/payment_gestion` | URL de conexión a PostgreSQL |
| `POSTGRES_USER` | `postgres` | Usuario de PostgreSQL |
| `POSTGRES_PASSWORD` | `postgres` | Contraseña de PostgreSQL |
| `POSTGRES_DB` | `payment_gestion` | Nombre de la base de datos |
| `ADMIN_PASSWORD` | `admin123` | Contraseña del usuario admin (¡cambiar en producción!) |
| `ALLOWED_ORIGINS` | `*` (todas) | Orígenes CORS permitidos, separados por coma. Ej: `http://192.168.1.100:8000` |
| `DOCUMENTS_DIR` | `/app/documents` | Ruta interna de almacenamiento de documentos |
| `STATIC_DIR` | `/app/frontend` | Ruta del build del frontend |
| `PGDATA` | `/var/lib/postgresql/data` | Directorio de datos de PostgreSQL |
| `PYTHONUNBUFFERED` | `1` | Logs sin buffering |

### Ejemplo `docker-compose.yml` para producción

```yaml
services:
  app:
    build: .
    container_name: payment-gestion
    ports:
      - "8000:8000"
    volumes:
      - ./documents:/app/documents
      - ./frontend/dist:/app/frontend
      - ./backups:/app/backups
      - pgdata:/var/lib/postgresql/data
    environment:
      - PYTHONUNBUFFERED=1
      - DATABASE_URL=postgresql://postgres:postgres@localhost:5432/payment_gestion
      - DOCUMENTS_DIR=/app/documents
      - STATIC_DIR=/app/frontend
      - PGDATA=/var/lib/postgresql/data
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=payment_gestion
      - ADMIN_PASSWORD=cambia-esto
      - ALLOWED_ORIGINS=http://192.168.1.100:8000
    restart: unless-stopped

volumes:
  pgdata:
```

---

## Volúmenes Persistentes

| Dato | Ubicación en host | Descripción |
|------|-------------------|-------------|
| Base de datos | `/mnt/user/appdata/payment-gestion/postgres` → `/var/lib/postgresql/data` | Datos PostgreSQL |
| Documentos | `/mnt/user/appdata/payment-gestion/documents` → `/app/documents` | Archivos subidos por usuarios |
| Backups | `/mnt/user/appdata/payment-gestion/backups` → `/app/backups` | Backups automáticos |

> El frontend React está **embebido en la imagen Docker** — no requiere volumen externo.

---

## Migraciones de Base de Datos

Las migraciones se gestionan con **Alembic** y se aplican **automáticamente** cada vez que el contenedor arranca.

### Flujo de arranque

```
PostgreSQL listo
  → alembic upgrade head   ← aplica todas las migraciones pendientes
  → python init_db.py      ← carga datos iniciales (solo si la DB está vacía)
  → uvicorn                ← inicia la API
```

### Comportamiento en primera instalación vs. actualización

| Escenario | Comportamiento |
|-----------|---------------|
| DB nueva (primera vez) | Alembic crea todas las tablas desde cero |
| DB existente sin Alembic | El entrypoint detecta la situación y ejecuta `alembic stamp head` automáticamente antes de aplicar migraciones nuevas |
| DB existente con Alembic | Solo aplica las migraciones pendientes (idempotente) |

### Crear una nueva migración

```bash
# Dentro del contenedor corriendo
docker exec -it payment-gestion bash

# Generar migración automática comparando modelos vs DB
alembic revision --autogenerate -m "descripcion del cambio"

# Aplicar
alembic upgrade head

# Ver historial
alembic history

# Ver versión actual de la DB
alembic current
```

### Rollback de una migración

```bash
# Revertir la última migración
docker exec -it payment-gestion alembic downgrade -1

# Revertir a una revisión específica
docker exec -it payment-gestion alembic downgrade 0001
```

---

## Verificación Post-Despliegue

```bash
# Contenedor corriendo
docker ps

# Ver logs de arranque completo
docker compose logs app

# PostgreSQL responde
docker exec payment-gestion pg_isready -U postgres

# Test de login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin123"

# Recursos del contenedor
docker stats payment-gestion --no-stream
```

**Checklist:**
- [ ] `docker ps` muestra el contenedor en `Up`
- [ ] Logs muestran `Application startup complete`
- [ ] Logs muestran migración Alembic aplicada o `Running upgrade ...`
- [ ] `http://<IP-UNRAID>:8888/` carga el frontend (redirige automáticamente)
- [ ] Login funciona con las credenciales por defecto

---

## Backups

### Script de backup automatizado

```bash
cat > /mnt/user/appdata/payment-gestion/backup-all.sh << 'EOF'
#!/bin/bash
set -e
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_BASE="/mnt/user/appdata/payment-gestion/backups"

echo "=== BACKUP: $DATE ==="

mkdir -p "$BACKUP_BASE/database" "$BACKUP_BASE/documents"

# 1. Base de datos
echo "[1/3] PostgreSQL dump..."
docker exec payment-gestion pg_dump -U postgres payment_gestion \
  | gzip > "$BACKUP_BASE/database/backup_$DATE.sql.gz"

# 2. Documentos
echo "[2/3] Documentos..."
tar -czf "$BACKUP_BASE/documents/backup_$DATE.tar.gz" \
  -C /mnt/user/appdata/payment-gestion documents/

# 3. Limpieza de backups > 30 días
echo "[3/3] Limpieza de backups antiguos..."
find "$BACKUP_BASE" -name "backup_*" -mtime +30 -delete 2>/dev/null || true

echo "=== BACKUP COMPLETADO: $DATE ==="
EOF

chmod +x /mnt/user/appdata/payment-gestion/backup-all.sh
```

### Cron en Unraid (backup diario a las 3am)

```bash
crontab -e
# Añadir:
0 3 * * * /mnt/user/appdata/payment-gestion/backup-all.sh >> /mnt/user/appdata/payment-gestion/backups/backup.log 2>&1
```

### Backup manual

```bash
# Solo DB
docker exec payment-gestion pg_dump -U postgres payment_gestion \
  > /mnt/user/appdata/payment-gestion/backups/database/manual_$(date +%Y%m%d).sql
```

### Restaurar

```bash
# DB desde backup comprimido
gunzip < /path/to/backup_YYYYMMDD_HHMMSS.sql.gz \
  | docker exec -i payment-gestion psql -U postgres -d payment_gestion

# Documentos
tar -xzf /path/to/backup_YYYYMMDD_HHMMSS.tar.gz \
  -C /mnt/user/appdata/payment-gestion/
```

---

## Actualizaciones

Las actualizaciones se publican automáticamente en `ghcr.io/pecha2k2/payment-gestion:latest` vía GitHub Actions cuando se hace push a `main`.

```bash
# 1. Backup completo antes de actualizar
/mnt/user/appdata/payment-gestion/backup-all.sh

# 2. Bajar la nueva imagen
docker pull ghcr.io/pecha2k2/payment-gestion:latest

# 3. Recrear el contenedor
docker stop payment-gestion
docker rm payment-gestion

# 4. Volver a lanzar (mismo docker run del paso de instalación)
docker run -d --name='payment-gestion' ... ghcr.io/pecha2k2/payment-gestion:latest

# 5. Verificar logs (aplica migraciones automáticamente)
docker logs payment-gestion
```

> Desde la UI de Unraid también podés hacer click en el ícono del container → **Update**.

---

## Resolución de Problemas

### Contenedor no arranca o PostgreSQL falla

```bash
# Ver logs completos
docker compose logs app

# Ver logs de PostgreSQL
docker exec payment-gestion cat /tmp/postgresql.log

# Reiniciar
docker compose restart app
```

### Error en migraciones Alembic

```bash
# Ver qué versión tiene la DB
docker exec payment-gestion alembic current

# Ver historial de migraciones
docker exec payment-gestion alembic history

# Si hay conflicto: marcar manualmente
docker exec payment-gestion alembic stamp head
```

### Frontend no carga / muestra JSON en lugar de la UI

El síntoma es ver `{"message":"Payment Gestion API","version":"1.0.0"}` al acceder a `/`.

Causa más común: tenés una imagen vieja (sin el frontend embebido). Solución:

```bash
docker pull ghcr.io/pecha2k2/payment-gestion:latest
docker stop payment-gestion && docker rm payment-gestion
# Volver a lanzar con el docker run
```

Verificar que la imagen es nueva:
```bash
docker inspect ghcr.io/pecha2k2/payment-gestion:latest --format='{{.Created}}'
```

### Puerto 8000 ocupado

```yaml
# En docker-compose.yml, cambiar el puerto externo
ports:
  - "8090:8000"
```

### Base de datos corrupta

```bash
docker compose down

# Backup del volumen por seguridad
docker run --rm \
  -v payment-gestion_pgdata:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/pgdata_emergency.tar.gz -C /data .

# Eliminar y recrear (¡pierde todos los datos!)
docker volume rm payment-gestion_pgdata
docker compose up -d

# Si tenés backup SQL
gunzip < /path/to/backup.sql.gz \
  | docker exec -i payment-gestion psql -U postgres -d payment_gestion
```

### Acceder a la DB directamente

```bash
docker exec -it payment-gestion su -s /bin/bash postgres -c "psql -d payment_gestion"
```

---

## Configuración en UI de Unraid

Para configurar desde la UI gráfica de Docker en Unraid:

**Imagen:** `ghcr.io/pecha2k2/payment-gestion:latest`

**Puerto:**

| Host | Contenedor |
|------|------------|
| `8888` | `8000` |

**Variables de entorno:**

| Variable | Valor |
|----------|-------|
| `TZ` | `Europe/Paris` |
| `ADMIN_PASSWORD` | `cambia-esto` |
| `POSTGRES_USER` | `postgres` |
| `POSTGRES_PASSWORD` | `postgres` |
| `POSTGRES_DB` | `payment_gestion` |
| `PGDATA` | `/var/lib/postgresql/data` |
| `DOCUMENTS_DIR` | `/app/documents` |
| `STATIC_DIR` | `/app/frontend` |

**Paths de volúmenes:**

| Host | Contenedor | Modo |
|------|------------|------|
| `/mnt/user/appdata/payment-gestion/documents` | `/app/documents` | rw |
| `/mnt/user/appdata/payment-gestion/backups` | `/app/backups` | rw |
| `/mnt/user/appdata/payment-gestion/postgres` | `/var/lib/postgresql/data` | rw |

> No montar nada en `/app/frontend` — el frontend va dentro de la imagen.

---

## Comandos de referencia rápida

```bash
# Estado
docker ps
docker stats payment-gestion --no-stream

# Logs
docker compose logs -f app
docker exec payment-gestion cat /tmp/postgresql.log

# Arrancar / parar / reiniciar
docker compose start
docker compose stop
docker compose restart

# Shell en el contenedor
docker exec -it payment-gestion /bin/bash

# PostgreSQL interactivo
docker exec -it payment-gestion su -s /bin/bash postgres -c "psql -d payment_gestion"

# Alembic
docker exec payment-gestion alembic current
docker exec payment-gestion alembic history
docker exec payment-gestion alembic upgrade head

# Copiar archivos
docker cp payment-gestion:/app/documents/archivo.pdf ./local/
docker cp ./local/archivo.pdf payment-gestion:/app/documents/
```

---

*Versión: Payment Gestion v1.0 — Actualizado: Abril 2026*
