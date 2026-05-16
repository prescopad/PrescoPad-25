from datetime import datetime, timezone, timedelta
from bson import ObjectId
from app.config.database import get_db
from app.models.common import serialize_doc


async def get_clinics(search: str = None) -> list:
    db = get_db()
    query = {}
    if search:
        import re
        query["name"] = {"$regex": re.escape(search), "$options": "i"}

    cursor = db.clinics.find(query)
    result = []
    async for c in cursor:
        doc = serialize_doc(c)
        # Attach the owner doctor's name so the frontend can show "Dr. X"
        owner_id = doc.get("owner_id")
        if owner_id:
            try:
                owner = await db.users.find_one({"_id": ObjectId(owner_id)})
                doc["doctor_name"] = owner.get("name") if owner else None
            except Exception:
                doc["doctor_name"] = None
        else:
            doc["doctor_name"] = None
        result.append(doc)
    return result


async def get_doctors_in_clinic(clinic_id: str) -> list:
    db = get_db()
    cursor = db.users.find({"clinic_id": clinic_id, "role": "doctor", "is_active": True})
    doctors = []
    async for u in cursor:
        doc = serialize_doc(u)
        doc.pop("password_hash", None)
        doc.pop("otp_hash", None)
        # Normalize snake_case → camelCase fields the frontend expects
        doc["doctorCode"] = doc.get("doctor_code")
        doc["regNumber"] = doc.get("reg_number")
        doctors.append(doc)
    return doctors


async def get_my_clinic(user_id: str, clinic_id: str) -> dict:
    db = get_db()
    if not clinic_id:
        raise ValueError("No clinic associated")
    clinic = await db.clinics.find_one({"_id": ObjectId(clinic_id)})
    if not clinic:
        raise ValueError("Clinic not found")
    return serialize_doc(clinic)


async def create_or_update_clinic(user_id: str, clinic_id: str, data: dict) -> dict:
    db = get_db()
    data["updated_at"] = datetime.now(timezone.utc)

    if clinic_id:
        clinic = await db.clinics.find_one({"_id": ObjectId(clinic_id), "owner_id": user_id})
        if clinic:
            await db.clinics.update_one({"_id": ObjectId(clinic_id)}, {"$set": data})
            clinic = await db.clinics.find_one({"_id": ObjectId(clinic_id)})
            return serialize_doc(clinic)

    data["owner_id"] = user_id
    data["created_at"] = datetime.now(timezone.utc)
    result = await db.clinics.insert_one(data)
    new_clinic_id = str(result.inserted_id)
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"clinic_id": new_clinic_id, "updated_at": datetime.now(timezone.utc)}}
    )
    clinic = await db.clinics.find_one({"_id": result.inserted_id})
    return serialize_doc(clinic)


async def get_doctor_status(clinic_id: str) -> list:
    db = get_db()
    threshold = datetime.now(timezone.utc) - timedelta(minutes=15)
    cursor = db.users.find({"clinic_id": clinic_id, "role": "doctor"})
    result = []
    async for doc in cursor:
        last_active = doc.get("last_active_at")
        if last_active and last_active.tzinfo is None:
            last_active = last_active.replace(tzinfo=timezone.utc)
        is_online = last_active and last_active > threshold
        result.append({
            "id": str(doc["_id"]),
            "name": doc.get("name"),
            "is_online": is_online,
            "last_active_at": last_active.isoformat() if last_active else None,
        })
    return result
