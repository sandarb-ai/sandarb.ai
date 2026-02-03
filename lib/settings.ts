/**
 * App settings (theme, API, etc.) stored in DB.
 * Postgres (pg) only.
 */

import * as settingsPg from './settings-pg';

export async function getSetting(key: string): Promise<string> {
  return settingsPg.getSettingPg(key);
}

export async function setSetting(key: string, value: string): Promise<void> {
  return settingsPg.setSettingPg(key, value);
}

export async function getAllSettings(): Promise<Record<string, string>> {
  return settingsPg.getAllSettingsPg();
}

export async function updateSettings(updates: Record<string, string>): Promise<Record<string, string>> {
  return settingsPg.updateSettingsPg(updates);
}

export type ThemeValue = 'light' | 'dark' | 'system';

export async function getTheme(): Promise<ThemeValue> {
  const v = await getSetting('theme');
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'light';
}

export async function setTheme(theme: ThemeValue): Promise<void> {
  return setSetting('theme', theme);
}
