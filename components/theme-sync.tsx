'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { apiUrl } from '@/lib/api';

type ThemeValue = 'light' | 'dark' | 'system';

export function ThemeSync() {
  const { setTheme } = useTheme();

  useEffect(() => {
    fetch(apiUrl('/api/settings'))
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.theme) {
          const t = d.data.theme as ThemeValue;
          if (t === 'light' || t === 'dark' || t === 'system') {
            setTheme(t);
            return;
          }
        }
        // No saved theme from API — ensure light default
        // (clears any stale localStorage value from previous sessions)
        setTheme('light');
      })
      .catch(() => {
        setTheme('light');
      });
  }, [setTheme]);

  return null;
}
