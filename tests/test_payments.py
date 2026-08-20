import pytest
from datetime import datetime, timezone
from app.models.user import User, UserRole
from app.models.payment import PaymentRequest, TipoPago, MedioPago, Divisa, EstadoGeneral
from app.models.workflow import WorkflowState, Area, WorkflowEstado, Comment
from app.utils.security import get_password_hash, create_access_token

def get_auth_headers(username: str) -> dict:
    token = create_access_token(data={"sub": username})
    return {"Authorization": f"Bearer {token}"}

def create_test_user(db, username: str, role: UserRole, area: str = "Test Area") -> User:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            username=username,
            password_hash=get_password_hash("password123"),
            name=username.capitalize(),
            email=f"{username}@company.com",
            role=role,
            area=area,
            active=True,
            created_at=datetime.now(timezone.utc),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

@pytest.mark.asyncio
async def test_demandante_isolation(client, db_session):
    # Create test users
    juan = create_test_user(db_session, "juan", UserRole.demandante)
    maria = create_test_user(db_session, "maria", UserRole.demandante)

    # Create payments
    p1 = PaymentRequest(
        numero_peticion="PAY-2026-0001",
        propuesta_gasto=12345,
        tipo_pago=TipoPago.CON_FACTURA,
        medio_pago=MedioPago.TRANSFERENCIA,
        estado_general=EstadoGeneral.ABIERTA,
        monto_total=100.00,
        divisa=Divisa.EUR,
        creadora_id=juan.id,
        created_at=datetime.now(timezone.utc),
    )
    p2 = PaymentRequest(
        numero_peticion="PAY-2026-0002",
        propuesta_gasto=67890,
        tipo_pago=TipoPago.CON_FACTURA,
        medio_pago=MedioPago.TRANSFERENCIA,
        estado_general=EstadoGeneral.ABIERTA,
        monto_total=200.00,
        divisa=Divisa.EUR,
        creadora_id=maria.id,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add_all([p1, p2])
    db_session.commit()

    headers_juan = get_auth_headers("juan")

    # Juan lists payments: should only see P1
    response = await client.get("/api/payments", headers=headers_juan)
    assert response.status_code == 200
    data = response.json()
    items = data["items"]
    assert len(items) == 1
    assert items[0]["numero_peticion"] == "PAY-2026-0001"

    # Juan retrieves P1: should succeed
    response = await client.get(f"/api/payments/{p1.id}", headers=headers_juan)
    assert response.status_code == 200
    assert response.json()["numero_peticion"] == "PAY-2026-0001"

    # Juan retrieves P2: should be 404
    response = await client.get(f"/api/payments/{p2.id}", headers=headers_juan)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_workflow_user_access(client, db_session):
    # Create test users
    juan = create_test_user(db_session, "juan", UserRole.demandante)
    maria = create_test_user(db_session, "maria", UserRole.demandante)
    ana = create_test_user(db_session, "ana", UserRole.validador)

    # P1: in Ana's active queue (usuario_asignado_id == ana.id)
    p1 = PaymentRequest(
        numero_peticion="PAY-2026-0001",
        propuesta_gasto=11111,
        tipo_pago=TipoPago.CON_FACTURA,
        medio_pago=MedioPago.TRANSFERENCIA,
        estado_general=EstadoGeneral.ABIERTA,
        monto_total=100.00,
        divisa=Divisa.EUR,
        creadora_id=juan.id,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(p1)
    db_session.flush()

    ws1 = WorkflowState(
        payment_request_id=p1.id,
        area=Area.validadora,
        estado=WorkflowEstado.PENDIENTE,
        usuario_asignado_id=ana.id,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(ws1)

    # P2: previously processed by Ana (usuario_completo_id == ana.id)
    p2 = PaymentRequest(
        numero_peticion="PAY-2026-0002",
        propuesta_gasto=22222,
        tipo_pago=TipoPago.CON_FACTURA,
        medio_pago=MedioPago.TRANSFERENCIA,
        estado_general=EstadoGeneral.EN_PROCESO,
        monto_total=200.00,
        divisa=Divisa.EUR,
        creadora_id=juan.id,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(p2)
    db_session.flush()

    ws2 = WorkflowState(
        payment_request_id=p2.id,
        area=Area.validadora,
        estado=WorkflowEstado.APROBADO,
        usuario_completo_id=ana.id,
        completed_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(ws2)

    # P3: Ana was never involved, created by Maria
    p3 = PaymentRequest(
        numero_peticion="PAY-2026-0003",
        propuesta_gasto=33333,
        tipo_pago=TipoPago.CON_FACTURA,
        medio_pago=MedioPago.TRANSFERENCIA,
        estado_general=EstadoGeneral.ABIERTA,
        monto_total=300.00,
        divisa=Divisa.EUR,
        creadora_id=maria.id,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(p3)
    db_session.flush()

    ws3 = WorkflowState(
        payment_request_id=p3.id,
        area=Area.validadora,
        estado=WorkflowEstado.PENDIENTE,
        usuario_asignado_id=999,  # assigned to someone else
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(ws3)
    
    # P4: Commented by Ana
    p4 = PaymentRequest(
        numero_peticion="PAY-2026-0004",
        propuesta_gasto=44444,
        tipo_pago=TipoPago.CON_FACTURA,
        medio_pago=MedioPago.TRANSFERENCIA,
        estado_general=EstadoGeneral.EN_PROCESO,
        monto_total=400.00,
        divisa=Divisa.EUR,
        creadora_id=maria.id,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(p4)
    db_session.flush()
    
    comment = Comment(
        payment_request_id=p4.id,
        usuario_id=ana.id,
        area="validadora",
        contenido="Comentario de prueba",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(comment)

    db_session.commit()

    headers_ana = get_auth_headers("ana")

    # Ana lists payments: should see P1, P2, and P4. Should NOT see P3.
    response = await client.get("/api/payments", headers=headers_ana)
    assert response.status_code == 200
    data = response.json()
    items = data["items"]
    nums = [item["numero_peticion"] for item in items]
    assert len(nums) == 3
    assert "PAY-2026-0001" in nums  # Active queue
    assert "PAY-2026-0002" in nums  # Historically processed
    assert "PAY-2026-0004" in nums  # Commented by her
    assert "PAY-2026-0003" not in nums  # Never involved

    # Ana retrieves P1, P2, P4: should succeed
    for p in [p1, p2, p4]:
        res = await client.get(f"/api/payments/{p.id}", headers=headers_ana)
        assert res.status_code == 200

    # Ana retrieves P3: should be 404
    res = await client.get(f"/api/payments/{p3.id}", headers=headers_ana)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_admin_full_access(client, db_session):
    # Create test users
    juan = create_test_user(db_session, "juan", UserRole.demandante)
    maria = create_test_user(db_session, "maria", UserRole.demandante)
    
    # Create admin user
    admin = create_test_user(db_session, "admin_user", UserRole.admin)

    # Create payments
    p1 = PaymentRequest(
        numero_peticion="PAY-2026-0001",
        propuesta_gasto=12345,
        tipo_pago=TipoPago.CON_FACTURA,
        medio_pago=MedioPago.TRANSFERENCIA,
        estado_general=EstadoGeneral.ABIERTA,
        monto_total=100.00,
        divisa=Divisa.EUR,
        creadora_id=juan.id,
        created_at=datetime.now(timezone.utc),
    )
    p2 = PaymentRequest(
        numero_peticion="PAY-2026-0002",
        propuesta_gasto=67890,
        tipo_pago=TipoPago.CON_FACTURA,
        medio_pago=MedioPago.TRANSFERENCIA,
        estado_general=EstadoGeneral.ABIERTA,
        monto_total=200.00,
        divisa=Divisa.EUR,
        creadora_id=maria.id,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add_all([p1, p2])
    db_session.commit()

    headers_admin = get_auth_headers("admin_user")

    # Admin lists payments: should see all
    response = await client.get("/api/payments", headers=headers_admin)
    assert response.status_code == 200
    data = response.json()
    items = data["items"]
    assert len(items) == 2

    # Admin retrieves P1 and P2: should succeed
    response1 = await client.get(f"/api/payments/{p1.id}", headers=headers_admin)
    assert response1.status_code == 200
    response2 = await client.get(f"/api/payments/{p2.id}", headers=headers_admin)
    assert response2.status_code == 200


@pytest.mark.asyncio
async def test_search_returns_workflow_states(client, db_session):
    demandante = create_test_user(db_session, "search_owner", UserRole.demandante)
    payment = PaymentRequest(
        numero_peticion="PAY-2026-SEARCH",
        propuesta_gasto=54321,
        tipo_pago=TipoPago.CON_FACTURA,
        medio_pago=MedioPago.TRANSFERENCIA,
        estado_general=EstadoGeneral.ABIERTA,
        monto_total=150.00,
        divisa=Divisa.EUR,
        creadora_id=demandante.id,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(payment)
    db_session.flush()
    db_session.add(
        WorkflowState(
            payment_request_id=payment.id,
            area=Area.validadora,
            estado=WorkflowEstado.PENDIENTE,
            created_at=datetime.now(timezone.utc),
        )
    )
    db_session.commit()

    response = await client.get(
        "/api/search",
        params={"q": "PAY-2026-SEARCH", "field": "numero_peticion"},
        headers=get_auth_headers(demandante.username),
    )

    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["numero_peticion"] == payment.numero_peticion
    states = results[0]["workflow_states"]
    assert len(states) == 1
    assert states[0]["payment_request_id"] == payment.id
    assert states[0]["area"] == "validadora"
    assert states[0]["estado"] == "PENDIENTE"
