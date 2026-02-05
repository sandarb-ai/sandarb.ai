'use client';

import { useState, useEffect, useCallback } from 'react';
import type { A2ALogEntry } from '@/types';
import { AgentPulseStatsCards } from './agent-pulse-stats';
import { AgentPulseTerminal } from './agent-pulse-terminal';

export interface AgentPulseContentProps {
  initialBlocked: number;
  initialShadowAI: number;
  initialA2ALog: number;
  agents: Array<{ id: string; name: string; team: string }>;
}

export function AgentPulseContent({
  initialBlocked,
  initialShadowAI,
  initialA2ALog,
  agents,
}: AgentPulseContentProps) {
  const [liveA2a, setLiveA2a] = useState(0);
  const [liveBlocked, setLiveBlocked] = useState(initialBlocked);
  const [liveShadowAI, setLiveShadowAI] = useState(initialShadowAI);

  const onEntriesChange = useCallback((entries: A2ALogEntry[]) => {
    setLiveA2a(entries.length);
    const denied = entries.filter((e) => e.actionType === 'INJECT_DENIED').length;
    setLiveBlocked(initialBlocked + denied);
  }, [initialBlocked]);

  // Shadow AI: increase slowly (every ~12–18s) to feel “mostly static but can increase”
  useEffect(() => {
    const interval = 12000 + Math.random() * 6000;
    const t = setInterval(() => {
      setLiveShadowAI((prev) => prev + 1);
    }, interval);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <div className="shrink-0 px-6 py-4 border-b border-border bg-background">
        <AgentPulseStatsCards
          agentsCount={agents.length}
          blockedCount={liveBlocked}
          shadowAICount={liveShadowAI}
          a2aCount={liveA2a}
        />
      </div>
      <div className="flex-1 min-h-0">
        <AgentPulseTerminal
          agents={agents}
          autoPlay={true}
          onEntriesChange={onEntriesChange}
        />
      </div>
    </>
  );
}
