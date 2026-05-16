from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt, JWTError
from app.config.settings import settings


def create_access_token(payload: dict) -> str:
    data = payload.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_EXPIRES_IN)
    data["exp"] = expire
    data["type"] = "access"
    return jwt.encode(data, settings.JWT_SECRET, algorithm="HS256")


def create_refresh_token(payload: dict) -> str:
    data = payload.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_EXPIRES_IN)
    data["exp"] = expire
    data["type"] = "refresh"
    return jwt.encode(data, settings.JWT_REFRESH_SECRET, algorithm="HS256")


def verify_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def verify_refresh_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_REFRESH_SECRET, algorithms=["HS256"])
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None


def make_token_payload(user_id: str, role: str, phone: str, clinic_id: Optional[str]) -> dict:
    return {
        "userId": user_id,
        "role": role,
        "phone": phone,
        "clinicId": clinic_id,
    }
