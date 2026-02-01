/**
 * Dashboard stats: aggregates for home page and org cards.
 */

import { getAllOrganizations } from './organizations';
import { getAgentCount } from './agents';
import { getContextCountByTag } from './contexts';
import type { Organization } from '@/types';

export interface OrgWithCounts extends Organization {
  agentCount: number;
  contextCount: number;
}

export async function getOrganizationsWithCounts(): Promise<OrgWithCounts[]> {
  const orgs = await getAllOrganizations();
  const withCounts = await Promise.all(
    orgs.map(async (org) => ({
      ...org,
      agentCount: await getAgentCount(org.id),
      contextCount: await getContextCountByTag(org.slug),
    }))
  );
  return withCounts;
}
