from datetime import datetime, timedelta, timezone
from typing import Optional
from bson import ObjectId

from app.config.database import get_db
from app.utils.hash import (
    hash_password, verify_password,
    hash_otp, verify_otp,
    generate_doctor_code,
)
from app.utils.otp import send_otp_sms
from app.utils.jwt import create_access_token, create_refresh_token, verify_refresh_token, make_token_payload
from app.models.common import serialize_doc


async def send_otp(phone: str, role: str) -> dict:
    db = get_db()
    user = await db.users.find_one({"phone": phone, "role": role})

    otp = await send_otp_sms(phone)
    otp_hash = hash_otp(otp)
    otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

    if not user:
        doctor_code = None
        if role == "doctor":
            doctor_code = await _unique_doctor_code(db)

        user_doc = {
            "phone": phone,
            "role": role,
            "name": None,
            "specialty": None,
            "reg_number": None,
            "password_hash": None,
            "otp_hash": otp_hash,
            "otp_expires_at": otp_expires_at,
            "clinic_id": None,
            "doctor_code": doctor_code,
            "is_profile_complete": False,
            "is_active": True,
            "last_active_at": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        result = await db.users.insert_one(user_doc)
        user_id = str(result.inserted_id)

        if role == "doctor":
            clinic_doc = {
                "name": f"Dr. Clinic",
                "address": None,
                "phone": phone,
                "email": None,
                "logo_url": None,
                "owner_id": user_id,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
            clinic_result = await db.clinics.insert_one(clinic_doc)
            clinic_id = str(clinic_result.inserted_id)
            await db.users.update_one(
                {"_id": result.inserted_id},
                {"$set": {"clinic_id": clinic_id}}
            )

            wallet_doc = {
                "user_id": user_id,
                "balance": 100.0,
                "auto_refill": False,
                "auto_refill_amount": None,
                "auto_refill_threshold": None,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
            await db.wallets.insert_one(wallet_doc)
    else:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"otp_hash": otp_hash, "otp_expires_at": otp_expires_at, "updated_at": datetime.now(timezone.utc)}}
        )

    return {"message": "OTP sent successfully"}


async def verify_otp_and_login(phone: str, otp: str, role: str) -> dict:
    db = get_db()
    user = await db.users.find_one({"phone": phone, "role": role})
    if not user:
        raise ValueError("User not found")

    if not user.get("otp_hash"):
        raise ValueError("No OTP requested")

    otp_expires_at = user.get("otp_expires_at")
    if otp_expires_at:
        if otp_expires_at.tzinfo is None:
            otp_expires_at = otp_expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > otp_expires_at:
            raise ValueError("OTP expired")

    if not verify_otp(otp, user["otp_hash"]):
        raise ValueError("Invalid OTP")

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"otp_hash": None, "otp_expires_at": None, "last_active_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}}
    )

    user = await db.users.find_one({"_id": user["_id"]})
    return await _build_auth_response(user)


async def login_with_password(phone: str, password: str, role: str) -> dict:
    db = get_db()
    user = await db.users.find_one({"phone": phone, "role": role})
    if not user:
        raise ValueError("Invalid credentials")

    if not user.get("password_hash"):
        pw_hash = hash_password(password)
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"password_hash": pw_hash, "updated_at": datetime.now(timezone.utc)}}
        )
    else:
        if not verify_password(password, user["password_hash"]):
            raise ValueError("Invalid credentials")

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_active_at": datetime.now(timezone.utc)}}
    )
    user = await db.users.find_one({"_id": user["_id"]})
    return await _build_auth_response(user)


async def refresh_token(refresh_token_str: str) -> dict:
    payload = verify_refresh_token(refresh_token_str)
    if not payload:
        raise ValueError("Invalid refresh token")

    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(payload["userId"])})
    if not user or not user.get("is_active"):
        raise ValueError("User not found or inactive")

    return await _build_auth_response(user)


async def complete_registration(user_id: str, data: dict) -> dict:
    db = get_db()
    update = {
        "name": data.get("name"),
        "is_profile_complete": True,
        "updated_at": datetime.now(timezone.utc),
    }
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise ValueError("User not found")

    if user["role"] == "doctor":
        update["specialty"] = data.get("specialty")
        update["reg_number"] = data.get("reg_number")
        if data.get("password"):
            update["password_hash"] = hash_password(data["password"])
    else:
        update["specialty"] = data.get("qualification")
        if data.get("password"):
            update["password_hash"] = hash_password(data["password"])

    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update})
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    return serialize_doc(user)


async def get_me(user_id: str) -> dict:
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise ValueError("User not found")
    return serialize_doc(user)


async def update_profile(user_id: str, data: dict) -> dict:
    db = get_db()
    update = {k: v for k, v in data.items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc)
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update})
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    return serialize_doc(user)


async def heartbeat(user_id: str):
    db = get_db()
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"last_active_at": datetime.now(timezone.utc)}}
    )


async def refresh_session(user_id: str) -> dict:
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise ValueError("User not found")
    return await _build_auth_response(user)


async def _build_auth_response(user: dict) -> dict:
    user_id = str(user["_id"])
    payload = make_token_payload(user_id, user["role"], user["phone"], user.get("clinic_id"))
    access_token = create_access_token(payload)
    refresh_token_str = create_refresh_token(payload)

    user_data = serialize_doc(dict(user))
    user_data.pop("otp_hash", None)
    user_data.pop("password_hash", None)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
        "user": user_data,
    }


async def _unique_doctor_code(db) -> str:
    while True:
        code = generate_doctor_code()
        existing = await db.users.find_one({"doctor_code": code})
        if not existing:
            return code
