"""FastAPI dependencies: DB session, current user and role guards."""

from __future__ import annotations

from collections.abc import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database import get_db
from app.models.enums import Role
from app.models.user import User
from app.services import rules

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)


def _unauthorized(detail: str = "Could not validate your session. Please log in again.") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _user_from_token(db: Session, token: str) -> User:
    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub", ""))
    except (jwt.PyJWTError, TypeError, ValueError):
        raise _unauthorized()

    user = db.get(User, user_id)
    if user is None:
        raise _unauthorized("Your account no longer exists. Please log in again.")
    rules.ensure_user_account_is_active(user)
    return user


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    return _user_from_token(db, token)


def get_optional_current_user(
    token: str | None = Depends(optional_oauth2_scheme), db: Session = Depends(get_db)
) -> User | None:
    if not token:
        return None
    return _user_from_token(db, token)


def require_roles(*roles: Role, action_description: str = "perform this action") -> Callable:
    """Build a dependency that allows only the given roles."""
    allowed = set(roles)

    def _guard(user: User = Depends(get_current_user)) -> User:
        rules.ensure_user_has_role(user, allowed, action_description)
        return user

    return _guard
