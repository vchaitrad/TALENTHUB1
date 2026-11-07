"""Job applications and their immutable status-change history."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.common import enum_type, utcnow
from app.models.enums import ApplicationStatus

if TYPE_CHECKING:
    from app.models.job import Job
    from app.models.user import User


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        UniqueConstraint("job_id", "candidate_id", name="uq_application_job_candidate"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    job_id: Mapped[int] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[ApplicationStatus] = mapped_column(
        enum_type(ApplicationStatus),
        nullable=False,
        default=ApplicationStatus.APPLIED,
        index=True,
    )
    cover_letter: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    job: Mapped["Job"] = relationship(back_populates="applications")
    candidate: Mapped["User"] = relationship(
        back_populates="applications", foreign_keys=[candidate_id]
    )
    history: Mapped[list["ApplicationStatusHistory"]] = relationship(
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="ApplicationStatusHistory.created_at",
    )


class ApplicationStatusHistory(Base):
    __tablename__ = "application_status_history"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_status: Mapped[Optional[ApplicationStatus]] = mapped_column(
        enum_type(ApplicationStatus), nullable=True
    )
    to_status: Mapped[ApplicationStatus] = mapped_column(
        enum_type(ApplicationStatus), nullable=False
    )
    changed_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    changed_by_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    application: Mapped["Application"] = relationship(back_populates="history")
