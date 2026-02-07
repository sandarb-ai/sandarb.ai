FROM apache/superset:latest

USER root

# Install ClickHouse drivers INTO the Superset venv.
# The Superset image uses /app/.venv/ — plain "pip install" goes to
# /usr/local which is NOT on the venv sys.path. Use --target to fix.
RUN pip install --no-cache-dir \
    --target /app/.venv/lib/python3.10/site-packages \
    clickhouse-connect \
    clickhouse-sqlalchemy \
    clickhouse-driver \
    psycopg2-binary

# Sandarb Superset config (PostgreSQL metadata DB, ClickHouse drivers)
COPY superset_config.py /app/pythonpath/superset_config.py

USER superset
