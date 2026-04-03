from __future__ import annotations
from pydantic import BaseModel, field_validator
from typing import Optional, List, Any, TYPE_CHECKING
from datetime import datetime
import json
from app.models.workflow import Area, WorkflowEstado

if TYPE_CHECKING:
    from app.schemas.user import UserResponse


class WorkflowStateBase(BaseModel):
    area: Area
    estado: WorkflowEstado = WorkflowEstado.PENDIENTE


class WorkflowStateCreate(WorkflowStateBase):
    payment_request_id: int


class WorkflowStateUpdate(BaseModel):
    estado: Optional[WorkflowEstado] = None
    usuario_asignado_id: Optional[int] = None


class WorkflowStateResponse(WorkflowStateBase):
    id: int
    payment_request_id: int
    usuario_asignado_id: Optional[int] = None
    usuario_completo_id: Optional[int] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WorkflowConfigBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    es_default: bool = False
    flujo_json: str  # JSON string
    tipo_pago: Optional[str] = None  # CON_FACTURA | SIN_FACTURA


class WorkflowConfigCreate(WorkflowConfigBase):
    pass


class WorkflowConfigUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    es_default: Optional[bool] = None
    flujo_json: Optional[str] = None
    activo: Optional[bool] = None
    tipo_pago: Optional[str] = None


class WorkflowConfigResponse(WorkflowConfigBase):
    id: int
    activo: bool

    @field_validator("flujo_json", mode="before")
    @classmethod
    def coerce_flujo_json_to_str(cls, v: Any) -> str:
        """flujo_json is stored as Text in DB but SQLAlchemy may return it already
        deserialized as a list (e.g. after json.loads somewhere upstream).
        Always normalize to a JSON string before Pydantic validates the field."""
        if isinstance(v, (list, dict)):
            return json.dumps(v)
        return v

    class Config:
        from_attributes = True


class CommentBase(BaseModel):
    contenido: str


class CommentCreate(CommentBase):
    workflow_state_id: Optional[int] = None


class CommentResponse(CommentBase):
    id: int
    payment_request_id: int
    workflow_state_id: Optional[int] = None
    usuario_id: int
    area: str
    created_at: Optional[datetime] = None
    documentos: List["DocumentResponse"] = []
    usuario: Optional["UserResponse"] = None

    class Config:
        from_attributes = True


class WorkflowStateDetail(WorkflowStateResponse):
    comentarios: List[CommentResponse] = []


def rebuild_workflow_schemas():
    """Rebuild workflow schemas after all dependencies are loaded."""
    from app.schemas.payment import DocumentResponse
    from app.schemas.user import UserResponse

    # Rebuild with actual types
    CommentResponse.model_rebuild()
    WorkflowStateDetail.model_rebuild()
