"""Drop ck_payment_requests_monto_positive constraint

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-02

"""

from typing import Sequence, Union

from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE payment_requests DROP CONSTRAINT IF EXISTS ck_payment_requests_monto_positive"
    )


def downgrade() -> None:
    pass
