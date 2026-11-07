"""Convert ORM objects into API schemas.

Doing this inside the service layer means routes only orchestrate and the
session is still open while lazy relationships are read.
"""

from __future__ import annotations

from datetime import timezone

from app.models.application import Application
from app.models.candidate import CandidateProfile
from app.models.job import Job
from app.schemas.application import ApplicationHistoryOut, ApplicationOut
from app.schemas.candidate import CandidatePublic
from app.schemas.job import JobSummary


def candidate_public(profile: CandidateProfile) -> CandidatePublic:
    user = profile.user
    return CandidatePublic(
        profile_id=profile.id,
        user_id=profile.user_id,
        full_name=user.full_name,
        email=user.email,
        headline=profile.headline,
        summary=profile.summary,
        phone=profile.phone,
        location=profile.location,
        linkedin_url=profile.linkedin_url,
        portfolio_url=profile.portfolio_url,
        skills=profile.skills or [],
        education=profile.education or [],
        experience=profile.experience or [],
        resume_available=profile.has_resume,
        resume_filename=profile.resume_filename,
    )


def job_summary(job: Job) -> JobSummary:
    return JobSummary(
        id=job.id,
        title=job.title,
        company_name=job.company.name if job.company else "Unknown company",
        location=job.location,
        employment_type=job.employment_type,
        salary_min=job.salary_min,
        salary_max=job.salary_max,
        deadline=job.deadline,
        status=job.status,
    )


def _history_sort_key(entry) -> float:
    """SQLite returns naive datetimes; normalize before sorting/comparing."""
    created = entry.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return created.timestamp()


def application_out(application: Application) -> ApplicationOut:
    profile = application.candidate.candidate_profile
    if profile is not None:
        candidate = candidate_public(profile)
    else:
        # Defensive fallback: every candidate gets a profile at registration,
        # but a manually edited database should not crash the API.
        candidate = CandidatePublic(
            profile_id=0,
            user_id=application.candidate.id,
            full_name=application.candidate.full_name,
            email=application.candidate.email,
        )
    history = [
        ApplicationHistoryOut(
            id=item.id,
            from_status=item.from_status,
            to_status=item.to_status,
            changed_by_name=item.changed_by_name,
            note=item.note,
            created_at=item.created_at,
        )
        for item in sorted(application.history, key=_history_sort_key)
    ]
    return ApplicationOut(
        id=application.id,
        status=application.status,
        cover_letter=application.cover_letter,
        created_at=application.created_at,
        updated_at=application.updated_at,
        job=job_summary(application.job),
        candidate=candidate,
        history=history,
    )
