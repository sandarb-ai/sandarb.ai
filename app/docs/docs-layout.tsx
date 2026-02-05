'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocsNav, type TocGroup } from './docs-nav';

export function DocsLayout({
  tocGroups,
  children,
}: {
  tocGroups: TocGroup[];
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const leftNav = (
    <nav className="p-4 py-6 space-y-1">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
        Sections
      </p>
      {tocGroups.map((group) => {
        const firstId = group.items[0]?.id;
        if (!firstId) return null;
        return (
          <Link
            key={group.label}
            href={`#${firstId}`}
            className="block py-2 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-violet-100/50 dark:hover:bg-violet-900/20 transition-colors"
            onClick={() => setMobileOpen(false)}
          >
            {group.label}
          </Link>
        );
      })}
    </nav>
  );

  const rightToc = <DocsNav groups={tocGroups} />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sticky top bar with glassmorphism */}
      <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 lg:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle docs menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <Link href="/docs" className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
            <BookOpen className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <span className="font-semibold text-foreground truncate">Developer documentation</span>
        </Link>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 lg:hidden bg-background/95 backdrop-blur-sm"
          aria-modal
          role="dialog"
        >
          <div className="flex flex-col h-full pt-14 pb-6 overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 overflow-y-auto px-4">
              <div>{leftNav}</div>
              <div className="border-t sm:border-t-0 sm:border-l border-border/40 pt-4 sm:pt-0 sm:pl-4">
                {rightToc}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 flex-row">
        {/* Left: high-level nav (desktop) */}
        <aside className="hidden lg:flex shrink-0 w-52 border-r border-border/40 bg-muted/10 min-h-0 overflow-y-auto">
          {leftNav}
        </aside>

        {/* Center: main content */}
        <main
          id="docs-main"
          className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden scroll-smooth"
        >
          {children}
        </main>

        {/* Right: On this page TOC (desktop) */}
        <aside className="hidden xl:flex shrink-0 w-60 border-l border-border/40 bg-muted/10 min-h-0 overflow-y-auto">
          {rightToc}
        </aside>
      </div>
    </div>
  );
}
