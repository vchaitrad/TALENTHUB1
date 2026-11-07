"""Frontend metadata: enum options, transitions and configurable limits."""

from __future__ import annotations

from fastapi import APIRouter

from app.config import (
    APPLICATION_STATUS_LABELS,
    APPLICATION_STATUS_TRANSITIONS,
    CANDIDATE_WITHDRAWABLE_STATUSES,
    JOB_STATUS_LABELS,
    JOB_STATUS_TRANSITIONS,
    settings,
)
from app.models.enums import (
    EMPLOYMENT_TYPE_LABELS,
    ApplicationStatus,
    EmploymentType,
    JobStatus,
    Role,
    UserStatus,
)

router = APIRouter(prefix="/meta", tags=["Meta"])


@router.get("/options", summary="Statuses, transitions and limits used by the UI")
def options() -> dict:
    return {
        "roles": [role.value for role in Role],
        "user_statuses": [status.value for status in UserStatus],
        "employment_types": [
            {"value": item.value, "label": EMPLOYMENT_TYPE_LABELS[item]}
            for item in EmploymentType
        ],
        "job_statuses": [
            {"value": item.value, "label": JOB_STATUS_LABELS[item]} for item in JobStatus
        ],
        "application_statuses": [
            {"value": item.value, "label": APPLICATION_STATUS_LABELS[item]}
            for item in ApplicationStatus
        ],
        "job_status_transitions": {
            current.value: sorted(target.value for target in targets)
            for current, targets in JOB_STATUS_TRANSITIONS.items()
        },
        "application_status_transitions": {
            current.value: sorted(target.value for target in targets)
            for current, targets in APPLICATION_STATUS_TRANSITIONS.items()
        },
        "withdrawable_application_statuses": sorted(
            status.value for status in CANDIDATE_WITHDRAWABLE_STATUSES
        ),
        "limits": {
            "password_min_length": settings.MIN_PASSWORD_LENGTH,
            "resume_max_size_mb": settings.MAX_RESUME_SIZE_MB,
            "resume_extensions": sorted(settings.allowed_resume_extensions),
            "page_size_default": settings.PAGE_SIZE_DEFAULT,
            "page_size_max": settings.PAGE_SIZE_MAX,
            "max_job_openings": settings.MAX_JOB_OPENINGS,
            "admin_registration_requires_invite": True,
        },
    }
