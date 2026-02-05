import { getOrganizations } from '@/lib/api-client';
import { OrganizationsPageClient } from './organizations-client';
import type { Organization } from '@/types';

export const dynamic = 'force-dynamic';

export default async function OrganizationsPage() {
  let orgs: Organization[] = [];

  try {
    const data = await getOrganizations();
    orgs = Array.isArray(data) ? (data as Organization[]) : [];
  } catch {
    // Fallback: empty list if backend not ready
  }

  return <OrganizationsPageClient initialOrgs={orgs} />;
}
