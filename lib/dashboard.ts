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

export async function getRecentOrganizationsWithCounts(limit: number = 6): Promise<OrgWithCounts[]> {
  const orgs = await getAllOrganizations();
  // Filter out root org and sort by createdAt descending
  const sorted = orgs
    .filter((o) => !o.isRoot)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
  const withCounts = await Promise.all(
    sorted.map(async (org) => ({
      ...org,
      agentCount: await getAgentCount(org.id),
      contextCount: await getContextCountByTag(org.slug),
    }))
  );
  return withCounts;
}
