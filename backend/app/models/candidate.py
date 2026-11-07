"""Candidate profile, including structured education/experience and resume."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.common import utcnow

if TYPE_CHECKING:
    from app.models.user import User


class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    headline: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    portfolio_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # JSON columns keep the demo SQLite-friendly. They become JSONB on Postgres.
    skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    education: Mapped[list[dict]] = mapped_column(JSON, default=list, nullable=False)
    experience: Mapped[list[dict]] = mapped_column(JSON, default=list, nullable=False)

    resume_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    resume_stored_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    resume_uploaded_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    user: Mapped["User"] = relationship(back_populates="candidate_profile")

    @property
    def has_resume(self) -> bool:
        return bool(self.resume_stored_name)
