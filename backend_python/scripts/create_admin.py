"""Create or promote an admin user. Safe to use in any environment.

Examples:
    python -m scripts.create_admin --phone 9999900000 --password 'StrongPass!1'
    python -m scripts.create_admin --phone 9999900000 --promote
"""
import argparse
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import certifi
from motor.motor_asyncio import AsyncIOMotorClient

from app.config.settings import settings  # noqa: E402
from app.utils.hash import hash_password  # noqa: E402


async def main(phone: str, password: str | None, promote: bool):
    client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=10000,
    )
    db = client[settings.MONGODB_DB_NAME]
    now = datetime.now(timezone.utc)

    existing = await db.users.find_one({"phone": phone})

    if existing and promote:
        await db.users.update_one(
            {"_id": existing["_id"]},
            {"$set": {"role": "admin", "is_profile_complete": True, "updated_at": now}},
        )
        print(f"Promoted user {phone} (id={existing['_id']}) to admin.")
        client.close()
        return

    if existing and not promote:
        print(f"User with phone {phone} already exists. Re-run with --promote to make them admin.")
        client.close()
        sys.exit(2)

    if not password:
        print("--password is required when creating a new admin.")
        client.close()
        sys.exit(2)

    user_doc = {
        "phone": phone,
        "role": "admin",
        "name": "Platform Admin",
        "password_hash": hash_password(password),
        "otp_hash": None,
        "otp_expires_at": None,
        "clinic_id": None,
        "is_profile_complete": True,
        "is_active": True,
        "last_active_at": now,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.users.insert_one(user_doc)
    print(f"Created admin user phone={phone} id={result.inserted_id}")
    client.close()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--phone", required=True)
    p.add_argument("--password")
    p.add_argument("--promote", action="store_true", help="Promote an existing user instead of creating")
    args = p.parse_args()
    asyncio.run(main(args.phone, args.password, args.promote))
