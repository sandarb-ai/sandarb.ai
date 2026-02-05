import { Header } from '@/components/header';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { StatsCard } from '@/components/stats-card';
import { getBlockedInjections, getA2ALog, getUnauthenticatedDetections, getAgents } from '@/lib/api-client';
import { ShieldAlert, Bot, Radio, Users } from 'lucide-react';
import { AgentPulseScanButton } from './agent-pulse-scan-button';
import { AgentPulseTerminal } from './agent-pulse-terminal';
import type { RegisteredAgent } from '@/types';

export const dynamic = 'force-dynamic';

export default async function AgentPulsePage() {
  let blocked: Array<{ id: string; createdAt?: string; details?: { agentId?: string; reason?: string }; resourceName?: string; createdBy?: string }> = [];
  let unauthenticated: Array<{ id: string; sourceUrl?: string; scanRunAt?: string; detectedAgentId?: string }> = [];
  let a2aLog: Array<{ id: string; [key: string]: unknown }> = [];
  let agents: RegisteredAgent[] = [];

  try {
    const [b, u, a, agentList] = await Promise.all([
      getBlockedInjections(50),
      getUnauthenticatedDetections(50),
      getA2ALog(200),
      getAgents(),
    ]);
    blocked = Array.isArray(b) ? (b as typeof blocked) : [];
    unauthenticated = Array.isArray(u) ? (u as typeof unauthenticated) : [];
    a2aLog = Array.isArray(a) ? (a as typeof a2aLog) : [];
    agents = Array.isArray(agentList) ? (agentList as RegisteredAgent[]) : [];
  } catch {
    // Fallback: empty lists if backend not ready
  }

  // Convert agents to format expected by terminal
  const agentData = agents.map((a) => ({
    id: a.agentId || a.id,
    name: a.name,
    team: a.ownerTeam || 'unknown',
  }));

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Agent Pulse"
        description="Live A2A communication feed — watch agents interact with Sandarb AI Governance in real-time"
        breadcrumb={<Breadcrumb items={[{ label: 'Agent Pulse' }]} className="mb-2" />}
      >
        <AgentPulseScanButton />
      </Header>

      {/* Top: Stats cards in horizontal layout */}
      <div className="shrink-0 px-6 py-4 border-b border-border bg-background">
        <div className="grid grid-cols-4 gap-4">
          <StatsCard
            title="Registered Agents"
            value={agents.length}
            description="Active in Sandarb"
            icon={Users}
          />
          <StatsCard
            title="Blocked Injections"
            value={blocked.length}
            description="Policy violations"
            icon={ShieldAlert}
          />
          <StatsCard
            title="Shadow AI Detected"
            value={unauthenticated.length}
            description="Unauthenticated agents"
            icon={Bot}
          />
          <StatsCard
            title="A2A Messages"
            value={a2aLog.length}
            description="Recent communications"
            icon={Radio}
          />
        </div>
      </div>

      {/* Bottom: Terminal view takes full remaining space */}
      <div className="flex-1 min-h-0">
        <AgentPulseTerminal agents={agentData} autoPlay={true} />
      </div>
    </div>
  );
}
