"""Platform configuration service — separate config tables for each system.

Tables:
  - ``config_kafka``      — Kafka cluster settings
  - ``config_clickhouse``  — ClickHouse cluster settings
  - ``config_superset``    — Superset endpoint settings
  - ``config_gen_ai``      — LLM / Gen AI settings for context generation

Each table stores a single row (upserted on first save). If no row exists,
the API returns column defaults from the schema.
"""

import logging
from typing import Any

from backend.db import query_one, execute

logger = logging.getLogger(__name__)

# ── Column metadata per table (for masking, descriptions) ──────────

# Fields marked is_secret are masked in API GET responses.

TABLES: dict[str, dict[str, dict[str, Any]]] = {
    "kafka": {
        "_table": "config_kafka",
        "bootstrap_servers": {"is_secret": False, "description": "Comma-separated Kafka broker addresses"},
        "enabled": {"is_secret": False, "description": "Enable Kafka event publishing"},
        "compression_type": {"is_secret": False, "description": "Kafka message compression (lz4, snappy, gzip, zstd, none)"},
        "acks": {"is_secret": False, "description": "Kafka producer acknowledgment level (0, 1, all)"},
    },
    "clickhouse": {
        "_table": "config_clickhouse",
        "url": {"is_secret": False, "description": "ClickHouse HTTP endpoint URL"},
        "database_name": {"is_secret": False, "description": "ClickHouse database name"},
        "username": {"is_secret": False, "description": "ClickHouse username"},
        "password": {"is_secret": True, "description": "ClickHouse password"},
    },
    "superset": {
        "_table": "config_superset",
        "url": {"is_secret": False, "description": "Apache Superset base URL"},
        "username": {"is_secret": False, "description": "Superset admin username"},
        "password": {"is_secret": True, "description": "Superset admin password"},
    },
    "gen_ai": {
        "_table": "config_gen_ai",
        "provider": {"is_secret": False, "description": "LLM provider (anthropic, openai, azure)"},
        "model": {"is_secret": False, "description": "LLM model identifier"},
        "api_key": {"is_secret": True, "description": "LLM provider API key"},
        "base_url": {"is_secret": False, "description": "Custom LLM endpoint URL (for Azure or self-hosted)"},
        "temperature": {"is_secret": False, "description": "LLM sampling temperature (0.0 to 1.0)"},
        "max_tokens": {"is_secret": False, "description": "Maximum output tokens for LLM generation"},
        "system_prompt": {"is_secret": False, "description": "System prompt for natural language to Jinja2 template generation"},
    },
}

# Column names per table (exclude _table metadata key)
def _columns(section: str) -> list[str]:
    return [k for k in TABLES[section] if k != "_table"]


def _pg_table(section: str) -> str:
    return TABLES[section]["_table"]


# ── Public API ─────────────────────────────────────────────────────

def get_config(section: str) -> dict[str, Any]:
    """Get config for a section. Returns column defaults if no row saved yet."""
    if section not in TABLES:
        raise ValueError(f"Unknown config section: {section}")

    table = _pg_table(section)
    cols = _columns(section)
    col_list = ", ".join(cols) + ", updated_at, updated_by"

    row = query_one(f"SELECT {col_list} FROM {table} LIMIT 1")  # noqa: S608

    result: dict[str, Any] = {}
    meta = TABLES[section]

    for col in cols:
        is_secret = meta[col].get("is_secret", False)
        if row:
            val = row[col]
            # Convert booleans to strings for consistency
            if isinstance(val, bool):
                val = str(val).lower()
            elif val is None:
                val = ""
            else:
                val = str(val)
        else:
            val = ""  # DB defaults are used when row is created

        result[col] = {
            "value": _mask_value(val) if is_secret and val else val,
            "is_secret": is_secret,
            "description": meta[col]["description"],
        }

    result["_meta"] = {
        "updated_at": str(row["updated_at"]) if row and row.get("updated_at") else None,
        "updated_by": row["updated_by"] if row else None,
        "has_row": row is not None,
    }
    return result


def get_all_configs() -> dict[str, dict]:
    """Get all config sections."""
    return {section: get_config(section) for section in TABLES}


def update_config(section: str, updates: dict[str, Any], updated_by: str = "") -> dict[str, Any]:
    """Upsert a config row. Only provided keys are updated."""
    if section not in TABLES:
        raise ValueError(f"Unknown config section: {section}")

    table = _pg_table(section)
    meta = TABLES[section]
    cols = _columns(section)

    # Validate keys
    for key in updates:
        if key not in cols:
            raise ValueError(f"Unknown key '{key}' in section '{section}'")

    # Skip masked secret values (user didn't change them)
    clean_updates = {}
    for key, value in updates.items():
        is_secret = meta[key].get("is_secret", False)
        if is_secret and isinstance(value, str) and value.startswith("****"):
            continue
        clean_updates[key] = value

    if not clean_updates:
        return get_config(section)

    # Check if row exists
    existing = query_one(f"SELECT id FROM {table} LIMIT 1")  # noqa: S608

    if existing:
        # UPDATE only the provided columns
        set_parts = []
        params: list[Any] = []
        for key, value in clean_updates.items():
            set_parts.append(f"{key} = %s")
            params.append(value)
        set_parts.append("updated_at = NOW()")
        set_parts.append("updated_by = %s")
        params.append(updated_by)
        params.append(existing["id"])

        execute(
            f"UPDATE {table} SET {', '.join(set_parts)} WHERE id = %s",  # noqa: S608
            tuple(params),
        )
    else:
        # INSERT with provided values + defaults for the rest
        insert_cols = list(clean_updates.keys()) + ["updated_by"]
        insert_vals = list(clean_updates.values()) + [updated_by]
        placeholders = ", ".join(["%s"] * len(insert_vals))
        col_names = ", ".join(insert_cols)

        execute(
            f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})",  # noqa: S608
            tuple(insert_vals),
        )

    return get_config(section)


def get_raw_value(section: str, key: str) -> str:
    """Get unmasked raw value for internal use (Kafka producer, AI service).

    Returns the DB value or empty string if no row exists (caller should
    fall back to env var or hardcoded default).
    """
    if section not in TABLES or key not in _columns(section):
        return ""

    table = _pg_table(section)
    row = query_one(f"SELECT {key} FROM {table} LIMIT 1")  # noqa: S608
    if not row:
        return ""
    val = row[key]
    if isinstance(val, bool):
        return str(val).lower()
    return str(val) if val else ""


def ensure_tables():
    """Create all config tables if they don't exist (idempotent)."""
    execute("""
        CREATE TABLE IF NOT EXISTS config_kafka (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            bootstrap_servers TEXT NOT NULL DEFAULT 'localhost:9092,localhost:9093,localhost:9094,localhost:9095,localhost:9096',
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            compression_type TEXT NOT NULL DEFAULT 'lz4',
            acks TEXT NOT NULL DEFAULT '1',
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_by TEXT
        )
    """)
    execute("""
        CREATE TABLE IF NOT EXISTS config_clickhouse (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            url TEXT NOT NULL DEFAULT 'http://localhost:8123',
            database_name TEXT NOT NULL DEFAULT 'sandarb',
            username TEXT NOT NULL DEFAULT 'default',
            password TEXT NOT NULL DEFAULT '',
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_by TEXT
        )
    """)
    execute("""
        CREATE TABLE IF NOT EXISTS config_superset (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            url TEXT NOT NULL DEFAULT 'http://localhost:8088',
            username TEXT NOT NULL DEFAULT 'admin',
            password TEXT NOT NULL DEFAULT '',
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_by TEXT
        )
    """)
    execute("""
        CREATE TABLE IF NOT EXISTS config_gen_ai (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider TEXT NOT NULL DEFAULT 'anthropic',
            model TEXT NOT NULL DEFAULT 'claude-sonnet-4-5-20250929',
            api_key TEXT NOT NULL DEFAULT '',
            base_url TEXT NOT NULL DEFAULT '',
            temperature REAL NOT NULL DEFAULT 0.3,
            max_tokens INTEGER NOT NULL DEFAULT 4096,
            system_prompt TEXT NOT NULL DEFAULT '',
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_by TEXT
        )
    """)


def _mask_value(value: str) -> str:
    """Mask a secret value for API responses."""
    if not value:
        return ""
    if len(value) <= 4:
        return "****"
    return "****" + value[-4:]
