from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.security import verify_password, create_access_token, create_refresh_token, decode_token
from app.deps import get_current_user
import app.models as m
from app.api_schemas import LoginRequest, TokenResponse, RefreshRequest, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(m.User).where(m.User.email == body.email))
    if user is None or not user.is_active or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="אימייל או סיסמה שגויים")
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    uid, role = str(user.id), user.role.value
    return TokenResponse(
        access_token=create_access_token(uid, role),
        refresh_token=create_refresh_token(uid, role),
        user=UserOut.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="טוקן רענון לא תקין")
    user = db.get(m.User, __import__("uuid").UUID(payload["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="משתמש לא פעיל")
    uid, role = str(user.id), user.role.value
    return TokenResponse(
        access_token=create_access_token(uid, role),
        refresh_token=create_refresh_token(uid, role),
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
def me(user: m.User = Depends(get_current_user)):
    return user
