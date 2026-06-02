from fastapi import APIRouter, Request, Query
from fastapi.responses import JSONResponse
from typing import Optional
from app.models.data import (
    PatientRequest, QueueRequest, QueueStatusRequest,
    PrescriptionRequest, CustomMedicineRequest, CustomMedicineUsageRequest,
    CustomLabTestRequest, CustomLabTestUsageRequest, FinalizePrescriptionRequest,
)
from app.middleware.auth import get_current_user, require_doctor, TokenData
import app.services.data_service as data_service

router = APIRouter(prefix="/api/data", tags=["data"])


def _ok(body: dict, status: int = 200):
    body["success"] = True
    return JSONResponse(content=body, status_code=status)


def _err(message: str, status: int = 400):
    return JSONResponse(content={"success": False, "message": message}, status_code=status)


# ─── Patients ─────────────────────────────────────────────────────────────────

@router.get("/patients")
async def list_patients(
    request: Request,
    search: Optional[str] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        patients = await data_service.list_patients(user.clinic_id, search, limit, offset)
        return _ok({"patients": patients})
    except Exception as e:
        return _err(str(e), 500)


@router.get("/patients/{patient_id}")
async def get_patient(patient_id: str, request: Request):
    user: TokenData = await get_current_user(request)
    try:
        patient = await data_service.get_patient(user.clinic_id, patient_id)
        return _ok({"patient": patient})
    except ValueError as e:
        return _err(str(e), 404)
    except Exception as e:
        return _err(str(e), 500)


@router.post("/patients")
async def create_patient(request: Request, body: PatientRequest):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        patient = await data_service.create_patient(user.clinic_id, body.normalized())
        return _ok({"patient": patient}, 201)
    except Exception as e:
        return _err(str(e), 500)


@router.put("/patients/{patient_id}")
async def update_patient(patient_id: str, request: Request, body: PatientRequest):
    user: TokenData = await get_current_user(request)
    try:
        patient = await data_service.update_patient(user.clinic_id, patient_id, body.normalized())
        return _ok({"patient": patient})
    except Exception as e:
        return _err(str(e), 500)


# ─── Queue ────────────────────────────────────────────────────────────────────

@router.get("/queue/today")
async def today_queue(request: Request):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        queue = await data_service.get_today_queue(user.clinic_id)
        return _ok({"queue": queue})
    except Exception as e:
        return _err(str(e), 500)


@router.get("/queue/stats")
async def queue_stats(request: Request):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        stats = await data_service.get_queue_stats(user.clinic_id)
        return _ok({"stats": stats})
    except Exception as e:
        return _err(str(e), 500)


@router.get("/queue/filtered")
async def filtered_queue(
    request: Request,
    status: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    todayOnly: Optional[bool] = Query(None),
):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        queue = await data_service.get_filtered_queue(user.clinic_id, status, date, todayOnly)
        return _ok({"queue": queue})
    except Exception as e:
        return _err(str(e), 500)


@router.get("/queue/stats/filtered")
async def filtered_queue_stats(
    request: Request,
    status: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    todayOnly: Optional[bool] = Query(None),
):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        queue = await data_service.get_filtered_queue(user.clinic_id, status, date, todayOnly)
        stats = {
            "total": len(queue),
            "waiting": sum(1 for q in queue if q.get("status") == "waiting"),
            "in_progress": sum(1 for q in queue if q.get("status") == "in_progress"),
            "completed": sum(1 for q in queue if q.get("status") == "completed"),
        }
        return _ok({"stats": stats})
    except Exception as e:
        return _err(str(e), 500)


@router.get("/queue/patient/{patient_id}")
async def patient_queue_history(patient_id: str, request: Request):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        queue = await data_service.get_patient_queue_history(user.clinic_id, patient_id)
        return _ok({"queue": queue})
    except Exception as e:
        return _err(str(e), 500)


@router.post("/queue")
async def add_to_queue(request: Request, body: QueueRequest):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        item = await data_service.add_to_queue(
            user.clinic_id, user.user_id, body.get_patient_id(), body.notes
        )
        return _ok({"item": item}, 201)
    except Exception as e:
        return _err(str(e), 500)


@router.put("/queue/{queue_id}/status")
async def update_queue_status(queue_id: str, request: Request, body: QueueStatusRequest):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        item = await data_service.update_queue_status(user.clinic_id, queue_id, body.status)
        return _ok({"item": item})
    except Exception as e:
        return _err(str(e), 500)


@router.delete("/queue/{queue_id}")
async def remove_from_queue(queue_id: str, request: Request):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        await data_service.remove_from_queue(user.clinic_id, queue_id)
        return _ok({"message": "Removed from queue"})
    except Exception as e:
        return _err(str(e), 500)


# ─── Prescriptions ────────────────────────────────────────────────────────────

@router.get("/prescriptions/today/count")
async def today_prescription_count(request: Request):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        count = await data_service.get_today_prescription_count(user.clinic_id)
        return _ok({"count": count})
    except Exception as e:
        return _err(str(e), 500)


@router.get("/prescriptions/patient/{patient_id}")
async def patient_prescriptions(patient_id: str, request: Request):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        prescriptions = await data_service.get_patient_prescriptions(user.clinic_id, patient_id)
        return _ok({"prescriptions": prescriptions})
    except Exception as e:
        return _err(str(e), 500)


@router.get("/prescriptions/{prescription_id}")
async def get_prescription(prescription_id: str, request: Request):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        prescription = await data_service.get_prescription(user.clinic_id, prescription_id)
        return _ok({"prescription": prescription})
    except ValueError as e:
        return _err(str(e), 404)
    except Exception as e:
        return _err(str(e), 500)


@router.get("/prescriptions")
async def list_prescriptions(request: Request, limit: int = Query(50)):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        prescriptions = await data_service.list_prescriptions(user.clinic_id, limit)
        return _ok({"prescriptions": prescriptions})
    except Exception as e:
        return _err(str(e), 500)


@router.post("/prescriptions")
async def create_prescription(request: Request, body: PrescriptionRequest):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        prescription = await data_service.create_prescription(
            user.clinic_id, user.user_id, body.normalized()
        )
        return _ok({"prescription": prescription}, 201)
    except Exception as e:
        return _err(str(e), 500)


@router.put("/prescriptions/{prescription_id}/finalize")
async def finalize_prescription(prescription_id: str, request: Request, body: FinalizePrescriptionRequest):
    user: TokenData = await require_doctor(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        prescription = await data_service.finalize_prescription(
            user.clinic_id, user.user_id, prescription_id,
            signature=body.signature,
            pdf_hash=body.pdf_hash or body.pdfHash
        )
        return _ok({"prescription": prescription, "message": "Prescription finalized"})
    except ValueError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


# ─── Custom Medicines ─────────────────────────────────────────────────────────

@router.get("/custom-medicines/frequent")
async def frequent_medicines(request: Request):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        medicines = await data_service.get_frequent_medicines(user.clinic_id)
        return _ok({"medicines": medicines})
    except Exception as e:
        return _err(str(e), 500)


@router.get("/custom-medicines")
async def search_medicines(request: Request, search: Optional[str] = Query(None), q: Optional[str] = Query(None)):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        medicines = await data_service.search_medicines(user.clinic_id, search or q)
        return _ok({"medicines": medicines})
    except Exception as e:
        return _err(str(e), 500)


@router.post("/custom-medicines")
async def add_medicine(request: Request, body: CustomMedicineRequest):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        medicine = await data_service.add_custom_medicine(
            user.clinic_id, body.model_dump(exclude_none=True)
        )
        return _ok({"medicine": medicine}, 201)
    except ValueError as e:
        return _err(str(e), 409)
    except Exception as e:
        return _err(str(e), 500)


@router.put("/custom-medicines/usage")
async def medicine_usage(request: Request, body: CustomMedicineUsageRequest):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        await data_service.increment_medicine_usage(
            user.clinic_id, medicine_id=body.medicine_id, name=body.name
        )
        return _ok({"message": "Usage updated"})
    except Exception as e:
        return _err(str(e), 500)


@router.delete("/custom-medicines/{medicine_id}")
async def delete_medicine(medicine_id: str, request: Request):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        await data_service.delete_custom_medicine(user.clinic_id, medicine_id)
        return _ok({"message": "Medicine deleted"})
    except Exception as e:
        return _err(str(e), 500)


# ─── Custom Lab Tests ─────────────────────────────────────────────────────────

@router.get("/custom-lab-tests/frequent")
async def frequent_lab_tests(request: Request):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        lab_tests = await data_service.get_frequent_lab_tests(user.clinic_id)
        return _ok({"labTests": lab_tests})
    except Exception as e:
        return _err(str(e), 500)


@router.get("/custom-lab-tests")
async def search_lab_tests(request: Request, search: Optional[str] = Query(None), q: Optional[str] = Query(None)):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        lab_tests = await data_service.search_lab_tests(user.clinic_id, search or q)
        return _ok({"labTests": lab_tests})
    except Exception as e:
        return _err(str(e), 500)


@router.post("/custom-lab-tests")
async def add_lab_test(request: Request, body: CustomLabTestRequest):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        lab_test = await data_service.add_custom_lab_test(
            user.clinic_id, body.model_dump(exclude_none=True)
        )
        return _ok({"labTest": lab_test}, 201)
    except ValueError as e:
        return _err(str(e), 409)
    except Exception as e:
        return _err(str(e), 500)


@router.put("/custom-lab-tests/usage")
async def lab_test_usage(request: Request, body: CustomLabTestUsageRequest):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        await data_service.increment_lab_test_usage(
            user.clinic_id, test_id=body.test_id, name=body.name
        )
        return _ok({"message": "Usage updated"})
    except Exception as e:
        return _err(str(e), 500)


@router.delete("/custom-lab-tests/{test_id}")
async def delete_lab_test(test_id: str, request: Request):
    user: TokenData = await get_current_user(request)
    if not user.clinic_id:
        return _err("No clinic associated", 400)
    try:
        await data_service.delete_custom_lab_test(user.clinic_id, test_id)
        return _ok({"message": "Lab test deleted"})
    except Exception as e:
        return _err(str(e), 500)
