import { getContextsPaginated } from '@/lib/contexts';
import { ContextsListClient } from './contexts-list-client';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function ContextsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10));
  const offset = (page - 1) * PAGE_SIZE;
  let contexts: Awaited<ReturnType<typeof getContextsPaginated>>['contexts'] = [];
  let total = 0;
  try {
    const result = await getContextsPaginated(PAGE_SIZE, offset);
    contexts = result.contexts;
    total = result.total;
  } catch {
    // Fallback: empty list if DB not ready
  }

  return (
    <ContextsListClient
      initialContexts={contexts}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
    />
  );
}
