/**
 * Postgres implementation for app settings (theme, API, etc.).
 */

import { query, queryOne, getPool } from './pg';

const DEFAULTS: Record<string, string> = {
  theme: 'light',
  defaultFormat: 'json',
  defaultEnvironment: 'development',
};

export async function getSettingPg(key: string): Promise<string> {
  const row = await queryOne<{ value: string }>('SELECT value FROM settings WHERE key = $1', [key]);
  if (row) return row.value;
  return DEFAULTS[key] ?? '';
}

export async function setSettingPg(key: string, value: string): Promise<void> {
  const pool = await getPool();
  if (!pool) return;
  await pool.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`,
    [key, value]
  );
}

export async function getAllSettingsPg(): Promise<Record<string, string>> {
  const rows = await query<{ key: string; value: string }>('SELECT key, value FROM settings');
  const out: Record<string, string> = { ...DEFAULTS };
  for (const { key, value } of rows) {
    out[key] = value;
  }
  return out;
}

export async function updateSettingsPg(updates: Record<string, string>): Promise<Record<string, string>> {
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && value !== null) {
      await setSettingPg(key, String(value));
    }
  }
  return getAllSettingsPg();
}
