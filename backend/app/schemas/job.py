"""Job posting schemas."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.config import settings
from app.models.enums import EmploymentType, JobStatus
from app.schemas.auth import UserBrief
from app.schemas.company import CompanyBrief


class JobCreate(BaseModel):
    title: str = Field(
        min_length=settings.MIN_JOB_TITLE_LENGTH,
        max_length=settings.MAX_JOB_TITLE_LENGTH,
    )
    description: str = Field(
        min_length=settings.MIN_JOB_DESCRIPTION_LENGTH,
        max_length=settings.MAX_JOB_DESCRIPTION_LENGTH,
    )
    location: str = Field(min_length=2, max_length=160)
    employment_type: EmploymentType = EmploymentType.FULL_TIME
    experience_level: str = Field(default="Mid-level", min_length=1, max_length=60)
    salary_min: Optional[int] = Field(default=None, ge=0, le=10_000_000)
    salary_max: Optional[int] = Field(default=None, ge=0, le=10_000_000)
    skills_required: list[str] = Field(
        default_factory=list, max_length=settings.MAX_SKILLS_PER_JOB
    )
    openings: int = Field(default=1, ge=1, le=settings.MAX_JOB_OPENINGS)
    deadline: date
    status: JobStatus = JobStatus.OPEN


class JobUpdate(BaseModel):
    title: Optional[str] = Field(
        default=None,
        min_length=settings.MIN_JOB_TITLE_LENGTH,
        max_length=settings.MAX_JOB_TITLE_LENGTH,
    )
    description: Optional[str] = Field(
        default=None,
        min_length=settings.MIN_JOB_DESCRIPTION_LENGTH,
        max_length=settings.MAX_JOB_DESCRIPTION_LENGTH,
    )
    location: Optional[str] = Field(default=None, min_length=2, max_length=160)
    employment_type: Optional[EmploymentType] = None
    experience_level: Optional[str] = Field(default=None, min_length=1, max_length=60)
    salary_min: Optional[int] = Field(default=None, ge=0, le=10_000_000)
    salary_max: Optional[int] = Field(default=None, ge=0, le=10_000_000)
    skills_required: Optional[list[str]] = Field(
        default=None, max_length=settings.MAX_SKILLS_PER_JOB
    )
    openings: Optional[int] = Field(default=None, ge=1, le=settings.MAX_JOB_OPENINGS)
    deadline: Optional[date] = None


class JobStatusUpdate(BaseModel):
    status: JobStatus


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    location: str
    employment_type: EmploymentType
    experience_level: str
    salary_min: Optional[int]
    salary_max: Optional[int]
    skills_required: list[str]
    openings: int
    deadline: date
    status: JobStatus
    is_expired: bool
    is_accepting_applications: bool
    application_count: int
    company: CompanyBrief
    recruiter: UserBrief
    created_at: datetime
    updated_at: datetime


class JobSummary(BaseModel):
    id: int
    title: str
    company_name: str
    location: str
    employment_type: EmploymentType
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    deadline: date
    status: JobStatus
