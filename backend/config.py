"""Backend configuration from environment."""

import os
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings

# Load .env from repo root (parent of backend/). Run from repo root: uvicorn backend.main:app
_env_file = Path(__file__).resolve().parent.parent / ".env"

DEV_SECRET_PLACEHOLDER = "dev-secret-do-not-use-in-prod"


class Settings(BaseSettings):
    """Settings loaded from env (e.g. .env at repo root)."""

    database_url: str = "postgresql://postgres:sandarb@localhost:5432/sandarb"
    jwt_secret: str = DEV_SECRET_PLACEHOLDER
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:4000", "http://127.0.0.1:3000", "http://127.0.0.1:4000"]
    agent_public_url: str = "http://localhost:8000"
    dev_mode: bool = Field(default=False, validation_alias="SANDARB_DEV", description="Allow preview agent without sandarb-ui key")

    model_config = {
        "env_file": _env_file if _env_file.exists() else None,
        "env_file_encoding": "utf-8",
        "extra": "ignore",
        "env_prefix": "",  # no prefix; use exact names JWT_SECRET, SANDARB_DEV, etc.
    }

    @field_validator("jwt_secret", mode="after")
    @classmethod
    def validate_jwt_secret_production(cls, v: str) -> str:
        if os.environ.get("SANDARB_ENV", "").lower() != "production":
            return v or DEV_SECRET_PLACEHOLDER
        if not v or v == DEV_SECRET_PLACEHOLDER:
            raise ValueError(
                "JWT_SECRET must be set to a strong secret in production (SANDARB_ENV=production). "
                "Do not use dev-secret-do-not-use-in-prod."
            )
        return v

    @field_validator("cors_origins", mode="before")
    @classmethod
    def validate_cors_origins(cls, v):
        if v is not None and isinstance(v, list) and len(v) > 0:
            return v
        if os.environ.get("SANDARB_ENV", "").lower() == "production" and os.environ.get("SANDARB_DEV", "").lower() not in ("true", "1", "yes"):
            origins = os.environ.get("CORS_ORIGINS", "")
            if origins:
                return [o.strip() for o in origins.split(",") if o.strip()]
            return []
        return ["http://localhost:3000", "http://localhost:4000", "http://127.0.0.1:3000", "http://127.0.0.1:4000"]

    @field_validator("dev_mode", mode="before")
    @classmethod
    def coerce_dev_mode(cls, v):
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() in ("true", "1", "yes")
        return False


try:
    settings = Settings()
except ValueError as e:
    if "JWT_SECRET" in str(e):
        raise SystemExit(str(e)) from e
    raise
