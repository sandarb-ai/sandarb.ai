#!/usr/bin/env python3
"""
Drop context/version/audit tables so the new schema can be applied.
Run before init-postgres when migrating to the new schema.
Usage: DATABASE_URL=... python scripts/migrate_postgres_reset_context.py
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _env import load_dotenv, get_database_url

load_dotenv()


def main() -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit(1)
    try:
        import psycopg2
    except ImportError:
        print("psycopg2 not installed. pip install psycopg2-binary", file=sys.stderr)
        sys.exit(1)
    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute("DROP TABLE IF EXISTS sandarb_access_logs CASCADE")
        cur.execute("DROP TABLE IF EXISTS sandarb_audit_log CASCADE")
        cur.execute("DROP TABLE IF EXISTS context_versions CASCADE")
        cur.execute("DROP TABLE IF EXISTS contexts CASCADE")
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        sys.exit(1)
