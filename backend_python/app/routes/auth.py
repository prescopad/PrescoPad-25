from fastapi import APIRouter, Request
from app.models.user import (
    SendOtpRequest, VerifyOtpRequest, LoginRequest,
    RefreshTokenRequest, CompleteRegistrationRequest, UpdateProfileRequest,
)
from app.middleware.auth import get_current_user, TokenData
from fastapi.responses import JSONResponse
import app.services.auth_service as auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _ok(body: dict, status: int = 200):
    body["success"] = True
    return JSONResponse(content=body, status_code=status)


def _err(message: str, status: int = 400):
    return JSONResponse(content={"success": False, "message": message}, status_code=status)


@router.post("/send-otp")
async def send_otp(body: SendOtpRequest):
    try:
        await auth_service.send_otp(body.phone, body.role)
        return _ok({"message": "OTP sent successfully"})
    except Exception as e:
        return _err(str(e), 500)


@router.post("/verify-otp")
async def verify_otp(body: VerifyOtpRequest):
    try:
        result = await auth_service.verify_otp_and_login(body.phone, body.otp, body.role)
        return _ok({
            "message": "Login successful",
            "access_token": result["access_token"],
            "refresh_token": result["refresh_token"],
            "user": result["user"],
        })
    except ValueError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@router.post("/login")
async def login(body: LoginRequest):
    try:
        result = await auth_service.login_with_password(body.phone, body.password, body.role)
        return _ok({
            "message": "Login successful",
            "access_token": result["access_token"],
            "refresh_token": result["refresh_token"],
            "user": result["user"],
        })
    except ValueError as e:
        return _err(str(e), 401)
    except Exception as e:
        return _err(str(e), 500)


@router.post("/refresh-token")
async def refresh_token(body: RefreshTokenRequest):
    try:
        result = await auth_service.refresh_token(body.token)
        return _ok({
            "access_token": result["access_token"],
            "refresh_token": result["refresh_token"],
            "user": result["user"],
        })
    except ValueError as e:
        return _err(str(e), 401)
    except Exception as e:
        return _err(str(e), 500)


@router.post("/complete-registration")
async def complete_registration(request: Request, body: CompleteRegistrationRequest):
    user: TokenData = await get_current_user(request)
    try:
        result = await auth_service.complete_registration(user.user_id, body.normalized())
        # re-issue tokens with updated user data
        tokens = await auth_service.refresh_session(user.user_id)
        return _ok({
            "message": "Profile completed",
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "user": tokens["user"],
        })
    except ValueError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@router.post("/refresh-session")
async def refresh_session(request: Request):
    user: TokenData = await get_current_user(request)
    try:
        result = await auth_service.refresh_session(user.user_id)
        return _ok({
            "access_token": result["access_token"],
            "refresh_token": result["refresh_token"],
            "user": result["user"],
        })
    except Exception as e:
        return _err(str(e), 500)


@router.get("/me")
async def get_me(request: Request):
    user: TokenData = await get_current_user(request)
    try:
        result = await auth_service.get_me(user.user_id)
        return _ok({"user": result})
    except ValueError as e:
        return _err(str(e), 404)
    except Exception as e:
        return _err(str(e), 500)


@router.put("/profile")
async def update_profile(request: Request, body: UpdateProfileRequest):
    user: TokenData = await get_current_user(request)
    try:
        result = await auth_service.update_profile(user.user_id, body.normalized())
        return _ok({"user": result, "message": "Profile updated"})
    except Exception as e:
        return _err(str(e), 500)


@router.post("/heartbeat")
async def heartbeat(request: Request):
    user: TokenData = await get_current_user(request)
    await auth_service.heartbeat(user.user_id)
    return _ok({"message": "OK"})
