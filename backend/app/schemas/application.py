"""Application schemas and role dashboard summaries."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import ApplicationStatus
from app.schemas.candidate import CandidatePublic
from app.schemas.company import CompanyOut
from app.schemas.job import JobSummary


class ApplicationCreate(BaseModel):
    cover_letter: Optional[str] = Field(default=None, max_length=5000)


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus
    note: Optional[str] = Field(default=None, max_length=2000)


class ApplicationWithdrawRequest(BaseModel):
    note: Optional[str] = Field(default=None, max_length=2000)


class ApplicationHistoryOut(BaseModel):
    id: int
    from_status: Optional[ApplicationStatus]
    to_status: ApplicationStatus
    changed_by_name: Optional[str]
    note: Optional[str]
    created_at: datetime


class ApplicationOut(BaseModel):
    id: int
    status: ApplicationStatus
    cover_letter: Optional[str]
    created_at: datetime
    updated_at: datetime
    job: JobSummary
    candidate: CandidatePublic
    history: list[ApplicationHistoryOut] = Field(default_factory=list)


class CandidateSummary(BaseModel):
    applications_total: int
    active_applications: int
    by_status: dict[str, int]
    profile_completion: int
    resume_uploaded: bool


class RecruiterSummary(BaseModel):
    jobs_total: int
    open_jobs: int
    total_applicants: int
    by_status: dict[str, int]
    company: Optional[CompanyOut] = None


class AdminStats(BaseModel):
    users_total: int
    users_by_role: dict[str, int]
    jobs_total: int
    jobs_by_status: dict[str, int]
    applications_total: int
    applications_by_status: dict[str, int]
