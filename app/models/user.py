from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    demandante = "demandante"
    validador = "validador"
    aprobador = "aprobador"
    contador = "contador"
    sap = "sap"
    pagador = "pagador"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(100), nullable=False)
    email = Column(String(100), nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.demandante)
    area = Column(String(100), nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=None)

    # Relationships
    payment_requests = relationship("PaymentRequest", back_populates="creadora")
    documents = relationship("Document", back_populates="uploaded_by")
    comments = relationship("Comment", back_populates="usuario")
