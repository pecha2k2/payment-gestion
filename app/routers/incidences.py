from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.payment import PaymentRequest
from app.models.workflow import WorkflowState, WorkflowEstado, Area
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/incidences", tags=["incidences"])


@router.get("/by-user/{user_id}")
def get_incidences_by_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtener incidencias pendientes de un usuario.
    Una incidencia es una petición de pago donde el usuario tiene un estado
    de workflow en PENDIENTE o EN_PROCESO.
    """
    # Buscar estados de workflow donde el usuario está asignado y no está completado
    workflow_states = db.query(WorkflowState).filter(
        WorkflowState.usuario_asignado_id == user_id,
        WorkflowState.estado.in_([WorkflowEstado.PENDIENTE, WorkflowEstado.EN_PROCESO])
    ).all()

    result = []
    for ws in workflow_states:
        payment = db.query(PaymentRequest).filter(PaymentRequest.id == ws.payment_request_id).first()
        if payment and payment.estado_general.value not in ['COMPLETADA', 'CANCELADA']:
            result.append({
                "workflow_state_id": ws.id,
                "area": ws.area.value,
                "estado": ws.estado.value,
                "payment_request": {
                    "id": payment.id,
                    "numero_peticion": payment.numero_peticion,
                    "propuesta_gasto": payment.propuesta_gasto,
                    "descripcion": payment.descripcion,
                    "tipo_pago": payment.tipo_pago.value,
                    "estado_general": payment.estado_general.value,
                    "monto_total": float(payment.monto_total),
                    "created_at": str(payment.created_at)
                }
            })

    return result


@router.get("/by-area/{area}")
def get_incidences_by_area(
    area: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtener incidencias pendientes por área.
    Solo PENDIENTE son incidencias reales (EN_PROCESO ya actuó).
    """
    try:
        area_enum = Area(area)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Área inválida: {area}")

    workflow_states = db.query(WorkflowState).filter(
        WorkflowState.area == area_enum,
        WorkflowState.estado == WorkflowEstado.PENDIENTE
    ).all()

    result = []
    for ws in workflow_states:
        payment = db.query(PaymentRequest).filter(PaymentRequest.id == ws.payment_request_id).first()
        if payment and payment.estado_general.value not in ['COMPLETADA', 'CANCELADA']:
            result.append({
                "workflow_state_id": ws.id,
                "usuario_asignado_id": ws.usuario_asignado_id,
                "estado": ws.estado.value,
                "payment_request": {
                    "id": payment.id,
                    "numero_peticion": payment.numero_peticion,
                    "propuesta_gasto": payment.propuesta_gasto,
                    "descripcion": payment.descripcion,
                    "tipo_pago": payment.tipo_pago.value,
                    "estado_general": payment.estado_general.value,
                    "monto_total": float(payment.monto_total),
                    "created_at": str(payment.created_at)
                }
            })

    return result


@router.get("/my-pending")
def get_my_pending_incidences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtener las incidencias pendientes del usuario actual.
    """
    return get_incidences_by_user(current_user.id, db, current_user)


@router.get("/summary")
def get_incidences_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Resumen de incidencias pendientes por área.
    Solo cuenta PENDIENTE (EN_PROCESO ya actuó).
    """
    summary = {}
    for area in Area:
        count = db.query(WorkflowState).filter(
            WorkflowState.area == area,
            WorkflowState.estado == WorkflowEstado.PENDIENTE
        ).count()
        summary[area.value] = count

    # Total del usuario actual (solo PENDIENTE)
    my_pending = db.query(WorkflowState).filter(
        WorkflowState.usuario_asignado_id == current_user.id,
        WorkflowState.estado == WorkflowEstado.PENDIENTE
    ).count()

    return {
        "by_area": summary,
        "my_pending": my_pending
    }
