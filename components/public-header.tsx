'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Settings } from 'lucide-react';
import { SignedInStrip } from '@/components/signed-in-strip';

const navLink =
  'text-sm font-medium rounded-md px-3 py-2 transition-colors hover:bg-muted/60 hover:text-foreground';
const navLinkActive = 'text-violet-600 dark:text-violet-400 bg-violet-100/60 dark:bg-violet-900/20';
const navLinkInactive = 'text-muted-foreground';

export function PublicHeader({
  initialSignedIn,
}: {
  /** Server-rendered sign-in state so header is consistent on first paint */
  initialSignedIn?: boolean;
} = {}) {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isDocs = pathname?.startsWith('/docs');
  const isSettings = pathname === '/settings';

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
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          className={`${navLink} flex items-center gap-1.5 ${isSettings ? navLinkActive : navLinkInactive}`}
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <SignedInStrip variant="header" initialSignedIn={initialSignedIn} />
      </div>
    </header>
  );
}
