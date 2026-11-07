"""Application submission, tracking and status workflow services."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.application import Application, ApplicationStatusHistory
from app.models.enums import ApplicationStatus
from app.models.job import Job
from app.models.user import User
from app.schemas.application import ApplicationCreate, ApplicationOut, ApplicationWithdrawRequest
from app.services import rules
from app.services.mappers import application_out


def _application_options():
    return (
        selectinload(Application.job).selectinload(Job.company),
        selectinload(Application.job).selectinload(Job.recruiter),
        selectinload(Application.candidate).selectinload(User.candidate_profile),
        selectinload(Application.history),
    )


def _load_application(db: Session, application_id: int) -> Application:
    application = db.scalar(
        select(Application)
        .where(Application.id == application_id)
        .options(*_application_options())
    )
    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with id {application_id} was not found.",
        )
    return application


def apply_to_job(
    db: Session, candidate: User, job_id: int, payload: ApplicationCreate
) -> ApplicationOut:
    job = db.scalar(
        select(Job)
        .where(Job.id == job_id)
        .options(selectinload(Job.company), selectinload(Job.recruiter))
    )
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job with id {job_id} was not found.",
        )

    rules.ensure_job_is_accepting_applications(job)

    existing = db.scalar(
        select(Application).where(
            Application.job_id == job_id, Application.candidate_id == candidate.id
        )
    )
    rules.ensure_candidate_has_not_applied(existing)

    cover_letter = (payload.cover_letter or "").strip() or None
    application = Application(
        job_id=job_id,
        candidate_id=candidate.id,
        status=ApplicationStatus.APPLIED,
        cover_letter=cover_letter,
    )
    application.history.append(
        ApplicationStatusHistory(
            from_status=None,
            to_status=ApplicationStatus.APPLIED,
            changed_by_id=candidate.id,
            changed_by_name=candidate.full_name,
            note="Application submitted.",
        )
    )
    db.add(application)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.scalar(
            select(Application).where(
                Application.job_id == job_id, Application.candidate_id == candidate.id
            )
        )
        rules.ensure_candidate_has_not_applied(existing)
        raise

    return application_out(_load_application(db, application.id))


def get_application(db: Session, user: User, application_id: int) -> ApplicationOut:
    application = _load_application(db, application_id)
    rules.ensure_can_view_application(user, application)
    return application_out(application)


def list_my_applications(db: Session, candidate: User) -> list[ApplicationOut]:
    applications = (
        db.scalars(
            select(Application)
            .where(Application.candidate_id == candidate.id)
            .options(*_application_options())
            .order_by(Application.updated_at.desc(), Application.id.desc())
        )
        .unique()
        .all()
    )
    return [application_out(application) for application in applications]


def list_job_applications(
    db: Session,
    actor: User,
    job_id: int,
    *,
    status_filter: ApplicationStatus | None = None,
) -> list[ApplicationOut]:
    job = db.scalar(
        select(Job)
        .where(Job.id == job_id)
        .options(selectinload(Job.company), selectinload(Job.recruiter))
    )
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job with id {job_id} was not found.",
        )
    rules.ensure_can_manage_job_applications(actor, job)

    conditions = [Application.job_id == job_id]
    if status_filter is not None:
        conditions.append(Application.status == status_filter)

    applications = (
        db.scalars(
            select(Application)
            .where(*conditions)
            .options(*_application_options())
            .order_by(Application.created_at.desc(), Application.id.desc())
        )
        .unique()
        .all()
    )
    return [application_out(application) for application in applications]


def update_application_status(
    db: Session,
    actor: User,
    application_id: int,
    target: ApplicationStatus,
    note: str | None = None,
) -> ApplicationOut:
    application = _load_application(db, application_id)
    rules.ensure_can_manage_job_applications(actor, application.job)
    rules.ensure_application_status_transition_allowed(application.status, target)

    previous = application.status
    application.status = target
    application.history.append(
        ApplicationStatusHistory(
            from_status=previous,
            to_status=target,
            changed_by_id=actor.id,
            changed_by_name=actor.full_name,
            note=(note or "").strip() or f"Status changed from {previous.value} to {target.value}.",
        )
    )
    db.commit()
    return application_out(_load_application(db, application_id))


def withdraw_application(
    db: Session,
    candidate: User,
    application_id: int,
    payload: ApplicationWithdrawRequest,
) -> ApplicationOut:
    application = _load_application(db, application_id)
    rules.ensure_application_owner_or_admin(candidate, application)
    rules.ensure_application_can_be_withdrawn(application)
    rules.ensure_application_status_transition_allowed(
        application.status, ApplicationStatus.WITHDRAWN
    )

    previous = application.status
    application.status = ApplicationStatus.WITHDRAWN
    application.history.append(
        ApplicationStatusHistory(
            from_status=previous,
            to_status=ApplicationStatus.WITHDRAWN,
            changed_by_id=candidate.id,
            changed_by_name=candidate.full_name,
            note=(payload.note or "").strip() or "Application withdrawn by candidate.",
        )
    )
    db.commit()
    return application_out(_load_application(db, application_id))


def list_all_applications(
    db: Session,
    *,
    status_filter: ApplicationStatus | None = None,
    q: str | None = None,
) -> list[ApplicationOut]:
    conditions = []
    if status_filter is not None:
        conditions.append(Application.status == status_filter)
    stmt = (
        select(Application)
        .join(Job, Job.id == Application.job_id)
        .join(User, User.id == Application.candidate_id)
    )
    if q:
        term = f"%{q.strip()}%"
        conditions.append(
            or_(
                User.full_name.ilike(term),
                User.email.ilike(term),
                Job.title.ilike(term),
            )
        )
    applications = (
        db.scalars(
            stmt.where(*conditions)
            .options(*_application_options())
            .order_by(Application.created_at.desc(), Application.id.desc())
            .limit(300)
        )
        .unique()
        .all()
    )
    return [application_out(application) for application in applications]
