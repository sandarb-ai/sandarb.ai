import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '@/lib/auth/jwt';
import { verifyServiceAccount } from '@/lib/service-accounts-pg';

export async function POST(req: NextRequest) {
  let body: { clientId?: string; clientSecret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const clientId = body?.clientId ?? '';
  const clientSecret = body?.clientSecret ?? '';
  const agentId = await verifyServiceAccount(clientId, clientSecret);
  if (!agentId) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await signToken(agentId);
  return NextResponse.json({ access_token: token, expires_in: 3600 });
}
