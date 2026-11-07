"""Public job discovery endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import get_optional_current_user
from app.database import get_db
from app.models.enums import EmploymentType
from app.models.user import User
from app.schemas.common import Page
from app.schemas.job import JobOut
from app.services import job_service

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.get("", response_model=Page[JobOut], summary="Browse, search and filter open jobs")
def list_jobs(
    q: Optional[str] = Query(default=None, max_length=200, description="Title, description, company or skill"),
    location: Optional[str] = Query(default=None, max_length=160),
    employment_type: Optional[EmploymentType] = None,
    company: Optional[str] = Query(default=None, max_length=160),
    skills: Optional[list[str]] = Query(default=None),
    min_salary: Optional[int] = Query(default=None, ge=0),
    sort: str = Query(default="newest", pattern="^(newest|deadline|salary)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(
        default=settings.PAGE_SIZE_DEFAULT, ge=1, le=settings.PAGE_SIZE_MAX
    ),
    db: Session = Depends(get_db),
) -> Page[JobOut]:
    return job_service.list_public_jobs(
        db,
        q=q,
        location=location,
        employment_type=employment_type,
        company=company,
        skills=skills,
        min_salary=min_salary,
        sort=sort,
        page=page,
        page_size=page_size,
    )


@router.get("/{job_id}", response_model=JobOut, summary="Get a job's full details")
def get_job(
    job_id: int,
    user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> JobOut:
    return job_service.get_job_detail(db, job_id, user)
