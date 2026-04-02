from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from app.models.payment import TipoPago, MedioPago, EstadoGeneral, DocumentoTipo, Divisa


class DocumentBase(BaseModel):
    tipo: DocumentoTipo = DocumentoTipo.otro
    n_documento_contable: Optional[str] = None


class DocumentResponse(DocumentBase):
    id: int
    payment_request_id: int
    nombre_original: str
    hash_sha256: Optional[str] = None
    tamano_bytes: int
    mime_type: Optional[str] = None
    uploaded_by_id: int
    uploaded_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PaymentRequestBase(BaseModel):
    propuesta_gasto: int  # Código numérico obligatorio
    orden_pago: Optional[str] = None
    numero_factura: Optional[str] = None
    n_documento_contable: Optional[str] = None
    fecha_pago: Optional[date] = None
    tipo_pago: TipoPago = TipoPago.CON_FACTURA
    medio_pago: Optional[MedioPago] = None
    monto_total: Decimal = Decimal("0.00")
    divisa: Divisa = Divisa.EUR
    descripcion: Optional[str] = None
    banco: Optional[str] = None  # Banco del pago

    @field_validator("fecha_pago", mode="before")
    @classmethod
    def parse_fecha_pago(cls, v):
        if v is None or v == "":
            return None
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            if "/" in v:
                return parse_date_ddmmyyyy(v)
            return date.fromisoformat(v)
        return v


class PaymentRequestCreate(PaymentRequestBase):
    pass


def parse_date_ddmmyyyy(date_str: str) -> date:
    """Parse date from dd/mm/yyyy format"""
    if isinstance(date_str, date):
        return date_str
    parts = date_str.split("/")
    if len(parts) == 3:
        day, month, year = int(parts[0]), int(parts[1]), int(parts[2])
        return date(year, month, day)
    raise ValueError(f"Invalid date format: {date_str}")


class PaymentRequestUpdate(BaseModel):
    propuesta_gasto: Optional[int] = None
    orden_pago: Optional[str] = None
    numero_factura: Optional[str] = None
    n_documento_contable: Optional[str] = None
    fecha_pago: Optional[date] = None
    tipo_pago: Optional[TipoPago] = None
    medio_pago: Optional[MedioPago] = None
    monto_total: Optional[Decimal] = None
    divisa: Optional[Divisa] = None
    descripcion: Optional[str] = None
    banco: Optional[str] = None

    @field_validator("fecha_pago", mode="before")
    @classmethod
    def parse_fecha_pago(cls, v):
        if v is None or v == "":
            return None
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            if "/" in v:
                return parse_date_ddmmyyyy(v)
            return date.fromisoformat(v)
        return v


class PaymentRequestResponse(PaymentRequestBase):
    id: int
    numero_peticion: str
    estado_general: EstadoGeneral
    creadora_id: int
    workflow_config_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    workflow_states: List["WorkflowStateResponse"] = []

    class Config:
        from_attributes = True


class PaginatedResponse(BaseModel):
    total: int
    page: int
    per_page: int
    pages: int
    items: List[PaymentRequestResponse] = []

    class Config:
        from_attributes = True


class PaymentRequestDetail(PaymentRequestResponse):
    creadora: Optional["UserResponse"] = None
    documents: List["DocumentResponse"] = []
    workflow_states: List["WorkflowStateResponse"] = []
    comments: List["CommentResponse"] = []


# Need forward references
from app.schemas.user import UserResponse
from app.schemas.workflow import WorkflowStateResponse, CommentResponse

PaymentRequestResponse.model_rebuild()
PaymentRequestDetail.model_rebuild()
