"""Dashboard summaries and admin management services."""

from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import get_or_404
from app.models.application import Application
from app.models.enums import ApplicationStatus, JobStatus, Role, UserStatus
from app.models.job import Job
from app.models.user import User
from app.schemas.application import AdminStats, RecruiterSummary
from app.schemas.auth import AdminUserOut, UserOut
from app.schemas.company import CompanyOut
from app.services import rules


def recruiter_summary(db: Session, recruiter: User) -> RecruiterSummary:
    jobs_total = (
        db.scalar(select(func.count(Job.id)).where(Job.recruiter_id == recruiter.id)) or 0
    )
    open_jobs = (
        db.scalar(
            select(func.count(Job.id)).where(
                Job.recruiter_id == recruiter.id, Job.status == JobStatus.OPEN
            )
        )
        or 0
    )

    rows = db.execute(
        select(Application.status, func.count(Application.id))
        .join(Job, Job.id == Application.job_id)
        .where(Job.recruiter_id == recruiter.id)
        .group_by(Application.status)
    ).all()
    by_status = {status_.value: 0 for status_ in ApplicationStatus}
    for app_status, count in rows:
        by_status[app_status.value] = count

    company = CompanyOut.model_validate(recruiter.company) if recruiter.company else None
    return RecruiterSummary(
        jobs_total=jobs_total,
        open_jobs=open_jobs,
        total_applicants=sum(by_status.values()),
        by_status=by_status,
        company=company,
    )


def admin_stats(db: Session) -> AdminStats:
    user_rows = db.execute(
        select(User.role, func.count(User.id)).group_by(User.role)
    ).all()
    users_by_role = {role.value: 0 for role in Role}
    for role, count in user_rows:
        users_by_role[role.value] = count

    job_rows = db.execute(select(Job.status, func.count(Job.id)).group_by(Job.status)).all()
    jobs_by_status = {status_.value: 0 for status_ in JobStatus}
    for job_status, count in job_rows:
        jobs_by_status[job_status.value] = count

    app_rows = db.execute(
        select(Application.status, func.count(Application.id)).group_by(Application.status)
    ).all()
    applications_by_status = {status_.value: 0 for status_ in ApplicationStatus}
    for app_status, count in app_rows:
        applications_by_status[app_status.value] = count

    return AdminStats(
        users_total=sum(users_by_role.values()),
        users_by_role=users_by_role,
        jobs_total=sum(jobs_by_status.values()),
        jobs_by_status=jobs_by_status,
        applications_total=sum(applications_by_status.values()),
        applications_by_status=applications_by_status,
    )


def list_admin_users(
    db: Session,
    *,
    role: Role | None = None,
    status_filter: UserStatus | None = None,
    q: str | None = None,
) -> list[AdminUserOut]:
    conditions = []
    if role is not None:
        conditions.append(User.role == role)
    if status_filter is not None:
        conditions.append(User.status == status_filter)
    if q:
        term = f"%{q.strip()}%"
        conditions.append(or_(User.full_name.ilike(term), User.email.ilike(term)))

    users = (
        db.scalars(
            select(User)
            .where(*conditions)
            .options(selectinload(User.applications), selectinload(User.jobs))
            .order_by(User.created_at.desc(), User.id.desc())
        )
        .unique()
        .all()
    )
    result: list[AdminUserOut] = []
    for user in users:
        base = UserOut.model_validate(user).model_dump()
        result.append(
            AdminUserOut(
                **base,
                applications_count=len(user.applications),
                jobs_count=len(user.jobs),
            )
        )
    return result


def update_user_status(
    db: Session, admin: User, user_id: int, new_status: UserStatus
) -> AdminUserOut:
    target = get_or_404(db, User, user_id, "User")
    if new_status == UserStatus.DISABLED:
        rules.ensure_user_cannot_disable_self(admin, target.id)
    target.status = new_status
    db.commit()
    db.refresh(target)
    base = UserOut.model_validate(target).model_dump()
    return AdminUserOut(
        **base,
        applications_count=len(target.applications),
        jobs_count=len(target.jobs),
    )


def delete_user(db: Session, admin: User, user_id: int) -> None:
    target = get_or_404(db, User, user_id, "User")
    rules.ensure_user_cannot_delete_self(admin, target.id)
    db.delete(target)
    db.commit()
