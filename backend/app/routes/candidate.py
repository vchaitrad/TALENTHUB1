"""Candidate-only endpoints: profile, resume, dashboard."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import require_roles
from app.database import get_db
from app.models.enums import Role
from app.models.user import User
from app.schemas.application import ApplicationOut, CandidateSummary
from app.schemas.candidate import CandidateProfileOut, CandidateProfileUpdate
from app.services import application_service, candidate_service

router = APIRouter(prefix="/candidate", tags=["Candidate"])

CandidateUser = Annotated[
    User,
    Depends(require_roles(Role.CANDIDATE, action_description="use the candidate dashboard")),
]


@router.get("/profile", response_model=CandidateProfileOut, summary="Get my profile")
def get_profile(
    user: CandidateUser, db: Session = Depends(get_db)
) -> CandidateProfileOut:
    return candidate_service.get_profile(db, user)


@router.put("/profile", response_model=CandidateProfileOut, summary="Update my profile")
def update_profile(
    payload: CandidateProfileUpdate,
    user: CandidateUser,
    db: Session = Depends(get_db),
) -> CandidateProfileOut:
    return candidate_service.update_profile(db, user, payload)


@router.post(
    "/resume",
    response_model=CandidateProfileOut,
    summary="Upload or replace my resume (PDF/DOC/DOCX, max 5 MB)",
)
async def upload_resume(
    user: CandidateUser,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> CandidateProfileOut:
    # Read at most one byte over the limit; the rules layer reports the friendly error.
    content = await file.read(settings.max_resume_size_bytes + 1)
    return candidate_service.save_resume(
        db,
        user,
        filename=file.filename,
        content=content,
        content_type=file.content_type,
    )


@router.delete("/resume", response_model=CandidateProfileOut, summary="Delete my resume")
def delete_resume(
    user: CandidateUser, db: Session = Depends(get_db)
) -> CandidateProfileOut:
    return candidate_service.delete_resume(db, user)


@router.get("/summary", response_model=CandidateSummary, summary="My dashboard summary")
def summary(user: CandidateUser, db: Session = Depends(get_db)) -> CandidateSummary:
    return candidate_service.get_candidate_summary(db, user)


@router.get(
    "/applications",
    response_model=list[ApplicationOut],
    summary="Track my applications",
)
def my_applications(
    user: CandidateUser, db: Session = Depends(get_db)
) -> list[ApplicationOut]:
    return application_service.list_my_applications(db, user)
