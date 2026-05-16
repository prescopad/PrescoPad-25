from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from app.models.wallet import RechargeRequest, DeductRequest, AutoRefillRequest
from app.middleware.auth import get_current_user, require_doctor, TokenData
import app.services.wallet_service as wallet_service

router = APIRouter(prefix="/api/wallet", tags=["wallet"])


def _ok(body: dict, status: int = 200):
    body["success"] = True
    return JSONResponse(content=body, status_code=status)


def _err(message: str, status: int = 400):
    return JSONResponse(content={"success": False, "message": message}, status_code=status)


@router.get("/")
async def get_wallet(request: Request):
    user: TokenData = await get_current_user(request)
    try:
        wallet = await wallet_service.get_wallet(user.user_id)
        return _ok({"wallet": wallet})
    except ValueError as e:
        return _err(str(e), 404)
    except Exception as e:
        return _err(str(e), 500)


@router.post("/recharge")
async def recharge(request: Request, body: RechargeRequest):
    user: TokenData = await require_doctor(request)
    try:
        wallet = await wallet_service.recharge(user.user_id, body.amount, body.get_reference_id())
        return _ok({"wallet": wallet, "balance": wallet.get("balance"), "message": "Wallet recharged"})
    except ValueError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@router.post("/deduct")
async def deduct(request: Request, body: DeductRequest):
    user: TokenData = await require_doctor(request)
    try:
        wallet = await wallet_service.deduct(user.user_id, body.amount, body.description, body.get_reference_id())
        return _ok({"wallet": wallet, "balance": wallet.get("balance"), "message": "Amount deducted"})
    except ValueError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@router.get("/transactions")
async def get_transactions(request: Request):
    user: TokenData = await get_current_user(request)
    try:
        transactions = await wallet_service.get_transactions(user.user_id)
        return _ok({"transactions": transactions})
    except Exception as e:
        return _err(str(e), 500)


@router.put("/auto-refill")
async def auto_refill(request: Request, body: AutoRefillRequest):
    user: TokenData = await require_doctor(request)
    try:
        wallet = await wallet_service.update_auto_refill(
            user.user_id,
            body.get_auto_refill(),
            body.get_amount(),
            body.get_threshold(),
        )
        return _ok({"wallet": wallet, "message": "Auto-refill settings updated"})
    except Exception as e:
        return _err(str(e), 500)
