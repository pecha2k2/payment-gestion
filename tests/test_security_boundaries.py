from datetime import datetime, timezone
from pathlib import Path

import pytest

from app.models.payment import Document, Divisa, EstadoGeneral, MedioPago, PaymentRequest, TipoPago
from app.models.user import User, UserRole
from app.routers import payments as payments_router
from app.utils.security import create_access_token, get_password_hash


def create_user(db, username, *, active=True):
    user = User(
        username=username,
        password_hash=get_password_hash("password123"),
        name=username.capitalize(),
        email=f"{username}@company.com",
        role=UserRole.demandante,
        area="Demandante",
        active=active,
        created_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_payment(db, user):
    payment = PaymentRequest(
        numero_peticion=f"PAY-2026-{user.id:04d}",
        propuesta_gasto=12345,
        tipo_pago=TipoPago.CON_FACTURA,
        medio_pago=MedioPago.TRANSFERENCIA,
        estado_general=EstadoGeneral.ABIERTA,
        monto_total=100,
        divisa=Divisa.EUR,
        creadora_id=user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def auth_headers(username):
    token = create_access_token(data={"sub": username})
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_login_rejects_invalid_password(client, db_session):
    create_user(db_session, "alice")

    response = await client.post(
        "/api/auth/login",
        data={"username": "alice", "password": "wrong"},
    )

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.asyncio
async def test_inactive_user_cannot_login_or_reuse_token(client, db_session):
    create_user(db_session, "inactive", active=False)

    login_response = await client.post(
        "/api/auth/login",
        data={"username": "inactive", "password": "password123"},
    )
    token_response = await client.get("/api/auth/me", headers=auth_headers("inactive"))

    assert login_response.status_code == 400
    assert login_response.json()["detail"] == "Usuario inactivo"
    assert token_response.status_code == 400
    assert token_response.json()["detail"] == "Usuario inactivo"


@pytest.mark.asyncio
async def test_upload_sanitizes_filename_and_keeps_file_in_payment_directory(
    client, db_session, monkeypatch, tmp_path
):
    user = create_user(db_session, "uploader")
    payment = create_payment(db_session, user)
    monkeypatch.setattr(payments_router, "DOCUMENTS_DIR", str(tmp_path))

    response = await client.post(
        f"/api/payments/{payment.id}/documents",
        headers=auth_headers(user.username),
        files={"file": ("../../escape.pdf", b"safe content", "application/pdf")},
    )

    assert response.status_code == 200
    assert response.json()["nombre_original"] == "escape.pdf"
    document = db_session.query(Document).one()
    payment_dir = (tmp_path / payment.numero_peticion).resolve()
    assert Path(document.ruta_storage).resolve().is_relative_to(payment_dir)
    assert Path(document.ruta_storage).read_bytes() == b"safe content"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("filename", "content", "content_type", "expected_status"),
    [
        ("payload.exe", b"content", "application/octet-stream", 400),
        ("large.pdf", b"123456789", "application/pdf", 413),
    ],
)
async def test_upload_rejects_invalid_type_and_oversized_content(
    client, db_session, monkeypatch, tmp_path, filename, content, content_type, expected_status
):
    user = create_user(db_session, "blocked-upload")
    payment = create_payment(db_session, user)
    monkeypatch.setattr(payments_router, "DOCUMENTS_DIR", str(tmp_path))
    monkeypatch.setattr(payments_router, "MAX_FILE_SIZE", 8)

    response = await client.post(
        f"/api/payments/{payment.id}/documents",
        headers=auth_headers(user.username),
        files={"file": (filename, content, content_type)},
    )

    assert response.status_code == expected_status
    assert db_session.query(Document).count() == 0
