from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.payment import Document
from app.services.auth import get_current_user
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


@router.get("/public/{document_id}/view")
def public_view_document(
    document_id: int, token: str = Query(...), db: Session = Depends(get_db)
):
    """
    Ver documento en el navegador usando token en query param.
    Para uso interno - el frontend pasa el token de sesión.
    """
    from app.utils.security import decode_access_token

    username = decode_access_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Token inválido")

    user = db.query(User).filter(User.username == username).first()
    if not user or not user.active:
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
    """
    Descargar documento usando token en query param.
    """
    from app.utils.security import decode_access_token

    username = decode_access_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Token inválido")

    user = db.query(User).filter(User.username == username).first()
    if not user or not user.active:
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
