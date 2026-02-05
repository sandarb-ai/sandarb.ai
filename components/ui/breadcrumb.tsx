'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Breadcrumb navigation. Last item is current (no link).
 * Only shown when there is a path (2+ segments); single-crumb list pages do not show a bar.
 */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  if (!items.length || items.length < 2) return null;
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        'flex items-center gap-1.5 rounded-md border border-violet-200/80 dark:border-violet-800/50 bg-violet-50/80 dark:bg-violet-950/40 px-3 py-2 text-[13px] font-medium',
        className
      )}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-violet-500 dark:text-violet-400 shrink-0 opacity-80" aria-hidden />
            )}
            {isLast || !item.href ? (
              <span
                className="text-violet-900 dark:text-violet-100 truncate max-w-[12rem] sm:max-w-none"
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-violet-700 dark:text-violet-300 hover:text-violet-900 dark:hover:text-violet-100 hover:underline underline-offset-2 truncate max-w-[8rem] sm:max-w-[12rem] transition-colors"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
