"""Authentication endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    PasswordChange,
    RegisterRequest,
    TokenResponse,
    UserOut,
)
from app.schemas.common import MessageResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a candidate, recruiter or admin",
)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = auth_service.register_user(db, payload)
    return auth_service.build_token_response(user)


@router.post("/login", response_model=TokenResponse, summary="Log in with email and password")
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = auth_service.authenticate_user(db, payload)
    return auth_service.build_token_response(user)


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="OAuth2 password form login (used by the Swagger Authorize button)",
)
def login_form(
    form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
) -> TokenResponse:
    user = auth_service.authenticate_user(
        db, LoginRequest(email=form.username, password=form.password)
    )
    return auth_service.build_token_response(user)


@router.get("/me", response_model=UserOut, summary="Get the signed-in account")
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.post(
    "/change-password",
    response_model=MessageResponse,
    summary="Change the signed-in account password",
)
def change_password(
    payload: PasswordChange,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    auth_service.change_password(db, user, payload)
    return MessageResponse(message="Password updated successfully.")
