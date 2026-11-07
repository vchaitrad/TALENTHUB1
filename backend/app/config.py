"""Application settings and all tunable business values.

Every limit, threshold, deadline policy and status transition used by the
business rules lives here.  Nothing in this file talks to the database.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.models.enums import ApplicationStatus, JobStatus

BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ------------------------------------------------------------------ app
    APP_NAME: str = "TalentHub"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    API_PREFIX: str = "/api"

    # ----------------------------------------------------------------- auth
    SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    MIN_PASSWORD_LENGTH: int = 8
    MAX_PASSWORD_LENGTH: int = 128
    ADMIN_INVITE_CODE: str = "TALENTHUB-ADMIN-2026"

    # ------------------------------------------------------------- database
    # Swap this single value for PostgreSQL later, e.g.
    # postgresql+psycopg://user:pass@localhost:5432/talenthub
    DATABASE_URL: str = f"sqlite:///{(BASE_DIR / 'talenthub.db').as_posix()}"
    SQL_ECHO: bool = False

    # ---------------------------------------------------------------- files
    UPLOAD_DIR: str = "uploads"
    MAX_RESUME_SIZE_MB: int = 5
    ALLOWED_RESUME_EXTENSIONS: str = "pdf,doc,docx"
    ALLOWED_RESUME_CONTENT_TYPES: str = (
        "application/pdf,"
        "application/msword,"
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

    # ---------------------------------------------------------------- CORS
    CORS_ORIGINS: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "http://localhost:3000,"
        "http://127.0.0.1:3000"
    )

    # ----------------------------------------------------------- pagination
    PAGE_SIZE_DEFAULT: int = 10
    PAGE_SIZE_MAX: int = 50

    # Dashboard profile-completion meter (equal-weight fields).
    PROFILE_COMPLETION_FIELDS: tuple[str, ...] = (
        "headline",
        "summary",
        "phone",
        "location",
        "skills",
        "education",
        "experience",
        "resume",
    )

    # -------------------------------------------------------- job constants
    MIN_JOB_TITLE_LENGTH: int = 3
    MAX_JOB_TITLE_LENGTH: int = 120
    MIN_JOB_DESCRIPTION_LENGTH: int = 30
    MAX_JOB_DESCRIPTION_LENGTH: int = 10_000
    MAX_JOB_OPENINGS: int = 100
    MAX_SKILLS_PER_JOB: int = 25
    MAX_APPLICATIONS_PER_JOB: int = 1  # a candidate may apply once per job
    APPLICATION_DEADLINE_INCLUSIVE: bool = True

    # ------------------------------------------------------------- properties
    @field_validator("DATABASE_URL")
    @classmethod
    def _anchor_relative_sqlite_path(cls, value: str) -> str:
        """Make a relative sqlite path stable regardless of the start folder."""
        prefix = "sqlite:///"
        if not value.startswith(prefix):
            return value
        path_part = value[len(prefix) :]
        if path_part == ":memory:" or Path(path_part).is_absolute():
            return value
        return f"{prefix}{(BASE_DIR / path_part).as_posix()}"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def allowed_resume_extensions(self) -> set[str]:
        return {
            ext.strip().lower().lstrip(".")
            for ext in self.ALLOWED_RESUME_EXTENSIONS.split(",")
            if ext.strip()
        }

    @property
    def allowed_resume_content_types(self) -> set[str]:
        return {
            content_type.strip().lower()
            for content_type in self.ALLOWED_RESUME_CONTENT_TYPES.split(",")
            if content_type.strip()
        }

    @property
    def max_resume_size_bytes(self) -> int:
        return self.MAX_RESUME_SIZE_MB * 1024 * 1024

    @property
    def upload_path(self) -> Path:
        path = Path(self.UPLOAD_DIR)
        if not path.is_absolute():
            path = BASE_DIR / path
        return path

    @property
    def resume_path(self) -> Path:
        return self.upload_path / "resumes"


# ---------------------------------------------------------------------------
# Status machines (single source of truth, used by app.services.rules)
# ---------------------------------------------------------------------------

# Jobs start as DRAFT or OPEN. Closed jobs may be reopened while they are not
# past their deadline.
JOB_STATUS_TRANSITIONS: dict[JobStatus, set[JobStatus]] = {
    JobStatus.DRAFT: {JobStatus.OPEN, JobStatus.CLOSED},
    JobStatus.OPEN: {JobStatus.CLOSED},
    JobStatus.CLOSED: {JobStatus.OPEN},
}

# Forward-only recruiting pipeline. HIRED / REJECTED / WITHDRAWN are terminal.
APPLICATION_STATUS_TRANSITIONS: dict[ApplicationStatus, set[ApplicationStatus]] = {
    ApplicationStatus.APPLIED: {
        ApplicationStatus.SHORTLISTED,
        ApplicationStatus.REJECTED,
        ApplicationStatus.WITHDRAWN,
    },
    ApplicationStatus.SHORTLISTED: {
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.REJECTED,
        ApplicationStatus.WITHDRAWN,
    },
    ApplicationStatus.INTERVIEW: {
        ApplicationStatus.OFFERED,
        ApplicationStatus.REJECTED,
    },
    ApplicationStatus.OFFERED: {
        ApplicationStatus.HIRED,
        ApplicationStatus.REJECTED,
    },
    ApplicationStatus.HIRED: set(),
    ApplicationStatus.REJECTED: set(),
    ApplicationStatus.WITHDRAWN: set(),
}

# A candidate may withdraw only before the recruiter sends an offer.
CANDIDATE_WITHDRAWABLE_STATUSES: set[ApplicationStatus] = {
    ApplicationStatus.APPLIED,
    ApplicationStatus.SHORTLISTED,
}

# Human-readable labels for the frontend / meta endpoint.
APPLICATION_STATUS_LABELS: dict[ApplicationStatus, str] = {
    ApplicationStatus.APPLIED: "Applied",
    ApplicationStatus.SHORTLISTED: "Shortlisted",
    ApplicationStatus.INTERVIEW: "Interview",
    ApplicationStatus.OFFERED: "Offered",
    ApplicationStatus.HIRED: "Hired",
    ApplicationStatus.REJECTED: "Rejected",
    ApplicationStatus.WITHDRAWN: "Withdrawn",
}

JOB_STATUS_LABELS: dict[JobStatus, str] = {
    JobStatus.DRAFT: "Draft",
    JobStatus.OPEN: "Open",
    JobStatus.CLOSED: "Closed",
}


@lru_cache
def get_settings() -> Settings:
    """Return the cached settings instance (one env read per process)."""
    return Settings()


settings = get_settings()
