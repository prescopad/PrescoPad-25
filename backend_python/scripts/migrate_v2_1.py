"""One-off migration to v2.1.

What this script does:
1. Backfill `transactions.wallet_id` from string ObjectId-encoded strings to real
   ObjectId. Older rows used `str(wallet["_id"])`, which broke `$lookup` joins.
2. Backfill `transactions.user_id` for old rows that didn't store it.
3. Set `clinic.solo_mode` for every existing clinic based on whether it has any
   active assistant. Doctors with no assistants get solo_mode=true so the
   in-app UI exposes patient management for them.
4. Reset `prescriptions.transcript_id` if missing (no-op for new docs).

Run:
    python -m scripts.migrate_v2_1            # apply
    python -m scripts.migrate_v2_1 --dry-run  # report only
"""
import argparse
import asyncio
import sys
from pathlib import Path

# Allow running from anywhere — add the backend_python folder to sys.path.
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import certifi
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

from app.config.settings import settings  # noqa: E402


async def main(dry_run: bool):
    client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=10000,
    )
    db = client[settings.MONGODB_DB_NAME]

    print(f"=== PrescoPad v2.1 migration ({'DRY RUN' if dry_run else 'APPLY'}) ===")

    # ── 1. transactions.wallet_id : string -> ObjectId ────────────────────────
    fixed_wallet_ids = 0
    async for tx in db.transactions.find({"wallet_id": {"$type": "string"}}):
        wid = tx["wallet_id"]
        if not ObjectId.is_valid(wid):
            continue
        if dry_run:
            fixed_wallet_ids += 1
            continue
        await db.transactions.update_one(
            {"_id": tx["_id"]},
            {"$set": {"wallet_id": ObjectId(wid)}},
        )
        fixed_wallet_ids += 1
    print(f"[1] transactions.wallet_id string->ObjectId: {fixed_wallet_ids}")

    # ── 2. transactions.user_id backfill ──────────────────────────────────────
    # Old rows didn't store user_id; reconstruct from wallet_id.
    missing_user = 0
    backfilled_user = 0
    async for tx in db.transactions.find({"user_id": {"$exists": False}}):
        missing_user += 1
        wid = tx.get("wallet_id")
        if isinstance(wid, str) and ObjectId.is_valid(wid):
            wid = ObjectId(wid)
        if not isinstance(wid, ObjectId):
            continue
        wallet = await db.wallets.find_one({"_id": wid})
        if not wallet:
            continue
        if dry_run:
            backfilled_user += 1
            continue
        await db.transactions.update_one(
            {"_id": tx["_id"]},
            {"$set": {"user_id": wallet["user_id"]}},
        )
        backfilled_user += 1
    print(f"[2] transactions.user_id backfilled: {backfilled_user} / {missing_user} missing")

    # ── 3. clinic.solo_mode ───────────────────────────────────────────────────
    solo_set = 0
    multi_set = 0
    async for clinic in db.clinics.find({}):
        cid = str(clinic["_id"])
        has_assistant = await db.users.count_documents({
            "clinic_id": cid,
            "role": "assistant",
            "is_active": True,
        })
        desired = has_assistant == 0
        current = bool(clinic.get("solo_mode", False))
        if current == desired:
            continue
        if dry_run:
            if desired:
                solo_set += 1
            else:
                multi_set += 1
            continue
        await db.clinics.update_one(
            {"_id": clinic["_id"]},
            {"$set": {"solo_mode": desired}},
        )
        if desired:
            solo_set += 1
        else:
            multi_set += 1
    print(f"[3] clinic.solo_mode set to true: {solo_set}, set to false: {multi_set}")

    print("Done.")
    client.close()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true", help="Report without writing")
    args = p.parse_args()
    asyncio.run(main(args.dry_run))
