from fastapi import APIRouter, Request, Query
from fastapi.responses import JSONResponse
from typing import Optional

from app.middleware.auth import require_admin
import app.services.admin_service as admin_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _ok(body: dict, status: int = 200):
    body["success"] = True
    return JSONResponse(content=body, status_code=status)


def _err(message: str, status: int = 400):
    return JSONResponse(content={"success": False, "message": message}, status_code=status)


@router.get("/overview")
async def overview(request: Request):
    await require_admin(request)
    try:
        return _ok({"overview": await admin_service.get_overview()})
    except Exception as e:
        return _err(str(e), 500)


@router.get("/users")
async def users(
    request: Request,
    role: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    await require_admin(request)
    try:
        result = await admin_service.list_users(role=role, search=search, limit=limit, offset=offset)
        return _ok(result)
    except Exception as e:
        return _err(str(e), 500)


@router.get("/clinics")
async def clinics(
    request: Request,
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    await require_admin(request)
    try:
        return _ok(await admin_service.list_clinics(search=search, limit=limit, offset=offset))
    except Exception as e:
        return _err(str(e), 500)


@router.get("/prescriptions")
async def prescriptions(
    request: Request,
    clinic_id: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    await require_admin(request)
    try:
        return _ok(await admin_service.list_prescriptions(clinic_id=clinic_id, limit=limit, offset=offset))
    except Exception as e:
        return _err(str(e), 500)


@router.get("/revenue")
async def revenue(
    request: Request,
    period: str = Query(default="month"),
):
    await require_admin(request)
    try:
        return _ok(await admin_service.revenue_breakdown(period=period))
    except Exception as e:
        return _err(str(e), 500)


@router.put("/users/{user_id}/active")
async def set_active(user_id: str, request: Request, is_active: bool = Query(default=True)):
    await require_admin(request)
    try:
        user = await admin_service.set_user_active(user_id, is_active)
        return _ok({"user": user, "message": "Updated"})
    except ValueError as e:
        return _err(str(e), 404)
    except Exception as e:
        return _err(str(e), 500)


@router.put("/users/{user_id}/promote")
async def promote(user_id: str, request: Request):
    await require_admin(request)
    try:
        user = await admin_service.promote_to_admin(user_id)
        return _ok({"user": user, "message": "Promoted to admin"})
    except ValueError as e:
        return _err(str(e), 404)
    except Exception as e:
        return _err(str(e), 500)
