import { Header } from '@/components/header';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { getBlockedInjections, getA2ALog, getUnauthenticatedDetections, getAgents } from '@/lib/api-client';
import { AgentPulseScanButton } from './agent-pulse-scan-button';
import { AgentPulseContent } from './agent-pulse-content';
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

      {/* Stats cards (animated) + Terminal with live counts */}
      <AgentPulseContent
        initialBlocked={blocked.length}
        initialShadowAI={unauthenticated.length}
        initialA2ALog={a2aLog.length}
        agents={agentData}
      />
    </div>
  );
}
