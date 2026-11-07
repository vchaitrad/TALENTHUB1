"""Small helpers shared by the ORM models."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Enum as SAEnum


def enum_type(enum_cls: type[Enum], length: int = 32) -> SAEnum:
    """Store enum *values* (lowercase strings) instead of member names."""
    return SAEnum(
        enum_cls,
        native_enum=False,
        values_callable=lambda members: [member.value for member in members],
        validate_strings=True,
        length=length,
    )


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
