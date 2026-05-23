from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from app.config.database import get_db
from app.models.common import serialize_doc
import uuid


# ─── Patients ────────────────────────────────────────────────────────────────

async def list_patients(clinic_id: str, search: str = None, limit: int = 100, offset: int = 0) -> list:
    db = get_db()
    query = {"clinic_id": clinic_id, "is_deleted": {"$ne": True}}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    cursor = db.patients.find(query).sort("name", 1).skip(offset).limit(limit)
    return [serialize_doc(p) async for p in cursor]


async def get_patient(clinic_id: str, patient_id: str) -> dict:
    db = get_db()
    patient = await db.patients.find_one({"_id": ObjectId(patient_id), "clinic_id": clinic_id, "is_deleted": {"$ne": True}})
    if not patient:
        raise ValueError("Patient not found")
    return serialize_doc(patient)


async def create_patient(clinic_id: str, data: dict) -> dict:
    db = get_db()
    data["clinic_id"] = clinic_id
    data["is_deleted"] = False
    data["created_at"] = datetime.now(timezone.utc)
    data["updated_at"] = datetime.now(timezone.utc)
    result = await db.patients.insert_one(data)
    patient = await db.patients.find_one({"_id": result.inserted_id})
    return serialize_doc(patient)


async def update_patient(clinic_id: str, patient_id: str, data: dict) -> dict:
    db = get_db()
    data["updated_at"] = datetime.now(timezone.utc)
    await db.patients.update_one(
        {"_id": ObjectId(patient_id), "clinic_id": clinic_id},
        {"$set": data}
    )
    patient = await db.patients.find_one({"_id": ObjectId(patient_id)})
    return serialize_doc(patient)


# ─── Queue helpers ────────────────────────────────────────────────────────────

async def _enrich_queue_items(db, queue_docs: list) -> list:
    """Join patient data into each queue item so the frontend gets full patient info."""
    result = []
    for q in queue_docs:
        doc = serialize_doc(q)
        patient_id = doc.get("patient_id")
        if patient_id:
            try:
                patient = await db.patients.find_one({"_id": ObjectId(patient_id)})
                if patient:
                    doc["patient_name"] = patient.get("name")
                    doc["patient_age"] = patient.get("age")
                    doc["patient_gender"] = patient.get("gender")
                    doc["patient_phone"] = patient.get("phone", "")
                    doc["patient_weight"] = patient.get("weight")
                    doc["patient_address"] = patient.get("address", "")
                    doc["patient_blood_group"] = patient.get("blood_group", "")
                    doc["patient_allergies"] = patient.get("allergies", "")
            except Exception:
                pass
        result.append(doc)
    return result


# ─── Queue ────────────────────────────────────────────────────────────────────

async def get_today_queue(clinic_id: str) -> list:
    db = get_db()
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    query = {
        "clinic_id": clinic_id,
        "added_at": {"$gte": today_start},
        "is_deleted": {"$ne": True},
    }
    docs = [q async for q in db.queue.find(query).sort("added_at", 1)]
    return await _enrich_queue_items(db, docs)


async def get_queue_stats(clinic_id: str) -> dict:
    db = get_db()
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    query = {"clinic_id": clinic_id, "added_at": {"$gte": today_start}, "is_deleted": {"$ne": True}}
    pipeline = [
        {"$match": query},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    result = {"waiting": 0, "in_progress": 0, "completed": 0, "cancelled": 0, "total": 0}
    async for row in db.queue.aggregate(pipeline):
        status = row["_id"]
        if status in result:
            result[status] = row["count"]
        result["total"] += row["count"]
    return result


async def get_filtered_queue(clinic_id: str, status: str = None, date_str: str = None, today_only: bool = None) -> list:
    db = get_db()
    query = {"clinic_id": clinic_id, "is_deleted": {"$ne": True}}
    if status:
        query["status"] = status
    if today_only:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        query["added_at"] = {"$gte": today_start}
    elif date_str:
        try:
            d = datetime.strptime(date_str, "%Y-%m-%d")
            start = d.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
            end = d.replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc)
            query["added_at"] = {"$gte": start, "$lte": end}
        except Exception:
            pass
    docs = [q async for q in db.queue.find(query).sort("added_at", -1)]
    return await _enrich_queue_items(db, docs)


async def get_patient_queue_history(clinic_id: str, patient_id: str) -> list:
    db = get_db()
    docs = [q async for q in db.queue.find(
        {"clinic_id": clinic_id, "patient_id": patient_id, "is_deleted": {"$ne": True}}
    ).sort("added_at", -1)]
    return await _enrich_queue_items(db, docs)


async def add_to_queue(clinic_id: str, user_id: str, patient_id: str, notes: str = None) -> dict:
    db = get_db()

    # Validate patient exists in this clinic
    try:
        patient = await db.patients.find_one({"_id": ObjectId(patient_id), "clinic_id": clinic_id})
    except Exception:
        patient = None
    if not patient:
        raise ValueError("Patient not found in this clinic")

    # Atomic per-clinic-per-day counter — no race condition.
    today_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    counter = await db.counters.find_one_and_update(
        {"_id": f"queue_token:{clinic_id}:{today_key}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    token_number = counter["seq"]

    doc = {
        "clinic_id": clinic_id,
        "patient_id": patient_id,
        "status": "waiting",
        "added_by": user_id,
        "token_number": token_number,
        "notes": notes,
        "added_at": datetime.now(timezone.utc),
        "started_at": None,
        "completed_at": None,
        "updated_at": datetime.now(timezone.utc),
        "is_deleted": False,
    }
    result = await db.queue.insert_one(doc)
    q = await db.queue.find_one({"_id": result.inserted_id})
    enriched = await _enrich_queue_items(db, [q])
    return enriched[0]


async def update_queue_status(clinic_id: str, queue_id: str, status: str) -> dict:
    db = get_db()
    update = {"status": status, "updated_at": datetime.now(timezone.utc)}
    if status == "in_progress":
        update["started_at"] = datetime.now(timezone.utc)
    elif status in ("completed", "cancelled"):
        update["completed_at"] = datetime.now(timezone.utc)

    await db.queue.update_one({"_id": ObjectId(queue_id), "clinic_id": clinic_id}, {"$set": update})
    q = await db.queue.find_one({"_id": ObjectId(queue_id)})
    enriched = await _enrich_queue_items(db, [q])
    return enriched[0]


async def remove_from_queue(clinic_id: str, queue_id: str):
    db = get_db()
    await db.queue.update_one(
        {"_id": ObjectId(queue_id), "clinic_id": clinic_id},
        {"$set": {"is_deleted": True, "updated_at": datetime.now(timezone.utc)}}
    )


# ─── Prescriptions ────────────────────────────────────────────────────────────

def _generate_prescription_id() -> str:
    now = datetime.now(timezone.utc)
    return f"RX-{now.strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"


async def get_today_prescription_count(clinic_id: str) -> int:
    db = get_db()
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return await db.prescriptions.count_documents({
        "clinic_id": clinic_id,
        "created_at": {"$gte": today_start},
        "is_deleted": {"$ne": True},
    })


async def get_patient_prescriptions(clinic_id: str, patient_id: str) -> list:
    db = get_db()
    cursor = db.prescriptions.find({
        "clinic_id": clinic_id,
        "patient_id": patient_id,
        "is_deleted": {"$ne": True},
    }).sort("created_at", -1)
    return [serialize_doc(p) async for p in cursor]


async def get_prescription(clinic_id: str, prescription_id: str) -> dict:
    db = get_db()
    rx = await db.prescriptions.find_one({"_id": prescription_id, "clinic_id": clinic_id, "is_deleted": {"$ne": True}})
    if not rx:
        raise ValueError("Prescription not found")
    return serialize_doc(rx)


async def list_prescriptions(clinic_id: str, limit: int = 50) -> list:
    db = get_db()
    cursor = db.prescriptions.find({"clinic_id": clinic_id, "is_deleted": {"$ne": True}}).sort("created_at", -1).limit(limit)
    return [serialize_doc(p) async for p in cursor]


async def create_prescription(clinic_id: str, doctor_id: str, data: dict) -> dict:
    db = get_db()
    medicines = data.pop("medicines", [])
    lab_tests = data.pop("lab_tests", [])

    rx_id = _generate_prescription_id()
    rx_doc = {
        "_id": rx_id,
        "clinic_id": clinic_id,
        "doctor_id": doctor_id,
        "patient_id": data.get("patient_id"),
        "patient_name": data.get("patient_name"),
        "patient_age": data.get("patient_age"),
        "patient_gender": data.get("patient_gender"),
        "patient_phone": data.get("patient_phone"),
        "diagnosis": data.get("diagnosis"),
        "advice": data.get("advice"),
        "follow_up_date": data.get("follow_up_date"),
        "medicines": medicines,
        "lab_tests": lab_tests,
        "status": "draft",
        "wallet_deducted": 0.0,
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.prescriptions.insert_one(rx_doc)
    rx = await db.prescriptions.find_one({"_id": rx_id})
    return serialize_doc(rx)


async def finalize_prescription(clinic_id: str, doctor_id: str, prescription_id: str) -> dict:
    """Finalize a prescription and atomically deduct the prescription fee.

    Idempotent: if the prescription is already finalized, returns it as-is.
    """
    from app.config.settings import settings
    from app.services import wallet_service

    db = get_db()
    rx = await db.prescriptions.find_one({"_id": prescription_id, "clinic_id": clinic_id})
    if not rx:
        raise ValueError("Prescription not found")

    # Idempotency — a retry after a successful finalize must succeed.
    if rx.get("status") == "finalized":
        return serialize_doc(rx)

    fee = float(settings.PRESCRIPTION_FEE)

    # Atomic deduction with idempotency key tied to this prescription.
    try:
        await wallet_service.deduct(
            user_id=doctor_id,
            amount=fee,
            description=f"Prescription fee for {prescription_id}",
            reference_id=prescription_id,
            idempotency_key=f"rx_fee:{prescription_id}",
        )
    except ValueError as e:
        # Surface as a 400 to the route layer.
        raise ValueError(
            "Insufficient wallet balance. Please recharge to issue a prescription."
        ) from e

    # Mark finalized only if still draft — protects against a parallel finalize.
    update_result = await db.prescriptions.update_one(
        {"_id": prescription_id, "status": "draft"},
        {"$set": {
            "status": "finalized",
            "wallet_deducted": fee,
            "finalized_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }}
    )
    if update_result.modified_count == 0:
        # Someone else finalized between our read and write — refund our debit.
        await wallet_service.refund(
            user_id=doctor_id,
            amount=fee,
            reference_id=prescription_id,
            description=f"Refund: duplicate finalize for {prescription_id}",
        )

    rx = await db.prescriptions.find_one({"_id": prescription_id})
    return serialize_doc(rx)


async def link_transcript_to_prescription(
    clinic_id: str, prescription_id: str, transcript_id: str, queue_item_id: str = None
):
    """Attach a transcript reference to a prescription so the audit trail
    survives even after the consultation ends."""
    db = get_db()
    update = {
        "transcript_id": transcript_id,
        "updated_at": datetime.now(timezone.utc),
    }
    if queue_item_id:
        update["queue_item_id"] = queue_item_id
    await db.prescriptions.update_one(
        {"_id": prescription_id, "clinic_id": clinic_id},
        {"$set": update},
    )


# ─── Custom Medicines ─────────────────────────────────────────────────────────

async def get_frequent_medicines(clinic_id: str, limit: int = 10) -> list:
    db = get_db()
    cursor = db.custom_medicines.find({"clinic_id": clinic_id}).sort("usage_count", -1).limit(limit)
    return [serialize_doc(m) async for m in cursor]


async def search_medicines(clinic_id: str, search: str = None) -> list:
    db = get_db()
    query = {"clinic_id": clinic_id}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    cursor = db.custom_medicines.find(query).sort("name", 1)
    return [serialize_doc(m) async for m in cursor]


async def add_custom_medicine(clinic_id: str, data: dict) -> dict:
    db = get_db()
    data["clinic_id"] = clinic_id
    data["usage_count"] = 0
    data["created_at"] = datetime.now(timezone.utc)
    data["updated_at"] = datetime.now(timezone.utc)
    try:
        result = await db.custom_medicines.insert_one(data)
        med = await db.custom_medicines.find_one({"_id": result.inserted_id})
        return serialize_doc(med)
    except Exception:
        raise ValueError("Medicine already exists in this clinic")


async def increment_medicine_usage(clinic_id: str, medicine_id: str = None, name: str = None):
    db = get_db()
    if name:
        query = {"clinic_id": clinic_id, "name": {"$regex": f"^{name}$", "$options": "i"}}
    elif medicine_id:
        try:
            query = {"_id": ObjectId(medicine_id), "clinic_id": clinic_id}
        except Exception:
            query = {"clinic_id": clinic_id, "name": medicine_id}
    else:
        return
    await db.custom_medicines.update_one(
        query,
        {"$inc": {"usage_count": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}}
    )


async def delete_custom_medicine(clinic_id: str, medicine_id: str):
    db = get_db()
    await db.custom_medicines.delete_one({"_id": ObjectId(medicine_id), "clinic_id": clinic_id})


# ─── Custom Lab Tests ─────────────────────────────────────────────────────────

async def get_frequent_lab_tests(clinic_id: str, limit: int = 10) -> list:
    db = get_db()
    cursor = db.custom_lab_tests.find({"clinic_id": clinic_id}).sort("usage_count", -1).limit(limit)
    return [serialize_doc(t) async for t in cursor]


async def search_lab_tests(clinic_id: str, search: str = None) -> list:
    db = get_db()
    query = {"clinic_id": clinic_id}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    cursor = db.custom_lab_tests.find(query).sort("name", 1)
    return [serialize_doc(t) async for t in cursor]


async def add_custom_lab_test(clinic_id: str, data: dict) -> dict:
    db = get_db()
    data["clinic_id"] = clinic_id
    data["usage_count"] = 0
    data["created_at"] = datetime.now(timezone.utc)
    data["updated_at"] = datetime.now(timezone.utc)
    try:
        result = await db.custom_lab_tests.insert_one(data)
        test = await db.custom_lab_tests.find_one({"_id": result.inserted_id})
        return serialize_doc(test)
    except Exception:
        raise ValueError("Lab test already exists in this clinic")


async def increment_lab_test_usage(clinic_id: str, test_id: str = None, name: str = None):
    db = get_db()
    if name:
        query = {"clinic_id": clinic_id, "name": {"$regex": f"^{name}$", "$options": "i"}}
    elif test_id:
        try:
            query = {"_id": ObjectId(test_id), "clinic_id": clinic_id}
        except Exception:
            query = {"clinic_id": clinic_id, "name": test_id}
    else:
        return
    await db.custom_lab_tests.update_one(
        query,
        {"$inc": {"usage_count": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}}
    )


async def delete_custom_lab_test(clinic_id: str, test_id: str):
    db = get_db()
    await db.custom_lab_tests.delete_one({"_id": ObjectId(test_id), "clinic_id": clinic_id})
