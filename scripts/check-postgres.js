#!/usr/bin/env node
/**
 * Check that Postgres is reachable (for start-sandarb.sh).
 * Loads .env from project root; defaults DATABASE_URL to local docker-compose URL.
 * Exits 0 if OK, 1 and message if not running / unreachable.
 */

const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.replace(/^#.*/, '').trim();
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) {
      const key = m[1];
      let val = m[2].replace(/^["']|["']$/g, '').trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:sandarb@localhost:5432/sandarb-dev';

const { Client } = require('pg');
const client = new Client({ connectionString: DATABASE_URL });

client
  .connect()
  .then(() => client.end())
  .then(() => {
    console.log('Postgres is running.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Postgres is not running or unreachable:', err.message);
    console.error('');
    console.error('Start Postgres (e.g. with Docker):');
    console.error('  docker compose up -d postgres');
    console.error('');
    console.error('Or set DATABASE_URL in .env to your Postgres connection string.');
    process.exit(1);
  });
