"""Candidate profile schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.auth import UserOut


class EducationItem(BaseModel):
    institution: str = Field(min_length=1, max_length=160)
    degree: str = Field(min_length=1, max_length=160)
    field_of_study: Optional[str] = Field(default=None, max_length=160)
    start_year: Optional[int] = Field(default=None, ge=1950, le=2100)
    end_year: Optional[int] = Field(default=None, ge=1950, le=2100)


class ExperienceItem(BaseModel):
    company: str = Field(min_length=1, max_length=160)
    title: str = Field(min_length=1, max_length=160)
    start_date: Optional[str] = Field(default=None, max_length=30)
    end_date: Optional[str] = Field(default=None, max_length=30)
    description: Optional[str] = Field(default=None, max_length=2000)


class CandidateProfileUpdate(BaseModel):
    headline: Optional[str] = Field(default=None, max_length=160)
    summary: Optional[str] = Field(default=None, max_length=5000)
    phone: Optional[str] = Field(default=None, max_length=40)
    location: Optional[str] = Field(default=None, max_length=160)
    linkedin_url: Optional[str] = Field(default=None, max_length=255)
    portfolio_url: Optional[str] = Field(default=None, max_length=255)
    skills: list[str] = Field(default_factory=list, max_length=50)
    education: list[EducationItem] = Field(default_factory=list, max_length=20)
    experience: list[ExperienceItem] = Field(default_factory=list, max_length=30)


class CandidateProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    headline: Optional[str]
    summary: Optional[str]
    phone: Optional[str]
    location: Optional[str]
    linkedin_url: Optional[str]
    portfolio_url: Optional[str]
    skills: list[str]
    education: list[EducationItem]
    experience: list[ExperienceItem]
    resume_filename: Optional[str]
    has_resume: bool
    resume_uploaded_at: Optional[datetime]
    updated_at: datetime
    user: UserOut


class CandidatePublic(BaseModel):
    """What a recruiter sees about an applicant."""

    profile_id: int
    user_id: int
    full_name: str
    email: str
    headline: Optional[str] = None
    summary: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    skills: list[str] = Field(default_factory=list)
    education: list[EducationItem] = Field(default_factory=list)
    experience: list[ExperienceItem] = Field(default_factory=list)
    resume_available: bool = False
    resume_filename: Optional[str] = None
