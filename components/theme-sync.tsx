'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { apiUrl } from '@/lib/api';

type ThemeValue = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'sandarb-theme';

/**
 * ThemeSync — ensures a clean, deterministic theme on every load.
 *
 * The ONLY source of truth is: localStorage → DB fallback → "light" fallback.
 * System theme detection is disabled (enableSystem={false} in ThemeProvider).
 *
 * This fixes the Chrome-only bug where stale localStorage values or
 * system-preference detection would force dark mode after clearing storage.
 */
export function ThemeSync() {
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    const stored =
      typeof window !== 'undefined'
        ? localStorage.getItem(STORAGE_KEY)
        : null;

    // If localStorage has an explicit light/dark value, trust it — next-themes
    // already applied it before React hydrated. Nothing to do.
    if (stored === 'light' || stored === 'dark') {
      return;
    }

    // Stale "system" value or no value at all — we disabled enableSystem,
    // so "system" is no longer valid. Clean it up and seed from DB.
    if (stored === 'system') {
      localStorage.removeItem(STORAGE_KEY);
    }

    // Fetch from backend DB to seed the initial theme
    fetch(apiUrl('/api/settings'))
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.theme) {
          const t = d.data.theme as ThemeValue;
          if (t === 'light' || t === 'dark') {
            setTheme(t);
            return;
          }
        }
        // No valid theme in DB — default to light
        setTheme('light');
      })
      .catch(() => {
        setTheme('light');
      });
  }, [setTheme]);

  return null;
}
