import { notFound } from 'next/navigation';
import { getAgentById } from '@/lib/agents';
import { AgentDetailClient } from './agent-detail-client';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AgentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const agent = await getAgentById(id);

  if (!agent) notFound();

  return <AgentDetailClient initialAgent={agent} />;
}
