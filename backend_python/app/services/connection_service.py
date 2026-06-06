from datetime import datetime, timezone
from bson import ObjectId
from app.config.database import get_db
from app.models.common import serialize_doc


async def invite_assistant(doctor_id: str, clinic_id: str, assistant_phone: str) -> dict:
    db = get_db()
    assistant = await db.assistants.find_one({"phone": assistant_phone})
    if not assistant:
        raise ValueError("Assistant not found with that phone number")

    assistant_id = str(assistant["_id"])
    existing = await db.connection_requests.find_one({
        "doctor_id": doctor_id,
        "assistant_id": assistant_id,
        "status": "pending",
    })
    if existing:
        raise ValueError("Pending request already exists")

    doc = {
        "clinic_id": clinic_id,
        "doctor_id": doctor_id,
        "assistant_id": assistant_id,
        "initiated_by": "doctor",
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = await db.connection_requests.insert_one(doc)
    req = await db.connection_requests.find_one({"_id": result.inserted_id})
    return serialize_doc(req)


async def request_join(assistant_id: str, doctor_code: str) -> dict:
    db = get_db()
    doctor = await db.doctors.find_one({"doctor_code": doctor_code})
    if not doctor:
        raise ValueError("Doctor not found with that code")

    doctor_id = str(doctor["_id"])
    existing = await db.connection_requests.find_one({
        "doctor_id": doctor_id,
        "assistant_id": assistant_id,
        "status": "pending",
    })
    if existing:
        raise ValueError("Pending request already exists")

    doc = {
        "clinic_id": doctor.get("clinic_id"),
        "doctor_id": doctor_id,
        "assistant_id": assistant_id,
        "initiated_by": "assistant",
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = await db.connection_requests.insert_one(doc)
    req = await db.connection_requests.find_one({"_id": result.inserted_id})
    return serialize_doc(req)


async def accept_request(request_id: str, user_id: str, role: str) -> dict:
    db = get_db()
    req = await db.connection_requests.find_one({"_id": ObjectId(request_id), "status": "pending"})
    if not req:
        raise ValueError("Request not found or not pending")

    if role == "doctor" and req["doctor_id"] != user_id:
        raise ValueError("Not authorized")
    if role == "assistant" and req["assistant_id"] != user_id:
        raise ValueError("Not authorized")

    await db.connection_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "accepted", "updated_at": datetime.now(timezone.utc)}}
    )
    await db.assistants.update_one(
        {"_id": ObjectId(req["assistant_id"])},
        {"$set": {"clinic_id": req.get("clinic_id"), "updated_at": datetime.now(timezone.utc)}}
    )

    # Clinic now has at least one assistant → solo_mode off.
    if req.get("clinic_id"):
        await db.clinics.update_one(
            {"_id": ObjectId(req["clinic_id"])},
            {"$set": {"solo_mode": False, "updated_at": datetime.now(timezone.utc)}},
        )

    req = await db.connection_requests.find_one({"_id": ObjectId(request_id)})
    return serialize_doc(req)


async def reject_request(request_id: str, user_id: str, role: str) -> dict:
    db = get_db()
    req = await db.connection_requests.find_one({"_id": ObjectId(request_id), "status": "pending"})
    if not req:
        raise ValueError("Request not found or not pending")

    if role == "doctor" and req["doctor_id"] != user_id:
        raise ValueError("Not authorized")
    if role == "assistant" and req["assistant_id"] != user_id:
        raise ValueError("Not authorized")

    await db.connection_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "rejected", "updated_at": datetime.now(timezone.utc)}}
    )
    req = await db.connection_requests.find_one({"_id": ObjectId(request_id)})
    return serialize_doc(req)


async def get_pending(user_id: str, role: str) -> list:
    db = get_db()
    query = {"status": "pending"}
    if role == "doctor":
        query["doctor_id"] = user_id
    else:
        query["assistant_id"] = user_id

    result = []
    async for r in db.connection_requests.find(query):
        doc = serialize_doc(r)

        # Attach human-readable names so the frontend can display them
        try:
            doctor = await db.doctors.find_one({"_id": ObjectId(doc["doctor_id"])})
            doc["doctor_name"] = doctor.get("name") if doctor else None
        except Exception:
            doc["doctor_name"] = None

        try:
            assistant = await db.assistants.find_one({"_id": ObjectId(doc["assistant_id"])})
            if assistant:
                doc["assistant_name"] = assistant.get("name")
                doc["assistant_phone"] = assistant.get("phone")
                doc["qualification"] = assistant.get("specialty")
                doc["experience_years"] = assistant.get("experience_years")
                doc["city"] = assistant.get("city")
                doc["assistant_address"] = assistant.get("address")
            else:
                doc["assistant_name"] = None
                doc["assistant_phone"] = None
        except Exception:
            doc["assistant_name"] = None
            doc["assistant_phone"] = None

        # Attach clinic name
        try:
            if doc.get("clinic_id"):
                clinic = await db.clinics.find_one({"_id": ObjectId(doc["clinic_id"])})
                doc["clinic_name"] = clinic.get("name") if clinic else None
            else:
                doc["clinic_name"] = None
        except Exception:
            doc["clinic_name"] = None

        result.append(doc)
    return result


async def get_team(clinic_id: str) -> list:
    db = get_db()
    team = []
    
    # Doctors
    cursor = db.doctors.find({
        "clinic_id": clinic_id,
        "is_active": True,
    })
    async for u in cursor:
        doc = serialize_doc(u)
        doc.pop("password_hash", None)
        doc.pop("otp_hash", None)
        team.append(doc)

    # Assistants
    cursor = db.assistants.find({
        "clinic_id": clinic_id,
        "is_active": True,
    })
    async for u in cursor:
        doc = serialize_doc(u)
        doc.pop("password_hash", None)
        doc.pop("otp_hash", None)
        team.append(doc)

    return team


async def disconnect_assistant(doctor_id: str, clinic_id: str, assistant_id: str):
    db = get_db()
    assistant = await db.assistants.find_one({"_id": ObjectId(assistant_id), "clinic_id": clinic_id})
    if not assistant:
        raise ValueError("Assistant not in your clinic")

    await db.assistants.update_one(
        {"_id": ObjectId(assistant_id)},
        {"$set": {"clinic_id": None, "updated_at": datetime.now(timezone.utc)}}
    )
    await db.connection_requests.update_many(
        {"doctor_id": doctor_id, "assistant_id": assistant_id},
        {"$set": {"status": "rejected", "updated_at": datetime.now(timezone.utc)}}
    )

    # If no assistants remain, flip the clinic back to solo_mode so the doctor
    # regains AddPatient / PatientSearch capability.
    remaining = await db.assistants.count_documents({
        "clinic_id": clinic_id, "is_active": True,
    })
    if remaining == 0:
        await db.clinics.update_one(
            {"_id": ObjectId(clinic_id)},
            {"$set": {"solo_mode": True, "updated_at": datetime.now(timezone.utc)}},
        )
