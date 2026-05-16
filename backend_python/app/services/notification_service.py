from datetime import datetime, timezone
from bson import ObjectId
from app.config.database import get_db
from app.models.common import serialize_doc


async def get_pending_notifications(user_id: str) -> list:
    db = get_db()
    cursor = db.notification_jobs.find({
        "user_id": user_id,
        "status": "pending",
    }).sort("created_at", -1)
    return [serialize_doc(n) async for n in cursor]


async def mark_read(user_id: str, notification_id: str) -> dict:
    db = get_db()
    notif = await db.notification_jobs.find_one({"_id": ObjectId(notification_id), "user_id": user_id})
    if not notif:
        raise ValueError("Notification not found")
    await db.notification_jobs.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"status": "sent", "sent_at": datetime.now(timezone.utc)}}
    )
    notif = await db.notification_jobs.find_one({"_id": ObjectId(notification_id)})
    return serialize_doc(notif)
