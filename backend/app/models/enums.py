"""Domain enums shared by models, schemas, services and rules."""

from __future__ import annotations

from enum import Enum


class Role(str, Enum):
    CANDIDATE = "candidate"
    RECRUITER = "recruiter"
    ADMIN = "admin"


class UserStatus(str, Enum):
    ACTIVE = "active"
    DISABLED = "disabled"


class JobStatus(str, Enum):
    DRAFT = "draft"
    OPEN = "open"
    CLOSED = "closed"


class EmploymentType(str, Enum):
    FULL_TIME = "full-time"
    PART_TIME = "part-time"
    CONTRACT = "contract"
    INTERNSHIP = "internship"
    FREELANCE = "freelance"


class ApplicationStatus(str, Enum):
    APPLIED = "applied"
    SHORTLISTED = "shortlisted"
    INTERVIEW = "interview"
    OFFERED = "offered"
    HIRED = "hired"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


EMPLOYMENT_TYPE_LABELS: dict[EmploymentType, str] = {
    EmploymentType.FULL_TIME: "Full-time",
    EmploymentType.PART_TIME: "Part-time",
    EmploymentType.CONTRACT: "Contract",
    EmploymentType.INTERNSHIP: "Internship",
    EmploymentType.FREELANCE: "Freelance",
}
