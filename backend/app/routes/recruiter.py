"""Recruiter-only endpoints: company, jobs and applicant management."""

from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.database import get_db
from app.models.enums import ApplicationStatus, JobStatus, Role
from app.models.user import User
from app.schemas.application import (
    ApplicationOut,
    ApplicationStatusUpdate,
    RecruiterSummary,
)
from app.schemas.common import MessageResponse
from app.schemas.company import CompanyOut, CompanyUpdate
from app.schemas.job import JobCreate, JobOut, JobStatusUpdate, JobUpdate
from app.services import (
    application_service,
    company_service,
    job_service,
    stats_service,
)

router = APIRouter(prefix="/recruiter", tags=["Recruiter"])

RecruiterUser = Annotated[
    User,
    Depends(require_roles(Role.RECRUITER, action_description="use the recruiter dashboard")),
]


@router.get("/summary", response_model=RecruiterSummary, summary="Recruiter dashboard summary")
def summary(user: RecruiterUser, db: Session = Depends(get_db)) -> RecruiterSummary:
    return stats_service.recruiter_summary(db, user)


@router.get("/company", response_model=Optional[CompanyOut], summary="Get my company profile")
def get_company(user: RecruiterUser) -> Optional[CompanyOut]:
    return company_service.get_company(user)


@router.put(
    "/company",
    response_model=CompanyOut,
    summary="Create or update my company profile",
)
def upsert_company(
    payload: CompanyUpdate,
    user: RecruiterUser,
    db: Session = Depends(get_db),
) -> CompanyOut:
    return company_service.upsert_company(db, user, payload)


@router.get("/jobs", response_model=list[JobOut], summary="List my jobs")
def list_jobs(
    user: RecruiterUser,
    status_filter: Optional[JobStatus] = Query(default=None, alias="status"),
    q: Optional[str] = Query(default=None, max_length=200),
    db: Session = Depends(get_db),
) -> list[JobOut]:
    return job_service.list_recruiter_jobs(db, user, status_filter=status_filter, q=q)


@router.post(
    "/jobs",
    response_model=JobOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a job (draft or open)",
)
def create_job(
    payload: JobCreate,
    user: RecruiterUser,
    db: Session = Depends(get_db),
) -> JobOut:
    return job_service.create_job(db, user, payload)


@router.get("/jobs/{job_id}", response_model=JobOut, summary="Get one of my jobs")
def get_job(
    job_id: int, user: RecruiterUser, db: Session = Depends(get_db)
) -> JobOut:
    return job_service.get_job_for_recruiter(db, user, job_id)


@router.put("/jobs/{job_id}", response_model=JobOut, summary="Edit my job")
def update_job(
    job_id: int,
    payload: JobUpdate,
    user: RecruiterUser,
    db: Session = Depends(get_db),
) -> JobOut:
    return job_service.update_job(db, user, job_id, payload)


@router.patch(
    "/jobs/{job_id}/status",
    response_model=JobOut,
    summary="Publish, close or reopen my job",
)
def change_job_status(
    job_id: int,
    payload: JobStatusUpdate,
    user: RecruiterUser,
    db: Session = Depends(get_db),
) -> JobOut:
    return job_service.change_job_status(db, user, job_id, payload.status)


@router.delete(
    "/jobs/{job_id}", response_model=MessageResponse, summary="Delete my job"
)
def delete_job(
    job_id: int, user: RecruiterUser, db: Session = Depends(get_db)
) -> MessageResponse:
    job_service.delete_job(db, user, job_id)
    return MessageResponse(message="Job deleted successfully.")


@router.get(
    "/jobs/{job_id}/applications",
    response_model=list[ApplicationOut],
    summary="View applicants for my job",
)
def job_applications(
    job_id: int,
    user: RecruiterUser,
    status_filter: Optional[ApplicationStatus] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> list[ApplicationOut]:
    return application_service.list_job_applications(
        db, user, job_id, status_filter=status_filter
    )


@router.patch(
    "/applications/{application_id}/status",
    response_model=ApplicationOut,
    summary="Move an applicant through the hiring pipeline",
)
def update_application_status(
    application_id: int,
    payload: ApplicationStatusUpdate,
    user: RecruiterUser,
    db: Session = Depends(get_db),
) -> ApplicationOut:
    return application_service.update_application_status(
        db, user, application_id, payload.status, payload.note
    )
