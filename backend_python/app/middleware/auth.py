from typing import Optional

from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer

from app.utils.jwt import verify_access_token

security = HTTPBearer(auto_error=False)


class TokenData:
    def __init__(self, user_id: str, role: str, phone: str, clinic_id: Optional[str]):
        self.user_id = user_id
        self.role = role
        self.phone = phone
        self.clinic_id = clinic_id


async def get_current_user(request: Request) -> TokenData:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = auth_header.split(" ", 1)[1]
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return TokenData(
        user_id=payload["userId"],
        role=payload["role"],
        phone=payload["phone"],
        clinic_id=payload.get("clinicId"),
    )


async def require_doctor(request: Request) -> TokenData:
    user = await get_current_user(request)
    # Admins are allowed to use doctor-only endpoints for support/debugging.
    if user.role not in ("doctor", "admin"):
        raise HTTPException(status_code=403, detail="Doctor access required")
    return user


async def require_assistant(request: Request) -> TokenData:
    user = await get_current_user(request)
    if user.role not in ("assistant", "admin"):
        raise HTTPException(status_code=403, detail="Assistant access required")
    return user


async def require_admin(request: Request) -> TokenData:
    user = await get_current_user(request)
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def require_clinic_member(request: Request) -> TokenData:
    """Doctor OR Assistant — anyone bound to a clinic. Used by routes that
    both roles call (queue/add-patient under solo_mode etc.)."""
    user = await get_current_user(request)
    if user.role not in ("doctor", "assistant", "admin"):
        raise HTTPException(status_code=403, detail="Clinic access required")
    return user
