"""Admin service — platform-wide aggregations for the Admin Interface.

All read-only. Mutations (promote / deactivate users) live in admin routes
that call dedicated helpers below.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId

from app.config.database import get_db
from app.models.common import serialize_doc


async def get_overview() -> dict:
    db = get_db()
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)

    # Counts by role
    doctors = await db.users.count_documents({"role": "doctor", "is_active": True})
    assistants = await db.users.count_documents({"role": "assistant", "is_active": True})
    admins = await db.users.count_documents({"role": "admin", "is_active": True})
    total_clinics = await db.clinics.count_documents({})

    total_patients = await db.patients.count_documents({"is_deleted": {"$ne": True}})

    rx_total = await db.prescriptions.count_documents({"is_deleted": {"$ne": True}})
    rx_finalized = await db.prescriptions.count_documents({
        "status": "finalized", "is_deleted": {"$ne": True}
    })
    rx_today = await db.prescriptions.count_documents({
        "created_at": {"$gte": today_start}, "is_deleted": {"$ne": True}
    })
    rx_week = await db.prescriptions.count_documents({
        "created_at": {"$gte": week_start}, "is_deleted": {"$ne": True}
    })
    rx_month = await db.prescriptions.count_documents({
        "created_at": {"$gte": month_start}, "is_deleted": {"$ne": True}
    })

    # Revenue = total wallet credits across all users (platform money in)
    rev_pipeline = [
        {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}}
    ]
    rev_total_credit = 0.0
    rev_total_debit = 0.0
    rev_total_refund = 0.0
    async for row in db.transactions.aggregate(rev_pipeline):
        if row["_id"] == "credit":
            rev_total_credit = row["total"]
        elif row["_id"] == "debit":
            rev_total_debit = row["total"]
        elif row["_id"] == "refund":
            rev_total_refund = row["total"]

    # Active doctors in last 15 minutes
    online_threshold = now - timedelta(minutes=15)
    online_doctors = await db.users.count_documents({
        "role": "doctor",
        "is_active": True,
        "last_active_at": {"$gte": online_threshold},
    })

    return {
        "users": {
            "doctors": doctors,
            "assistants": assistants,
            "admins": admins,
            "onlineDoctors": online_doctors,
        },
        "clinics": {"total": total_clinics},
        "patients": {"total": total_patients},
        "prescriptions": {
            "total": rx_total,
            "finalized": rx_finalized,
            "today": rx_today,
            "week": rx_week,
            "month": rx_month,
        },
        "revenue": {
            "totalCredits": rev_total_credit,
            "totalDebits": rev_total_debit,
            "totalRefunds": rev_total_refund,
            "platformGross": rev_total_debit - rev_total_refund,
        },
        "generatedAt": now.isoformat(),
    }


async def list_users(
    role: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    db = get_db()
    q: dict = {}
    if role and role in ("doctor", "assistant", "admin"):
        q["role"] = role
    if search:
        import re
        q["$or"] = [
            {"phone": {"$regex": re.escape(search), "$options": "i"}},
            {"name": {"$regex": re.escape(search), "$options": "i"}},
        ]
    total = await db.users.count_documents(q)
    cursor = db.users.find(q).sort("created_at", -1).skip(offset).limit(limit)
    users = []
    async for u in cursor:
        doc = serialize_doc(u)
        doc.pop("password_hash", None)
        doc.pop("otp_hash", None)
        doc.pop("otp_attempts", None)
        users.append(doc)
    return {"total": total, "users": users}


async def list_clinics(search: Optional[str] = None, limit: int = 100, offset: int = 0) -> dict:
    db = get_db()
    q: dict = {}
    if search:
        import re
        q["name"] = {"$regex": re.escape(search), "$options": "i"}
    total = await db.clinics.count_documents(q)
    cursor = db.clinics.find(q).sort("created_at", -1).skip(offset).limit(limit)
    items = []
    async for c in cursor:
        doc = serialize_doc(c)
        cid = doc["id"]
        doc["doctorCount"] = await db.users.count_documents({"clinic_id": cid, "role": "doctor", "is_active": True})
        doc["assistantCount"] = await db.users.count_documents({"clinic_id": cid, "role": "assistant", "is_active": True})
        doc["prescriptionCount"] = await db.prescriptions.count_documents({"clinic_id": cid, "is_deleted": {"$ne": True}})
        items.append(doc)
    return {"total": total, "clinics": items}


async def list_prescriptions(
    clinic_id: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    db = get_db()
    q: dict = {"is_deleted": {"$ne": True}}
    if clinic_id:
        q["clinic_id"] = clinic_id
    total = await db.prescriptions.count_documents(q)
    cursor = db.prescriptions.find(q).sort("created_at", -1).skip(offset).limit(limit)
    items = [serialize_doc(p) async for p in cursor]
    return {"total": total, "prescriptions": items}


async def revenue_breakdown(period: str = "month") -> dict:
    db = get_db()
    now = datetime.now(timezone.utc)
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start = now - timedelta(days=7)
    else:
        start = now - timedelta(days=30)

    pipeline = [
        {"$match": {"created_at": {"$gte": start, "$lte": now}}},
        {"$group": {"_id": "$type", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]
    by_type: dict = {}
    async for row in db.transactions.aggregate(pipeline):
        by_type[row["_id"]] = {"total": row["total"], "count": row["count"]}

    return {
        "period": period,
        "byType": by_type,
        "platformRevenue": by_type.get("debit", {}).get("total", 0.0) - by_type.get("refund", {}).get("total", 0.0),
        "generatedAt": now.isoformat(),
    }


async def set_user_active(user_id: str, is_active: bool) -> dict:
    db = get_db()
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_active": is_active, "updated_at": datetime.now(timezone.utc)}},
    )
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise ValueError("User not found")
    doc = serialize_doc(user)
    doc.pop("password_hash", None)
    doc.pop("otp_hash", None)
    return doc


async def promote_to_admin(user_id: str) -> dict:
    db = get_db()
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"role": "admin", "updated_at": datetime.now(timezone.utc)}},
    )
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise ValueError("User not found")
    doc = serialize_doc(user)
    doc.pop("password_hash", None)
    doc.pop("otp_hash", None)
    return doc
