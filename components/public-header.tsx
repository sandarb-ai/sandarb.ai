'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Settings } from 'lucide-react';
import { SignedInStrip, DEMO_COOKIE_NAME } from '@/components/signed-in-strip';
import { NotificationFeed } from '@/components/notification-feed';

const navLink =
  'text-sm font-medium rounded-md px-3 py-2 transition-colors hover:bg-muted/60 hover:text-foreground';
const navLinkActive = 'text-violet-600 dark:text-violet-400 bg-violet-100/60 dark:bg-violet-900/20';
const navLinkInactive = 'text-muted-foreground';
const iconButton =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-muted/60 hover:text-foreground text-muted-foreground';

export function PublicHeader({
  initialSignedIn,
}: {
  /** Server-rendered sign-in state so header is consistent on first paint */
  initialSignedIn?: boolean;
} = {}) {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isDocs = pathname?.startsWith('/docs');
  const isAGP = pathname === '/agp';
  const isSettings = pathname === '/settings';

  // Notification bell: only show when signed in and not on public pages
  const isPublicPath = isHome || pathname === '/signup' || isDocs;
  const [signedIn, setSignedIn] = useState(initialSignedIn ?? false);
  useEffect(() => {
    if (typeof document !== 'undefined') {
      setSignedIn(document.cookie.includes(`${DEMO_COOKIE_NAME}=`));
    }
  }, []);
  const showNotifications = signedIn && !isPublicPath;

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 sm:px-6 py-2">
      <div className="flex items-center gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/50 transition-colors"
          aria-label="Sandarb home"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500">
            <Image src="/logo.svg" alt="" width={20} height={20} />
          </div>
          <span className="text-sm font-semibold text-foreground">Sandarb</span>
        </Link>
        <nav className="flex items-center gap-0.5" aria-label="Main">
          <Link
            href="/"
            className={`${navLink} ${isHome ? navLinkActive : navLinkInactive}`}
          >
            Home
          </Link>
          <Link
            href="/docs"
            className={`${navLink} ${isDocs ? navLinkActive : navLinkInactive}`}
          >
            Docs
          </Link>
          <Link
            href="/agp"
            className={`${navLink} ${isAGP ? navLinkActive : navLinkInactive}`}
          >
            AGP
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-1">
        {showNotifications && <NotificationFeed />}
        <SignedInStrip
          variant="header"
          initialSignedIn={initialSignedIn}
          insertBetween={
            <Link
              href="/settings"
              className={`${iconButton} ${isSettings ? 'text-violet-600 dark:text-violet-400 bg-violet-100/60 dark:bg-violet-900/20' : ''}`}
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </Link>
          }
        />
      </div>
    </header>
  );
}
