"""Company schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class CompanyUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    website: Optional[str] = Field(default=None, max_length=255)
    industry: Optional[str] = Field(default=None, max_length=120)
    company_size: Optional[str] = Field(default=None, max_length=60)
    location: Optional[str] = Field(default=None, max_length=160)
    description: Optional[str] = Field(default=None, max_length=5000)


class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    name: str
    website: Optional[str]
    industry: Optional[str]
    company_size: Optional[str]
    location: Optional[str]
    description: Optional[str]
    jobs_count: int = 0
    created_at: datetime
    updated_at: datetime


class CompanyBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    industry: Optional[str] = None
    location: Optional[str] = None
