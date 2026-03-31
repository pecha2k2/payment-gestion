"""Add tipo_pago to workflow_configs

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "workflow_configs",
        sa.Column("tipo_pago", sa.String(20), nullable=True),
    )
    # Backfill existing rows by name convention
    op.execute("""
        UPDATE workflow_configs
        SET tipo_pago = 'CON_FACTURA'
        WHERE tipo_pago IS NULL AND (
            nombre ILIKE '%con factura%' OR nombre ILIKE '%con_factura%'
        )
    """)
    op.execute("""
        UPDATE workflow_configs
        SET tipo_pago = 'SIN_FACTURA'
        WHERE tipo_pago IS NULL AND (
            nombre ILIKE '%sin factura%' OR nombre ILIKE '%sin_factura%'
        )
    """)


def downgrade() -> None:
    op.drop_column("workflow_configs", "tipo_pago")
