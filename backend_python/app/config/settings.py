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

    # OTP — demo mode must be explicitly enabled. Default is OFF for safety.
    OTP_DEMO_MODE: bool = True
    OTP_DEMO_CODE: str = "123456"
    FAST2SMS_API_KEY: Optional[str] = None

    # OTP brute-force protection
    OTP_MAX_VERIFY_ATTEMPTS: int = 5
    OTP_REQUESTS_PER_HOUR: int = 5

    # Wallet
    PRESCRIPTION_FEE: float = 1.0

    # Transcription upload guard
    MAX_AUDIO_UPLOAD_BYTES: int = 25 * 1024 * 1024  # 25 MB

    RATE_LIMIT_WINDOW_MS: int = 900000
    RATE_LIMIT_MAX: int = 100

    ALLOWED_ORIGINS: Optional[str] = None

    GROQ_API_KEY: Optional[str] = None

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
