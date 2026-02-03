#!/usr/bin/env node
/**
 * Full reset: drop all Sandarb Postgres tables, recreate schema, seed sample data.
 * Use when you want a clean DB with sample data (e.g. on boot).
 * Loads .env from project root if present; otherwise set DATABASE_URL in the environment.
 */

const path = require('path');
const fs = require('fs');

// Load .env from project root so DATABASE_URL is available when run via npm run db:full-reset-pg
const envPath = path.resolve(__dirname, '..', '.env');
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

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:sandarb@localhost:5432/sandarb-dev';

const DROP_ORDER = [
  'sandarb_access_logs',
  'sandarb_audit_log',
  'context_versions',
  'activity_log',
  'unauthenticated_detections',
  'scan_targets',
  'agents',
  'org_members',
  'contexts',
  'organizations',
  'templates',
  'settings',
];

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    for (const table of DROP_ORDER) {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
    console.log('Dropped all Sandarb tables');
  } finally {
    await client.end();
  }

  const { execSync } = require('child_process');
  const env = { ...process.env, DATABASE_URL };
  console.log('Applying schema...');
  execSync('node scripts/init-postgres.js', { stdio: 'inherit', env, cwd: require('path').resolve(__dirname, '..') });
  console.log('Seeding sample data...');
  execSync('node scripts/seed-postgres.js', { stdio: 'inherit', env, cwd: require('path').resolve(__dirname, '..') });
  console.log('Full reset complete. Sample data is ready.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
