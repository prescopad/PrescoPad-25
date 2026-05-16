from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.utils.jwt import verify_access_token
from typing import Optional

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
    if user.role != "doctor":
        raise HTTPException(status_code=403, detail="Doctor access required")
    return user


async def require_assistant(request: Request) -> TokenData:
    user = await get_current_user(request)
    if user.role != "assistant":
        raise HTTPException(status_code=403, detail="Assistant access required")
    return user
