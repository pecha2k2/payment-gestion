#!/usr/bin/env python3
"""
Initialize the database with default data.
Run this script to set up the initial database.
"""

import os
import sys

# Add the app directory to path
sys.path.insert(0, "/app")

from datetime import datetime, timezone
from app.database import SessionLocal
from app.models.workflow import WorkflowConfig  # Import first to resolve relationships
from app.models.user import User, UserRole
from app.models.payment import (
    PaymentRequest,
    Document,
    TipoPago,
    EstadoGeneral,
    DocumentoTipo,
)
from app.models.workflow import WorkflowState, WorkflowEstado, Area, Comment
from app.utils.security import get_password_hash
import json


def init_db():
    # Schema is managed by Alembic — only seed initial data here
    db = SessionLocal()

    try:
        # Check if already initialized
        existing_user = db.query(User).first()
        if existing_user:
            print("Database already initialized. Skipping...")
            return

        # Create default users
        users_data = [
            {
                "username": "admin",
                "password": "admin123",
                "name": "Administrador",
                "email": "admin@company.com",
                "role": UserRole.admin,
                "area": "Administración",
            },
            {
                "username": "demandante1",
                "password": "demo123",
                "name": "Juan Demandante",
                "email": "juan@company.com",
                "role": UserRole.demandante,
                "area": "Compras",
            },
            {
                "username": "validador1",
                "password": "demo123",
                "name": "María Validadora",
                "email": "maria@company.com",
                "role": UserRole.validador,
                "area": "Presupuestos",
            },
            {
                "username": "aprobador1",
                "password": "demo123",
                "name": "Carlos Aprobador",
                "email": "carlos@company.com",
                "role": UserRole.aprobador,
                "area": "Dirección",
            },
            {
                "username": "contador1",
                "password": "demo123",
                "name": "Ana Contadora",
                "email": "ana@company.com",
                "role": UserRole.contador,
                "area": "Contabilidad",
            },
            {
                "username": "pagador1",
                "password": "demo123",
                "name": "Pedro Pagador",
                "email": "pedro@company.com",
                "role": UserRole.pagador,
                "area": "Tesorería",
            },
            {
                "username": "sap1",
                "password": "demo123",
                "name": "Sara SAP",
                "email": "sara@company.com",
                "role": UserRole.sap,
                "area": "SAP",
            },
        ]

        for user_data in users_data:
            user = User(
                username=user_data["username"],
                password_hash=get_password_hash(user_data["password"]),
                name=user_data["name"],
                email=user_data["email"],
                role=user_data["role"],
                area=user_data["area"],
                active=True,
                created_at=datetime.now(timezone.utc),
            )
            db.add(user)

        # Create default workflow configs
        workflows_data = [
            {
                "nombre": "Flujo con Factura",
                "descripcion": "Flujo estándar para pagos con factura",
                "es_default": True,
                "flujo_json": json.dumps(
                    [
                        "demandante",
                        "validadora",
                        "aprobadora",
                        "contabilidad",
                        "pagadora",
                        "sap",
                    ]
                ),
                "activo": True,
            },
            {
                "nombre": "Flujo sin Factura",
                "descripcion": "Flujo para pagos sin factura (validación y contabilidad en paralelo)",
                "es_default": False,
                "flujo_json": json.dumps(
                    [
                        "demandante",
                        "aprobadora",
                        "pagadora",
                        "validadora",
                        "contabilidad",
                        "sap",
                    ]
                ),
                "activo": True,
            },
        ]

        for wf_data in workflows_data:
            workflow_config = WorkflowConfig(**wf_data)
            db.add(workflow_config)

        db.commit()
        print("Database initialized successfully!")
        print("\nDefault users created:")
        print("  admin / admin123 (Administrator)")
        print("  demandante1 / demo123 (Demandante)")
        print("  validador1 / demo123 (Validador)")
        print("  aprobador1 / demo123 (Aprobador)")
        print("  contador1 / demo123 (Contador)")
        print("  pagador1 / demo123 (Pagador)")
        print("  sap1 / demo123 (SAP)")

    except Exception as e:
        print(f"Error initializing database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
