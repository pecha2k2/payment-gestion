#!/bin/bash

echo "=== Payment Gestion - Starting ==="

# Crear directorio de datos
echo "[1] Creating data directory..."
mkdir -p $PGDATA
chmod 700 $PGDATA
chown postgres:postgres $PGDATA

# Inicializar si no existe
if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "[2] Initializing PostgreSQL as postgres user..."
    su -s /bin/bash postgres -c "/usr/lib/postgresql/15/bin/initdb -D $PGDATA"
    echo "Init complete"
else
    echo "[2] PostgreSQL already initialized"
fi

# Configurar pg_hba.conf
echo "[3] Configuring pg_hba.conf..."
# Usar here-doc para escribir como usuario postgres (evitar redirección como root)
su -s /bin/bash postgres -c "cat > $PGDATA/pg_hba.conf" << 'EOF'
host all all 127.0.0.1/32 trust
host all all ::1/128 trust
local all all trust
EOF

# Iniciar PostgreSQL como postgres
echo "[4] Starting PostgreSQL..."
su -s /bin/bash postgres -c "/usr/lib/postgresql/15/bin/pg_ctl -D $PGDATA -l /tmp/postgresql.log start"

# Esperar a que esté listo
echo "[5] Waiting for PostgreSQL..."
for i in $(seq 1 30); do
    if su -s /bin/bash postgres -c "/usr/lib/postgresql/15/bin/pg_isready" > /dev/null 2>&1; then
        echo "PostgreSQL is ready!"
        break
    fi
    echo "  Waiting... ($i/30)"
    sleep 1
done

# Crear base de datos si no existe
echo "[6] Ensuring database exists..."
su -s /bin/bash postgres -c "/usr/lib/postgresql/15/bin/psql -tc \"SELECT 1 FROM pg_database WHERE datname='$POSTGRES_DB'\"" | grep -q 1 || \
    su -s /bin/bash postgres -c "/usr/lib/postgresql/15/bin/createdb $POSTGRES_DB"

# Aplicar migraciones de Alembic
echo "[7] Running database migrations..."
# Si la DB ya existe pero nunca tuvo Alembic, marcar el estado actual sin re-crear tablas
HAS_ALEMBIC=$(su -s /bin/bash postgres -c "psql -d $POSTGRES_DB -tAc \"SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='alembic_version')\"" 2>/dev/null | tr -d '[:space:]')
HAS_USERS=$(su -s /bin/bash postgres -c "psql -d $POSTGRES_DB -tAc \"SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='users')\"" 2>/dev/null | tr -d '[:space:]')

if [ "$HAS_ALEMBIC" = "f" ] && [ "$HAS_USERS" = "t" ]; then
    echo "  Existing DB detected — stamping Alembic head (no schema changes)..."
    alembic stamp head
fi

alembic upgrade head

# Seed initial data (only runs if DB is empty)
echo "[8] Seeding initial data..."
python init_db.py

echo "=== Starting FastAPI application ==="
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
