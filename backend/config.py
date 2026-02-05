"""Backend configuration from environment."""

from pathlib import Path

from pydantic_settings import BaseSettings

# Load .env from repo root (parent of backend/). Run from repo root: uvicorn backend.main:app
_env_file = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    """Settings loaded from env (e.g. .env at repo root)."""

    database_url: str = "postgresql://postgres:sandarb@localhost:5432/sandarb"
    jwt_secret: str = "dev-secret-do-not-use-in-prod"
    # CORS: allow Next.js frontend (all localhost when running locally)
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:4000", "http://127.0.0.1:3000", "http://127.0.0.1:4000"]
    # Public URL for this backend (Agent Card, links). Local: http://localhost:8000; prod: https://api.sandarb.ai or https://agent.sandarb.ai
    agent_public_url: str = "http://localhost:8000"

    model_config = {
        "env_file": _env_file if _env_file.exists() else None,
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
