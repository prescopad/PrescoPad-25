from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId

from app.config.database import get_db
from app.config.settings import settings
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

    # Rate-limit OTP requests per phone+role.
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    if user:
        recent_count = user.get("otp_request_count", 0) or 0
        window_start = user.get("otp_window_start_at")
        if window_start and window_start.tzinfo is None:
            window_start = window_start.replace(tzinfo=timezone.utc)
        if window_start and window_start > one_hour_ago and recent_count >= settings.OTP_REQUESTS_PER_HOUR:
            raise ValueError("Too many OTP requests. Please try again in an hour.")

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
            "otp_attempts": 0,
            "otp_request_count": 1,
            "otp_window_start_at": datetime.now(timezone.utc),
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
                "name": f"Dr. Clinic ({phone})",
                "address": None,
                "phone": phone,
                "email": None,
                "logo_url": None,
                "owner_id": user_id,
                "solo_mode": True,  # default — flips to False when an assistant joins
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
        # Reset / advance the rate-limit window.
        window_start = user.get("otp_window_start_at")
        if window_start and window_start.tzinfo is None:
            window_start = window_start.replace(tzinfo=timezone.utc)
        if window_start and window_start > one_hour_ago:
            new_count = (user.get("otp_request_count") or 0) + 1
            new_window = window_start
        else:
            new_count = 1
            new_window = datetime.now(timezone.utc)

        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "otp_hash": otp_hash,
                "otp_expires_at": otp_expires_at,
                "otp_attempts": 0,
                "otp_request_count": new_count,
                "otp_window_start_at": new_window,
                "updated_at": datetime.now(timezone.utc),
            }}
        )

    return {"message": "OTP sent successfully"}


async def verify_otp_and_login(phone: str, otp: str, role: str) -> dict:
    db = get_db()
    user = await db.users.find_one({"phone": phone, "role": role})
    if not user:
        raise ValueError("Invalid OTP")  # don't leak account existence

    if not user.get("otp_hash"):
        raise ValueError("No OTP requested")

    # Brute-force attempt counter — locks the OTP after N failed tries.
    attempts = user.get("otp_attempts", 0) or 0
    if attempts >= settings.OTP_MAX_VERIFY_ATTEMPTS:
        # Invalidate the OTP so it can't be guessed further.
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"otp_hash": None, "otp_expires_at": None}}
        )
        raise ValueError("Too many failed attempts. Please request a new OTP.")

    otp_expires_at = user.get("otp_expires_at")
    if otp_expires_at:
        if otp_expires_at.tzinfo is None:
            otp_expires_at = otp_expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > otp_expires_at:
            raise ValueError("OTP expired")

    if not verify_otp(otp, user["otp_hash"]):
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$inc": {"otp_attempts": 1}}
        )
        raise ValueError("Invalid OTP")

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "otp_hash": None,
            "otp_expires_at": None,
            "otp_attempts": 0,
            "last_active_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }}
    )

    user = await db.users.find_one({"_id": user["_id"]})
    return await _build_auth_response(user)


async def login_with_password(phone: str, password: str, role: str) -> dict:
    db = get_db()
    user = await db.users.find_one({"phone": phone, "role": role})
    if not user:
        raise ValueError("Invalid credentials")

    if not user.get("password_hash"):
        # No password set yet — account not fully registered, must use OTP
        raise ValueError("No password set. Please login with OTP.")

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


async def _with_solo_mode(user_data: dict, clinic_id) -> dict:
    """Attach clinic.solo_mode to a serialized user dict so the frontend can
    show/hide the doctor's patient-management tab consistently across both
    /auth/me and the login response."""
    if clinic_id:
        try:
            db = get_db()
            clinic = await db.clinics.find_one({"_id": ObjectId(clinic_id)})
            if clinic:
                user_data["solo_mode"] = bool(clinic.get("solo_mode", False))
        except Exception:
            pass
    return user_data


async def get_me(user_id: str) -> dict:
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise ValueError("User not found")
    data = serialize_doc(user)
    data.pop("password_hash", None)
    data.pop("otp_hash", None)
    return await _with_solo_mode(data, user.get("clinic_id"))


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
    user_data.pop("otp_attempts", None)
    user_data.pop("otp_request_count", None)
    user_data.pop("otp_window_start_at", None)

    # Enrich with clinic.solo_mode so the frontend can adapt UI without a second call.
    user_data = await _with_solo_mode(user_data, user.get("clinic_id"))

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
