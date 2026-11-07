"""TalentHub business rules — the single source of truth.

Design notes
------------
* Each rule is a plain function with a docstring in simple English.
* A broken rule raises :class:`RuleViolation` with a human-readable message,
  a stable rule name and the correct HTTP status (400 / 403 / 409).
* Rules are pure decisions: services fetch database rows, then call a rule.
  Rules never commit, query or format responses.
* Tunable values (limits, statuses, transitions, deadlines) come from
  ``app.config`` rather than being hard-coded.
"""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

from fastapi import status

from app.config import (
    APPLICATION_STATUS_TRANSITIONS,
    CANDIDATE_WITHDRAWABLE_STATUSES,
    JOB_STATUS_TRANSITIONS,
    settings,
)
from app.core.errors import RuleViolation
from app.models.enums import ApplicationStatus, JobStatus, Role, UserStatus

if TYPE_CHECKING:  # avoid runtime import cycles in type checkers only
    from app.models.application import Application
    from app.models.candidate import CandidateProfile
    from app.models.company import Company
    from app.models.job import Job
    from app.models.user import User


# ---------------------------------------------------------------------------
# Accounts & authentication
# ---------------------------------------------------------------------------


def ensure_password_meets_policy(password: str) -> None:
    """A password must be at least the configured minimum length.

    The minimum is ``settings.MIN_PASSWORD_LENGTH`` (8 by default) and is also
    capped at ``MAX_PASSWORD_LENGTH`` to avoid absurd inputs.
    """
    if len(password) < settings.MIN_PASSWORD_LENGTH:
        raise RuleViolation(
            rule="password_policy",
            message=(
                f"Password is too short. It must be at least "
                f"{settings.MIN_PASSWORD_LENGTH} characters long."
            ),
        )
    if len(password) > settings.MAX_PASSWORD_LENGTH:
        raise RuleViolation(
            rule="password_policy",
            message=(
                f"Password is too long. It must be at most "
                f"{settings.MAX_PASSWORD_LENGTH} characters."
            ),
        )


def ensure_new_password_differs_from_current(current_password: str, new_password: str) -> None:
    """A password change must actually pick a different password."""
    if current_password == new_password:
        raise RuleViolation(
            rule="password_change_differs",
            message="Your new password must be different from your current password.",
        )


def ensure_email_is_available(existing_user: "User | None") -> None:
    """An email address can belong to only one account.

    Registration asks the database for a user with the same email and passes
    the result here; if one exists the registration is rejected with 409.
    """
    if existing_user is not None:
        raise RuleViolation(
            rule="unique_email",
            message="An account with this email already exists. Please log in instead.",
            status_code=status.HTTP_409_CONFLICT,
        )


def ensure_admin_invite_code_is_valid(invite_code: str | None) -> None:
    """Admin accounts can only be created with the private admin invite code.

    The code is configured with ``ADMIN_INVITE_CODE`` and is never exposed by
    the API. Candidate and recruiter registration does not use this rule.
    """
    expected = settings.ADMIN_INVITE_CODE
    if not invite_code or invite_code != expected:
        raise RuleViolation(
            rule="admin_invite_code",
            message=(
                "Admin registration requires a valid admin invite code. "
                "Check the code with the platform owner."
            ),
            status_code=status.HTTP_403_FORBIDDEN,
        )


def ensure_user_account_is_active(user: "User") -> None:
    """Only active accounts may log in or use the API.

    A disabled account is blocked with 403 until an admin reactivates it.
    """
    if user.status != UserStatus.ACTIVE:
        raise RuleViolation(
            rule="account_active",
            message="Your account has been disabled. Please contact the platform administrator.",
            status_code=status.HTTP_403_FORBIDDEN,
        )


def ensure_user_has_role(
    user: "User", allowed_roles: set[Role], action_description: str = "perform this action"
) -> None:
    """Role-based access: the account must hold one of the allowed roles.

    Route-level role guards call this so every access denial goes through the
    same rule/error format. Admins are not silently allowed everywhere; routes
    that admins may use explicitly include the admin role.
    """
    if user.role not in allowed_roles:
        allowed_text = ", ".join(sorted(role.value for role in allowed_roles))
        raise RuleViolation(
            rule="role_access",
            message=(
                f"Only {allowed_text} accounts can {action_description}. "
                f"Your account role is {user.role.value}."
            ),
            status_code=status.HTTP_403_FORBIDDEN,
        )


def ensure_user_cannot_delete_self(actor: "User", target_user_id: int) -> None:
    """Admins cannot delete their own account.

    This prevents an administrator from accidentally locking everyone out of
    the platform.
    """
    if actor.id == target_user_id:
        raise RuleViolation(
            rule="cannot_delete_self",
            message="You cannot delete your own admin account.",
            status_code=status.HTTP_403_FORBIDDEN,
        )


def ensure_user_cannot_disable_self(actor: "User", target_user_id: int) -> None:
    """Admins cannot disable their own account."""
    if actor.id == target_user_id:
        raise RuleViolation(
            rule="cannot_disable_self",
            message="You cannot disable your own admin account.",
            status_code=status.HTTP_403_FORBIDDEN,
        )


# ---------------------------------------------------------------------------
# Profiles & companies
# ---------------------------------------------------------------------------


def ensure_profile_owner_or_admin(user: "User", profile: "CandidateProfile") -> None:
    """A candidate can only edit their own profile; admins can edit any profile.

    Recruiters cannot edit candidate profiles at all.
    """
    if user.role == Role.ADMIN:
        return
    if user.role != Role.CANDIDATE or profile.user_id != user.id:
        raise RuleViolation(
            rule="profile_ownership",
            message="You can only edit your own candidate profile.",
            status_code=status.HTTP_403_FORBIDDEN,
        )


def ensure_recruiter_role(user: "User") -> None:
    """Only recruiters can create or edit a company profile."""
    if user.role != Role.RECRUITER:
        raise RuleViolation(
            rule="company_requires_recruiter",
            message="Only recruiter accounts can manage a company profile.",
            status_code=status.HTTP_403_FORBIDDEN,
        )


def ensure_company_profile_exists(company: "Company | None") -> None:
    """A recruiter must create a company profile before posting a job.

    This keeps every job attached to a real company for candidates to see.
    """
    if company is None:
        raise RuleViolation(
            rule="company_profile_required",
            message=(
                "Create your company profile before posting a job. "
                "Go to Company Profile in the recruiter dashboard."
            ),
        )


def ensure_one_company_per_recruiter(existing_company: "Company | None") -> None:
    """Each recruiter account can own exactly one company profile.

    Updating the existing company is the correct action instead of creating
    a second one.
    """
    if existing_company is not None:
        raise RuleViolation(
            rule="one_company_per_recruiter",
            message=(
                "You already have a company profile. "
                "Edit the existing company instead of creating a new one."
            ),
            status_code=status.HTTP_409_CONFLICT,
        )


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------


def ensure_job_salary_range(salary_min: int | None, salary_max: int | None) -> None:
    """If both salaries are supplied, the minimum cannot exceed the maximum."""
    if salary_min is not None and salary_max is not None and salary_min > salary_max:
        raise RuleViolation(
            rule="job_salary_range",
            message="Minimum salary cannot be greater than maximum salary.",
        )


def ensure_job_openings_are_valid(openings: int) -> None:
    """A job must have at least one opening and no more than the configured cap."""
    if openings < 1:
        raise RuleViolation(
            rule="job_openings",
            message="A job must have at least 1 opening.",
        )
    if openings > settings.MAX_JOB_OPENINGS:
        raise RuleViolation(
            rule="job_openings",
            message=f"A job cannot have more than {settings.MAX_JOB_OPENINGS} openings.",
        )


def ensure_job_deadline_is_not_in_the_past(
    deadline: date, reference_date: date | None = None
) -> None:
    """A published job's application deadline must be today or later.

    A deadline of today is still valid for the whole day; the deadline is
    inclusive. Past deadlines are rejected with 400.
    """
    today = reference_date or date.today()
    if deadline < today:
        raise RuleViolation(
            rule="job_deadline",
            message=(
                f"The application deadline ({deadline.isoformat()}) has already passed. "
                "Choose today or a future date."
            ),
        )


def ensure_job_is_accepting_applications(job: "Job", reference_date: date | None = None) -> None:
    """Candidates can only apply to OPEN jobs whose deadline has not passed.

    Draft and closed jobs are rejected with 409, as are expired jobs.
    """
    if job.status == JobStatus.DRAFT:
        raise RuleViolation(
            rule="job_accepting_applications",
            message="This job is still a draft and is not accepting applications.",
            status_code=status.HTTP_409_CONFLICT,
        )
    if job.status == JobStatus.CLOSED:
        raise RuleViolation(
            rule="job_accepting_applications",
            message="This job is closed and is no longer accepting applications.",
            status_code=status.HTTP_409_CONFLICT,
        )
    today = reference_date or date.today()
    if job.deadline < today:
        raise RuleViolation(
            rule="job_accepting_applications",
            message=(
                f"The application deadline for this job passed on "
                f"{job.deadline.isoformat()}. It is no longer accepting applications."
            ),
            status_code=status.HTTP_409_CONFLICT,
        )


def ensure_job_owner_or_admin(user: "User", job: "Job") -> None:
    """Only the recruiter who posted a job (or an admin) can manage it.

    Used for viewing applicants, editing, changing status and deleting.
    Other recruiters receive 403, even if they work at the same company.
    """
    if user.role == Role.ADMIN:
        return
    if user.role != Role.RECRUITER or job.recruiter_id != user.id:
        raise RuleViolation(
            rule="job_ownership",
            message="Only the recruiter who posted this job can view or manage its applicants.",
            status_code=status.HTTP_403_FORBIDDEN,
        )


def ensure_job_can_be_edited(user: "User", job: "Job") -> None:
    """A job can only be edited by its owner (or an admin).

    Recruiters cannot edit a closed job; they must reopen it first. Admins can
    edit any job, including closed ones.
    """
    ensure_job_owner_or_admin(user, job)
    if job.status == JobStatus.CLOSED and user.role != Role.ADMIN:
        raise RuleViolation(
            rule="job_editable",
            message="Closed jobs cannot be edited. Reopen the job before making changes.",
            status_code=status.HTTP_409_CONFLICT,
        )


def ensure_job_initial_status_allowed(target: JobStatus) -> None:
    """A new job can only be saved as a draft or published immediately as open.

    Jobs cannot be created in the closed state; closing is an action performed
    on an existing job.
    """
    if target not in {JobStatus.DRAFT, JobStatus.OPEN}:
        raise RuleViolation(
            rule="job_initial_status",
            message="A new job can only be saved as a draft or published as open.",
        )


def ensure_job_status_transition_allowed(current: JobStatus, target: JobStatus) -> None:
    """Jobs may only move along configured statuses: draft ⇄ open → closed and closed → open.

    The allowed transitions live in ``settings``/``JOB_STATUS_TRANSITIONS``.
    Invalid moves (for example open → draft) return 409 with the allowed
    next statuses in the message.
    """
    if current == target:
        raise RuleViolation(
            rule="job_status_transition",
            message=f"This job is already {target.value}.",
            status_code=status.HTTP_409_CONFLICT,
        )
    allowed = JOB_STATUS_TRANSITIONS.get(current, set())
    if target not in allowed:
        allowed_text = ", ".join(sorted(item.value for item in allowed)) or "none"
        raise RuleViolation(
            rule="job_status_transition",
            message=(
                f"Invalid job status change: {current.value} → {target.value}. "
                f"Allowed next statuses: {allowed_text}."
            ),
            status_code=status.HTTP_409_CONFLICT,
        )


def ensure_job_can_be_published(job: "Job", reference_date: date | None = None) -> None:
    """A job can be opened only if it has a company and a deadline that is not past.

    Admins reopening a job also go through this check.
    """
    if job.company is None:
        raise RuleViolation(
            rule="company_profile_required",
            message="This job has no company profile and cannot be published.",
        )
    ensure_job_deadline_is_not_in_the_past(job.deadline, reference_date)


# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------


def ensure_candidate_has_not_applied(existing_application: "Application | None") -> None:
    """A candidate can apply only once to a given job.

    The check covers every status, including withdrawn applications, so the
    rule cannot be bypassed by withdrawing and applying again.
    """
    if existing_application is not None:
        raise RuleViolation(
            rule="duplicate_application",
            message="You have already applied to this job. Each candidate may apply only once per job.",
            status_code=status.HTTP_409_CONFLICT,
        )


def ensure_application_status_transition_allowed(
    current: ApplicationStatus, target: ApplicationStatus
) -> None:
    """Applications move only forward through the recruiting pipeline.

    Allowed path: applied → shortlisted → interview → offered → hired.
    Rejection is possible from every non-terminal stage, and candidates may
    withdraw from applied/shortlisted. Hired, rejected and withdrawn are final.
    The transition table lives in ``settings``/``APPLICATION_STATUS_TRANSITIONS``.
    """
    if current == target:
        raise RuleViolation(
            rule="application_status_transition",
            message=f"This application is already in the {target.value} stage.",
            status_code=status.HTTP_409_CONFLICT,
        )
    allowed = APPLICATION_STATUS_TRANSITIONS.get(current, set())
    if target not in allowed:
        allowed_text = ", ".join(sorted(item.value for item in allowed)) or "none"
        raise RuleViolation(
            rule="application_status_transition",
            message=(
                f"Invalid application status change: {current.value} → {target.value}. "
                f"Allowed next statuses: {allowed_text}."
            ),
            status_code=status.HTTP_409_CONFLICT,
        )


def ensure_application_can_be_withdrawn(application: "Application") -> None:
    """Candidates can withdraw only before an offer is made.

    Withdrawal is allowed while the application is applied or shortlisted;
    interview, offered, hired, rejected and withdrawn applications cannot be
    withdrawn.
    """
    if application.status not in CANDIDATE_WITHDRAWABLE_STATUSES:
        allowed = ", ".join(sorted(item.value for item in CANDIDATE_WITHDRAWABLE_STATUSES))
        raise RuleViolation(
            rule="application_withdrawable",
            message=(
                f"An application in the {application.status.value} stage cannot be withdrawn. "
                f"Withdrawal is only allowed while the status is: {allowed}."
            ),
            status_code=status.HTTP_409_CONFLICT,
        )


def ensure_application_owner_or_admin(user: "User", application: "Application") -> None:
    """Only the candidate who owns an application (or an admin) may act on it."""
    if user.role == Role.ADMIN:
        return
    if user.role != Role.CANDIDATE or application.candidate_id != user.id:
        raise RuleViolation(
            rule="application_ownership",
            message="You can only view or withdraw your own applications.",
            status_code=status.HTTP_403_FORBIDDEN,
        )


def ensure_can_manage_job_applications(user: "User", job: "Job") -> None:
    """Only the job's recruiter (or an admin) may review applicants and change statuses."""
    if user.role == Role.ADMIN:
        return
    if user.role != Role.RECRUITER or job.recruiter_id != user.id:
        raise RuleViolation(
            rule="applicant_management",
            message=(
                "Only the recruiter who posted this job can view applicants "
                "or change their application status."
            ),
            status_code=status.HTTP_403_FORBIDDEN,
        )


def ensure_can_view_application(user: "User", application: "Application") -> None:
    """An application is visible to its candidate, the job's recruiter, or an admin.

    No other recruiter or candidate can read it.
    """
    if user.role == Role.ADMIN:
        return
    if user.role == Role.CANDIDATE and application.candidate_id == user.id:
        return
    if user.role == Role.RECRUITER and application.job.recruiter_id == user.id:
        return
    raise RuleViolation(
        rule="application_visibility",
        message="You do not have permission to view this application.",
        status_code=status.HTTP_403_FORBIDDEN,
    )


# ---------------------------------------------------------------------------
# Resumes
# ---------------------------------------------------------------------------


def ensure_resume_file_is_valid(
    filename: str | None, size_bytes: int, content_type: str | None
) -> None:
    """Resume uploads must be a non-empty PDF, DOC or DOCX within the size limit.

    Extensions and MIME types are configurable in ``app.config``. The maximum
    size defaults to 5 MB. Uploading an empty file is also rejected.
    """
    if not filename:
        raise RuleViolation(
            rule="resume_file",
            message="Choose a resume file to upload.",
        )
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in settings.allowed_resume_extensions:
        allowed = ", ".join(sorted(settings.allowed_resume_extensions))
        raise RuleViolation(
            rule="resume_file",
            message=f"Invalid resume type. Allowed file types: {allowed}.",
        )
    if content_type and content_type.lower() not in settings.allowed_resume_content_types:
        raise RuleViolation(
            rule="resume_file",
            message=(
                "Invalid resume content type. Upload a PDF, DOC or DOCX file, "
                "not an image or archive."
            ),
        )
    if size_bytes <= 0:
        raise RuleViolation(
            rule="resume_file",
            message="The resume file is empty. Please choose a valid file.",
        )
    if size_bytes > settings.max_resume_size_bytes:
        raise RuleViolation(
            rule="resume_file",
            message=(
                f"Resume is too large. The maximum size is "
                f"{settings.MAX_RESUME_SIZE_MB} MB."
            ),
        )


def ensure_resume_uploaded(profile: "CandidateProfile") -> None:
    """A resume must exist before it can be downloaded or deleted."""
    if not profile.resume_stored_name:
        raise RuleViolation(
            rule="resume_exists",
            message="No resume has been uploaded to this profile yet.",
        )


def ensure_can_view_resume(
    user: "User", profile: "CandidateProfile", recruiter_has_relationship: bool
) -> None:
    """A resume is private to its candidate, an admin, or a recruiter the candidate applied to.

    ``recruiter_has_relationship`` is computed by the service: it is true when
    the candidate has an application to one of that recruiter's jobs. This
    keeps resumes from being publicly downloadable.
    """
    if user.role == Role.ADMIN:
        return
    if user.role == Role.CANDIDATE and profile.user_id == user.id:
        return
    if user.role == Role.RECRUITER and recruiter_has_relationship:
        return
    raise RuleViolation(
        rule="resume_access",
        message=(
            "You do not have permission to download this resume. Recruiters can "
            "only view resumes of candidates who applied to their own jobs."
        ),
        status_code=status.HTTP_403_FORBIDDEN,
    )
