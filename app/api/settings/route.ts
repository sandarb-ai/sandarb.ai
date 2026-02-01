import { NextRequest, NextResponse } from 'next/server';
import { getAllSettings, updateSettings } from '@/lib/settings';

const ALLOWED_KEYS = new Set([
  'theme',
  'defaultFormat',
  'defaultEnvironment',
]);

// GET /api/settings - Get all settings (theme, etc.)
export async function GET() {
  try {
    const data = getAllSettings();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PATCH /api/settings - Update settings (e.g. theme: light | dark | system)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const updates: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_KEYS.has(key) && typeof value === 'string') {
        updates[key] = value;
      }
    }
    const data = updateSettings(updates);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Failed to update settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
