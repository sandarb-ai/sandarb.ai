#!/usr/bin/env node
/**
 * Drop context/version/audit tables so the new schema can be applied.
 * Run before init-postgres when migrating to the new schema
 * (contexts with owner_team + CHECK, context_versions with version_label + sha256_hash, sandarb_access_logs).
 * Usage: DATABASE_URL=... node scripts/migrate-postgres-reset-context.js
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query('DROP TABLE IF EXISTS sandarb_access_logs CASCADE');
    await client.query('DROP TABLE IF EXISTS sandarb_audit_log CASCADE');
    await client.query('DROP TABLE IF EXISTS context_versions CASCADE');
    await client.query('DROP TABLE IF EXISTS contexts CASCADE');
  } finally {
    await client.end();
  }
}

main().catch(() => {
  process.exit(1);
});
