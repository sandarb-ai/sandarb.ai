#!/usr/bin/env python3
"""
Generate a single GCP Cloud SQL–ready import file (schema + data).
Uses a temporary local DB: creates it, runs init + seed, pg_dump to one .sql file, then drops the DB.

Usage: python scripts/generate_gcp_import_sql.py [OUTPUT_FILE]
  OUTPUT_FILE default: export/sandarb-cloudsql-import.sql

Requires: Postgres (local or via Cloud SQL Proxy), pg_dump on PATH.
Loads .env. Uses DATABASE_URL (local); if unset, CLOUD_SQL_DATABASE_URL only when TCP (not socket).
"""
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _env import load_dotenv, get_database_url_for_reset

load_dotenv()

TEMP_DB = "sandarb_gcp_export"


def get_create_db_url(url: str) -> str:
    try:
        p = urlparse(url)
        netloc = p.netloc or "localhost:5432"
        return f"{p.scheme or 'postgresql'}://{netloc}/postgres"
    except Exception:
        return "postgresql://localhost:5432/postgres"


def replace_path_in_url(url: str, new_path: str) -> str | None:
    try:
        p = urlparse(url)
        path = new_path.lstrip("/")
        new = p._replace(path="/" + path if path else "/")
        return new.geturl()
    except Exception:
        return None


def is_localhost(url: str) -> bool:
    try:
        p = urlparse(url)
        host = (p.hostname or "").lower()
        return host in ("localhost", "127.0.0.1", "")
    except Exception:
        return False


def main() -> None:
    out_arg = sys.argv[1] if len(sys.argv) > 1 else "export/sandarb-cloudsql-import.sql"
    out_file = (ROOT / out_arg).resolve()

    url = get_database_url_for_reset()
    create_url = get_create_db_url(url)
    temp_url = replace_path_in_url(url, TEMP_DB)
    if not temp_url:
        print("Invalid DATABASE_URL", file=sys.stderr)
        sys.exit(1)

    try:
        import psycopg2
        from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
    except ImportError:
        print("psycopg2 not installed. pip install psycopg2-binary", file=sys.stderr)
        sys.exit(1)

    # Create temp DB
    conn = psycopg2.connect(create_url)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    try:
        cur.execute(f'DROP DATABASE IF EXISTS "{TEMP_DB}"')
        cur.execute(f'CREATE DATABASE "{TEMP_DB}"')
    finally:
        cur.close()
        conn.close()

    env = os.environ.copy()
    env["DATABASE_URL"] = temp_url

    print("Temp DB created. Running schema + seed...")
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "init_postgres.py")], cwd=ROOT, env=env)
    if r.returncode != 0:
        sys.exit(r.returncode)
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "seed_postgres.py")], cwd=ROOT, env=env)
    if r.returncode != 0:
        sys.exit(r.returncode)

    out_file.parent.mkdir(parents=True, exist_ok=True)
    print(f"Dumping schema + data to {out_file} ...")

    dump_ok = False
    if is_localhost(url):
        dc = subprocess.run(["docker", "compose", "ps", "postgres", "--format", "json"], cwd=ROOT, capture_output=True, text=True)
        if dc.returncode == 0 and (dc.stdout or "").strip():
            r = subprocess.run(
                ["docker", "compose", "exec", "-T", "postgres", "pg_dump", "-U", "postgres", "-d", TEMP_DB, "--no-owner", "--no-acl"],
                cwd=ROOT,
                stdout=open(out_file, "wb"),
                stderr=subprocess.PIPE,
            )
            if r.returncode == 0:
                dump_ok = True
            else:
                print("Docker pg_dump failed:", r.stderr, file=sys.stderr)
    if not dump_ok:
        r = subprocess.run(["pg_dump", temp_url, "--no-owner", "--no-acl", "-f", str(out_file)], cwd=ROOT)
        if r.returncode != 0:
            print("pg_dump failed. Ensure pg_dump is on PATH and version matches server.", file=sys.stderr)
            sys.exit(1)

    # Drop temp DB
    conn = psycopg2.connect(create_url)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    try:
        cur.execute(f'DROP DATABASE IF EXISTS "{TEMP_DB}"')
    finally:
        cur.close()
        conn.close()

    print("Done. Import file:", out_file)
    print("Import to Cloud SQL: gcloud sql connect INSTANCE --user=postgres --database=DB <", out_file.name, "(or use Cloud Console SQL import)")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(e, file=sys.stderr)
        sys.exit(1)
