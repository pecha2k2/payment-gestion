from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Date,
    Enum as SQLEnum,
    ForeignKey,
    Numeric,
)
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import enum


class TipoPago(str, enum.Enum):
    CON_FACTURA = "CON_FACTURA"
    SIN_FACTURA = "SIN_FACTURA"


class MedioPago(str, enum.Enum):
    TRANSFERENCIA = "TRANSFERENCIA"
    TARJETA = "TARJETA"


class Divisa(str, enum.Enum):
    EUR = "EUR"
    USD = "USD"
    GBP = "GBP"
    CHF = "CHF"
    JPY = "JPY"
    CNY = "CNY"


class EstadoGeneral(str, enum.Enum):
    ABIERTA = "ABIERTA"
    EN_PROCESO = "EN_PROCESO"
    COMPLETADA = "COMPLETADA"
    CANCELADA = "CANCELADA"


class DocumentoTipo(str, enum.Enum):
    peticion = "peticion"
    presupuesto = "presupuesto"
    factura = "factura"
    documento_contable = "documento_contable"
    otro = "otro"


class PaymentRequest(Base):
    __tablename__ = "payment_requests"

    id = Column(Integer, primary_key=True, index=True)
    numero_peticion = Column(String(20), unique=True, index=True, nullable=False)
    propuesta_gasto = Column(
        Integer, index=True, nullable=False
    )  # Código numérico obligatorio
    orden_pago = Column(String(100), index=True, nullable=True)
    numero_factura = Column(String(100), index=True, nullable=True)
    n_documento_contable = Column(String(100), index=True, nullable=True)
    fecha_pago = Column(Date, nullable=True)
    tipo_pago = Column(SQLEnum(TipoPago), nullable=False, default=TipoPago.CON_FACTURA)
    medio_pago = Column(SQLEnum(MedioPago), nullable=True)
    estado_general = Column(
        SQLEnum(EstadoGeneral), nullable=False, default=EstadoGeneral.ABIERTA
    )
    monto_total = Column(Numeric(15, 2), default=0)
    divisa = Column(SQLEnum(Divisa), nullable=False, default=Divisa.EUR)
    descripcion = Column(Text, nullable=True)  # Descripción del gasto
    banco = Column(String(200), nullable=True)  # Banco del pago
    creadora_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    workflow_config_id = Column(
        Integer, ForeignKey("workflow_configs.id"), nullable=True
    )
    created_at = Column(DateTime, default=None)
    updated_at = Column(DateTime, default=None, onupdate=datetime.utcnow)

    # Relationships
    creadora = relationship("User", back_populates="payment_requests")
    workflow_config = relationship("WorkflowConfig", back_populates="payment_requests")
    documents = relationship(
        "Document", back_populates="payment_request", cascade="all, delete-orphan"
    )
    workflow_states = relationship(
        "WorkflowState", back_populates="payment_request", cascade="all, delete-orphan"
    )
    comments = relationship(
        "Comment", back_populates="payment_request", cascade="all, delete-orphan"
    )


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    payment_request_id = Column(
        Integer, ForeignKey("payment_requests.id"), nullable=False
    )
    tipo = Column(SQLEnum(DocumentoTipo), nullable=False, default=DocumentoTipo.otro)
    nombre_original = Column(String(255), nullable=False)
    ruta_storage = Column(String(500), nullable=False)
    hash_sha256 = Column(String(64), nullable=True)
    tamano_bytes = Column(Integer, default=0)
    mime_type = Column(String(100), nullable=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=None)
    n_documento_contable = Column(String(100), nullable=True)
    metadata_json = Column(Text, nullable=True)
    comment_id = Column(Integer, ForeignKey("comments.id"), nullable=True)

    # Relationships
    payment_request = relationship("PaymentRequest", back_populates="documents")
    uploaded_by = relationship("User", back_populates="documents")
    comment = relationship(
        "Comment", back_populates="documentos", foreign_keys=[comment_id]
    )
