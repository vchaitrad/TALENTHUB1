"""Job posting model."""

from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.common import enum_type, utcnow
from app.models.enums import EmploymentType, JobStatus

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.company import Company
    from app.models.user import User


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    recruiter_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    employment_type: Mapped[EmploymentType] = mapped_column(
        enum_type(EmploymentType), nullable=False, default=EmploymentType.FULL_TIME
    )
    experience_level: Mapped[str] = mapped_column(String(60), nullable=False, default="Mid-level")
    salary_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    salary_max: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    skills_required: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    openings: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    deadline: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[JobStatus] = mapped_column(
        enum_type(JobStatus), nullable=False, default=JobStatus.DRAFT, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    recruiter: Mapped["User"] = relationship(back_populates="jobs", foreign_keys=[recruiter_id])
    company: Mapped["Company"] = relationship(back_populates="jobs")
    applications: Mapped[list["Application"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )

    @property
    def is_expired(self) -> bool:
        return self.deadline < date.today()

    @property
    def is_accepting_applications(self) -> bool:
        return self.status == JobStatus.OPEN and not self.is_expired

    @property
    def application_count(self) -> int:
        return len(self.applications)
