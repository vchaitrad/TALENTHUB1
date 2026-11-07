"""Job listing, posting, editing and lifecycle services."""

from __future__ import annotations

from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.models.company import Company
from app.models.enums import EmploymentType, JobStatus, Role
from app.models.job import Job
from app.models.user import User
from app.schemas.common import Page
from app.schemas.job import JobCreate, JobOut, JobUpdate
from app.services import rules


def _job_options():
    return (
        selectinload(Job.company),
        selectinload(Job.recruiter),
        selectinload(Job.applications),
    )


def _load_job(db: Session, job_id: int) -> Job:
    job = db.scalar(select(Job).where(Job.id == job_id).options(*_job_options()))
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job with id {job_id} was not found.",
        )
    return job


def _clean_skills(skills: list[str]) -> list[str]:
    seen: set[str] = set()
    cleaned: list[str] = []
    for skill in skills:
        value = skill.strip()
        if value and value.lower() not in seen:
            seen.add(value.lower())
            cleaned.append(value)
    return cleaned[: settings.MAX_SKILLS_PER_JOB]


def _can_manage(user: User | None, job: Job) -> bool:
    return user is not None and (user.role == Role.ADMIN or job.recruiter_id == user.id)


def list_public_jobs(
    db: Session,
    *,
    q: str | None = None,
    location: str | None = None,
    employment_type: EmploymentType | None = None,
    company: str | None = None,
    skills: list[str] | None = None,
    min_salary: int | None = None,
    sort: str = "newest",
    page: int = 1,
    page_size: int = settings.PAGE_SIZE_DEFAULT,
) -> Page[JobOut]:
    """Browse jobs that are open and whose deadline has not passed."""
    conditions = [Job.status == JobStatus.OPEN, Job.deadline >= date.today()]

    if q:
        term = f"%{q.strip()}%"
        conditions.append(
            or_(
                Job.title.ilike(term),
                Job.description.ilike(term),
                Company.name.ilike(term),
                cast(Job.skills_required, String).ilike(term),
            )
        )
    if location:
        conditions.append(Job.location.ilike(f"%{location.strip()}%"))
    if employment_type is not None:
        conditions.append(Job.employment_type == employment_type)
    if company:
        conditions.append(Company.name.ilike(f"%{company.strip()}%"))
    for skill in skills or []:
        value = skill.strip()
        if value:
            conditions.append(cast(Job.skills_required, String).ilike(f"%{value}%"))
    if min_salary is not None:
        conditions.append(
            func.coalesce(Job.salary_max, Job.salary_min, 0) >= min_salary
        )

    base = select(Job).join(Company).where(*conditions)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0

    if sort == "deadline":
        ordering = (Job.deadline.asc(), Job.created_at.desc())
    elif sort == "salary":
        ordering = (func.coalesce(Job.salary_max, 0).desc(), Job.created_at.desc())
    else:
        ordering = (Job.created_at.desc(), Job.id.desc())

    page = max(page, 1)
    page_size = max(1, min(page_size, settings.PAGE_SIZE_MAX))
    jobs = (
        db.scalars(
            base.options(*_job_options())
            .order_by(*ordering)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .unique()
        .all()
    )

    return Page[JobOut](
        items=[JobOut.model_validate(job) for job in jobs],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total else 0,
    )


def get_job_detail(db: Session, job_id: int, user: User | None) -> JobOut:
    job = _load_job(db, job_id)
    if job.status != JobStatus.OPEN and not _can_manage(user, job):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This job is not available.",
        )
    return JobOut.model_validate(job)


def list_recruiter_jobs(
    db: Session,
    recruiter: User,
    *,
    status_filter: JobStatus | None = None,
    q: str | None = None,
) -> list[JobOut]:
    conditions = [Job.recruiter_id == recruiter.id]
    if status_filter is not None:
        conditions.append(Job.status == status_filter)
    if q:
        conditions.append(Job.title.ilike(f"%{q.strip()}%"))
    jobs = (
        db.scalars(
            select(Job)
            .where(*conditions)
            .options(*_job_options())
            .order_by(Job.updated_at.desc(), Job.id.desc())
        )
        .unique()
        .all()
    )
    return [JobOut.model_validate(job) for job in jobs]


def create_job(db: Session, recruiter: User, payload: JobCreate) -> JobOut:
    rules.ensure_recruiter_role(recruiter)
    rules.ensure_company_profile_exists(recruiter.company)
    rules.ensure_job_initial_status_allowed(payload.status)
    rules.ensure_job_salary_range(payload.salary_min, payload.salary_max)
    rules.ensure_job_openings_are_valid(payload.openings)
    if payload.status == JobStatus.OPEN:
        rules.ensure_job_deadline_is_not_in_the_past(payload.deadline)

    job = Job(
        recruiter_id=recruiter.id,
        company_id=recruiter.company.id,
        title=payload.title.strip(),
        description=payload.description.strip(),
        location=payload.location.strip(),
        employment_type=payload.employment_type,
        experience_level=payload.experience_level.strip(),
        salary_min=payload.salary_min,
        salary_max=payload.salary_max,
        skills_required=_clean_skills(payload.skills_required),
        openings=payload.openings,
        deadline=payload.deadline,
        status=payload.status,
    )
    db.add(job)
    db.commit()
    return JobOut.model_validate(_load_job(db, job.id))


def update_job(db: Session, recruiter: User, job_id: int, payload: JobUpdate) -> JobOut:
    job = _load_job(db, job_id)
    rules.ensure_job_can_be_edited(recruiter, job)

    data = payload.model_dump(exclude_unset=True)
    new_min = data["salary_min"] if "salary_min" in data else job.salary_min
    new_max = data["salary_max"] if "salary_max" in data else job.salary_max
    rules.ensure_job_salary_range(new_min, new_max)
    if "openings" in data and data["openings"] is not None:
        rules.ensure_job_openings_are_valid(data["openings"])
    if (
        "deadline" in data
        and data["deadline"] is not None
        and job.status == JobStatus.OPEN
    ):
        rules.ensure_job_deadline_is_not_in_the_past(data["deadline"])

    for field in (
        "title",
        "description",
        "location",
        "employment_type",
        "experience_level",
        "openings",
        "deadline",
    ):
        if field in data and data[field] is not None:
            value = data[field]
            if isinstance(value, str):
                value = value.strip()
            setattr(job, field, value)

    if "salary_min" in data:
        job.salary_min = data["salary_min"]
    if "salary_max" in data:
        job.salary_max = data["salary_max"]
    if "skills_required" in data and data["skills_required"] is not None:
        job.skills_required = _clean_skills(data["skills_required"])

    db.commit()
    return JobOut.model_validate(_load_job(db, job_id))


def change_job_status(
    db: Session, actor: User, job_id: int, target: JobStatus
) -> JobOut:
    job = _load_job(db, job_id)
    rules.ensure_job_owner_or_admin(actor, job)
    rules.ensure_job_status_transition_allowed(job.status, target)
    if target == JobStatus.OPEN:
        rules.ensure_job_can_be_published(job)

    job.status = target
    db.commit()
    return JobOut.model_validate(_load_job(db, job_id))


def delete_job(db: Session, actor: User, job_id: int) -> None:
    job = _load_job(db, job_id)
    rules.ensure_job_owner_or_admin(actor, job)
    db.delete(job)
    db.commit()


def list_admin_jobs(
    db: Session,
    *,
    status_filter: JobStatus | None = None,
    q: str | None = None,
) -> list[JobOut]:
    conditions = []
    if status_filter is not None:
        conditions.append(Job.status == status_filter)
    if q:
        term = f"%{q.strip()}%"
        conditions.append(
            or_(Job.title.ilike(term), Company.name.ilike(term))
        )
    jobs = (
        db.scalars(
            select(Job)
            .join(Company)
            .where(*conditions)
            .options(*_job_options())
            .order_by(Job.created_at.desc(), Job.id.desc())
        )
        .unique()
        .all()
    )
    return [JobOut.model_validate(job) for job in jobs]


def get_job_for_recruiter(db: Session, recruiter: User, job_id: int) -> JobOut:
    job = _load_job(db, job_id)
    rules.ensure_job_owner_or_admin(recruiter, job)
    return JobOut.model_validate(job)
