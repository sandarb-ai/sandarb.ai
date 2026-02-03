import { getAllAgents } from '@/lib/agents';
import { getAllOrganizations, getRootOrganization } from '@/lib/organizations';
import type { RegisteredAgent } from '@/types';
import type { Organization } from '@/types';
import { AgentsPageClient } from './agents-client';

export default async function AgentsPage() {
  let agents: RegisteredAgent[] = [];
  let orgs: Organization[] = [];

  try {
    const [allAgents, allOrgs, root] = await Promise.all([
      getAllAgents(),
      getAllOrganizations(),
      getRootOrganization(),
    ]);
    orgs = allOrgs;
    agents = root ? allAgents.filter((a) => a.orgId !== root.id) : allAgents;
  } catch {
    // Fallback: empty lists if DB not ready
  }

  return <AgentsPageClient initialAgents={agents} initialOrgs={orgs} />;
}
