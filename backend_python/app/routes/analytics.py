from fastapi import APIRouter, Request, Query
from fastapi.responses import JSONResponse
from typing import Optional
from app.middleware.auth import get_current_user, TokenData
import app.services.analytics_service as analytics_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _ok(body: dict, status: int = 200):
    body["success"] = True
    return JSONResponse(content=body, status_code=status)


def _err(message: str, status: int = 400):
    return JSONResponse(content={"success": False, "message": message}, status_code=status)


@router.get("/")
async def get_analytics(
    request: Request,
    period: Optional[str] = Query("today"),
):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        analytics = await analytics_service.get_analytics(user.clinic_id, period)
        return _ok({"analytics": analytics})
    except Exception as e:
        return _err(str(e), 500)
