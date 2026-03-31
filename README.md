# Payment Gestion

Sistema de gestión documental de pagos con flujos de trabajo configurables.

## Características

- **Gestión de peticiones de pago** con documentos adjuntos
- **Flujos de trabajo configurables** entre 6 áreas:
  - Demandante
  - Validadora (presupuestos y facturas)
  - Aprobadora
  - Contabilidad
  - Pagadora
  - SAP
- **Dos tipos de flujo**:
  - **Con Factura**: demandante → validadora → aprobadora → contabilidad → pagadora → SAP
  - **Sin Factura**: demandante → aprobadora → pagadora → validadora → contabilidad → SAP
- **Búsqueda** por número de petición, propuesta de gasto, orden de pago, número de factura, documento contable, fecha de pago
- **Estados por área** reversibles (PENDIENTE → EN_PROCESO → APROBADO)
- **Comentarios** con marca de tiempo
- **Gestión de usuarios** con roles

## Ejecutar con Docker

```bash
# Opción 1: Con Makefile (recomendado)
make run

# Opción 2: Manual
cd frontend && npm install && npm run build
cd .. && docker-compose up -d --build
```

> **Nota**: El volumen `./frontend/dist:/app/frontend` monta el frontend construido.
> Sin construir el frontend, la API funcionará pero el frontend no estará disponible.

## Ejecutar en desarrollo

```bash
# Backend (requiere PostgreSQL corriendo)
cd app
pip install -r requirements.txt
python init_db.py
uvicorn app.main:app --reload --port 8000

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev   # ← proxy automático a :8000
```

## Makefile (desarrollo rápido)

```bash
make run        # Build + up (primera vez)
make rebuild    # Rebuild frontend + restart
make dev        # Solo frontend en dev ( :5173)
make logs       # Ver logs de la app
make stop       # Bajar contenedores
```

## Acceso

- URL: http://localhost:8000
- Usuario: `admin`
- Contraseña: `admin123`

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

## API Endpoints

### Autenticación
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Usuario actual

### Peticiones de pago
- `GET /api/payments?page=1&per_page=20` - Listar peticiones (paginadas)
  - Response: `{ total, page, per_page, pages, items }`
- `POST /api/payments` - Crear petición
- `GET /api/payments/{id}` - Detalle
- `PUT /api/payments/{id}` - Actualizar
- `DELETE /api/payments/{id}` - Eliminar
- `POST /api/payments/{id}/cancel` - Cancelar petición

### Documentos
- `POST /api/payments/{id}/documents` - Subir documento
- `GET /api/documents/{id}/download` - Descargar (autenticado)
- `GET /api/documents/public/{id}/download` - Descargar (público)
- `GET /api/documents/public/{id}/view` - Ver en navegador (público)
- `DELETE /api/documents/{id}` - Eliminar

### Workflow
- `GET /api/payments/{id}/workflow` - Estados
- `POST /api/payments/{id}/workflow/{area}/advance` - Avanzar
- `POST /api/payments/{id}/workflow/{area}/reverse` - Revertir
- `POST /api/payments/{id}/workflow/{area}/comment` - Comentar

### Workflow Configs (admin)
- `GET /api/workflow-configs` - Listar configuraciones
- `POST /api/workflow-configs` - Crear configuración
- `PUT /api/workflow-configs/{id}` - Actualizar configuración

### Usuarios (admin)
- `GET /api/users` - Listar usuarios
- `POST /api/users` - Crear usuario
- `PUT /api/users/{id}` - Actualizar usuario
- `DELETE /api/users/{id}` - Eliminar usuario

### Incidencias
- `GET /api/incidences/summary` - Resumen general
- `GET /api/incidences/my-pending` - Mis pendientes
- `GET /api/incidences/by-user/{user_id}` - Por usuario
- `GET /api/incidences/by-area/{area}` - Por área

### Búsqueda
- `GET /api/search?q=...&field=...` - Buscar por campo
