"""Seed/load sample data into Postgres. Uses DATABASE_URL or CLOUD_SQL_DATABASE_URL from env.

SECURITY: This endpoint is restricted to admin users (SEED_ALLOWED_EMAILS) or disabled in production
unless ALLOW_SEED_IN_PRODUCTION=true is set.
"""

import logging
import os
import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException, Depends

from backend.config import settings
from backend.schemas.common import ApiResponse
from backend.write_auth import require_write_allowed

router = APIRouter(tags=["seed"])
logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SCHEMA_SQL = REPO_ROOT / "schema" / "sandarb.sql"
DATA_SQL = REPO_ROOT / "data" / "sandarb.sql"
SCRIPTS_DIR = REPO_ROOT / "scripts"
SEED_SCRIPT = SCRIPTS_DIR / "seed_postgres.py"


def _get_database_url() -> str:
    """Prefer CLOUD_SQL_DATABASE_URL (GCP), then DATABASE_URL, then settings.database_url."""
    url = os.environ.get("CLOUD_SQL_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if url:
        return url.strip()
    return settings.database_url


def _split_sql_statements(sql: str) -> list[str]:
    """Split SQL script into statements (semicolon-newline)."""
    sql = sql.replace("\r\n", "\n")
    parts = sql.split(";\n")
    out = []
    for p in parts:
        lines = p.splitlines()
        while lines and (not lines[0].strip() or lines[0].strip().startswith("--")):
            lines.pop(0)
        stmt = "\n".join(lines).strip()
        if stmt:
            out.append(stmt)
    return out


def _run_sql_file(sql_path: Path, url: str) -> None:
    """Execute SQL file against url using psycopg2."""
    import psycopg2

    if not sql_path.exists():
        raise FileNotFoundError(f"SQL file not found: {sql_path}")
    sql = sql_path.read_text(encoding="utf-8")
    statements = _split_sql_statements(sql)
    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()
    try:
        for i, stmt in enumerate(statements):
            s = stmt.strip()
            if not s or s.startswith("--"):
                continue
            cur.execute(s)
    finally:
        cur.close()
        conn.close()


def _check_seed_allowed() -> None:
    """Check if seed endpoint is allowed in current environment."""
    is_production = os.environ.get("SANDARB_ENV", "").lower() == "production"
    allow_in_prod = os.environ.get("ALLOW_SEED_IN_PRODUCTION", "").lower() in ("true", "1", "yes")

    if is_production and not allow_in_prod:
        raise HTTPException(
            status_code=403,
            detail="Seed endpoint is disabled in production. Set ALLOW_SEED_IN_PRODUCTION=true to enable.",
        )


@router.post("/seed", response_model=ApiResponse)
def post_seed(_email: str = Depends(require_write_allowed)):
    """
    Load sample data: run schema/sandarb.sql then data/sandarb.sql (if present in image)
    or scripts/seed_postgres.py. In Cloud Run the image has schema/ and scripts/ but not data/sandarb.sql;
    use deploy --seed-only with data/sandarb.sql locally for bulk data.

    SECURITY: Requires write authorization. Disabled in production unless ALLOW_SEED_IN_PRODUCTION=true.
    """
    _check_seed_allowed()

    try:
        url = _get_database_url()
    except Exception as e:
        logger.exception("Database URL not configured")
        raise HTTPException(status_code=500, detail="Database URL not configured") from e

    if not SCHEMA_SQL.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Schema file not found: {SCHEMA_SQL}. Run from repo root.",
        )

    try:
        # 1. Run schema (DDL)
        _run_sql_file(SCHEMA_SQL, url)
    except Exception as e:
        logger.exception("Schema load failed")
        raise HTTPException(status_code=500, detail="Schema load failed. Check server logs for details.") from e

    # 2. Load data: data/sandarb.sql if present, else seed_postgres.py
    if DATA_SQL.exists():
        try:
            _run_sql_file(DATA_SQL, url)
        except Exception as e:
            logger.exception("Data load failed")
            raise HTTPException(status_code=500, detail="Data load failed. Check server logs for details.") from e
    else:
        if not SEED_SCRIPT.exists():
            return ApiResponse(
                success=True,
                data={
                    "message": "Schema loaded. data/sandarb.sql not found; run ./scripts/generate_sandarb_data.sh to generate it, or run scripts/seed_postgres.py manually.",
                },
            )
        env = os.environ.copy()
        env["DATABASE_URL"] = url
        r = subprocess.run(
            [sys.executable, str(SEED_SCRIPT)],
            cwd=str(REPO_ROOT),
            env=env,
            capture_output=True,
            text=True,
            timeout=120,
        )
        if r.returncode != 0:
            # Log full error server-side, return sanitized message to client
            err = (r.stderr or r.stdout or "").strip() or "seed_postgres.py failed"
            logger.error(f"Seed script failed: {err[:1000]}")
            raise HTTPException(status_code=500, detail="Seed script failed. Check server logs for details.")

    return ApiResponse(success=True, data={"message": "Sample data loaded."})
