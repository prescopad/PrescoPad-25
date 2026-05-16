from fastapi import APIRouter, Request, Query
from fastapi.responses import JSONResponse
from typing import Optional
from app.models.clinic import ClinicRequest
from app.middleware.auth import get_current_user, require_doctor, TokenData
import app.services.clinic_service as clinic_service

router = APIRouter(prefix="/api/clinic", tags=["clinic"])


def _ok(body: dict, status: int = 200):
    body["success"] = True
    return JSONResponse(content=body, status_code=status)


def _err(message: str, status: int = 400):
    return JSONResponse(content={"success": False, "message": message}, status_code=status)


# IMPORTANT: fixed/literal routes MUST come before parameterised /{clinic_id} routes
# otherwise FastAPI matches "list" and "doctor-status" as clinic_id values.

@router.get("/list")
async def list_clinics(
    request: Request,
    search: Optional[str] = Query(default=None),
):
    await get_current_user(request)
    try:
        clinics = await clinic_service.get_clinics(search=search)
        return _ok({"clinics": clinics})
    except Exception as e:
        return _err(str(e), 500)


@router.get("/doctor-status")
async def doctor_status(request: Request):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        result = await clinic_service.get_doctor_status(user.clinic_id)
        return _ok({"doctors": result})
    except Exception as e:
        return _err(str(e), 500)


@router.get("/")
async def get_clinic(request: Request):
    user: TokenData = await get_current_user(request)
    try:
        clinic = await clinic_service.get_my_clinic(user.user_id, user.clinic_id)
        return _ok({"clinic": clinic})
    except ValueError as e:
        return _err(str(e), 404)
    except Exception as e:
        return _err(str(e), 500)


@router.put("/")
async def upsert_clinic(request: Request, body: ClinicRequest):
    user: TokenData = await require_doctor(request)
    try:
        clinic = await clinic_service.create_or_update_clinic(
            user.user_id, user.clinic_id, body.model_dump(exclude_none=True)
        )
        return _ok({"clinic": clinic, "message": "Clinic saved"})
    except Exception as e:
        return _err(str(e), 500)


# Parameterised routes AFTER all fixed routes
@router.get("/{clinic_id}/doctors")
async def doctors_in_clinic(clinic_id: str, request: Request):
    await get_current_user(request)
    try:
        doctors = await clinic_service.get_doctors_in_clinic(clinic_id)
        return _ok({"doctors": doctors})
    except Exception as e:
        return _err(str(e), 500)
