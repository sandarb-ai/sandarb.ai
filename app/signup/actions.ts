'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { signSessionToken } from '@/lib/auth/jwt';

const DEMO_COOKIE_NAME = 'sandarb_demo';
const DEMO_PROVIDER_COOKIE = 'sandarb_demo_provider';
/** Session lasts 24 hours so you won't be asked to sign in again. */
const DEMO_COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours
/** JWT cookie for write access; backend checks email against WRITE_ALLOWED_EMAILS. */
const WRITE_JWT_COOKIE_NAME = 'sandarb_write_jwt';
const WRITE_JWT_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * Start demo mode: set cookies and redirect to dashboard.
 * FormData may include "provider" (Google, Apple, X) and optional "email" (for write access).
 */
export async function startDemo(formData?: FormData) {
  const cookieStore = cookies();
  const provider = (formData?.get('provider') as string) || 'Demo';
  const email = (formData?.get('email') as string)?.trim();
  cookieStore.set(DEMO_COOKIE_NAME, '1', {
    path: '/',
    maxAge: DEMO_COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: false,
  });
  cookieStore.set(DEMO_PROVIDER_COOKIE, provider, {
    path: '/',
    maxAge: DEMO_COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: false,
  });
  if (email) {
    try {
      const token = await signSessionToken(email);
      cookieStore.set(WRITE_JWT_COOKIE_NAME, token, {
        path: '/',
        maxAge: WRITE_JWT_MAX_AGE,
        sameSite: 'lax',
        httpOnly: false,
      });
    } catch {
      // JWT_SECRET missing or invalid; leave write cookie unset
    }
  }
  const from = (formData?.get('from') as string)?.trim() || '/dashboard';
  redirect(from.startsWith('/') ? from : '/dashboard');
}
