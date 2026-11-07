"""Admin-only endpoints: platform stats, users, jobs and applications."""

from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.database import get_db
from app.models.enums import ApplicationStatus, JobStatus, Role, UserStatus
from app.models.user import User
from app.schemas.application import (
    AdminStats,
    ApplicationOut,
    ApplicationStatusUpdate,
)
from app.schemas.auth import AdminUserOut, AdminUserUpdate
from app.schemas.candidate import CandidateProfileOut, CandidateProfileUpdate
from app.schemas.common import MessageResponse
from app.schemas.job import JobOut, JobStatusUpdate
from app.services import application_service, candidate_service, job_service, stats_service

router = APIRouter(prefix="/admin", tags=["Admin"])

AdminUser = Annotated[
    User,
    Depends(require_roles(Role.ADMIN, action_description="use the admin dashboard")),
]


@router.get("/stats", response_model=AdminStats, summary="Platform statistics")
def stats(_: AdminUser, db: Session = Depends(get_db)) -> AdminStats:
    return stats_service.admin_stats(db)


@router.get("/users", response_model=list[AdminUserOut], summary="List and search users")
def list_users(
    _: AdminUser,
    role: Optional[Role] = None,
    status_filter: Optional[UserStatus] = Query(default=None, alias="status"),
    q: Optional[str] = Query(default=None, max_length=200),
    db: Session = Depends(get_db),
) -> list[AdminUserOut]:
    return stats_service.list_admin_users(
        db, role=role, status_filter=status_filter, q=q
    )


@router.patch(
    "/users/{user_id}/status",
    response_model=AdminUserOut,
    summary="Activate or disable a user",
)
def update_user_status(
    user_id: int,
    payload: AdminUserUpdate,
    admin: AdminUser,
    db: Session = Depends(get_db),
) -> AdminUserOut:
    return stats_service.update_user_status(db, admin, user_id, payload.status)


@router.get(
    "/candidates/{user_id}/profile",
    response_model=CandidateProfileOut,
    summary="View any candidate profile",
)
def get_candidate_profile(
    user_id: int, admin: AdminUser, db: Session = Depends(get_db)
) -> CandidateProfileOut:
    return candidate_service.get_profile_by_user_id(db, admin, user_id)


@router.put(
    "/candidates/{user_id}/profile",
    response_model=CandidateProfileOut,
    summary="Edit any candidate profile",
)
def update_candidate_profile(
    user_id: int,
    payload: CandidateProfileUpdate,
    admin: AdminUser,
    db: Session = Depends(get_db),
) -> CandidateProfileOut:
    return candidate_service.update_profile_by_user_id(db, admin, user_id, payload)


@router.delete(
    "/users/{user_id}", response_model=MessageResponse, summary="Delete a user"
)
def delete_user(
    user_id: int, admin: AdminUser, db: Session = Depends(get_db)
) -> MessageResponse:
    stats_service.delete_user(db, admin, user_id)
    return MessageResponse(message="User deleted successfully.")


@router.get("/jobs", response_model=list[JobOut], summary="List all jobs")
def list_jobs(
    _: AdminUser,
    status_filter: Optional[JobStatus] = Query(default=None, alias="status"),
    q: Optional[str] = Query(default=None, max_length=200),
    db: Session = Depends(get_db),
) -> list[JobOut]:
    return job_service.list_admin_jobs(db, status_filter=status_filter, q=q)


@router.patch(
    "/jobs/{job_id}/status",
    response_model=JobOut,
    summary="Close, publish or reopen any job",
)
def change_job_status(
    job_id: int,
    payload: JobStatusUpdate,
    admin: AdminUser,
    db: Session = Depends(get_db),
) -> JobOut:
    return job_service.change_job_status(db, admin, job_id, payload.status)


@router.delete(
    "/jobs/{job_id}", response_model=MessageResponse, summary="Delete any job"
)
def delete_job(
    job_id: int, admin: AdminUser, db: Session = Depends(get_db)
) -> MessageResponse:
    job_service.delete_job(db, admin, job_id)
    return MessageResponse(message="Job deleted successfully.")


@router.get(
    "/applications",
    response_model=list[ApplicationOut],
    summary="List all applications",
)
def list_applications(
    _: AdminUser,
    status_filter: Optional[ApplicationStatus] = Query(default=None, alias="status"),
    q: Optional[str] = Query(default=None, max_length=200),
    db: Session = Depends(get_db),
) -> list[ApplicationOut]:
    return application_service.list_all_applications(
        db, status_filter=status_filter, q=q
    )


@router.patch(
    "/applications/{application_id}/status",
    response_model=ApplicationOut,
    summary="Change any application's status",
)
def update_application_status(
    application_id: int,
    payload: ApplicationStatusUpdate,
    admin: AdminUser,
    db: Session = Depends(get_db),
) -> ApplicationOut:
    return application_service.update_application_status(
        db, admin, application_id, payload.status, payload.note
    )
