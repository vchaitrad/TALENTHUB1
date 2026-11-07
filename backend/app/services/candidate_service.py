"""Candidate profile, resume and dashboard services."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.errors import get_or_404
from app.models.application import Application
from app.models.candidate import CandidateProfile
from app.models.enums import ApplicationStatus, Role
from app.models.job import Job
from app.models.user import User
from app.schemas.application import CandidateSummary
from app.schemas.candidate import CandidateProfileOut, CandidateProfileUpdate
from app.services import rules


def _require_profile(db: Session, user: User) -> CandidateProfile:
    profile = user.candidate_profile
    if profile is None:
        # Defensive: accounts created outside the normal registration flow.
        profile = CandidateProfile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(user)
        profile = user.candidate_profile
    return profile


def get_profile(db: Session, user: User) -> CandidateProfileOut:
    profile = _require_profile(db, user)
    return CandidateProfileOut.model_validate(profile)


def _apply_profile_update(profile: CandidateProfile, payload: CandidateProfileUpdate) -> None:
    # Trim skills, drop blanks and remove case-insensitive duplicates.
    seen: set[str] = set()
    clean_skills: list[str] = []
    for skill in payload.skills:
        cleaned = skill.strip()
        if cleaned and cleaned.lower() not in seen:
            seen.add(cleaned.lower())
            clean_skills.append(cleaned)

    profile.headline = _clean_optional(payload.headline)
    profile.summary = _clean_optional(payload.summary)
    profile.phone = _clean_optional(payload.phone)
    profile.location = _clean_optional(payload.location)
    profile.linkedin_url = _clean_optional(payload.linkedin_url)
    profile.portfolio_url = _clean_optional(payload.portfolio_url)
    profile.skills = clean_skills
    profile.education = [item.model_dump() for item in payload.education]
    profile.experience = [item.model_dump() for item in payload.experience]


def update_profile(db: Session, user: User, payload: CandidateProfileUpdate) -> CandidateProfileOut:
    profile = _require_profile(db, user)
    rules.ensure_profile_owner_or_admin(user, profile)
    _apply_profile_update(profile, payload)
    db.commit()
    db.refresh(profile)
    return CandidateProfileOut.model_validate(profile)


def get_profile_by_user_id(
    db: Session, actor: User, user_id: int
) -> CandidateProfileOut:
    """Admin (or the candidate themselves) can read a candidate profile by user id."""
    target = get_or_404(db, User, user_id, "Candidate")
    if target.role != Role.CANDIDATE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That user is not a candidate.",
        )
    profile = _require_profile(db, target)
    rules.ensure_profile_owner_or_admin(actor, profile)
    return CandidateProfileOut.model_validate(profile)


def update_profile_by_user_id(
    db: Session, actor: User, user_id: int, payload: CandidateProfileUpdate
) -> CandidateProfileOut:
    """Admin can edit any candidate profile; candidates are limited to their own."""
    target = get_or_404(db, User, user_id, "Candidate")
    if target.role != Role.CANDIDATE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That user is not a candidate.",
        )
    profile = _require_profile(db, target)
    rules.ensure_profile_owner_or_admin(actor, profile)
    _apply_profile_update(profile, payload)
    db.commit()
    db.refresh(profile)
    return CandidateProfileOut.model_validate(profile)


def _clean_optional(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _safe_resume_file(stored_name: str) -> Path:
    """Resolve an uploaded resume without allowing path traversal."""
    safe_name = Path(stored_name).name
    return settings.resume_path / safe_name


def save_resume(
    db: Session,
    user: User,
    *,
    filename: str | None,
    content: bytes,
    content_type: str | None,
) -> CandidateProfileOut:
    profile = _require_profile(db, user)
    rules.ensure_profile_owner_or_admin(user, profile)
    rules.ensure_resume_file_is_valid(filename, len(content), content_type)
    assert filename is not None  # guaranteed by the rule

    display_name = Path(filename).name[:255]
    extension = display_name.rsplit(".", 1)[-1].lower()
    stored_name = f"{uuid.uuid4().hex}.{extension}"
    settings.resume_path.mkdir(parents=True, exist_ok=True)
    _safe_resume_file(stored_name).write_bytes(content)

    old_stored_name = profile.resume_stored_name
    profile.resume_filename = display_name
    profile.resume_stored_name = stored_name
    from app.models.common import utcnow

    profile.resume_uploaded_at = utcnow()
    db.commit()
    db.refresh(profile)

    if old_stored_name and old_stored_name != stored_name:
        _safe_resume_file(old_stored_name).unlink(missing_ok=True)

    return CandidateProfileOut.model_validate(profile)


def delete_resume(db: Session, user: User) -> CandidateProfileOut:
    profile = _require_profile(db, user)
    rules.ensure_profile_owner_or_admin(user, profile)
    rules.ensure_resume_uploaded(profile)
    stored_name = profile.resume_stored_name
    profile.resume_filename = None
    profile.resume_stored_name = None
    profile.resume_uploaded_at = None
    db.commit()
    db.refresh(profile)
    if stored_name:
        _safe_resume_file(stored_name).unlink(missing_ok=True)
    return CandidateProfileOut.model_validate(profile)


def get_resume_for_download(db: Session, user: User, profile_id: int) -> tuple[Path, str]:
    profile = db.get(CandidateProfile, profile_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate profile was not found.",
        )
    rules.ensure_resume_uploaded(profile)

    relationship = False
    if user.role.value == "recruiter":
        relationship = (
            db.scalar(
                select(func.count(Application.id))
                .join(Job, Job.id == Application.job_id)
                .where(
                    Application.candidate_id == profile.user_id,
                    Job.recruiter_id == user.id,
                )
            )
            or 0
        ) > 0

    rules.ensure_can_view_resume(user, profile, relationship)
    path = _safe_resume_file(profile.resume_stored_name or "")
    if not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The resume file is missing from storage. Ask the candidate to upload it again.",
        )
    return path, profile.resume_filename or path.name


def get_candidate_summary(db: Session, user: User) -> CandidateSummary:
    profile = _require_profile(db, user)
    rows = db.execute(
        select(Application.status, func.count(Application.id))
        .where(Application.candidate_id == user.id)
        .group_by(Application.status)
    ).all()
    by_status = {status_.value: 0 for status_ in ApplicationStatus}
    for app_status, count in rows:
        by_status[app_status.value] = count

    active_statuses = {
        ApplicationStatus.APPLIED,
        ApplicationStatus.SHORTLISTED,
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.OFFERED,
    }
    active = sum(by_status[s.value] for s in active_statuses)

    checks = {
        "headline": bool(profile.headline),
        "summary": bool(profile.summary),
        "phone": bool(profile.phone),
        "location": bool(profile.location),
        "skills": bool(profile.skills),
        "education": bool(profile.education),
        "experience": bool(profile.experience),
        "resume": bool(profile.resume_stored_name),
    }
    filled = sum(1 for field in settings.PROFILE_COMPLETION_FIELDS if checks.get(field))
    completion = round(filled / len(settings.PROFILE_COMPLETION_FIELDS) * 100)

    return CandidateSummary(
        applications_total=sum(by_status.values()),
        active_applications=active,
        by_status=by_status,
        profile_completion=completion,
        resume_uploaded=profile.has_resume,
    )
