"""Postgres connection pool using psycopg2 ThreadedConnectionPool."""

import json
from contextlib import contextmanager
from typing import Any, Generator

import psycopg2
import psycopg2.pool
from psycopg2.extras import RealDictCursor

from backend.config import settings

_pool: psycopg2.pool.ThreadedConnectionPool | None = None


def _get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    """Lazily create and return the connection pool."""
    global _pool
    if _pool is None or _pool.closed:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=settings.db_pool_min,
            maxconn=settings.db_pool_max,
            dsn=settings.database_url,
            cursor_factory=RealDictCursor,
            connect_timeout=settings.db_connect_timeout,
        )
    return _pool


def get_connection():
    """Get a connection from the pool. Caller must call put_connection() when done."""
    return _get_pool().getconn()


def put_connection(conn: Any) -> None:
    """Return a connection to the pool."""
    try:
        _get_pool().putconn(conn)
    except Exception:
        pass


def close_pool() -> None:
    """Close all pool connections. Call on app shutdown."""
    global _pool
    if _pool and not _pool.closed:
        _pool.closeall()
    _pool = None


@contextmanager
def cursor() -> Generator[Any, None, None]:
    """Context manager for a dict cursor. Gets conn from pool, auto-commits/rollbacks."""
    pool = _get_pool()
    conn = pool.getconn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        pool.putconn(conn)


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
