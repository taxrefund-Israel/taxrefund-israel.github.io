"""Cross-dialect column types.

Lets the same models run on PostgreSQL (production, on the office server) and on
SQLite (zero-install local preview). On PostgreSQL we still get native UUID and
JSONB; on SQLite they degrade to portable CHAR/JSON automatically.
"""
from sqlalchemy import Uuid, JSON, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB

# UUID: native on PG, CHAR(32) on SQLite — handled by SQLAlchemy's Uuid type.
GUID = Uuid

# JSON: JSONB on PG, generic JSON elsewhere.
JSONType = JSON().with_variant(JSONB, "postgresql")


def PortableEnum(*args, **kwargs):
    """Enum stored as VARCHAR + CHECK — portable across PostgreSQL and SQLite."""
    kwargs.setdefault("native_enum", False)
    kwargs.setdefault("validate_strings", True)
    return SAEnum(*args, **kwargs)
