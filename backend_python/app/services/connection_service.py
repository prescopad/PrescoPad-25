from datetime import datetime, timezone
from bson import ObjectId
from app.config.database import get_db
from app.models.common import serialize_doc


async def invite_assistant(doctor_id: str, clinic_id: str, assistant_phone: str) -> dict:
    db = get_db()
    assistant = await db.users.find_one({"phone": assistant_phone, "role": "assistant"})
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
    doctor = await db.users.find_one({"doctor_code": doctor_code, "role": "doctor"})
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
    await db.users.update_one(
        {"_id": ObjectId(req["assistant_id"])},
        {"$set": {"clinic_id": req.get("clinic_id"), "updated_at": datetime.now(timezone.utc)}}
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
    cursor = db.connection_requests.find(query)
    return [serialize_doc(r) async for r in cursor]


async def get_team(clinic_id: str) -> list:
    db = get_db()
    cursor = db.users.find({"clinic_id": clinic_id, "role": "assistant", "is_active": True})
    team = []
    async for u in cursor:
        doc = serialize_doc(u)
        doc.pop("password_hash", None)
        doc.pop("otp_hash", None)
        team.append(doc)
    return team


async def disconnect_assistant(doctor_id: str, clinic_id: str, assistant_id: str):
    db = get_db()
    assistant = await db.users.find_one({"_id": ObjectId(assistant_id), "clinic_id": clinic_id})
    if not assistant:
        raise ValueError("Assistant not in your clinic")

    await db.users.update_one(
        {"_id": ObjectId(assistant_id)},
        {"$set": {"clinic_id": None, "updated_at": datetime.now(timezone.utc)}}
    )
    await db.connection_requests.update_many(
        {"doctor_id": doctor_id, "assistant_id": assistant_id},
        {"$set": {"status": "rejected", "updated_at": datetime.now(timezone.utc)}}
    )
