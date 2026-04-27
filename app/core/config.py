from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "FraudGuard"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/fraudguard"
    REDIS_URL: str = "redis://localhost:6379"

    SECRET_KEY: str = "change-this-in-production"
    API_KEY_PREFIX: str = "fg_live_"

    RATE_LIMIT_PER_MINUTE: int = 60

    class Config:
        env_file = ".env"


settings = Settings()
