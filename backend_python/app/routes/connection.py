from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from app.models.connection import InviteRequest, JoinRequest
from app.middleware.auth import get_current_user, require_doctor, require_assistant, TokenData
import app.services.connection_service as connection_service

router = APIRouter(prefix="/api/connection", tags=["connection"])


def _ok(body: dict, status: int = 200):
    body["success"] = True
    return JSONResponse(content=body, status_code=status)


def _err(message: str, status: int = 400):
    return JSONResponse(content={"success": False, "message": message}, status_code=status)


@router.post("/invite")
async def invite(request: Request, body: InviteRequest):
    user: TokenData = await require_doctor(request)
    try:
        req = await connection_service.invite_assistant(user.user_id, user.clinic_id, body.get_phone())
        return _ok({"request": req, "message": "Invitation sent"})
    except ValueError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@router.post("/request")
async def join_request(request: Request, body: JoinRequest):
    user: TokenData = await require_assistant(request)
    try:
        req = await connection_service.request_join(user.user_id, body.get_code())
        return _ok({"request": req, "message": "Join request sent"})
    except ValueError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@router.put("/{request_id}/accept")
async def accept(request_id: str, request: Request):
    user: TokenData = await get_current_user(request)
    try:
        req = await connection_service.accept_request(request_id, user.user_id, user.role)
        return _ok({"request": req, "message": "Request accepted"})
    except ValueError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@router.put("/{request_id}/reject")
async def reject(request_id: str, request: Request):
    user: TokenData = await get_current_user(request)
    try:
        req = await connection_service.reject_request(request_id, user.user_id, user.role)
        return _ok({"request": req, "message": "Request rejected"})
    except ValueError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@router.get("/pending")
async def pending(request: Request):
    user: TokenData = await get_current_user(request)
    try:
        requests = await connection_service.get_pending(user.user_id, user.role)
        return _ok({"requests": requests})
    except Exception as e:
        return _err(str(e), 500)


@router.get("/team")
async def team(request: Request):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        members = await connection_service.get_team(user.clinic_id)
        return _ok({"members": members})
    except Exception as e:
        return _err(str(e), 500)


@router.delete("/team/{assistant_id}")
async def disconnect(assistant_id: str, request: Request):
    user: TokenData = await require_doctor(request)
    try:
        await connection_service.disconnect_assistant(user.user_id, user.clinic_id, assistant_id)
        return _ok({"message": "Assistant disconnected"})
    except ValueError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)
