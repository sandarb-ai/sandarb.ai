'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const DEMO_COOKIE_NAME = 'sandarb_demo';
const DEMO_PROVIDER_COOKIE = 'sandarb_demo_provider';

function getProviderFromCookie(): string {
  if (typeof document === 'undefined') return 'Demo';
  const match = document.cookie.match(new RegExp(`(?:^|; )${DEMO_PROVIDER_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : 'Demo';
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-1.18 1.35-2.15 2.7-3.45 3.95zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function XLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function ProviderIcon({ provider }: { provider: string }) {
  const c = 'h-4 w-4 shrink-0';
  switch (provider) {
    case 'Google':
      return <GoogleLogo className={c} />;
    case 'Apple':
      return <AppleLogo className={c} />;
    case 'X':
      return <XLogo className={c} />;
    default:
      return <User className={`${c} text-violet-500 dark:text-violet-400`} aria-hidden />;
  }
}

const navLink =
  'text-sm font-medium rounded-md px-3 py-2 transition-colors hover:bg-muted/60 hover:text-foreground';
const navLinkInactive = 'text-muted-foreground';

export function SignedInStrip({
  variant = 'header',
  initialSignedIn,
}: {
  variant?: 'header' | 'sidebar';
  /** Server-rendered sign-in state to avoid flash; still synced from cookie in useEffect */
  initialSignedIn?: boolean;
}) {
  const [isSignedIn, setIsSignedIn] = useState(initialSignedIn ?? false);
  const [provider, setProvider] = useState('Demo');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    setIsSignedIn(document.cookie.includes(`${DEMO_COOKIE_NAME}=`));
    setProvider(getProviderFromCookie());
  }, []);

  const handleSignOut = () => {
    document.cookie = `${DEMO_COOKIE_NAME}=; path=/; max-age=0`;
    document.cookie = `${DEMO_PROVIDER_COOKIE}=; path=/; max-age=0`;
    setIsSignedIn(false);
    window.location.href = '/';
  };

  if (!isSignedIn) {
    if (variant === 'header') {
      return (
        <Link
          href="/signup"
          className={`${navLink} flex items-center gap-1.5 ${navLinkInactive}`}
        >
          Try the demo
        </Link>
      );
    }
    return null;
  }

  if (variant === 'sidebar') {
    return (
      <div className="mt-2 pt-2 border-t border-border/80 dark:border-border/60 space-y-0.5">
        {/* Status row: same layout as NavItem, muted and non-interactive */}
        <div
          className="flex items-center gap-3 rounded-md px-2 py-2 text-[15px] text-muted-foreground min-w-0"
          title={`Signed in with ${provider} (demo)`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/50 dark:bg-muted/40 text-muted-foreground">
            <ProviderIcon provider={provider} />
          </span>
          <span className="truncate">Signed in (demo)</span>
        </div>
        {/* Sign out: same look as NavItem so it feels like part of the nav */}
        <button
          type="button"
          onClick={handleSignOut}
          className={cn(
            'w-full group relative flex items-center gap-3 rounded-md px-2 py-2 text-[15px] font-medium transition-colors',
            'text-muted-foreground hover:bg-violet-100/80 dark:hover:bg-violet-900/20 hover:text-foreground'
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground group-hover:text-foreground transition-colors">
            <LogOut className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="min-w-0 truncate">Sign out</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <ProviderIcon provider={provider} />
        <span>Signed in (demo)</span>
      </span>
      <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-1.5">
        <LogOut className="h-4 w-4" aria-hidden />
        Sign out
      </Button>
    </div>
  );
}
