'use client';

import { useState, useRef, useEffect } from 'react';
import { Info, X } from 'lucide-react';

const GLOSSARY: Record<string, { full: string; description: string }> = {
  AGP: {
    full: 'AI Governance Proof',
    description:
      'The core metric tracking every governance event end-to-end — cryptographic hash proofs, trace IDs, and full audit metadata ensuring compliance & regulatory requirements are met.',
  },
  SKCC: {
    full: 'Sandarb Kafka to ClickHouse Consumer',
    description:
      'Standalone Python service that consumes AGP events from Kafka topics and batch-inserts them into ClickHouse for real-time analytics and dashboards.',
  },
};

/**
 * Inline (i) icon that opens a popover bubble with the full form and description
 * of a governance abbreviation (AGP, SKCC). Click to open, click X or outside to close.
 */
export function InfoBubble({ term }: { term: keyof typeof GLOSSARY }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const entry = GLOSSARY[term];

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (!entry) return null;

  return (
    <span ref={ref} className="relative inline-flex items-center align-baseline">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center ml-0.5 rounded-full text-violet-500 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        aria-label={`Info about ${term}`}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-72 rounded-lg border border-border/60 bg-popover text-popover-foreground shadow-lg p-3 animate-in fade-in-0 zoom-in-95">
          <span className="flex items-start justify-between gap-2 mb-1">
            <span className="text-xs font-bold text-violet-600 dark:text-violet-400">
              {term} — {entry.full}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
          <span className="text-xs text-muted-foreground leading-relaxed block">{entry.description}</span>
          {/* Arrow */}
          <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-border/60" />
        </span>
      )}
    </span>
  );
}
