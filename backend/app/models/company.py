"""Recruiter-owned company profile."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.common import utcnow

if TYPE_CHECKING:
    from app.models.job import Job
    from app.models.user import User


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    industry: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    company_size: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    owner: Mapped["User"] = relationship(back_populates="company")
    jobs: Mapped[list["Job"]] = relationship(
        back_populates="company", cascade="all, delete-orphan"
    )

    @property
    def jobs_count(self) -> int:
        return len(self.jobs)
