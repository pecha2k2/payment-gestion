from sqlalchemy import Column, Integer, String, Text, DateTime, Enum as SQLEnum, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class Area(str, enum.Enum):
    demandante = "demandante"
    validadora = "validadora"
    aprobadora = "aprobadora"
    contabilidad = "contabilidad"
    sap = "sap"
    pagadora = "pagadora"


class WorkflowEstado(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    EN_PROCESO = "EN_PROCESO"
    APROBADO = "APROBADO"
    RECHAZADO = "RECHAZADO"
    REVERSADO = "REVERSADO"


class WorkflowConfig(Base):
    __tablename__ = "workflow_configs"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text, nullable=True)
    es_default = Column(Boolean, default=False)
    flujo_json = Column(Text, nullable=False)  # JSON array of area names in order
    activo = Column(Boolean, default=True)
    tipo_pago = Column(String(20), nullable=True)  # CON_FACTURA | SIN_FACTURA

    # Relationships
    payment_requests = relationship("PaymentRequest", back_populates="workflow_config")


class WorkflowState(Base):
    __tablename__ = "workflow_states"

    id = Column(Integer, primary_key=True, index=True)
    payment_request_id = Column(Integer, ForeignKey("payment_requests.id"), nullable=False)
    area = Column(SQLEnum(Area), nullable=False)
    estado = Column(SQLEnum(WorkflowEstado), nullable=False, default=WorkflowEstado.PENDIENTE)
    usuario_asignado_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    usuario_completo_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=None)

    # Relationships
    payment_request = relationship("PaymentRequest", back_populates="workflow_states")
    comments = relationship("Comment", back_populates="workflow_state")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    payment_request_id = Column(Integer, ForeignKey("payment_requests.id"), nullable=False)
    workflow_state_id = Column(Integer, ForeignKey("workflow_states.id"), nullable=True)
    usuario_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    area = Column(String(50), nullable=True)  # Área a la que pertenece el comentario
    contenido = Column(Text, nullable=False)
    created_at = Column(DateTime, default=None)

    # Relationships
    payment_request = relationship("PaymentRequest", back_populates="comments")
    workflow_state = relationship("WorkflowState", back_populates="comments")
    usuario = relationship("User", back_populates="comments")
    documentos = relationship("Document", back_populates="comment", foreign_keys="Document.comment_id")
