-- Create additional databases for Sandarb services.
-- The default 'sandarb' database is created by POSTGRES_DB env var.
-- This script creates the Superset metadata database.

CREATE DATABASE superset;

-- Create replication user for streaming replica
CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'sandarb_repl';
