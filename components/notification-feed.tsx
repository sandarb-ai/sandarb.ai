'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, CheckCircle2, XCircle, AlertTriangle, Info, Loader2, RefreshCw, X, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiUrl } from '@/lib/api';

interface HealthItem {
  id: string;
  name: string;
  category: string;
  status: string;
  latency_ms: number;
  detail: string;
  checked_at: string;
}

interface HealthFeed {
  overall: string;
  summary: { healthy: number; unhealthy: number; not_configured: number; info: number; total: number };
  items: HealthItem[];
}

const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  healthy: CheckCircle2,
  unhealthy: XCircle,
  degraded: AlertTriangle,
  not_configured: AlertTriangle,
  disabled: AlertTriangle,
  info: Info,
  unknown: Info,
  error: XCircle,
};

const STATUS_COLOR: Record<string, string> = {
  healthy: 'text-green-500',
  unhealthy: 'text-red-500',
  degraded: 'text-yellow-500',
  not_configured: 'text-muted-foreground',
  disabled: 'text-muted-foreground',
  info: 'text-blue-400',
  unknown: 'text-muted-foreground',
  error: 'text-red-500',
};

const STATUS_BG: Record<string, string> = {
  healthy: 'bg-green-500/10',
  unhealthy: 'bg-red-500/10',
  not_configured: 'bg-muted/50',
  disabled: 'bg-muted/50',
  info: 'bg-blue-500/10',
  unknown: 'bg-muted/50',
  error: 'bg-red-500/10',
};

const BELL_DOT_COLOR: Record<string, string> = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  unhealthy: 'bg-red-500',
};

/** Format ISO (UTC) timestamp to the browser's local timezone. */
function formatCheckedAt(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    // Resolve the browser's short timezone name (e.g. "PST", "IST", "EST")
    const tz = Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
      .formatToParts(d)
      .find((p) => p.type === 'timeZoneName')?.value ?? '';

    if (diffSec < 5) return `just now (${tz})`;
    if (diffSec < 60) return `${diffSec}s ago (${tz})`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago (${tz})`;

    // Older than 1 hour — show full local date/time with timezone
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });
  } catch {
    return iso;
  }
}

export function NotificationFeed() {
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<HealthFeed | null>(null);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(apiUrl('/api/notifications/health'));
      const data = await resp.json();
      if (data.success) {
        setFeed(data.data);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount + every 60s
  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 60_000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const overall = feed?.overall ?? 'unknown';
  const unhealthyCount = feed?.summary.unhealthy ?? 0;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => { setOpen(!open); if (!open) fetchFeed(); }}
        className={cn(
          'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors',
          'hover:bg-muted/60 hover:text-foreground text-muted-foreground',
          open && 'bg-muted/60 text-foreground'
        )}
        aria-label="Notifications"
        title="Infrastructure Status"
      >
        <Bell className="h-5 w-5" />
        {/* Status dot */}
        {feed && (
          <span
            className={cn(
              'absolute top-1 right-1 h-2.5 w-2.5 rounded-full ring-2 ring-background',
              BELL_DOT_COLOR[overall] ?? 'bg-gray-400'
            )}
          />
        )}
        {/* Unhealthy count badge */}
        {unhealthyCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unhealthyCount}
          </span>
        )}
      </button>

      {/* Feed Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] rounded-lg border border-border bg-background shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              {overall === 'healthy' ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <h3 className="text-sm font-semibold">Infrastructure Status</h3>
              {feed && (
                <span className={cn(
                  'text-xs font-medium px-1.5 py-0.5 rounded-full',
                  overall === 'healthy' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' :
                  overall === 'degraded' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400' :
                  'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                )}>
                  {overall}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); fetchFeed(); }}
                className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted/60 text-muted-foreground"
                title="Refresh"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted/60 text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Items */}
          <div className="max-h-[420px] overflow-y-auto">
            {!feed && loading && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Checking...
              </div>
            )}

            {feed && (
              <>
                {/* Core Services */}
                <div className="px-3 pt-3 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Core Services</span>
                </div>
                {feed.items.filter(i => i.category === 'core').map((item) => (
                  <FeedItem key={item.id} item={item} />
                ))}

                {/* Data Platform */}
                <div className="px-3 pt-3 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Data Platform</span>
                </div>
                {feed.items.filter(i => i.category === 'data-platform').map((item) => (
                  <FeedItem key={item.id} item={item} />
                ))}

                {/* Publishing — Sandarb → Kafka (sub-section of Data Platform) */}
                <div className="px-3 pt-2 pb-1 pl-5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">Publishing</span>
                </div>
                {feed.items.filter(i => i.category === 'publishing').map((item) => (
                  <FeedItem key={item.id} item={item} />
                ))}

                {/* Consumption — Kafka → ClickHouse (sub-section of Data Platform) */}
                <div className="px-3 pt-2 pb-1 pl-5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">Consumption</span>
                </div>
                {feed.items.filter(i => i.category === 'consumption').map((item) => (
                  <FeedItem key={item.id} item={item} />
                ))}
              </>
            )}
          </div>

          {/* Footer */}
          {feed && (
            <div className="border-t px-4 py-2 flex flex-col gap-1 text-[11px] text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>{feed.summary.healthy}/{feed.summary.total} services healthy</span>
                <span>Auto-refresh: 60s</span>
              </div>
              {feed.items.length > 0 && (
                <div className="text-[10px] text-muted-foreground/60">
                  Last checked: {formatCheckedAt(feed.items[0].checked_at)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeedItem({ item }: { item: HealthItem }) {
  const Icon = STATUS_ICON[item.status] ?? Info;
  const color = STATUS_COLOR[item.status] ?? 'text-muted-foreground';
  const bg = STATUS_BG[item.status] ?? 'bg-muted/50';

  return (
    <div className="flex items-start gap-3 px-3 py-2 hover:bg-muted/30 transition-colors">
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', bg)}>
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{item.name}</span>
          {item.latency_ms > 0 && (
            <span className="text-[10px] text-muted-foreground shrink-0">{item.latency_ms}ms</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
      </div>
      <div className={cn(
        'shrink-0 mt-1 h-2 w-2 rounded-full',
        item.status === 'healthy' ? 'bg-green-500' :
        item.status === 'unhealthy' || item.status === 'error' ? 'bg-red-500' :
        item.status === 'info' ? 'bg-blue-400' :
        'bg-gray-300 dark:bg-gray-600'
      )} />
    </div>
  );
}
