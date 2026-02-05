import { notFound } from 'next/navigation';
import { getAgentById } from '@/lib/api-client';
import type { RegisteredAgent } from '@/types';
import dynamic from 'next/dynamic';

const AgentDetailClient = dynamic(
  () => import('./agent-detail-client').then((m) => ({ default: m.AgentDetailClient })),
  { ssr: true }
);

interface PageProps {
  params: { id: string };
}

export default async function AgentDetailPage({ params }: PageProps) {
  const { id } = params;
  const agent = await getAgentById(id);

  if (!agent) notFound();

  return <AgentDetailClient initialAgent={agent as RegisteredAgent} />;
}
