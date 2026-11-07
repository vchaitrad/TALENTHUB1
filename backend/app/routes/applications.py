"""Candidate application submission, detail and withdrawal endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.database import get_db
from app.models.enums import Role
from app.models.user import User
from app.schemas.application import (
    ApplicationCreate,
    ApplicationOut,
    ApplicationWithdrawRequest,
)
from app.services import application_service

router = APIRouter(tags=["Applications"])

CandidateUser = Annotated[
    User,
    Depends(require_roles(Role.CANDIDATE, action_description="apply to jobs")),
]


@router.post(
    "/jobs/{job_id}/applications",
    response_model=ApplicationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Apply to a job (candidate)",
)
def apply(
    job_id: int,
    payload: ApplicationCreate,
    user: CandidateUser,
    db: Session = Depends(get_db),
) -> ApplicationOut:
    return application_service.apply_to_job(db, user, job_id, payload)


@router.get(
    "/applications/{application_id}",
    response_model=ApplicationOut,
    summary="Get one application (candidate, job owner or admin)",
)
def get_application(
    application_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApplicationOut:
    return application_service.get_application(db, user, application_id)


@router.post(
    "/applications/{application_id}/withdraw",
    response_model=ApplicationOut,
    summary="Withdraw my application (candidate)",
)
def withdraw(
    application_id: int,
    payload: ApplicationWithdrawRequest,
    user: CandidateUser,
    db: Session = Depends(get_db),
) -> ApplicationOut:
    return application_service.withdraw_application(db, user, application_id, payload)
