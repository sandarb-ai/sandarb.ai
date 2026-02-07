"""Sandarb Superset configuration.

Metadata DB uses PostgreSQL (sandarb-postgres-primary) for HA cluster mode.
All nodes share the same metadata DB for consistent state.
"""
import os

# PostgreSQL metadata database (shared across all Superset nodes)
SQLALCHEMY_DATABASE_URI = os.environ.get(
    "SQLALCHEMY_DATABASE_URI",
    "postgresql+psycopg2://postgres:sandarb@sandarb-postgres-primary:5432/superset",
)

# Secret key (must be identical across all nodes for session sharing)
SECRET_KEY = os.environ.get("SUPERSET_SECRET_KEY", "sandarb_super_secret_key_change_me")

# Disable Flask-Limiter in-memory warning (Redis caching will be added later)
RATELIMIT_ENABLED = False
