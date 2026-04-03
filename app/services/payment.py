from sqlalchemy.orm import Session, selectinload
from sqlalchemy import text
from typing import List, Optional, Tuple
from datetime import datetime, timezone
import logging
import os

from app.models.payment import PaymentRequest, Document
from app.models.workflow import WorkflowState, WorkflowConfig, WorkflowEstado, Area
from app.models.user import User, UserRole
from app.schemas.payment import PaymentRequestCreate, PaymentRequestUpdate
from app.services.workflow import AREA_TO_ROLES, _parse_flujo_json

logger = logging.getLogger(__name__)

# Derived from AREA_TO_ROLES in workflow.py — single source of truth.
# Maps each area to its primary (non-admin) role for workflow state assignment.
AREA_TO_ROLE = {
    area: next((r for r in roles if r != UserRole.admin), roles[0])
    for area, roles in AREA_TO_ROLES.items()
    if roles
}

# Default workflow configurations
DEFAULT_WORKFLOWS = {
    "CON_FACTURA": [
        "demandante",
        "validadora",
        "aprobadora",
        "contabilidad",
        "pagadora",
        "sap",
    ],
    "SIN_FACTURA": [
        "demandante",
        "aprobadora",
        "pagadora",
        "validadora",
        "contabilidad",
        "sap",
    ],
}


def get_next_numero_peticion(db: Session) -> str:
    year = datetime.now(timezone.utc).year
    # Advisory lock prevents concurrent transactions from generating the same number
    db.execute(text("SELECT pg_advisory_xact_lock(hashtext('numero_peticion_seq'))"))
    last_request = (
        db.query(PaymentRequest)
        .filter(PaymentRequest.numero_peticion.like(f"PAY-{year}-%"))
        .order_by(PaymentRequest.numero_peticion.desc())
        .first()
    )

    if last_request:
        last_num = int(last_request.numero_peticion.split("-")[-1])
        next_num = last_num + 1
    else:
        next_num = 1

    return f"PAY-{year}-{next_num:04d}"


def create_payment_request(
    db: Session, payment_data: PaymentRequestCreate, creadora_id: int
) -> PaymentRequest:
    # Resolve workflow from DB; fallback to hardcoded defaults if none configured
    tipo_pago_value = payment_data.tipo_pago.value
    workflow_config = (
        db.query(WorkflowConfig)
        .filter(
            WorkflowConfig.tipo_pago == tipo_pago_value, WorkflowConfig.activo == True
        )
        .first()
    )
    if workflow_config:
        flujo = _parse_flujo_json(workflow_config.flujo_json)
        workflow_config_id = workflow_config.id
        logger.info(
            "Using DB WorkflowConfig id=%s for tipo_pago=%s",
            workflow_config.id,
            tipo_pago_value,
        )
    else:
        flujo = DEFAULT_WORKFLOWS.get(tipo_pago_value, DEFAULT_WORKFLOWS["CON_FACTURA"])
        workflow_config_id = None
        logger.warning(
            "No active WorkflowConfig found for tipo_pago=%s — using hardcoded default",
            tipo_pago_value,
        )

    now = datetime.now(timezone.utc)
    payment = PaymentRequest(
        numero_peticion=get_next_numero_peticion(db),
        propuesta_gasto=payment_data.propuesta_gasto,
        orden_pago=payment_data.orden_pago,
        numero_factura=payment_data.numero_factura,
        n_documento_contable=payment_data.n_documento_contable,
        fecha_pago=payment_data.fecha_pago,
        tipo_pago=payment_data.tipo_pago,
        medio_pago=payment_data.medio_pago,
        monto_total=payment_data.monto_total,
        divisa=payment_data.divisa,
        descripcion=payment_data.descripcion,
        banco=payment_data.banco,
        creadora_id=creadora_id,
        workflow_config_id=workflow_config_id,
        created_at=now,
        updated_at=now,
    )
    db.add(payment)
    db.flush()

    # Create workflow states based on tipo_pago (not from config)
    for area_name in flujo:
        area = Area(area_name)
        # Assign first user of that area (map area name to role)
        role = AREA_TO_ROLE.get(area_name)
        assigned_user = None
        if role:
            assigned_user = (
                db.query(User).filter(User.role == role, User.active == True).first()
            )

        state = WorkflowState(
            payment_request_id=payment.id,
            area=area,
            estado=WorkflowEstado.PENDIENTE,
            usuario_asignado_id=assigned_user.id if assigned_user else None,
            created_at=now,
        )
        db.add(state)

    db.commit()
    db.refresh(payment)
    return payment


def _apply_payment_filters(
    query,
    db: Session,
    estado_general: Optional[str],
    area: Optional[str],
    numero_peticion: Optional[str],
    propuesta_gasto: Optional[str],
    orden_pago: Optional[str],
    numero_factura: Optional[str],
    n_documento_contable: Optional[str],
    fecha_pago: Optional[str],
):
    if estado_general:
        query = query.filter(PaymentRequest.estado_general == estado_general)
    if area:
        area_enum = Area(area)
        pending_ids = (
            db.query(WorkflowState.payment_request_id)
            .filter(
                WorkflowState.area == area_enum,
                WorkflowState.estado == WorkflowEstado.PENDIENTE,
            )
            .subquery()
        )
        query = query.filter(PaymentRequest.id.in_(pending_ids))
    if numero_peticion:
        query = query.filter(
            PaymentRequest.numero_peticion.ilike(f"%{numero_peticion}%")
        )
    if propuesta_gasto:
        try:
            query = query.filter(PaymentRequest.propuesta_gasto == int(propuesta_gasto))
        except ValueError:
            query = query.filter(
                PaymentRequest.propuesta_gasto.ilike(f"%{propuesta_gasto}%")
            )
    if orden_pago:
        query = query.filter(PaymentRequest.orden_pago.ilike(f"%{orden_pago}%"))
    if numero_factura:
        query = query.filter(PaymentRequest.numero_factura.ilike(f"%{numero_factura}%"))
    if n_documento_contable:
        query = query.filter(
            PaymentRequest.n_documento_contable.ilike(f"%{n_documento_contable}%")
        )
    if fecha_pago:
        query = query.filter(PaymentRequest.fecha_pago == fecha_pago)
    return query


def get_payments(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    estado_general: Optional[str] = None,
    area: Optional[str] = None,
    numero_peticion: Optional[str] = None,
    propuesta_gasto: Optional[str] = None,
    orden_pago: Optional[str] = None,
    numero_factura: Optional[str] = None,
    n_documento_contable: Optional[str] = None,
    fecha_pago: Optional[str] = None,
) -> List[PaymentRequest]:
    query = _apply_payment_filters(
        db.query(PaymentRequest),
        db,
        estado_general,
        area,
        numero_peticion,
        propuesta_gasto,
        orden_pago,
        numero_factura,
        n_documento_contable,
        fecha_pago,
    )
    return (
        query.order_by(PaymentRequest.created_at.desc()).offset(skip).limit(limit).all()
    )


def get_payments_paginated(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    estado_general: Optional[str] = None,
    area: Optional[str] = None,
    numero_peticion: Optional[str] = None,
    propuesta_gasto: Optional[str] = None,
    orden_pago: Optional[str] = None,
    numero_factura: Optional[str] = None,
    n_documento_contable: Optional[str] = None,
    fecha_pago: Optional[str] = None,
) -> Tuple[int, List[PaymentRequest]]:
    """Returns (total_count, items) for pagination with workflow states."""
    # Base query with eager loading of workflow_states
    base_query = db.query(PaymentRequest).options(
        selectinload(PaymentRequest.workflow_states)
    )

    query = _apply_payment_filters(
        base_query,
        db,
        estado_general,
        area,
        numero_peticion,
        propuesta_gasto,
        orden_pago,
        numero_factura,
        n_documento_contable,
        fecha_pago,
    )
    total = query.count()
    items = (
        query.order_by(PaymentRequest.created_at.desc()).offset(skip).limit(limit).all()
    )
    return total, items


def get_payment_by_id(db: Session, payment_id: int) -> Optional[PaymentRequest]:
    from app.models.workflow import Comment

    # Use selectinload for workflow_states, comments and their documents
    return (
        db.query(PaymentRequest)
        .options(
            selectinload(PaymentRequest.workflow_states),
            selectinload(PaymentRequest.comments).selectinload(Comment.documentos),
        )
        .filter(PaymentRequest.id == payment_id)
        .first()
    )


def delete_payment(db: Session, payment_id: int, numero_peticion: str) -> None:
    """Delete payment and all associated resources atomically.

    Deletes: comments → workflow states → documents (files + records) → payment folder → payment.
    Single db.commit() at the end — must be called AFTER delete_workflow_by_payment (no-commit version).

    Args:
        db: DB session
        payment_id: ID of the payment to delete
        numero_peticion: needed to locate the documents directory (e.g. PAY-2026-0001)
    """
    from app.models.workflow import Comment

    # Delete any remaining comments directly linked to payment (not via workflow_state)
    db.query(Comment).filter(
        Comment.payment_request_id == payment_id,
        Comment.workflow_state_id.is_(None),
    ).delete()

    # Delete associated documents (physical files + DB records)
    documents = (
        db.query(Document).filter(Document.payment_request_id == payment_id).all()
    )
    for doc in documents:
        if doc.ruta_storage and os.path.exists(doc.ruta_storage):
            try:
                os.remove(doc.ruta_storage)
            except OSError as e:
                logger.warning("Could not delete file %s: %s", doc.ruta_storage, e)
        db.delete(doc)

    # Delete the payment folder (e.g., PAY-2026-0001)
    documents_dir = os.getenv("DOCUMENTS_DIR", "/app/documents")
    payment_dir = os.path.join(documents_dir, numero_peticion)
    if os.path.exists(payment_dir):
        import shutil

        try:
            shutil.rmtree(payment_dir)
        except OSError as e:
            logger.warning("Could not delete directory %s: %s", payment_dir, e)

    # Delete the payment record — single atomic commit covers everything
    db.query(PaymentRequest).filter(PaymentRequest.id == payment_id).delete()
    db.commit()


def update_payment(
    db: Session, payment_id: int, payment_data: PaymentRequestUpdate
) -> Optional[PaymentRequest]:
    payment = get_payment_by_id(db, payment_id)
    if not payment:
        return None

    update_data = payment_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(payment, field, value)

    payment.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(payment)
    return payment
