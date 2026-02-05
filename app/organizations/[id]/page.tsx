import { notFound } from 'next/navigation';
import { getOrganizationById, getChildOrganizations, getAgents } from '@/lib/api-client';
import type { Organization, RegisteredAgent } from '@/types';
import { OrganizationDetailClient } from './organization-detail-client';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrganizationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [org, children, agents] = await Promise.all([
    getOrganizationById(id),
    getChildOrganizations(id),
    getAgents(id),
  ]);

  if (!org) notFound();

  return (
    <OrganizationDetailClient
      org={org as Organization}
      children={Array.isArray(children) ? (children as Organization[]) : []}
      agents={Array.isArray(agents) ? (agents as RegisteredAgent[]) : []}
    />
  );
}
