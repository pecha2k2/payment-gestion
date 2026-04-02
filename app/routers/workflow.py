from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload
from app.database import get_db
from app.middleware.rate_limit import search_limits
from app.models.user import User
from app.models.payment import PaymentRequest, Document
from app.models.workflow import WorkflowConfig, WorkflowState, Comment
from app.schemas.workflow import (
    WorkflowConfigCreate,
    WorkflowConfigUpdate,
    WorkflowConfigResponse,
)
from app.services.auth import get_current_user, require_admin
from app.services import workflow as workflow_service

router = APIRouter(prefix="/api/workflow-configs", tags=["workflow-configs"])


@router.get("", response_model=List[WorkflowConfigResponse])
def list_workflow_configs(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return workflow_service.get_workflow_configs(db)


@router.post("", response_model=WorkflowConfigResponse)
def create_workflow_config(
    config_data: WorkflowConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return workflow_service.create_workflow_config(db, config_data.model_dump())


@router.put("/{config_id}", response_model=WorkflowConfigResponse)
def update_workflow_config(
    config_id: int,
    config_data: WorkflowConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    config = db.query(WorkflowConfig).filter(WorkflowConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")

    update_data = config_data.model_dump(exclude_unset=True)

    # If setting as default, unset others
    if update_data.get("es_default"):
        db.query(WorkflowConfig).update({"es_default": False})

    for field, value in update_data.items():
        setattr(config, field, value)

    db.commit()
    db.refresh(config)
    return config


# Search endpoint
search_router = APIRouter(prefix="/api/search", tags=["search"])


@search_router.get("")
@search_limits()
def search_payments(
    request: Request,
    q: str,
    field: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Search payments by various fields.
    Fields: propuesta_gasto, numero_peticion, orden_pago, numero_factura, n_documento_contable, fecha_pago, descripcion, comentarios
    If no field specified, searches all text fields including descripcion and comentarios.
    Supports wildcards: * (any characters), ? (single character)
    """
    # A-01: Use selectinload to avoid N+1 queries when loading workflow states
    query = db.query(PaymentRequest).options(
        selectinload(PaymentRequest.workflow_states)
    )

    if field:
        if field == "propuesta_gasto":
            try:
                propuesta_value = int(q)
                query = query.filter(PaymentRequest.propuesta_gasto == propuesta_value)
            except ValueError:
                query = query.filter(PaymentRequest.propuesta_gasto.ilike(f"%{q}%"))
        elif field == "numero_peticion":
            query = query.filter(PaymentRequest.numero_peticion.ilike(f"%{q}%"))
        elif field == "orden_pago":
            query = query.filter(PaymentRequest.orden_pago.ilike(f"%{q}%"))
        elif field == "numero_factura":
            query = query.filter(PaymentRequest.numero_factura.ilike(f"%{q}%"))
        elif field == "n_documento_contable":
            query = query.filter(PaymentRequest.n_documento_contable.ilike(f"%{q}%"))
        elif field == "fecha_pago":
            query = query.filter(PaymentRequest.fecha_pago.ilike(f"%{q}%"))
        else:
            raise HTTPException(
                status_code=400, detail=f"Campo de búsqueda inválido: {field}"
            )
    else:
        # A-02: Correct LIKE escape order — escape SQL special chars FIRST, then apply user wildcards.
        # Step 1: escape SQL special chars in the raw input (prevents injection)
        sql_safe = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        # Step 2: convert user wildcards to SQL wildcards
        sql_pattern = sql_safe.replace("*", "%").replace("?", "_")
        # Step 3: wrap with % for "contains" and lowercase so it matches func.lower() columns
        search_pattern = f"%{sql_pattern.lower()}%"

        # A-03: propuesta_gasto must be inside or_() — not chained as AND via .filter()
        or_clauses = [
            func.lower(PaymentRequest.numero_peticion).like(
                search_pattern, escape="\\"
            ),
            func.lower(PaymentRequest.orden_pago).like(search_pattern, escape="\\"),
            func.lower(PaymentRequest.numero_factura).like(search_pattern, escape="\\"),
            func.lower(PaymentRequest.n_documento_contable).like(
                search_pattern, escape="\\"
            ),
            func.lower(PaymentRequest.descripcion).like(search_pattern, escape="\\"),
            func.lower(Comment.contenido).like(search_pattern, escape="\\"),
        ]

        # Include propuesta_gasto as a numeric OR clause when q is a valid integer
        try:
            propuesta_value = int(q)
            or_clauses.append(PaymentRequest.propuesta_gasto == propuesta_value)
        except ValueError:
            pass

        query = query.outerjoin(Comment).filter(or_(*or_clauses))

    results = query.order_by(PaymentRequest.created_at.desc()).limit(50).all()

    # workflow_states already eagerly loaded — no additional queries per payment
    response = []
    for payment in results:
        area_status = {ws.area.value: ws.estado.value for ws in payment.workflow_states}

        response.append(
            {
                "id": payment.id,
                "numero_peticion": payment.numero_peticion,
                "propuesta_gasto": payment.propuesta_gasto,
                "orden_pago": payment.orden_pago,
                "numero_factura": payment.numero_factura,
                "n_documento_contable": payment.n_documento_contable,
                "fecha_pago": str(payment.fecha_pago) if payment.fecha_pago else None,
                "estado_general": payment.estado_general.value,
                "tipo_pago": payment.tipo_pago.value,
                "monto_total": float(payment.monto_total),
                "area_status": area_status,
                "created_at": str(payment.created_at),
            }
        )

    return response
