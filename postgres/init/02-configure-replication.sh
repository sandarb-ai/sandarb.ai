#!/bin/bash
# Configure pg_hba.conf to allow replication connections from the replica.
# This runs during initdb on the PRIMARY only.

set -e

echo "Configuring pg_hba.conf for streaming replication..."

# Append replication permission to pg_hba.conf
echo "host replication replicator all md5" >> "$PGDATA/pg_hba.conf"

echo "Replication configuration complete."
