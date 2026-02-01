'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const DEMO_COOKIE_NAME = 'sandarb_demo';
const DEMO_PROVIDER_COOKIE = 'sandarb_demo_provider';
/** Session lasts 24 hours so you won't be asked to sign in again during that time. */
const DEMO_COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

/**
 * Start demo mode: set cookies and redirect to dashboard.
 * Session persists for 24 hours so you won't be asked to sign in again.
 * FormData may include "provider" (Google, Apple, X) from the button used.
 */
export async function startDemo(formData?: FormData) {
  const cookieStore = cookies();
  const provider = (formData?.get('provider') as string) || 'Demo';
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
  redirect('/dashboard');
}
