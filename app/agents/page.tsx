import { getAllAgents, getAgentStats } from '@/lib/agents';
import { getAllOrganizations, getRootOrganization } from '@/lib/organizations';
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
      getAllAgents(),
      getAllOrganizations(),
      getAgentStats(root?.id),
    ]);
    orgs = allOrgs;
    agents = root ? allAgents.filter((a) => a.orgId !== root.id) : allAgents;
    stats = agentStats;
  } catch (err) {
    // Fallback: empty lists if DB not ready; log in dev to debug "0 data"
    if (process.env.NODE_ENV === 'development') {
      console.error('[agents/page] Failed to load agents or orgs:', err);
    }
  }

  return <AgentsPageClient initialAgents={agents} initialOrgs={orgs} initialStats={stats} />;
}
