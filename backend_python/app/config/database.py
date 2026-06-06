import logging
import certifi
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config.settings import settings

log = logging.getLogger(__name__)

_client: AsyncIOMotorClient = None


async def connect_db():
    global _client
    import asyncio

    _client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=10000,
        connectTimeoutMS=10000,
        socketTimeoutMS=10000,
    )

    for attempt in range(1, 6):
        try:
            await _client.admin.command("ping")
            break
        except Exception as e:
            log.warning("MongoDB connect attempt %s/5 failed: %s", attempt, e)
            if attempt == 5:
                raise RuntimeError(
                    "Could not connect to MongoDB after 5 attempts. "
                    "Check your network / DNS and that the Atlas URI is correct."
                ) from e
            await asyncio.sleep(3)

    db = _client[settings.MONGODB_DB_NAME]
    log.info("Connected to MongoDB: %s", settings.MONGODB_DB_NAME)
    await _create_indexes(db)
    await _seed_admin(db)


async def close_db():
    global _client
    if _client:
        _client.close()


def get_db() -> AsyncIOMotorDatabase:
    return _client[settings.MONGODB_DB_NAME]


async def _create_indexes(db: AsyncIOMotorDatabase):
    await db.doctors.create_index("phone", unique=True)
    await db.doctors.create_index("doctor_code", sparse=True)
    await db.doctors.create_index("clinic_id")

    await db.assistants.create_index("phone", unique=True)
    await db.assistants.create_index("clinic_id")

    await db.admins.create_index("phone", unique=True)

    await db.clinics.create_index("owner_id")

    await db.wallets.create_index("user_id", unique=True)

    await db.transactions.create_index("wallet_id")
    await db.transactions.create_index("user_id")
    await db.transactions.create_index([("wallet_id", 1), ("created_at", -1)])
    await db.transactions.create_index("created_at")
    # idempotency_key — partial index so we don't reject NULLs.
    await db.transactions.create_index(
        "idempotency_key",
        unique=True,
        partialFilterExpression={"idempotency_key": {"$type": "string"}},
    )

    await db.patients.create_index("clinic_id")
    await db.patients.create_index([("clinic_id", 1), ("name", 1)])

    await db.prescriptions.create_index("clinic_id")
    await db.prescriptions.create_index("patient_id")
    await db.prescriptions.create_index("doctor_id")
    await db.prescriptions.create_index([("clinic_id", 1), ("patient_id", 1), ("created_at", -1)])
    await db.prescriptions.create_index("created_at")
    await db.prescriptions.create_index("transcript_id", sparse=True)

    await db.queue.create_index("clinic_id")
    await db.queue.create_index("patient_id")
    await db.queue.create_index([("clinic_id", 1), ("added_at", 1)])

    await db.connection_requests.create_index([("doctor_id", 1), ("assistant_id", 1)])
    await db.connection_requests.create_index("clinic_id")

    await db.custom_medicines.create_index([("clinic_id", 1), ("name", 1)], unique=True)
    await db.custom_lab_tests.create_index([("clinic_id", 1), ("name", 1)], unique=True)

    await db.notification_jobs.create_index("user_id")
    await db.notification_jobs.create_index("status")
    # TTL — purge notifications after 30 days.
    await db.notification_jobs.create_index("created_at", expireAfterSeconds=2_592_000)

    await db.transcripts.create_index("clinic_id")
    await db.transcripts.create_index("patient_id")
    await db.transcripts.create_index("doctor_id")
    await db.transcripts.create_index([("clinic_id", 1), ("patient_id", 1)])
    await db.transcripts.create_index("created_at")
    await db.transcripts.create_index("prescription_id", sparse=True)

    log.info("Indexes created.")


async def _seed_admin(db: AsyncIOMotorDatabase):
    """Seed an admin user — opt-in, dev-only.

    Requires:
    - settings.SEED_ADMIN is True
    - settings.NODE_ENV != "production"
    - settings.ADMIN_PHONE and settings.ADMIN_PASSWORD are set

    Production should bootstrap admins via scripts/create_admin.py or a manual
    Mongo update. We never auto-seed in production.
    """
    if not settings.SEED_ADMIN:
        return
    if settings.NODE_ENV == "production":
        log.info("Skipping admin seed in production")
        return
    if not settings.ADMIN_PHONE or not settings.ADMIN_PASSWORD:
        log.warning("SEED_ADMIN=true but ADMIN_PHONE / ADMIN_PASSWORD not set; skipping")
        return

    from app.utils.hash import hash_password

    existing = await db.admins.find_one({"phone": settings.ADMIN_PHONE})
    if existing:
        return

    now = datetime.now(timezone.utc)
    user_doc = {
        "phone": settings.ADMIN_PHONE,
        "role": "admin",
        "name": "Platform Admin",
        "password_hash": hash_password(settings.ADMIN_PASSWORD),
        "otp_hash": None,
        "otp_expires_at": None,
        "clinic_id": None,
        "is_profile_complete": True,
        "is_active": True,
        "last_active_at": now,
        "created_at": now,
        "updated_at": now,
    }
    await db.admins.insert_one(user_doc)
    log.warning(
        "Admin seeded with phone=%s — change the password immediately.",
        settings.ADMIN_PHONE,
    )


def get_user_collection(db, role: str):
    if role == "doctor":
        return db.doctors
    elif role == "assistant":
        return db.assistants
    elif role == "admin":
        return db.admins
    raise ValueError(f"Invalid role: {role}")


async def find_user_by_id_across_collections(db, user_id: str) -> tuple[dict | None, str | None]:
    """Finds user by id across all collections. Returns (user_doc, role) or (None, None)."""
    from bson import ObjectId
    try:
        oid = ObjectId(user_id)
    except Exception:
        return None, None

    for role, col in [("doctor", db.doctors), ("assistant", db.assistants), ("admin", db.admins)]:
        user = await col.find_one({"_id": oid})
        if user:
            return user, role
    return None, None

