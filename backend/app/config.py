from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = Field(
        default="sqlite+aiosqlite:///./palatial.db",
        validation_alias=AliasChoices("DATABASE_URL", "database_url"),
    )
    max_concurrent_runs: int = Field(
        default=3,
        validation_alias=AliasChoices("MAX_CONCURRENT_RUNS", "max_concurrent_runs"),
    )
    worker_min_seconds: int = Field(
        default=5,
        validation_alias=AliasChoices("WORKER_MIN_SECONDS", "worker_min_seconds"),
    )
    worker_max_seconds: int = Field(
        default=15,
        validation_alias=AliasChoices("WORKER_MAX_SECONDS", "worker_max_seconds"),
    )
    worker_success_rate: float = Field(
        default=0.85,
        validation_alias=AliasChoices("WORKER_SUCCESS_RATE", "worker_success_rate"),
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("worker_max_seconds")
    @classmethod
    def validate_worker_window(cls, v: int, info):
        min_seconds = info.data.get("worker_min_seconds", 1)
        if v < min_seconds:
            raise ValueError("WORKER_MAX_SECONDS must be >= WORKER_MIN_SECONDS")
        return v

    @field_validator("worker_success_rate")
    @classmethod
    def clamp_success_rate(cls, v: float) -> float:
        if not 0.0 < v <= 1.0:
            raise ValueError("WORKER_SUCCESS_RATE must be between 0 and 1")
        return v


settings = Settings()
