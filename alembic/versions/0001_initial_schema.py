"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2026-03-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(50), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(100), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "admin", "demandante", "validador", "aprobador",
                "contador", "sap", "pagador",
                name="userrole",
            ),
            nullable=False,
        ),
        sa.Column("area", sa.String(100), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.create_table(
        "workflow_configs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("es_default", sa.Boolean(), nullable=True),
        sa.Column("flujo_json", sa.Text(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workflow_configs_id", "workflow_configs", ["id"])

    op.create_table(
        "payment_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("numero_peticion", sa.String(20), nullable=False),
        sa.Column("propuesta_gasto", sa.Integer(), nullable=False),
        sa.Column("orden_pago", sa.String(100), nullable=True),
        sa.Column("numero_factura", sa.String(100), nullable=True),
        sa.Column("n_documento_contable", sa.String(100), nullable=True),
        sa.Column("fecha_pago", sa.Date(), nullable=True),
        sa.Column(
            "tipo_pago",
            sa.Enum("CON_FACTURA", "SIN_FACTURA", name="tipopago"),
            nullable=False,
        ),
        sa.Column(
            "medio_pago",
            sa.Enum("TRANSFERENCIA", "TARJETA", name="mediopago"),
            nullable=True,
        ),
        sa.Column(
            "estado_general",
            sa.Enum("ABIERTA", "EN_PROCESO", "COMPLETADA", "CANCELADA", name="estadogeneral"),
            nullable=False,
        ),
        sa.Column("monto_total", sa.Numeric(15, 2), nullable=True),
        sa.Column(
            "divisa",
            sa.Enum("EUR", "USD", "GBP", "CHF", "JPY", "CNY", name="divisa"),
            nullable=False,
            server_default="EUR",
        ),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("banco", sa.String(200), nullable=True),
        sa.Column("creadora_id", sa.Integer(), nullable=False),
        sa.Column("workflow_config_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["creadora_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["workflow_config_id"], ["workflow_configs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payment_requests_id", "payment_requests", ["id"])
    op.create_index("ix_payment_requests_numero_peticion", "payment_requests", ["numero_peticion"], unique=True)
    op.create_index("ix_payment_requests_propuesta_gasto", "payment_requests", ["propuesta_gasto"])
    op.create_index("ix_payment_requests_orden_pago", "payment_requests", ["orden_pago"])
    op.create_index("ix_payment_requests_numero_factura", "payment_requests", ["numero_factura"])
    op.create_index("ix_payment_requests_n_documento_contable", "payment_requests", ["n_documento_contable"])

    op.create_table(
        "workflow_states",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("payment_request_id", sa.Integer(), nullable=False),
        sa.Column(
            "area",
            sa.Enum(
                "demandante", "validadora", "aprobadora",
                "contabilidad", "sap", "pagadora",
                name="area",
            ),
            nullable=False,
        ),
        sa.Column(
            "estado",
            sa.Enum(
                "PENDIENTE", "EN_PROCESO", "APROBADO", "RECHAZADO", "REVERSADO",
                name="workflowestado",
            ),
            nullable=False,
        ),
        sa.Column("usuario_asignado_id", sa.Integer(), nullable=True),
        sa.Column("usuario_completo_id", sa.Integer(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["payment_request_id"], ["payment_requests.id"]),
        sa.ForeignKeyConstraint(["usuario_asignado_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["usuario_completo_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workflow_states_id", "workflow_states", ["id"])

    op.create_table(
        "comments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("payment_request_id", sa.Integer(), nullable=False),
        sa.Column("workflow_state_id", sa.Integer(), nullable=True),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("area", sa.String(50), nullable=True),
        sa.Column("contenido", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["payment_request_id"], ["payment_requests.id"]),
        sa.ForeignKeyConstraint(["workflow_state_id"], ["workflow_states.id"]),
        sa.ForeignKeyConstraint(["usuario_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_comments_id", "comments", ["id"])

    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("payment_request_id", sa.Integer(), nullable=False),
        sa.Column(
            "tipo",
            sa.Enum(
                "peticion", "presupuesto", "factura",
                "documento_contable", "otro",
                name="documentotipo",
            ),
            nullable=False,
        ),
        sa.Column("nombre_original", sa.String(255), nullable=False),
        sa.Column("ruta_storage", sa.String(500), nullable=False),
        sa.Column("hash_sha256", sa.String(64), nullable=True),
        sa.Column("tamano_bytes", sa.Integer(), nullable=True),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("uploaded_by_id", sa.Integer(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(), nullable=True),
        sa.Column("n_documento_contable", sa.String(100), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("comment_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["comment_id"], ["comments.id"]),
        sa.ForeignKeyConstraint(["payment_request_id"], ["payment_requests.id"]),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_documents_id", "documents", ["id"])


def downgrade() -> None:
    op.drop_table("documents")
    op.drop_table("comments")
    op.drop_table("workflow_states")
    op.drop_table("payment_requests")
    op.drop_table("workflow_configs")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS documentotipo")
    op.execute("DROP TYPE IF EXISTS area")
    op.execute("DROP TYPE IF EXISTS workflowestado")
    op.execute("DROP TYPE IF EXISTS divisa")
    op.execute("DROP TYPE IF EXISTS estadogeneral")
    op.execute("DROP TYPE IF EXISTS mediopago")
    op.execute("DROP TYPE IF EXISTS tipopago")
    op.execute("DROP TYPE IF EXISTS userrole")
