'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Bot, ShieldCheck, ShieldAlert } from 'lucide-react';
import { apiUrl } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import type { A2ALogEntry } from '@/lib/audit';

const POLL_INTERVAL_MS = 4000;
const DEMO_INTERVAL_MS = 6000;
const MAX_ENTRIES = 200;
const ANIMATION_DURATION_MS = 400;

const DEMO_AGENTS = [
  'retail-banking-agent-03',
  'investment-banking-agent-01',
  'wealth-management-agent-02',
  'legal-compliance-agent-05',
  'risk-management-agent-01',
  'operations-agent-04',
  'technology-agent-02',
  'product-agent-01',
  'customer-experience-agent-03',
  'data-analytics-agent-07',
];
const DEMO_CONTEXTS = [
  'ib-trading-limits',
  'wm-suitability-policy',
  'retail-compliance-policy',
  'retail-product-limits',
  'ib-compliance-policy',
  'wm-portfolio-context',
  'context-retail-banking-042',
  'context-investment-banking-015',
  'context-legal-compliance-089',
];

function generateDemoEntry(): A2ALogEntry {
  const now = new Date().toISOString();
  const agent = DEMO_AGENTS[Math.floor(Math.random() * DEMO_AGENTS.length)];
  const context = DEMO_CONTEXTS[Math.floor(Math.random() * DEMO_CONTEXTS.length)];
  const success = Math.random() > 0.15;
  return {
    id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    agentId: agent,
    traceId: `trace-${Date.now().toString(36)}`,
    accessedAt: now,
    actionType: success ? 'INJECT_SUCCESS' : 'INJECT_DENIED',
    contextName: context,
    contextId: null,
    contextVersionId: success ? `v1.0.${Math.floor(Math.random() * 20)}` : null,
    reason: success ? undefined : (Math.random() > 0.5 ? 'LOB mismatch' : 'Agent not registered'),
    intent: Math.random() > 0.6 ? 'Compliance check before trade' : undefined,
  };
}

interface AgentPulseChatProps {
  entries: A2ALogEntry[];
}

export function AgentPulseChat({ entries: initialEntries }: AgentPulseChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<A2ALogEntry[]>(initialEntries);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const knownIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    initialEntries.forEach((e) => knownIdsRef.current.add(e.id));
  }, []);

  const addNewIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setNewIds((prev) => new Set(Array.from(prev).concat(ids)));
    setTimeout(() => {
      setNewIds((prev) => {
        const next = new Set(Array.from(prev));
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }, ANIMATION_DURATION_MS);
  }, []);

  // Poll for new A2A log entries
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(apiUrl('/api/agent-pulse/log?limit=50'));
        const data = await res.json().catch(() => ({}));
        if (!data.success || !Array.isArray(data.data?.entries)) return;
        const incoming = data.data.entries as A2ALogEntry[];
        const known = knownIdsRef.current;
        const newOnes = incoming.filter((e) => !known.has(e.id));
        if (newOnes.length === 0) return;
        newOnes.forEach((e) => known.add(e.id));
        setEntries((prev) => {
          const byId = new Map(prev.map((e) => [e.id, e]));
          newOnes.forEach((e) => byId.set(e.id, e));
          return Array.from(byId.values()).sort(
            (a, b) => new Date(b.accessedAt).getTime() - new Date(a.accessedAt).getTime()
          ).slice(0, MAX_ENTRIES);
        });
        addNewIds(newOnes.map((e) => e.id));
      } catch {
        // ignore
      }
    };
    const t = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [addNewIds]);

  // Demo: continuously inject synthetic entries so the feed looks active
  useEffect(() => {
    const tick = () => {
      const entry = generateDemoEntry();
      knownIdsRef.current.add(entry.id);
      setEntries((prev) => [entry, ...prev].slice(0, MAX_ENTRIES));
      addNewIds([entry.id]);
    };
    const t = setInterval(tick, DEMO_INTERVAL_MS);
    return () => clearInterval(t);
  }, [addNewIds]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [entries.length]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-[hsl(var(--background))]">
      <div
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1 agent-pulse-chat-area"
        ref={scrollRef}
      >
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <div className="rounded-full bg-muted/50 p-4 mb-3">
              <Bot className="h-8 w-8 opacity-60" />
            </div>
            <p className="text-sm font-medium text-foreground/80">No A2A messages yet</p>
            <p className="text-xs mt-1 max-w-[260px] text-muted-foreground">
              When agents request context from Sandarb (inject API or A2A), exchanges will appear here.
            </p>
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className={`space-y-1 py-2 ${newIds.has(entry.id) ? 'a2a-log-entry-new' : ''}`}
            >
              {/* Agent message (left-aligned, Slack style) */}
              <div className="flex gap-3 max-w-[85%]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#611f69] dark:bg-violet-600 text-white text-xs font-semibold overflow-hidden">
                  <Bot className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold text-[15px] text-foreground">{entry.agentId}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(entry.accessedAt)}</span>
                  </div>
                  <div className="mt-0.5 text-[15px] text-foreground break-words">
                    {entry.actionType === 'A2A_CALL' ? (
                      <>A2A call: <span className="font-medium">{entry.contextName || entry.method || '—'}</span></>
                    ) : (
                      <>Requested context: <span className="font-medium">{entry.contextName || '—'}</span></>
                    )}
                    {entry.intent && (
                      <p className="text-sm text-muted-foreground mt-1">Intent: {entry.intent}</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate" title={entry.traceId}>
                    trace: {entry.traceId}
                  </p>
                </div>
              </div>

              {/* Sandarb reply (indented under agent) */}
              <div className="flex gap-3 max-w-[85%] ml-12">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${
                    entry.actionType === 'A2A_CALL'
                      ? 'bg-violet-600 dark:bg-violet-500'
                      : entry.actionType === 'INJECT_SUCCESS'
                        ? 'bg-[#0b6e4f] dark:bg-emerald-600'
                        : 'bg-[#c23934] dark:bg-red-600'
                  }`}
                >
                  {entry.actionType === 'A2A_CALL' ? (
                    <Bot className="h-4 w-4" aria-hidden />
                  ) : entry.actionType === 'INJECT_SUCCESS' ? (
                    <ShieldCheck className="h-4 w-4" aria-hidden />
                  ) : (
                    <ShieldAlert className="h-4 w-4" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold text-[15px] text-foreground">Sandarb</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(entry.accessedAt)}</span>
                    <span
                      className={`text-[11px] font-medium px-1.5 py-0 rounded ${
                        entry.actionType === 'A2A_CALL'
                          ? 'bg-violet-500/20 text-violet-700 dark:text-violet-400'
                          : entry.actionType === 'INJECT_SUCCESS'
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                            : 'bg-red-500/20 text-red-700 dark:text-red-400'
                      }`}
                    >
                      {entry.actionType === 'A2A_CALL'
                        ? (entry.error ? 'Error' : 'OK')
                        : entry.actionType === 'INJECT_SUCCESS'
                          ? 'Delivered'
                          : 'Denied'}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[15px] text-foreground break-words">
                    {entry.actionType === 'A2A_CALL' ? (
                      <>
                        {entry.error ?? (entry.resultSummary ?? 'ok')}
                        {(entry.inputSummary ?? entry.method) && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {entry.method ?? ''} {entry.inputSummary ?? ''}
                          </p>
                        )}
                      </>
                    ) : entry.actionType === 'INJECT_SUCCESS' ? (
                      <>Context delivered: <span className="font-medium">{entry.contextName || '—'}</span></>
                    ) : (
                      <>
                        {entry.reason ?? 'Policy violation'}
                        {entry.contextName && (
                          <p className="text-sm text-muted-foreground mt-0.5">Requested: {entry.contextName}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
