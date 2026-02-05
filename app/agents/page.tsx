import { getAgents, getAgentStats, getOrganizations, getRootOrganization } from '@/lib/api-client';
import type { RegisteredAgent } from '@/types';
import type { Organization } from '@/types';
import { AgentsPageClient } from './agents-client';

export default async function AgentsPage() {
  let agents: RegisteredAgent[] = [];
  let orgs: Organization[] = [];
  let stats = { total: 0, active: 0, draft: 0, pending_approval: 0, approved: 0, rejected: 0 };

  try {
    const root = await getRootOrganization();
    const [allAgents, allOrgs, agentStats] = await Promise.all([
      getAgents(),
      getOrganizations(),
      getAgentStats(), // global stats (match dashboard); do not pass root.id
    ]);
    orgs = (allOrgs ?? []) as Organization[];
    agents = Array.isArray(allAgents)
      ? root ? (allAgents as RegisteredAgent[]).filter((a) => a.orgId !== (root as { id?: string })?.id) : (allAgents as RegisteredAgent[])
      : [];
    stats = (agentStats ?? stats) as typeof stats;
  } catch (err) {
    // Fallback: empty lists if DB not ready; log in dev to debug "0 data"
    if (process.env.NODE_ENV === 'development') {
      console.error('[agents/page] Failed to load agents or orgs:', err);
    }
  }

  return <AgentsPageClient initialAgents={agents} initialOrgs={orgs} initialStats={stats} />;
}
