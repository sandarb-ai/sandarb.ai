"""Backend configuration from environment.

Enterprise Deployment Configuration:
------------------------------------
For on-premises or custom cloud deployments, configure these environment variables:

Required:
  DATABASE_URL          - PostgreSQL connection string
  JWT_SECRET            - Strong secret for JWT signing (required in production)

Recommended:
  SANDARB_DOMAIN        - Base domain (e.g., governance.company.com)
  CORS_ORIGINS          - Comma-separated allowed origins
  WRITE_ALLOWED_EMAILS  - Comma-separated emails for write access

Optional:
  AGENT_PUBLIC_URL      - Public URL for agent service
  AGENT_BASE_URL        - Base URL for A2A/MCP endpoints

Security:
  SANDARB_ENV=production - Enables production security checks
  RATE_LIMIT_DEFAULT    - Default rate limit (e.g., "100/minute")
  ALLOW_SEED_IN_PRODUCTION - Enable /api/seed in production (default: false)
"""

import os
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings

# Load .env from repo root (parent of backend/). Run from repo root: uvicorn backend.main:app
_env_file = Path(__file__).resolve().parent.parent / ".env"

DEV_SECRET_PLACEHOLDER = "dev-secret-do-not-use-in-prod"

# Default localhost origins for development
_DEFAULT_DEV_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:4000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:4000",
]


class Settings(BaseSettings):
    """Settings loaded from env (e.g. .env at repo root)."""

    database_url: str = "postgresql://postgres:sandarb@localhost:5432/sandarb"
    jwt_secret: str = DEV_SECRET_PLACEHOLDER
    # Comma-separated emails allowed to perform writes (POST/PUT/PATCH/DELETE). Empty = no UI writes.
    write_allowed_emails: str = ""
    # CORS origins - in production, set CORS_ORIGINS env var; dev uses localhost defaults
    cors_origins: list[str] = Field(default_factory=list)
    # Enterprise domain configuration (e.g., governance.company.com)
    # When set, auto-configures CORS for ui.DOMAIN, api.DOMAIN, agent.DOMAIN
    sandarb_domain: str = Field(default="", description="Base domain for enterprise deployment")
    # Database connection pool
    db_pool_min: int = Field(default=2, description="Minimum pool connections")
    db_pool_max: int = Field(default=10, description="Maximum pool connections")
    db_connect_timeout: int = Field(default=10, description="Connection timeout in seconds")

    agent_public_url: str = "http://localhost:8000"
    # Base URL for the Agent subdomain (MCP + A2A). Used in Agent Card. Defaults to agent_public_url.
    agent_base_url: str = Field(default="", description="e.g. https://agent.sandarb.ai; empty = use agent_public_url")
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
        """Build CORS origins list from environment configuration.

        Priority:
        1. Explicit CORS_ORIGINS env var (comma-separated)
        2. Auto-generate from SANDARB_DOMAIN if set
        3. Default sandarb.ai origins (for managed deployment)
        4. Localhost origins (for development)
        """
        # If explicit list provided, use it
        if v is not None and isinstance(v, list) and len(v) > 0:
            return v

        origins = []

        # Check for explicit CORS_ORIGINS env var
        cors_env = os.environ.get("CORS_ORIGINS", "")
        if cors_env:
            origins = [o.strip() for o in cors_env.split(",") if o.strip()]

        # Auto-generate from SANDARB_DOMAIN for enterprise deployment
        domain = os.environ.get("SANDARB_DOMAIN", "")
        if domain:
            protocol = "http" if "localhost" in domain else "https"
            # Add standard subdomains
            origins.extend([
                f"{protocol}://ui.{domain}",
                f"{protocol}://api.{domain}",
                f"{protocol}://agent.{domain}",
                f"{protocol}://{domain}",  # root domain
            ])

        is_production = os.environ.get("SANDARB_ENV", "").lower() == "production"
        is_dev_mode = os.environ.get("SANDARB_DEV", "").lower() in ("true", "1", "yes")

        if is_production and not is_dev_mode:
            # Production: only use explicitly configured origins
            if not origins:
                # Default to sandarb.ai origins for managed deployment
                origins = [
                    "https://ui.sandarb.ai",
                    "https://api.sandarb.ai",
                    "https://agent.sandarb.ai",
                    "https://sandarb.ai",
                ]
            return origins

        # Development: include localhost + default sandarb.ai origins
        if not any("sandarb.ai" in o for o in origins):
            origins.extend([
                "https://ui.sandarb.ai",
                "https://api.sandarb.ai",
                "https://agent.sandarb.ai",
                "https://sandarb.ai",
            ])
        origins.extend(_DEFAULT_DEV_ORIGINS)
        return list(set(origins))  # deduplicate

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
