"""Wallet service — all balance mutations use atomic Mongo operators.

Race-safety: we never read-then-write balance. Recharge uses `$inc`. Deduction
uses a conditional `update_one(balance >= amount, $inc -amount)` so two
concurrent debits cannot both succeed when only one is funded.
"""
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from app.config.database import get_db
from app.models.common import serialize_doc


async def get_wallet(user_id: str) -> dict:
    db = get_db()
    wallet = await db.wallets.find_one({"user_id": user_id})
    if not wallet:
        raise ValueError("Wallet not found")
    return serialize_doc(wallet)


async def recharge(user_id: str, amount: float, reference_id: Optional[str] = None) -> dict:
    if amount <= 0:
        raise ValueError("Recharge amount must be positive")

    db = get_db()
    now = datetime.now(timezone.utc)

    result = await db.wallets.find_one_and_update(
        {"user_id": user_id},
        {"$inc": {"balance": amount}, "$set": {"updated_at": now}},
        return_document=True,
    )
    if not result:
        raise ValueError("Wallet not found")

    # Insert transaction with the resolved ObjectId so downstream $lookup works.
    await db.transactions.insert_one({
        "wallet_id": result["_id"],
        "user_id": user_id,
        "type": "credit",
        "amount": amount,
        "description": "Wallet recharge",
        "reference_id": reference_id,
        "created_at": now,
    })

    return serialize_doc(result)


async def deduct(
    user_id: str,
    amount: float,
    description: str,
    reference_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> dict:
    """Atomically deduct `amount` from the wallet. Raises if insufficient.

    If `idempotency_key` is provided, a prior transaction with the same key is
    treated as success — wallet balance is returned unchanged.
    """
    if amount <= 0:
        raise ValueError("Deduction amount must be positive")

    db = get_db()
    now = datetime.now(timezone.utc)

    if idempotency_key:
        existing = await db.transactions.find_one({"idempotency_key": idempotency_key})
        if existing:
            wallet = await db.wallets.find_one({"user_id": user_id})
            if wallet:
                return serialize_doc(wallet)

    # Conditional atomic decrement — only succeeds if balance >= amount.
    result = await db.wallets.find_one_and_update(
        {"user_id": user_id, "balance": {"$gte": amount}},
        {"$inc": {"balance": -amount}, "$set": {"updated_at": now}},
        return_document=True,
    )
    if not result:
        # Either no wallet, or insufficient funds — disambiguate.
        wallet = await db.wallets.find_one({"user_id": user_id})
        if not wallet:
            raise ValueError("Wallet not found")
        raise ValueError("Insufficient balance")

    tx_doc = {
        "wallet_id": result["_id"],
        "user_id": user_id,
        "type": "debit",
        "amount": amount,
        "description": description,
        "reference_id": reference_id,
        "created_at": now,
    }
    if idempotency_key:
        tx_doc["idempotency_key"] = idempotency_key

    try:
        await db.transactions.insert_one(tx_doc)
    except Exception:
        # Insert failed after debit succeeded — refund to keep books consistent.
        await db.wallets.update_one(
            {"_id": result["_id"]},
            {"$inc": {"balance": amount}, "$set": {"updated_at": now}},
        )
        raise

    return serialize_doc(result)


async def refund(
    user_id: str,
    amount: float,
    reference_id: Optional[str] = None,
    description: str = "Refund",
) -> dict:
    """Credit back a previously deducted amount (e.g. PDF generation failed
    after the prescription was finalized)."""
    if amount <= 0:
        raise ValueError("Refund amount must be positive")

    db = get_db()
    now = datetime.now(timezone.utc)

    result = await db.wallets.find_one_and_update(
        {"user_id": user_id},
        {"$inc": {"balance": amount}, "$set": {"updated_at": now}},
        return_document=True,
    )
    if not result:
        raise ValueError("Wallet not found")

    await db.transactions.insert_one({
        "wallet_id": result["_id"],
        "user_id": user_id,
        "type": "refund",
        "amount": amount,
        "description": description,
        "reference_id": reference_id,
        "created_at": now,
    })
    return serialize_doc(result)


async def get_transactions(user_id: str) -> list:
    db = get_db()
    wallet = await db.wallets.find_one({"user_id": user_id})
    if not wallet:
        return []
    # Backward-compat: older transactions stored wallet_id as a string.
    cursor = db.transactions.find(
        {"$or": [{"wallet_id": wallet["_id"]}, {"wallet_id": str(wallet["_id"])}]}
    ).sort("created_at", -1)
    return [serialize_doc(t) async for t in cursor]


async def update_auto_refill(
    user_id: str,
    auto_refill: bool,
    amount: Optional[float] = None,
    threshold: Optional[float] = None,
) -> dict:
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
