import logging

from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

from app.config.settings import settings
from app.utils.hash import generate_otp

log = logging.getLogger(__name__)


async def send_otp_sms(phone: str) -> str:
    """Generate OTP and send via Twilio. Returns the OTP string.

    Raises ValueError if SMS delivery fails.
    """
    if settings.OTP_DEMO_MODE:
        return settings.OTP_DEMO_CODE

    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN or not settings.TWILIO_FROM_NUMBER:
        raise ValueError("SMS provider is not configured")

    otp = generate_otp()

    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(
            to=f"+91{phone}" if not phone.startswith("+") else phone,
            from_=settings.TWILIO_FROM_NUMBER,
            body=f"Your PrescoPad OTP is {otp}. Valid for 5 minutes. Do not share with anyone.",
        )
    except TwilioRestException as e:
        log.warning("Twilio error code=%s msg=%s", e.code, e.msg)
        raise ValueError(f"Twilio error {e.code}: {e.msg}") from e
    except Exception as e:
        log.warning("SMS send failed: %s", e)
        raise ValueError(f"SMS send failed: {e}") from e

    return otp
