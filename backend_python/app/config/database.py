from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config.settings import settings

_client: AsyncIOMotorClient = None


async def connect_db():
    global _client
    _client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = _client[settings.MONGODB_DB_NAME]
    await _create_indexes(db)
    print(f"Connected to MongoDB: {settings.MONGODB_DB_NAME}")


async def close_db():
    global _client
    if _client:
        _client.close()


def get_db() -> AsyncIOMotorDatabase:
    return _client[settings.MONGODB_DB_NAME]


async def _create_indexes(db: AsyncIOMotorDatabase):
    await db.users.create_index("phone", unique=True)
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
