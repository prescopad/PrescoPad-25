import httpx
from app.config.settings import settings
from app.utils.hash import generate_otp


async def send_otp_sms(phone: str) -> str:
    """Generate OTP and send via Fast2SMS. Returns the OTP string."""
    if settings.OTP_DEMO_MODE:
        return settings.OTP_DEMO_CODE

    otp = generate_otp()
    if settings.FAST2SMS_API_KEY:
        async with httpx.AsyncClient() as client:
            await client.post(
                "https://www.fast2sms.com/dev/bulkV2",
                headers={"authorization": settings.FAST2SMS_API_KEY},
                json={
                    "route": "otp",
                    "variables_values": otp,
                    "flash": 0,
                    "numbers": phone,
                },
            )
    return otp
