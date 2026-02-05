"""Postgres connection pool. Reuses existing Sandarb schema."""

import json
from contextlib import contextmanager
from typing import Any, Generator

import psycopg2
from psycopg2.extras import RealDictCursor

from backend.config import settings

_conn: Any = None


def get_connection():
    """Return a connection (creates pool-like usage via single connection for simplicity)."""
    global _conn
    if _conn is None or _conn.closed:
        _conn = psycopg2.connect(
            settings.database_url,
            cursor_factory=RealDictCursor,
        )
    return _conn


@contextmanager
def cursor() -> Generator[Any, None, None]:
    """Context manager for a dict cursor."""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def query(sql: str, params: tuple | list | None = None) -> list[dict]:
    """Execute SELECT and return list of dict rows."""
    with cursor() as cur:
        cur.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]


def query_one(sql: str, params: tuple | list | None = None) -> dict | None:
    """Execute SELECT and return first row as dict or None."""
    with cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        return dict(row) if row else None


def execute(sql: str, params: tuple | list | None = None) -> None:
    """Execute INSERT/UPDATE/DELETE."""
    with cursor() as cur:
        cur.execute(sql, params)


def parse_json_array(v: Any) -> list[str]:
    if v is None:
        return []
    if isinstance(v, list):
        return [str(x) for x in v]
    if isinstance(v, str):
        try:
            a = json.loads(v)
            return [str(x) for x in a] if isinstance(a, list) else []
        except Exception:
            return []
    return []
