from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
import json

from app.models.workflow import (
    WorkflowState,
    WorkflowConfig,
    WorkflowEstado,
    Area,
    Comment,
)
from app.models.user import User, UserRole
from app.models.payment import PaymentRequest, EstadoGeneral
from app.schemas.workflow import WorkflowStateUpdate, CommentCreate

# Mapping from area to allowed roles (for workflow actions)
AREA_TO_ROLES = {
    "demandante": [UserRole.demandante, UserRole.admin],
    "validadora": [UserRole.validador, UserRole.admin],
    "aprobadora": [UserRole.aprobador, UserRole.admin],
    "contabilidad": [UserRole.contador, UserRole.admin],
    "pagadora": [UserRole.pagador, UserRole.admin],
    "sap": [
        UserRole.sap,
        UserRole.contador,
        UserRole.admin,
    ],  # Contador can also do SAP
}

# Areas that require previous areas to be approved first (for workflow validation)
# Used as fallback when no WorkflowConfig is found for a payment
AREA_DEPENDENCIES = {
    "pagadora": ["aprobadora"],  # pagadora can't advance until aprobadora is done
    "sap": ["pagadora"],  # SAP can't advance until pagadora is done
}


def get_area_dependencies(db: Session, payment_id: int) -> dict:
    """Derive area dependencies from the payment's WorkflowConfig.flujo_json.

    Each area depends on the area immediately before it in the configured flow.
    Falls back to AREA_DEPENDENCIES if no config is found.
    """
    payment = db.query(PaymentRequest).filter(PaymentRequest.id == payment_id).first()
    if not payment or not payment.workflow_config_id:
        return AREA_DEPENDENCIES

    config = (
        db.query(WorkflowConfig)
        .filter(WorkflowConfig.id == payment.workflow_config_id)
        .first()
    )
    if not config or not config.flujo_json:
        return AREA_DEPENDENCIES

    try:
        areas = config.flujo_json if not isinstance(config.flujo_json, str) else json.loads(config.flujo_json)
    except (json.JSONDecodeError, TypeError):
        return AREA_DEPENDENCIES

    deps = {}
    for i, area_name in enumerate(areas):
        if i > 0:
            deps[area_name] = [areas[i - 1]]
    return deps


def get_workflow_states(db: Session, payment_id: int) -> List[WorkflowState]:
    return (
        db.query(WorkflowState)
        .filter(WorkflowState.payment_request_id == payment_id)
        .order_by(WorkflowState.area)
        .all()
    )


def advance_workflow_state(
    db: Session,
    payment_id: int,
    area: Area,
    usuario_id: int,
    comentario: Optional[str] = None,
) -> Optional[WorkflowState]:
    # Check user permission for this area
    usuario = db.query(User).filter(User.id == usuario_id).first()
    if not usuario:
        return None

    allowed_roles = AREA_TO_ROLES.get(area.value, [])
    if usuario.role not in allowed_roles:
        raise ValueError(
            f"No tienes permiso para realizar acciones en el área {area.value}"
        )

    # Check dependencies derived from the payment's configured workflow order
    dependencies = get_area_dependencies(db, payment_id).get(area.value, [])
    for dep_area in dependencies:
        dep_state = (
            db.query(WorkflowState)
            .filter(
                WorkflowState.payment_request_id == payment_id,
                WorkflowState.area == dep_area,
            )
            .first()
        )
        if dep_state and dep_state.estado != WorkflowEstado.APROBADO:
            raise ValueError(f"No puedes avanzar hasta que {dep_area} haya aprobado")

    state = (
        db.query(WorkflowState)
        .filter(
            WorkflowState.payment_request_id == payment_id, WorkflowState.area == area
        )
        .first()
    )

    if not state:
        return None

    payment = db.query(PaymentRequest).filter(PaymentRequest.id == payment_id).first()

    # Don't allow advances on completed payments
    if payment and payment.estado_general == EstadoGeneral.COMPLETADA:
        raise ValueError("Esta petición ya está completada")

    # Move from PENDIENTE -> APROBADO (single step)
    if state.estado == WorkflowEstado.PENDIENTE:
        state.estado = WorkflowEstado.APROBADO
        state.completed_at = datetime.now(timezone.utc)
        state.usuario_completo_id = usuario_id
        # Update payment estado_general to EN_PROCESO if still ABIERTA
        if payment and payment.estado_general == EstadoGeneral.ABIERTA:
            payment.estado_general = EstadoGeneral.EN_PROCESO
            payment.updated_at = datetime.now(timezone.utc)
    elif state.estado == WorkflowEstado.REVERSADO:
        # Can re-advance from reversado to APROBADO directly
        state.estado = WorkflowEstado.APROBADO
        state.completed_at = datetime.now(timezone.utc)
        state.usuario_completo_id = usuario_id
        if payment and payment.estado_general == EstadoGeneral.ABIERTA:
            payment.estado_general = EstadoGeneral.EN_PROCESO
            payment.updated_at = datetime.now(timezone.utc)
    else:
        # Already approved
        return state

    db.commit()
    db.refresh(state)

    # Add comment when advancing
    if comentario:
        comment = Comment(
            payment_request_id=payment_id,
            workflow_state_id=state.id,
            usuario_id=usuario_id,
            area=area.value,
            contenido=comentario,
            created_at=datetime.now(timezone.utc),
        )
        db.add(comment)
        db.commit()
        db.refresh(comment)

    # Check if all workflow states are approved -> auto-complete payment
    if state.estado == WorkflowEstado.APROBADO:
        db.refresh(payment)
        if payment:
            all_approved = (
                db.query(WorkflowState)
                .filter(
                    WorkflowState.payment_request_id == payment_id,
                    WorkflowState.estado != WorkflowEstado.APROBADO,
                )
                .count()
                == 0
            )
            if all_approved:
                payment.estado_general = EstadoGeneral.COMPLETADA
                payment.updated_at = datetime.now(timezone.utc)
                db.commit()

    return state


def reverse_workflow_state(
    db: Session, payment_id: int, area: Area, usuario_id: int, comentario: str
) -> Optional[WorkflowState]:
    # Check user permission for this area
    usuario = db.query(User).filter(User.id == usuario_id).first()
    if not usuario:
        return None

    allowed_roles = AREA_TO_ROLES.get(area.value, [])
    if usuario.role not in allowed_roles:
        raise ValueError(
            f"No tienes permiso para realizar acciones en el área {area.value}"
        )

    state = (
        db.query(WorkflowState)
        .filter(
            WorkflowState.payment_request_id == payment_id, WorkflowState.area == area
        )
        .first()
    )

    if not state:
        return None

    payment = db.query(PaymentRequest).filter(PaymentRequest.id == payment_id).first()

    # Reverse: APROBADO -> PENDIENTE (single step back)
    if state.estado == WorkflowEstado.APROBADO:
        state.estado = WorkflowEstado.PENDIENTE
        state.completed_at = None
        state.usuario_completo_id = None
    elif state.estado == WorkflowEstado.REVERSADO:
        state.estado = WorkflowEstado.PENDIENTE
        state.completed_at = None
        state.usuario_completo_id = None

    db.commit()
    db.refresh(state)

    # If payment was COMPLETADA, revert to EN_PROCESO since not all areas are approved
    if payment and payment.estado_general == EstadoGeneral.COMPLETADA:
        payment.estado_general = EstadoGeneral.EN_PROCESO
        payment.updated_at = datetime.now(timezone.utc)
        db.commit()

    # Check if all are PENDIENTE -> revert payment to ABIERTA
    if payment:
        all_pending = (
            db.query(WorkflowState)
            .filter(
                WorkflowState.payment_request_id == payment_id,
                WorkflowState.estado != WorkflowEstado.PENDIENTE,
            )
            .count()
            == 0
        )
        if all_pending:
            payment.estado_general = EstadoGeneral.ABIERTA
            payment.updated_at = datetime.now(timezone.utc)
            db.commit()

    # Add comment
    comment = Comment(
        payment_request_id=payment_id,
        workflow_state_id=state.id,
        usuario_id=usuario_id,
        area=area.value,
        contenido=comentario,
        created_at=datetime.now(timezone.utc),
    )
    db.add(comment)
    db.commit()

    return state


def add_workflow_comment(
    db: Session, payment_id: int, area: Area, usuario_id: int, contenido: str
) -> Optional[Comment]:
    state = (
        db.query(WorkflowState)
        .filter(
            WorkflowState.payment_request_id == payment_id, WorkflowState.area == area
        )
        .first()
    )

    if not state:
        return None

    comment = Comment(
        payment_request_id=payment_id,
        workflow_state_id=state.id,
        usuario_id=usuario_id,
        area=area.value,
        contenido=contenido,
        created_at=datetime.now(timezone.utc),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def get_workflow_configs(db: Session) -> List[WorkflowConfig]:
    return db.query(WorkflowConfig).filter(WorkflowConfig.activo == True).all()


def create_workflow_config(db: Session, config_data: dict) -> WorkflowConfig:
    # If es_default=True, set all others to False
    if config_data.get("es_default"):
        db.query(WorkflowConfig).update({"es_default": False})

    config = WorkflowConfig(**config_data)
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


def init_default_workflow_configs(db: Session):
    """Initialize default workflow configurations if they don't exist.
    Also backfills tipo_pago on existing configs that don't have it set.
    """
    existing = db.query(WorkflowConfig).first()
    if not existing:
        db.add(
            WorkflowConfig(
                nombre="Flujo con Factura",
                descripcion="Flujo estándar para pagos con factura",
                es_default=True,
                tipo_pago="CON_FACTURA",
                flujo_json=json.dumps(
                    [
                        "demandante",
                        "validadora",
                        "aprobadora",
                        "contabilidad",
                        "pagadora",
                        "sap",
                    ]
                ),
                activo=True,
            )
        )
        db.add(
            WorkflowConfig(
                nombre="Flujo sin Factura",
                descripcion="Flujo para pagos sin factura",
                es_default=False,
                tipo_pago="SIN_FACTURA",
                flujo_json=json.dumps(
                    [
                        "demandante",
                        "aprobadora",
                        "pagadora",
                        "validadora",
                        "contabilidad",
                        "sap",
                    ]
                ),
                activo=True,
            )
        )
        db.commit()
        return

    # Backfill tipo_pago on existing configs by name convention
    for config in (
        db.query(WorkflowConfig).filter(WorkflowConfig.tipo_pago.is_(None)).all()
    ):
        nombre_lower = config.nombre.lower()
        if "sin factura" in nombre_lower or "sin_factura" in nombre_lower:
            config.tipo_pago = "SIN_FACTURA"
        elif "con factura" in nombre_lower or "con_factura" in nombre_lower:
            config.tipo_pago = "CON_FACTURA"
    db.commit()


def delete_workflow_by_payment(db: Session, payment_id: int):
    """Delete all workflow states and comments for a payment"""
    # Delete comments for these workflow states
    states = (
        db.query(WorkflowState)
        .filter(WorkflowState.payment_request_id == payment_id)
        .all()
    )
    for state in states:
        db.query(Comment).filter(Comment.workflow_state_id == state.id).delete()
    # Delete workflow states
    db.query(WorkflowState).filter(
        WorkflowState.payment_request_id == payment_id
    ).delete()
    db.commit()
