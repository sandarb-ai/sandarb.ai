"""Load .env from repo root. Used by all scripts in this directory.
Default DATABASE_URL matches common .env: postgresql://postgres:sandarb@localhost:5432/sandarb
"""
from pathlib import Path
import re

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
ENV_PATH = REPO_ROOT / ".env"

# Same as typical .env / docker-compose so scripts work without .env
DEFAULT_DATABASE_URL = "postgresql://postgres:sandarb@localhost:5432/sandarb"


def load_dotenv() -> None:
    """Load KEY=VALUE from REPO_ROOT/.env into os.environ (only if not already set)."""
    import os
    if not ENV_PATH.exists():
        return
    for line in ENV_PATH.read_text().splitlines():
        trimmed = re.sub(r"^#.*", "", line).strip()
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", trimmed)
        if m:
            key, val = m.group(1), m.group(2)
            val = re.sub(r"^[\"']|[\"']$", "", val).strip()
            if key not in os.environ:
                os.environ[key] = val


def get_database_url() -> str:
    """DATABASE_URL with .env loaded; default matches .env postgres:sandarb@localhost:5432/sandarb."""
    load_dotenv()
    import os
    return os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)


def get_database_url_for_reset() -> str:
    """Prefer DATABASE_URL; CLOUD_SQL_DATABASE_URL only when TCP (not Unix socket)."""
    load_dotenv()
    import os
    default = DEFAULT_DATABASE_URL
    cloud = os.environ.get("CLOUD_SQL_DATABASE_URL")
    cloud_is_tcp = cloud and "/cloudsql/" not in (cloud or "")
    return os.environ.get("DATABASE_URL") or (cloud if cloud_is_tcp else None) or default


def get_database_url_for_target(target: str) -> str:
    """Return URL for load target: 'local' (DATABASE_URL) or 'gcp' (CLOUD_SQL_DATABASE_URL)."""
    load_dotenv()
    import os
    if target == "local":
        return os.environ.get("DATABASE_URL") or DEFAULT_DATABASE_URL
    if target == "gcp":
        url = os.environ.get("CLOUD_SQL_DATABASE_URL") or os.environ.get("DATABASE_URL")
        if not url:
            raise ValueError(
                "No database URL for GCP. Set CLOUD_SQL_DATABASE_URL (or DATABASE_URL) in .env"
            )
        return url
    raise ValueError("target must be 'local' or 'gcp'")
