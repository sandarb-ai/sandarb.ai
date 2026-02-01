'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const DEMO_COOKIE_NAME = 'sandarb_demo';
const DEMO_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * Start demo mode: set a cookie and redirect to dashboard.
 * No real identity—just unlocks the app for the demo.
 */
export async function startDemo() {
  const cookieStore = cookies();
  cookieStore.set(DEMO_COOKIE_NAME, '1', {
    path: '/',
    maxAge: DEMO_COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: false, // so client can read for "demo mode" banner if needed
  });
  redirect('/dashboard');
}
