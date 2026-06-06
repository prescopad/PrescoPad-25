from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    PORT: int = 3000
    NODE_ENV: str = "development"

    MONGODB_URI: str
    MONGODB_DB_NAME: str = "prescopad"

    JWT_SECRET: str
    JWT_EXPIRES_IN: int = 7
    JWT_REFRESH_SECRET: str
    JWT_REFRESH_EXPIRES_IN: int = 30

    # OTP — set to True only for local dev when you don't have Twilio configured.
    OTP_DEMO_MODE: bool = False
    OTP_DEMO_CODE: str = "123456"
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_FROM_NUMBER: Optional[str] = None

    # OTP brute-force protection
    OTP_MAX_VERIFY_ATTEMPTS: int = 5
    OTP_REQUESTS_PER_HOUR: int = 5

    # Wallet
    PRESCRIPTION_FEE: float = 1.0

    RATE_LIMIT_WINDOW_MS: int = 900000
    RATE_LIMIT_MAX: int = 100

    ALLOWED_ORIGINS: Optional[str] = None

    # Admin seed — only used when NODE_ENV != "production" and explicitly enabled
    SEED_ADMIN: bool = False
    ADMIN_PHONE: Optional[str] = None
    ADMIN_PASSWORD: Optional[str] = None

    @property
    def allowed_origins_list(self) -> list[str]:
        if self.ALLOWED_ORIGINS:
            return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]
        # Production must explicitly configure origins; dev defaults to wildcard.
        if self.NODE_ENV == "production":
            return []
        return ["*"]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
