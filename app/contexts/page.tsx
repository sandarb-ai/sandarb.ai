import { getContextsPaginated } from '@/lib/api-client';
import { ContextsListClient } from './contexts-list-client';
import type { Context } from '@/types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function ContextsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10));
  const offset = (page - 1) * PAGE_SIZE;
  let contexts: Context[] = [];
  let total = 0;
  let totalActive = 0;
  let totalDraft = 0;
  try {
    const result = await getContextsPaginated(PAGE_SIZE, offset);
    contexts = (result.contexts ?? []) as Context[];
    total = result.total ?? 0;
    totalActive = result.totalActive ?? 0;
    totalDraft = result.totalDraft ?? 0;
  } catch {
    // Fallback: empty list if backend not ready
  }

  return (
    <ContextsListClient
      initialContexts={contexts}
      total={total}
      totalActive={totalActive}
      totalDraft={totalDraft}
      page={page}
      pageSize={PAGE_SIZE}
    />
  );
}
