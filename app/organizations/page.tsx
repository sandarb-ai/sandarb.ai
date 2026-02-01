import { getAllOrganizations } from '@/lib/organizations';
import { OrganizationsPageClient } from './organizations-client';

export const dynamic = 'force-dynamic';

export default async function OrganizationsPage() {
  let orgs: Awaited<ReturnType<typeof getAllOrganizations>> = [];

  try {
    orgs = await getAllOrganizations();
  } catch {
    // Fallback: empty list if DB not ready
  }

  return <OrganizationsPageClient initialOrgs={orgs} />;
}
