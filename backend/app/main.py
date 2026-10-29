from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    secret_key: str
    database_url: str
    redis_url: str
    template_encryption_key: str

    max_login_attempts: int = 5
    lockout_minutes: int = 15
    otp_valid_seconds: int = 30


settings = Settings()