from typing import List, Optional
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File,
    Form,
    Body,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import os
import pathlib
import hashlib
import shutil

from app.database import get_db
from app.models.user import User
from app.models.payment import PaymentRequest, Document, DocumentoTipo
from app.models.workflow import WorkflowState, WorkflowConfig, WorkflowEstado, Area
from app.schemas.payment import (
    PaymentRequestCreate,
    PaymentRequestUpdate,
    PaymentRequestResponse,
    PaymentRequestDetail,
    PaginatedResponse,
)
from app.schemas.workflow import WorkflowStateResponse, CommentResponse
from app.services.auth import get_current_user
from app.services import payment as payment_service
from app.services import workflow as workflow_service

router = APIRouter(prefix="/api/payments", tags=["payments"])

DOCUMENTS_DIR = os.getenv("DOCUMENTS_DIR", "/app/documents")


@router.get("", response_model=PaginatedResponse)
def list_payments(
    page: int = 1,
    per_page: int = 20,
    estado_general: Optional[str] = None,
    area: Optional[str] = None,
    numero_peticion: Optional[str] = None,
    propuesta_gasto: Optional[str] = None,
    orden_pago: Optional[str] = None,
    numero_factura: Optional[str] = None,
    n_documento_contable: Optional[str] = None,
    fecha_pago: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    skip = (page - 1) * per_page
    total, items = payment_service.get_payments_paginated(
        db,
        skip,
        per_page,
        estado_general,
        area,
        numero_peticion,
        propuesta_gasto,
        orden_pago,
        numero_factura,
        n_documento_contable,
        fecha_pago,
    )
    pages = (total + per_page - 1) // per_page if per_page > 0 else 0
    return PaginatedResponse(
        total=total, page=page, per_page=per_page, pages=pages, items=items
    )


@router.post(
    "", response_model=PaymentRequestResponse, status_code=status.HTTP_201_CREATED
)
def create_payment(
    payment_data: PaymentRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return payment_service.create_payment_request(db, payment_data, current_user.id)


@router.get("/{payment_id}", response_model=PaymentRequestDetail)
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payment = payment_service.get_payment_by_id(db, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Petición de pago no encontrada")
    return payment


@router.put("/{payment_id}", response_model=PaymentRequestResponse)
def update_payment(
    payment_id: int,
    payment_data: PaymentRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payment = payment_service.update_payment(db, payment_id, payment_data)
    if not payment:
        raise HTTPException(status_code=404, detail="Petición de pago no encontrada")
    return payment


@router.delete("/{payment_id}")
def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payment = payment_service.get_payment_by_id(db, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Petición de pago no encontrada")

    # Only creator or admin can delete
    if payment.creadora_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(
            status_code=403, detail="No tienes permiso para eliminar esta petición"
        )

    # Delete associated workflow states and comments first
    workflow_service.delete_workflow_by_payment(db, payment_id)

    # Delete associated documents (files)
    from app.models.payment import Document

    documents = (
        db.query(Document).filter(Document.payment_request_id == payment_id).all()
    )
    for doc in documents:
        # Delete physical file if exists
        if doc.ruta_storage and os.path.exists(doc.ruta_storage):
            os.remove(doc.ruta_storage)
        db.delete(doc)

    # Delete the payment folder (e.g., PAY-2026-0001)
    payment_dir = os.path.join(
        os.getenv("DOCUMENTS_DIR", "/app/documents"), payment.numero_peticion
    )
    if os.path.exists(payment_dir):
        shutil.rmtree(payment_dir)

    # Delete the payment request
    db.delete(payment)
    db.commit()
    return {"message": "Petición eliminada"}


@router.post("/{payment_id}/cancel")
def cancel_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payment = payment_service.get_payment_by_id(db, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Petición de pago no encontrada")

    # Only creator or admin can cancel
    if payment.creadora_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(
            status_code=403, detail="No tienes permiso para cancelar esta petición"
        )

    payment.estado_general = "CANCELADA"
    payment.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Petición cancelada"}


# Document endpoints
@router.post("/{payment_id}/documents")
async def upload_document(
    payment_id: int,
    file: UploadFile = File(...),
    tipo: DocumentoTipo = Form(DocumentoTipo.otro),
    n_documento_contable: Optional[str] = Form(None),
    comment_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payment = payment_service.get_payment_by_id(db, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Petición de pago no encontrada")

    # Create payment directory using numero_peticion (e.g., PAY-2026-0001)
    payment_dir = os.path.join(DOCUMENTS_DIR, payment.numero_peticion)
    os.makedirs(payment_dir, exist_ok=True)

    # Sanitize filename to prevent path traversal attacks
    original_filename = pathlib.Path(file.filename or "unknown").name or "unknown"
    file_path = os.path.join(payment_dir, original_filename)

    # Read and hash file
    content = await file.read()
    file_hash = hashlib.sha256(content).hexdigest()

    # Save file
    with open(file_path, "wb") as f:
        f.write(content)

    # Create document record
    document = Document(
        payment_request_id=payment_id,
        tipo=tipo,
        nombre_original=file.filename or "unknown",
        ruta_storage=file_path,
        hash_sha256=file_hash,
        tamano_bytes=len(content),
        mime_type=file.content_type,
        uploaded_by_id=current_user.id,
        uploaded_at=datetime.now(timezone.utc),
        n_documento_contable=n_documento_contable,
        comment_id=comment_id,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    return {"id": document.id, "nombre_original": document.nombre_original}


@router.get("/{payment_id}/workflow", response_model=List[WorkflowStateResponse])
def get_payment_workflow(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return workflow_service.get_workflow_states(db, payment_id)


@router.post("/{payment_id}/workflow/{area}/advance")
def advance_workflow(
    payment_id: int,
    area: str,
    body: dict = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        area_enum = Area[area]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Área inválida: {area}")

    try:
        comentario = body.get("comentario") if body else None
        state = workflow_service.advance_workflow_state(
            db, payment_id, area_enum, current_user.id, comentario
        )
        if not state:
            raise HTTPException(
                status_code=404, detail="Estado de workflow no encontrado"
            )
        return state
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{payment_id}/workflow/{area}/reverse")
def reverse_workflow(
    payment_id: int,
    area: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        area_enum = Area[area]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Área inválida: {area}")

    try:
        comentario = body.get("comentario", "")
        state = workflow_service.reverse_workflow_state(
            db, payment_id, area_enum, current_user.id, comentario
        )
        if not state:
            raise HTTPException(
                status_code=404, detail="Estado de workflow no encontrado"
            )
        return state
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{payment_id}/workflow/{area}/comment", response_model=CommentResponse)
def add_workflow_comment(
    payment_id: int,
    area: str,
    contenido: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        area_enum = Area[area]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Área inválida: {area}")

    comment = workflow_service.add_workflow_comment(
        db, payment_id, area_enum, current_user.id, contenido
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Estado de workflow no encontrado")

    return comment
