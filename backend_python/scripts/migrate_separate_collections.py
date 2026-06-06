"""Migration script: split single users collection into doctors, assistants, and admins collections.

Usage:
    python -m scripts.migrate_separate_collections
"""
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add project root to path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from app.config.settings import settings


async def main():
    print("=== Database Migration: Split Users Collection ===")
    client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=10000,
    )
    db = client[settings.MONGODB_DB_NAME]

    # Verify if users collection exists and has documents
    collections = await db.list_collection_names()
    if "users" not in collections:
        print("Error: 'users' collection does not exist in the database.")
        client.close()
        return

    users_count = await db.users.count_documents({})
    if users_count == 0:
        print("No users found in 'users' collection to migrate.")
        client.close()
        return

    print(f"Found {users_count} users to migrate.")

    doctors_migrated = 0
    assistants_migrated = 0
    admins_migrated = 0
    skipped = 0

    async for user in db.users.find({}):
        role = user.get("role")
        phone = user.get("phone")

        if not role or role not in ("doctor", "assistant", "admin"):
            print(f"Skipping user with invalid role: {user.get('_id')} (role={role})")
            skipped += 1
            continue

        # Target collection mapping
        if role == "doctor":
            target_col = db.doctors
        elif role == "assistant":
            target_col = db.assistants
        else:
            target_col = db.admins

        # Check if already exists in target collection
        existing = await target_col.find_one({"phone": phone})
        if existing:
            print(f"User with phone {phone} already exists in '{role}s' collection. Skipping.")
            skipped += 1
            continue

        # Insert to target collection
        await target_col.insert_one(user)

        if role == "doctor":
            doctors_migrated += 1
        elif role == "assistant":
            assistants_migrated += 1
        else:
            admins_migrated += 1

    print("\n--- Migration Results ---")
    print(f"Doctors migrated:   {doctors_migrated}")
    print(f"Assistants migrated: {assistants_migrated}")
    print(f"Admins migrated:     {admins_migrated}")
    print(f"Skipped/Duplicate:   {skipped}")

    # Build indexes on the new collections
    print("\nCreating indexes on new collections...")
    await db.doctors.create_index("phone", unique=True)
    await db.doctors.create_index("doctor_code", sparse=True)
    await db.doctors.create_index("clinic_id")

    await db.assistants.create_index("phone", unique=True)
    await db.assistants.create_index("clinic_id")

    await db.admins.create_index("phone", unique=True)
    print("Indexes created successfully.")

    # Safely back up the old users collection
    print("\nBacking up 'users' collection...")
    backup_name = f"users_backup_{int(datetime.now(timezone.utc).timestamp())}"
    await db.users.rename(backup_name)
    print(f"Renamed 'users' to '{backup_name}' for safety.")

    print("\nMigration completed successfully!")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
