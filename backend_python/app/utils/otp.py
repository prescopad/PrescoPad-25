import logging

import httpx

from app.config.settings import settings
from app.utils.hash import generate_otp

log = logging.getLogger(__name__)


async def send_otp_sms(phone: str) -> str:
    """Generate OTP and send via Fast2SMS. Returns the OTP string.

    Raises ValueError if SMS delivery fails (so the caller can surface a 5xx
    instead of silently telling the user "OTP sent" when it wasn't).
    """
    if settings.OTP_DEMO_MODE:
        return settings.OTP_DEMO_CODE

    otp = generate_otp()
    if not settings.FAST2SMS_API_KEY:
        raise ValueError("SMS provider is not configured")

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.post(
                "https://www.fast2sms.com/dev/bulkV2",
                headers={"authorization": settings.FAST2SMS_API_KEY},
                json={
                    "route": "otp",
                    "variables_values": otp,
                    "flash": 0,
                    "numbers": phone,
                },
            )
        except httpx.HTTPError as e:
            log.warning("Fast2SMS request failed: %s", e)
            raise ValueError("Could not send OTP, please try again") from e

    if response.status_code != 200:
        log.warning("Fast2SMS returned %s: %s", response.status_code, response.text[:200])
        raise ValueError("Could not send OTP, please try again")

    try:
        body = response.json()
        if isinstance(body, dict) and body.get("return") is False:
            log.warning("Fast2SMS rejected request: %s", body)
            raise ValueError("Could not send OTP, please try again")
    except ValueError:
        # Non-JSON body — assume failure
        raise ValueError("Could not send OTP, please try again")
    except Exception:
        pass

    return otp
