"""Per-clinic analytics aggregation.

Wallet transactions are joined to the clinic by:
  transactions.user_id -> users._id -> users.clinic_id

The previous version joined on transactions.wallet_id (string) to wallets._id
(ObjectId), which always returned empty. Now we filter transactions by the
doctors of the clinic (their user_ids), which is robust to type and works for
both old and new transactions.
"""
from datetime import datetime, timedelta, timezone

from app.config.database import get_db


def _period_range(period: str):
    now = datetime.now(timezone.utc)
    if period == "week":
        start = now - timedelta(days=7)
    elif period == "month":
        start = now - timedelta(days=30)
    else:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return start, now


async def get_analytics(clinic_id: str, period: str = "today") -> dict:
    db = get_db()
    start, end = _period_range(period)

    # Patient stats
    total_patients = await db.patients.count_documents({
        "clinic_id": clinic_id,
        "is_deleted": {"$ne": True},
    })
    new_patients = await db.patients.count_documents({
        "clinic_id": clinic_id,
        "created_at": {"$gte": start, "$lte": end},
        "is_deleted": {"$ne": True},
    })

    # Prescription stats
    rx_pipeline = [
        {"$match": {
            "clinic_id": clinic_id,
            "created_at": {"$gte": start, "$lte": end},
            "is_deleted": {"$ne": True},
        }},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "revenue": {"$sum": "$wallet_deducted"},
        }}
    ]
    rx_total = 0
    rx_finalized = 0
    rx_draft = 0
    rx_revenue = 0.0
    async for row in db.prescriptions.aggregate(rx_pipeline):
        rx_total += row["count"]
        rx_revenue += row.get("revenue", 0.0) or 0.0
        if row["_id"] == "finalized":
            rx_finalized = row["count"]
        elif row["_id"] == "draft":
            rx_draft = row["count"]

    # Consultation (queue) stats
    queue_pipeline = [
        {"$match": {
            "clinic_id": clinic_id,
            "added_at": {"$gte": start, "$lte": end},
            "is_deleted": {"$ne": True},
        }},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    q_total = 0
    q_completed = 0
    q_cancelled = 0
    async for row in db.queue.aggregate(queue_pipeline):
        q_total += row["count"]
        if row["_id"] == "completed":
            q_completed = row["count"]
        elif row["_id"] == "cancelled":
            q_cancelled = row["count"]

    # Wallet earnings — scope by clinic's doctor user_ids.
    doctor_ids = [str(u["_id"]) async for u in db.doctors.find(
        {"clinic_id": clinic_id}, {"_id": 1}
    )]
    admin_ids = [str(u["_id"]) async for u in db.admins.find(
        {"clinic_id": clinic_id}, {"_id": 1}
    )]
    doctor_ids.extend(admin_ids)
    total_debit = 0.0
    total_credit = 0.0
    if doctor_ids:
        tx_pipeline = [
            {"$match": {
                "user_id": {"$in": doctor_ids},
                "created_at": {"$gte": start, "$lte": end},
            }},
            {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}},
        ]
        async for row in db.transactions.aggregate(tx_pipeline):
            if row["_id"] == "debit":
                total_debit = row["total"]
            elif row["_id"] == "credit":
                total_credit = row["total"]

    # Popular medicines
    med_pipeline = [
        {"$match": {
            "clinic_id": clinic_id,
            "created_at": {"$gte": start, "$lte": end},
            "is_deleted": {"$ne": True},
        }},
        {"$unwind": "$medicines"},
        {"$group": {"_id": "$medicines.medicine_name", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5},
    ]
    top_medicines = []
    async for row in db.prescriptions.aggregate(med_pipeline):
        if row["_id"]:
            top_medicines.append({"name": row["_id"], "count": row["count"]})

    # Popular lab tests
    test_pipeline = [
        {"$match": {
            "clinic_id": clinic_id,
            "created_at": {"$gte": start, "$lte": end},
            "is_deleted": {"$ne": True},
        }},
        {"$unwind": "$lab_tests"},
        {"$group": {"_id": "$lab_tests.test_name", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5},
    ]
    top_tests = []
    async for row in db.prescriptions.aggregate(test_pipeline):
        if row["_id"]:
            top_tests.append({"name": row["_id"], "count": row["count"]})

    return {
        "prescriptions": {
            "total": rx_total,
            "finalized": rx_finalized,
            "draft": rx_draft,
        },
        "earnings": {
            "totalDebit": total_debit,
            "totalCredit": total_credit,
            "netEarnings": total_credit - total_debit,
            "prescriptionRevenue": rx_revenue,
        },
        "patients": {
            "newPatients": new_patients,
            "totalPatients": total_patients,
        },
        "consultations": {
            "totalConsultations": q_total,
            "completed": q_completed,
            "cancelled": q_cancelled,
            "avgWaitMinutes": 0,
            "avgConsultMinutes": 0,
        },
        "popular": {
            "topMedicines": top_medicines,
            "topTests": top_tests,
        },
    }
