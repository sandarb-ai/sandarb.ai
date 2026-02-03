import { getAllPrompts } from '@/lib/prompts';
import { PromptsListClient } from './prompts-list-client';
import type { Prompt } from '@/types';

export const dynamic = 'force-dynamic';

export default async function PromptsPage() {
  let prompts: Prompt[] = [];
  try {
    prompts = await getAllPrompts();
  } catch {
    // Fallback: empty list if DB not ready
  }

  return <PromptsListClient initialPrompts={prompts} />;
}
