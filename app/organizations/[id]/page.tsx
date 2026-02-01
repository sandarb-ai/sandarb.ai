import { notFound } from 'next/navigation';
import { getOrganizationById, getChildOrganizations } from '@/lib/organizations';
import { getAllAgents } from '@/lib/agents';
import { OrganizationDetailClient } from './organization-detail-client';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrganizationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [org, children, agents] = await Promise.all([
    getOrganizationById(id),
    getChildOrganizations(id),
    getAllAgents(id),
  ]);

  if (!org) notFound();

  return (
    <OrganizationDetailClient
      org={org}
      children={children}
      agents={agents}
    />
  );
}
