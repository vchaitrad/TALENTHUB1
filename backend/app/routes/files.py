"""Authenticated resume download endpoint (resumes are never public)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.services import candidate_service

router = APIRouter(prefix="/files", tags=["Files"])

_MEDIA_TYPES = {
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


@router.get(
    "/resumes/{profile_id}",
    summary="Download a candidate resume (owner, connected recruiter or admin only)",
    response_class=FileResponse,
)
def download_resume(
    profile_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    path, original_name = candidate_service.get_resume_for_download(db, user, profile_id)
    extension = path.suffix.lstrip(".").lower()
    return FileResponse(
        path=path,
        media_type=_MEDIA_TYPES.get(extension, "application/octet-stream"),
        filename=original_name,
    )
