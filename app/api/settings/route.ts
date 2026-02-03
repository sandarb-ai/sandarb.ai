import { NextRequest, NextResponse } from 'next/server';
import { getAllSettings, updateSettings } from '@/lib/settings';
import { withSpan, logger } from '@/lib/otel';

const ALLOWED_KEYS = new Set([
  'theme',
  'defaultFormat',
  'defaultEnvironment',
]);

// GET /api/settings - Get all settings (theme, etc.)
export async function GET() {
  return withSpan('GET /api/settings', async () => {
    try {
      const data = await getAllSettings();
      return NextResponse.json({ success: true, data });
    } catch (error) {
      logger.error('Failed to fetch settings', { route: 'GET /api/settings', error: String(error) });
      return NextResponse.json(
        { success: false, error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }
  });
}

// PATCH /api/settings - Update settings (e.g. theme: light | dark | system)
export async function PATCH(request: NextRequest) {
  return withSpan('PATCH /api/settings', async () => {
    try {
      const body = await request.json();
      const updates: Record<string, string> = {};
      for (const [key, value] of Object.entries(body)) {
        if (ALLOWED_KEYS.has(key) && typeof value === 'string') {
          updates[key] = value;
        }
      }
      const data = await updateSettings(updates);
      return NextResponse.json({ success: true, data });
    } catch (error) {
      logger.error('Failed to update settings', { route: 'PATCH /api/settings', error: String(error) });
      return NextResponse.json(
        { success: false, error: 'Failed to update settings' },
        { status: 500 }
      );
    }
  });
}
