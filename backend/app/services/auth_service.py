"""Registration, login, token and account services."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.models.candidate import CandidateProfile
from app.models.enums import Role
from app.models.user import User
from app.schemas.auth import LoginRequest, PasswordChange, RegisterRequest, TokenResponse
from app.schemas.auth import UserOut
from app.services import rules


def _find_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(func.lower(User.email) == email.strip().lower()))


def register_user(db: Session, payload: RegisterRequest) -> User:
    email = payload.email.strip().lower()
    rules.ensure_password_meets_policy(payload.password)
    rules.ensure_email_is_available(_find_by_email(db, email))
    if payload.role == Role.ADMIN:
        rules.ensure_admin_invite_code_is_valid(payload.admin_invite_code)

    user = User(
        email=email,
        full_name=payload.full_name.strip(),
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    if payload.role == Role.CANDIDATE:
        user.candidate_profile = CandidateProfile()
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Handles the rare race where two registrations share an email.
        rules.ensure_email_is_available(_find_by_email(db, email))
        raise
    db.refresh(user)
    return user


def authenticate_user(db: Session, payload: LoginRequest) -> User:
    user = _find_by_email(db, payload.email)
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please try again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    rules.ensure_user_account_is_active(user)
    return user


def build_token_response(user: User) -> TokenResponse:
    token = create_access_token(user.id, user.role.value)
    return TokenResponse(access_token=token, token_type="bearer", user=UserOut.model_validate(user))


def change_password(db: Session, user: User, payload: PasswordChange) -> None:
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your current password is incorrect.",
        )
    rules.ensure_password_meets_policy(payload.new_password)
    rules.ensure_new_password_differs_from_current(
        payload.current_password, payload.new_password
    )
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
