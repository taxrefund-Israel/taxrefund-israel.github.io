"""initial schema — create all tables from metadata

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-31
"""
from typing import Sequence, Union

from alembic import op

from app.database import Base
import app.models  # noqa: F401

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)
    # Helpful indexes
    op.create_index("idx_cases_taxpayer_id", "cases", ["taxpayer_id_number"])
    op.create_index("idx_cases_tax_year", "cases", ["tax_year"])
    op.create_index("idx_cases_created_by", "cases", ["created_by"])
    op.create_index("idx_tbl_import", "trial_balance_lines", ["import_id"])
    op.create_index("idx_audit_case", "calculation_audit", ["case_id"])
    op.create_index("idx_calc_results_case", "calculation_results", ["case_id", "is_current"])


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
