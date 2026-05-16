from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from app.middleware.auth import get_current_user, TokenData
import app.services.notification_service as notification_service

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _ok(body: dict, status: int = 200):
    body["success"] = True
    return JSONResponse(content=body, status_code=status)


def _err(message: str, status: int = 400):
    return JSONResponse(content={"success": False, "message": message}, status_code=status)


@router.get("/")
async def get_notifications(request: Request):
    user: TokenData = await get_current_user(request)
    try:
        notifications = await notification_service.get_pending_notifications(user.user_id)
        return _ok({"notifications": notifications})
    except Exception as e:
        return _err(str(e), 500)


@router.put("/{notification_id}/read")
async def mark_read(notification_id: str, request: Request):
    user: TokenData = await get_current_user(request)
    try:
        notification = await notification_service.mark_read(user.user_id, notification_id)
        return _ok({"notification": notification, "message": "Marked as read"})
    except ValueError as e:
        return _err(str(e), 404)
    except Exception as e:
        return _err(str(e), 500)
