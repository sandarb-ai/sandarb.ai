import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '@/lib/auth/jwt';

export async function POST(req: NextRequest) {
  const body = await req.json();

  // TODO: Replace this with a real DB lookup of client_id/secret
  if (body.clientId === 'admin' && body.clientSecret === 'change-me') {
    const token = await signToken('admin-agent');
    return NextResponse.json({ access_token: token, expires_in: 3600 });
  }

  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
}
