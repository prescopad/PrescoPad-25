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

    OTP_DEMO_MODE: bool = True
    OTP_DEMO_CODE: str = "123456"
    FAST2SMS_API_KEY: Optional[str] = None

    RATE_LIMIT_WINDOW_MS: int = 900000
    RATE_LIMIT_MAX: int = 100

    ALLOWED_ORIGINS: Optional[str] = None

    @property
    def allowed_origins_list(self) -> list[str]:
        if self.ALLOWED_ORIGINS:
            return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]
        return ["*"]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
