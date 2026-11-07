"""Company profile service."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.user import User
from app.schemas.company import CompanyOut, CompanyUpdate
from app.services import rules


def get_company(user: User) -> CompanyOut | None:
    if user.company is None:
        return None
    return CompanyOut.model_validate(user.company)


def upsert_company(db: Session, user: User, payload: CompanyUpdate) -> CompanyOut:
    rules.ensure_recruiter_role(user)
    company = user.company
    if company is None:
        rules.ensure_one_company_per_recruiter(company)
        company = Company(owner_id=user.id, name=payload.name.strip())
        db.add(company)

    company.name = payload.name.strip()
    company.website = _clean(payload.website)
    company.industry = _clean(payload.industry)
    company.company_size = _clean(payload.company_size)
    company.location = _clean(payload.location)
    company.description = _clean(payload.description)

    db.commit()
    db.refresh(company)
    return CompanyOut.model_validate(company)


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def get_company_by_id(db: Session, company_id: int) -> Company:
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with id {company_id} was not found.",
        )
    return company
