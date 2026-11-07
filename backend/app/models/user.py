"""User account model and role-independent account data."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.common import enum_type, utcnow
from app.models.enums import Role, UserStatus

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.candidate import CandidateProfile
    from app.models.company import Company
    from app.models.job import Job


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[Role] = mapped_column(enum_type(Role), nullable=False, default=Role.CANDIDATE)
    status: Mapped[UserStatus] = mapped_column(
        enum_type(UserStatus), nullable=False, default=UserStatus.ACTIVE
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    candidate_profile: Mapped[Optional["CandidateProfile"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )
    company: Mapped[Optional["Company"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan", uselist=False
    )
    jobs: Mapped[list["Job"]] = relationship(
        back_populates="recruiter",
        cascade="all, delete-orphan",
        foreign_keys="Job.recruiter_id",
    )
    applications: Mapped[list["Application"]] = relationship(
        back_populates="candidate",
        cascade="all, delete-orphan",
        foreign_keys="Application.candidate_id",
    )
