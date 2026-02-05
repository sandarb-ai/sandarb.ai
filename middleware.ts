import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const DEMO_COOKIE_NAME = 'sandarb_demo';

/** Only these routes are allowed when not signed in; all others redirect to /signup. */
const PUBLIC_PATHS = ['/', '/signup'];
const PUBLIC_PREFIX = '/docs'; // /docs and /docs/*

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname) || pathname === PUBLIC_PREFIX || pathname.startsWith(`${PUBLIC_PREFIX}/`)) {
    return NextResponse.next();
  }
  const hasDemo = request.cookies.get(DEMO_COOKIE_NAME)?.value;
  if (!hasDemo) {
    const signup = new URL('/signup', request.url);
    signup.searchParams.set('from', pathname);
    return NextResponse.redirect(signup);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|favicon\\.svg|logo\\.svg).*)',
  ],
};
