from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from urllib.parse import quote
from app.database import get_db
from app.models.user import User
from app.models.payment import Document, PaymentRequest
from app.services.auth import get_current_user
from app.utils.security import create_document_token, decode_document_token
import os
import zipfile
import io


def _safe_content_disposition(disposition: str, filename: str) -> str:
    safe = filename.replace('"', "_").replace("\n", "_").replace("\r", "_")
    encoded = quote(filename, safe="")
    return f"{disposition}; filename=\"{safe}\"; filename*=UTF-8''{encoded}"


router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    if not os.path.exists(document.ruta_storage):
        raise HTTPException(
            status_code=404, detail="Archivo no encontrado en el sistema"
        )

    return FileResponse(
        path=document.ruta_storage,
        filename=document.nombre_original,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": _safe_content_disposition(
                "attachment", document.nombre_original
            ),
            "Content-Transfer-Encoding": "binary",
        },
    )


@router.post("/{document_id}/request-token")
def request_document_token(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Issue a 60-second ephemeral JWT scoped to this document."""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    token = create_document_token(current_user.id, document_id)
    return {"token": token}


@router.get("/public/{document_id}/view")
def public_view_document(
    document_id: int, token: str = Query(...), db: Session = Depends(get_db)
):
    """Ver documento en el navegador usando token efímero."""
    user_id = decode_document_token(token, document_id)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    user = db.query(User).filter(User.id == user_id, User.active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no autorizado")

    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    if not os.path.exists(document.ruta_storage):
        raise HTTPException(
            status_code=404, detail="Archivo no encontrado en el sistema"
        )

    return FileResponse(
        path=document.ruta_storage,
        media_type=document.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": _safe_content_disposition(
                "inline", document.nombre_original
            )
        },
    )


@router.get("/public/{document_id}/download")
def public_download_document(
    document_id: int, token: str = Query(...), db: Session = Depends(get_db)
):
    """Descargar documento usando token efímero."""
    user_id = decode_document_token(token, document_id)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    user = db.query(User).filter(User.id == user_id, User.active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no autorizado")

    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    if not os.path.exists(document.ruta_storage):
        raise HTTPException(
            status_code=404, detail="Archivo no encontrado en el sistema"
        )

    return FileResponse(
        path=document.ruta_storage,
        filename=document.nombre_original,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": _safe_content_disposition(
                "attachment", document.nombre_original
            ),
            "Content-Transfer-Encoding": "binary",
        },
    )


@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    # Only uploader or admin can delete
    if (
        document.uploaded_by_id != current_user.id
        and current_user.role.value != "admin"
    ):
        raise HTTPException(
            status_code=403, detail="No tienes permiso para eliminar este documento"
        )

    # Delete file
    if os.path.exists(document.ruta_storage):
        os.remove(document.ruta_storage)

    db.delete(document)
    db.commit()

    return {"message": "Documento eliminado"}


@router.post("/payment/{payment_id}/request-zip-token")
def request_zip_token(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Issue a 60-second ephemeral JWT for downloading the ZIP of all documents."""
    payment = db.query(PaymentRequest).filter(PaymentRequest.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    # Reuse document token mechanism with a synthetic "payment zip" doc_id (negative payment_id)
    token = create_document_token(current_user.id, -payment_id)
    return {"token": token}


@router.get("/payment/{payment_id}/download-all")
def download_all_documents(
    payment_id: int,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """C-05: Descargar todos los documentos de un pago como ZIP usando token efímero.

    Token is required (no Bearer auth) so the URL can be used as a direct download link.
    Token is issued by POST /documents/payment/{payment_id}/request-zip-token.
    """
    # Validate ephemeral token (uses negative payment_id as synthetic doc_id)
    user_id = decode_document_token(token, -payment_id)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    user = db.query(User).filter(User.id == user_id, User.active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no autorizado")

    # Get payment and documents
    payment = db.query(PaymentRequest).filter(PaymentRequest.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    documents = (
        db.query(Document).filter(Document.payment_request_id == payment_id).all()
    )
    if not documents:
        raise HTTPException(status_code=404, detail="No hay documentos para descargar")

    # Create ZIP in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for doc in documents:
            if os.path.exists(doc.ruta_storage):
                zip_file.write(doc.ruta_storage, doc.nombre_original)

    zip_buffer.seek(0)
    zip_filename = f"documentos_{payment.numero_peticion}.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": _safe_content_disposition("attachment", zip_filename)
        },
    )
