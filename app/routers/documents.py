from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.payment import Document
from app.services.auth import get_current_user
from app.utils.security import create_document_token, decode_document_token
import os

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
            "Content-Disposition": f'attachment; filename="{document.nombre_original}"',
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
            "Content-Disposition": f'inline; filename="{document.nombre_original}"'
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
            "Content-Disposition": f'attachment; filename="{document.nombre_original}"',
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
