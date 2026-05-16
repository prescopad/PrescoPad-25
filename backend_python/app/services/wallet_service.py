from datetime import datetime, timezone
from bson import ObjectId
from app.config.database import get_db
from app.models.common import serialize_doc


async def get_wallet(user_id: str) -> dict:
    db = get_db()
    wallet = await db.wallets.find_one({"user_id": user_id})
    if not wallet:
        raise ValueError("Wallet not found")
    return serialize_doc(wallet)


async def recharge(user_id: str, amount: float, reference_id: str = None) -> dict:
    db = get_db()
    wallet = await db.wallets.find_one({"user_id": user_id})
    if not wallet:
        raise ValueError("Wallet not found")

    new_balance = wallet["balance"] + amount
    await db.wallets.update_one(
        {"user_id": user_id},
        {"$set": {"balance": new_balance, "updated_at": datetime.now(timezone.utc)}}
    )

    await db.transactions.insert_one({
        "wallet_id": str(wallet["_id"]),
        "type": "credit",
        "amount": amount,
        "description": "Wallet recharge",
        "reference_id": reference_id,
        "created_at": datetime.now(timezone.utc),
    })

    wallet = await db.wallets.find_one({"user_id": user_id})
    return serialize_doc(wallet)


async def deduct(user_id: str, amount: float, description: str, reference_id: str = None) -> dict:
    db = get_db()
    wallet = await db.wallets.find_one({"user_id": user_id})
    if not wallet:
        raise ValueError("Wallet not found")
    if wallet["balance"] < amount:
        raise ValueError("Insufficient balance")

    new_balance = wallet["balance"] - amount
    await db.wallets.update_one(
        {"user_id": user_id},
        {"$set": {"balance": new_balance, "updated_at": datetime.now(timezone.utc)}}
    )

    await db.transactions.insert_one({
        "wallet_id": str(wallet["_id"]),
        "type": "debit",
        "amount": amount,
        "description": description,
        "reference_id": reference_id,
        "created_at": datetime.now(timezone.utc),
    })

    wallet = await db.wallets.find_one({"user_id": user_id})
    return serialize_doc(wallet)


async def get_transactions(user_id: str) -> list:
    db = get_db()
    wallet = await db.wallets.find_one({"user_id": user_id})
    if not wallet:
        return []
    cursor = db.transactions.find({"wallet_id": str(wallet["_id"])}).sort("created_at", -1)
    return [serialize_doc(t) async for t in cursor]


async def update_auto_refill(user_id: str, auto_refill: bool, amount: float = None, threshold: float = None) -> dict:
    db = get_db()
    update = {
        "auto_refill": auto_refill,
        "auto_refill_amount": amount,
        "auto_refill_threshold": threshold,
        "updated_at": datetime.now(timezone.utc),
    }
    await db.wallets.update_one({"user_id": user_id}, {"$set": update})
    wallet = await db.wallets.find_one({"user_id": user_id})
    return serialize_doc(wallet)
