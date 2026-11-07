"""Shared errors.

A RuleViolation is raised only by app.services.rules (or helpers that represent
a business rule). main.py converts it into a predictable JSON response:

    {"detail": "<human readable message>", "rule": "<rule_name>"}
"""

from __future__ import annotations

from typing import TypeVar

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

T = TypeVar("T")


class RuleViolation(Exception):
    def __init__(self, rule: str, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.rule = rule
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def get_or_404(db: Session, model: type[T], object_id: int, label: str) -> T:
    """Fetch a row or raise a friendly 404. Not a business rule."""
    obj = db.get(model, object_id)
    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{label} with id {object_id} was not found.",
        )
    return obj
