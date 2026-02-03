/**
 * App settings (theme, API, etc.) stored in DB.
 * All UI settings are persisted and exposed via API.
 */

import db from './db';

const DEFAULTS: Record<string, string> = {
  theme: 'light',
  defaultFormat: 'json',
  defaultEnvironment: 'development',
};

export function getSetting(key: string): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  if (row) return row.value;
  return DEFAULTS[key] ?? '';
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?').run(
    key,
    value,
    value
  );
}

export function getAllSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const out: Record<string, string> = { ...DEFAULTS };
  for (const { key, value } of rows) {
    out[key] = value;
  }
  return out;
}

export function updateSettings(updates: Record<string, string>): Record<string, string> {
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && value !== null) {
      setSetting(key, String(value));
    }
  }
  return getAllSettings();
}

export type ThemeValue = 'light' | 'dark' | 'system';

export function getTheme(): ThemeValue {
  const v = getSetting('theme');
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'light';
}

export function setTheme(theme: ThemeValue): void {
  setSetting('theme', theme);
}
