from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
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
def search_payments(
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
    query = db.query(PaymentRequest)

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
        # Convert * to % and ? to _ for SQL LIKE wildcards
        sql_pattern = q.replace("*", "%").replace("?", "_")
        search_pattern = f"%{sql_pattern}%"
        query = query.outerjoin(Comment).filter(
            (PaymentRequest.numero_peticion.ilike(search_pattern))
            | (PaymentRequest.orden_pago.ilike(search_pattern))
            | (PaymentRequest.numero_factura.ilike(search_pattern))
            | (PaymentRequest.n_documento_contable.ilike(search_pattern))
            | (PaymentRequest.descripcion.ilike(search_pattern))
            | (Comment.contenido.ilike(search_pattern))
        )
        # Also try propuesta_gasto as number if q is numeric
        try:
            propuesta_value = int(q)
            query = query.filter(PaymentRequest.propuesta_gasto == propuesta_value)
        except ValueError:
            pass  # Ignore if not a number

    results = query.order_by(PaymentRequest.created_at.desc()).limit(50).all()

    # For each result, include current workflow state info
    response = []
    for payment in results:
        workflow_states = (
            db.query(WorkflowState)
            .filter(WorkflowState.payment_request_id == payment.id)
            .all()
        )

        area_status = {ws.area.value: ws.estado.value for ws in workflow_states}

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
