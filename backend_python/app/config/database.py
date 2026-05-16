import certifi
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config.settings import settings

_client: AsyncIOMotorClient = None


async def connect_db():
    global _client
    import asyncio

    # certifi provides the trusted CA bundle required by Python 3.13's stricter TLS
    _client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=10000,
        connectTimeoutMS=10000,
        socketTimeoutMS=10000,
    )

    # Retry up to 5 times with 3-second gaps so transient DNS/network blips don't kill startup
    for attempt in range(1, 6):
        try:
            await _client.admin.command("ping")
            break
        except Exception as e:
            print(f"MongoDB connect attempt {attempt}/5 failed: {e}")
            if attempt == 5:
                raise RuntimeError(
                    "Could not connect to MongoDB after 5 attempts. "
                    "Check your network / DNS and that the Atlas URI is correct."
                ) from e
            await asyncio.sleep(3)

    db = _client[settings.MONGODB_DB_NAME]
    print(f"Connected to MongoDB: {settings.MONGODB_DB_NAME}")
    await _create_indexes(db)
    await _seed_admin(db)


async def close_db():
    global _client
    if _client:
        _client.close()


def get_db() -> AsyncIOMotorDatabase:
    return _client[settings.MONGODB_DB_NAME]


async def _create_indexes(db: AsyncIOMotorDatabase):
    # phone+role compound unique (same phone can be both doctor and assistant)
    await db.users.create_index([("phone", 1), ("role", 1)], unique=True)
    await db.users.create_index("doctor_code", sparse=True)
    await db.users.create_index("clinic_id")

    await db.clinics.create_index("owner_id")

    await db.wallets.create_index("user_id", unique=True)

    await db.transactions.create_index("wallet_id")
    await db.transactions.create_index("created_at")

    await db.patients.create_index("clinic_id")
    await db.patients.create_index([("clinic_id", 1), ("name", 1)])

    await db.prescriptions.create_index("clinic_id")
    await db.prescriptions.create_index("patient_id")
    await db.prescriptions.create_index("doctor_id")
    await db.prescriptions.create_index("created_at")

    await db.queue.create_index("clinic_id")
    await db.queue.create_index("patient_id")
    await db.queue.create_index([("clinic_id", 1), ("added_at", 1)])

    await db.connection_requests.create_index([("doctor_id", 1), ("assistant_id", 1)])
    await db.connection_requests.create_index("clinic_id")

    await db.custom_medicines.create_index([("clinic_id", 1), ("name", 1)], unique=True)
    await db.custom_lab_tests.create_index([("clinic_id", 1), ("name", 1)], unique=True)

    await db.notification_jobs.create_index("user_id")
    await db.notification_jobs.create_index("status")

    await db.transcripts.create_index("clinic_id")
    await db.transcripts.create_index("patient_id")
    await db.transcripts.create_index("doctor_id")
    await db.transcripts.create_index([("clinic_id", 1), ("patient_id", 1)])
    await db.transcripts.create_index("created_at")

    print("Indexes created.")


async def _seed_admin(db: AsyncIOMotorDatabase):
    """Seed a default admin/doctor account if it doesn't exist yet."""
    from app.utils.hash import hash_password, generate_doctor_code

    ADMIN_PHONE = "9999999999"
    ADMIN_PASSWORD = "Admin@123"
    ADMIN_ROLE = "doctor"

    existing = await db.users.find_one({"phone": ADMIN_PHONE, "role": ADMIN_ROLE})
    if existing:
        return  # already seeded

    now = datetime.now(timezone.utc)
    doctor_code = generate_doctor_code()
    # ensure uniqueness
    while await db.users.find_one({"doctor_code": doctor_code}):
        doctor_code = generate_doctor_code()

    user_doc = {
        "phone": ADMIN_PHONE,
        "role": ADMIN_ROLE,
        "name": "Admin Doctor",
        "specialty": "General Medicine",
        "reg_number": "ADMIN001",
        "password_hash": hash_password(ADMIN_PASSWORD),
        "otp_hash": None,
        "otp_expires_at": None,
        "clinic_id": None,
        "doctor_code": doctor_code,
        "is_profile_complete": True,
        "is_active": True,
        "last_active_at": now,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    clinic_doc = {
        "name": "PrescoPad Admin Clinic",
        "address": "Admin Office",
        "phone": ADMIN_PHONE,
        "email": "admin@prescopad.com",
        "logo_url": None,
        "owner_id": user_id,
        "created_at": now,
        "updated_at": now,
    }
    clinic_result = await db.clinics.insert_one(clinic_doc)
    clinic_id = str(clinic_result.inserted_id)

    await db.users.update_one(
        {"_id": result.inserted_id},
        {"$set": {"clinic_id": clinic_id}}
    )

    await db.wallets.insert_one({
        "user_id": user_id,
        "balance": 1000.0,
        "auto_refill": False,
        "auto_refill_amount": None,
        "auto_refill_threshold": None,
        "created_at": now,
        "updated_at": now,
    })

    print(f"Admin seeded — phone: {ADMIN_PHONE}  password: {ADMIN_PASSWORD}  doctor_code: {doctor_code}")
