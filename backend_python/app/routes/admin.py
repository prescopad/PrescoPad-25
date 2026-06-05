from fastapi import APIRouter, Request, Query
from fastapi.responses import JSONResponse
from typing import Optional
from pydantic import BaseModel

from app.middleware.auth import require_admin
import app.services.admin_service as admin_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _ok(body: dict, status: int = 200):
    body["success"] = True
    return JSONResponse(content=body, status_code=status)


def _err(message: str, status: int = 400):
    return JSONResponse(content={"success": False, "message": message}, status_code=status)


# ── Models ────────────────────────────────────────────────────────────────────

class ClinicCreateBody(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None

class ClinicUpdateBody(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    is_active: Optional[bool] = None


# ── Overview ──────────────────────────────────────────────────────────────────

@router.get("/overview")
async def overview(request: Request):
    await require_admin(request)
    try:
        return _ok({"overview": await admin_service.get_overview()})
    except Exception as e:
        return _err(str(e), 500)


# ── Users ─────────────────────────────────────────────────────────────────────

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


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    await require_admin(request)
    try:
        await admin_service.delete_user(user_id)
        return _ok({"message": "User deleted"})
    except ValueError as e:
        return _err(str(e), 404)
    except Exception as e:
        return _err(str(e), 500)


# ── Clinics ───────────────────────────────────────────────────────────────────

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


@router.post("/clinics")
async def create_clinic(request: Request, body: ClinicCreateBody):
    await require_admin(request)
    try:
        clinic = await admin_service.create_clinic(body.model_dump(exclude_none=True))
        return _ok({"clinic": clinic, "message": "Clinic created"}, 201)
    except ValueError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@router.put("/clinics/{clinic_id}")
async def update_clinic(clinic_id: str, request: Request, body: ClinicUpdateBody):
    await require_admin(request)
    try:
        clinic = await admin_service.update_clinic(clinic_id, body.model_dump(exclude_none=True))
        return _ok({"clinic": clinic, "message": "Clinic updated"})
    except ValueError as e:
        return _err(str(e), 404)
    except Exception as e:
        return _err(str(e), 500)


@router.delete("/clinics/{clinic_id}")
async def delete_clinic(clinic_id: str, request: Request):
    await require_admin(request)
    try:
        await admin_service.delete_clinic(clinic_id)
        return _ok({"message": "Clinic deleted"})
    except ValueError as e:
        return _err(str(e), 404)
    except Exception as e:
        return _err(str(e), 500)


# ── Prescriptions ─────────────────────────────────────────────────────────────

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


# ── Revenue ───────────────────────────────────────────────────────────────────

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


# ── Patients ──────────────────────────────────────────────────────────────────

@router.get("/patients")
async def patients(
    request: Request,
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    await require_admin(request)
    try:
        return _ok(await admin_service.list_patients(search=search, limit=limit, offset=offset))
    except Exception as e:
        return _err(str(e), 500)
