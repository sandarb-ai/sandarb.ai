#!/usr/bin/env python3
"""
Check that Postgres is reachable (for start-sandarb.sh).
Loads .env from project root; defaults DATABASE_URL to local docker-compose URL.
Exits 0 if OK, 1 if not running / unreachable.
"""
import sys
from pathlib import Path

# Scripts dir on path so we can import _env (same directory)
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _env import load_dotenv, get_database_url

load_dotenv()


def main() -> None:
    try:
        import psycopg2
    except ImportError:
        print("psycopg2 not installed. pip install psycopg2-binary", file=sys.stderr)
        sys.exit(1)
    url = get_database_url()
    try:
        conn = psycopg2.connect(url)
        conn.close()
    except Exception:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
