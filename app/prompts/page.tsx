import { getPromptsPaginated } from '@/lib/api-client';
import { PromptsListClient } from './prompts-list-client';
import type { Prompt } from '@/types';

export const dynamic = 'force-dynamic';

export default async function PromptsPage() {
  let prompts: Prompt[] = [];
  let total = 0;
  let totalActive = 0;
  let totalDraft = 0;
  try {
    const data = await getPromptsPaginated(50, 0);
    prompts = data.prompts;
    total = data.total;
    totalActive = data.totalActive;
    totalDraft = data.totalDraft;
  } catch {
    // Fallback: empty list if backend not ready
  }

  return <PromptsListClient initialPrompts={prompts} initialTotal={total} initialTotalActive={totalActive} initialTotalDraft={totalDraft} />;
}
