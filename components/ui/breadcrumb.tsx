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
 * Use for list pages (single crumb) and detail pages (Section > ... > Current).
 */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  if (!items.length) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1.5 text-sm', className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground/70 shrink-0" aria-hidden />
            )}
            {isLast || !item.href ? (
              <span
                className="font-medium text-foreground truncate max-w-[12rem] sm:max-w-none"
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-muted-foreground hover:text-foreground truncate max-w-[8rem] sm:max-w-[12rem] transition-colors"
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
