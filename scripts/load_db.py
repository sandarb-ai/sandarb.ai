#!/usr/bin/env python3
"""
Load demo data: init Postgres schema + load data/sandarb.sql.

Usage:
  python scripts/load_db.py local     # DATABASE_URL from .env
  python scripts/load_db.py gcp       # CLOUD_SQL_DATABASE_URL from .env
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


def _split_sql_statements(sql: str) -> list:
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


def run_sql_file(sql_path: Path, url: str) -> None:
    """Run SQL file via psql or psycopg2."""
    if not sql_path.exists():
        print(f"Error: {sql_path} not found", file=sys.stderr)
        sys.exit(1)
    
    try:
        # Try psql first
        r = subprocess.run(
            ["psql", "-v", "ON_ERROR_STOP=1", "-f", str(sql_path), url],
            cwd=ROOT,
        )
        if r.returncode != 0:
            sys.exit(r.returncode)
    except FileNotFoundError:
        # Fall back to psycopg2
        try:
            import psycopg2
        except ImportError:
            print("psql not found and psycopg2 not installed. pip install psycopg2-binary", file=sys.stderr)
            sys.exit(1)
        
        sql = sql_path.read_text(encoding="utf-8")
        statements = _split_sql_statements(sql)
        print(f"psql not in PATH; running {sql_path.name} via psycopg2 ({len(statements)} statements)...")
        
        conn = psycopg2.connect(url)
        conn.autocommit = True
        cur = conn.cursor()
        try:
            for i, stmt in enumerate(statements):
                s = stmt.strip()
                if not s or s.startswith("--"):
                    continue
                try:
                    cur.execute(s)
                except Exception as e:
                    print(f"Statement {i + 1} failed: {e}", file=sys.stderr)
                    print(f"First 200 chars: {s[:200]}...", file=sys.stderr)
                    raise
        finally:
            cur.close()
            conn.close()


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
    
    data_sql = ROOT / "data" / "sandarb.sql"
    schema_sql = ROOT / "schema" / "sandarb.sql"
    
    print(f"Loading DB ({label}): {_redact(url)}")
    
    # Step 1: Init schema
    print("  [1/2] Initializing schema...")
    r = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "init_postgres.py")],
        cwd=ROOT,
        env=env,
    )
    if r.returncode != 0:
        print("Schema init failed", file=sys.stderr)
        sys.exit(r.returncode)
    
    # Step 2: Load seed data
    print(f"  [2/2] Loading seed data from {data_sql.name}...")
    run_sql_file(data_sql, url)
    
    print("Done.")


if __name__ == "__main__":
    main()
