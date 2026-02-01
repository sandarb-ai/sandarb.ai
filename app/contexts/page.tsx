import { getAllContexts } from '@/lib/contexts';
import { ContextsListClient } from './contexts-list-client';

export const dynamic = 'force-dynamic';

export default async function ContextsPage() {
  let contexts: Awaited<ReturnType<typeof getAllContexts>> = [];
  try {
    contexts = await getAllContexts();
  } catch {
    // Fallback: empty list if DB not ready
  }

  return <ContextsListClient initialContexts={contexts} />;
}
