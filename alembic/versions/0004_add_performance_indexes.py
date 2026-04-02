"""Add database indexes for performance optimization

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-02

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Indexes for workflow_states
    op.create_index(
        "ix_workflow_states_payment_area",
        "workflow_states",
        ["payment_request_id", "area"],
        unique=False,
    )
    op.create_index(
        "ix_workflow_states_estado_area",
        "workflow_states",
        ["estado", "area"],
        unique=False,
    )

    # Index for comments
    op.create_index(
        "ix_comments_payment_id",
        "comments",
        ["payment_request_id"],
        unique=False,
    )

    # Index for payment_requests
    op.create_index(
        "ix_payment_requests_creadora_id",
        "payment_requests",
        ["creadora_id"],
        unique=False,
    )
    op.create_index(
        "ix_payment_requests_estado",
        "payment_requests",
        ["estado_general"],
        unique=False,
    )

    # Index for documents
    op.create_index(
        "ix_documents_payment_id",
        "documents",
        ["payment_request_id"],
        unique=False,
    )


    # Convert TEXT to JSONB for better performance
    op.execute("""
        ALTER TABLE workflow_configs 
        ALTER COLUMN flujo_json 
        TYPE JSONB 
        USING flujo_json::JSONB
    """)


def downgrade() -> None:
    # Drop indexes
    op.drop_index("ix_workflow_states_payment_area", table_name="workflow_states")
    op.drop_index("ix_workflow_states_estado_area", table_name="workflow_states")
    op.drop_index("ix_comments_payment_id", table_name="comments")
    op.drop_index("ix_payment_requests_creadora_id", table_name="payment_requests")
    op.drop_index("ix_payment_requests_estado", table_name="payment_requests")
    op.drop_index("ix_documents_payment_id", table_name="documents")

    # Revert JSONB to TEXT
    op.execute("""
        ALTER TABLE workflow_configs 
        ALTER COLUMN flujo_json 
        TYPE TEXT
    """)
