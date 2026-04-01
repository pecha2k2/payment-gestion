"""Fix descripcion for Flujo sin Factura workflow config

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-01

"""

from typing import Sequence, Union

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        UPDATE workflow_configs
        SET descripcion = 'Flujo para pagos sin factura (validación y contabilidad en paralelo)'
        WHERE nombre = 'Flujo sin Factura'
          AND descripcion LIKE '%aprobación y contabilidad en paralelo%'
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE workflow_configs
        SET descripcion = 'Flujo para pagos sin factura (aprobación y contabilidad en paralelo)'
        WHERE nombre = 'Flujo sin Factura'
          AND descripcion LIKE '%validación y contabilidad en paralelo%'
    """)
