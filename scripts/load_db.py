#!/usr/bin/env python3
"""
Load demo data once: init Postgres (schema + data/sandarb.sql). Used after generating data once.

Usage:
  python scripts/load_db.py local     # DATABASE_URL from .env
  python scripts/load_db.py gcp      # CLOUD_SQL_DATABASE_URL from .env
  python scripts/load_db.py 'postgresql://user:pass@host:5432/db'   # explicit URL
"""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _env import load_dotenv, get_database_url_for_target

load_dotenv()


def main() -> None:
    target_or_url = (sys.argv[1] if len(sys.argv) > 1 else "local").strip().lower()

    if target_or_url in ("local", "gcp"):
        try:
            url = get_database_url_for_target(target_or_url)
        except ValueError as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)
        label = "local" if target_or_url == "local" else "GCP (Cloud SQL)"
    elif target_or_url.startswith("postgresql://") or target_or_url.startswith("postgres://"):
        url = target_or_url
        label = "custom URL"
    else:
        print(
            "Usage: python scripts/load_db.py [local|gcp]\n"
            "   or: python scripts/load_db.py 'postgresql://user:pass@host:5432/db'",
            file=sys.stderr,
        )
        sys.exit(1)

    env = os.environ.copy()
    env["DATABASE_URL"] = url
    def _redact(u: str) -> str:
        if not u or "@" not in u:
            return u or "(none)"
        try:
            from urllib.parse import urlparse
            p = urlparse(u)
            netloc = f"{p.hostname or ''}" + (f":{p.port}" if p.port else "")
            return f"{p.scheme or ''}://***@{netloc}/{p.path.lstrip('/') or ''}"
        except Exception:
            return "***@..."
    data_sql = ROOT / "data" / "sandarb.sql"
    print(f"Loading DB ({label}): init + load demo data → {_redact(url)}")
    r = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "generate_seed_sql.py"), "--load-only", str(data_sql)],
        cwd=ROOT,
        env=env,
    )
    if r.returncode != 0:
        sys.exit(r.returncode)
    print("Done.")


if __name__ == "__main__":
    main()
