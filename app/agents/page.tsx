import { getAllAgents } from '@/lib/agents';
import { getAllOrganizations } from '@/lib/organizations';
import type { RegisteredAgent } from '@/types';
import type { Organization } from '@/types';
import { AgentsPageClient } from './agents-client';

export default async function AgentsPage() {
  let agents: RegisteredAgent[] = [];
  let orgs: Organization[] = [];

  try {
    [agents, orgs] = await Promise.all([getAllAgents(), getAllOrganizations()]);
  } catch {
    // Fallback: empty lists if DB not ready
  }

  return <AgentsPageClient initialAgents={agents} initialOrgs={orgs} />;
}
