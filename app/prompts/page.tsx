import { getPrompts } from '@/lib/api-client';
import { PromptsListClient } from './prompts-list-client';
import type { Prompt } from '@/types';

export const dynamic = 'force-dynamic';

export default async function PromptsPage() {
  let prompts: Prompt[] = [];
  try {
    const data = await getPrompts();
    prompts = Array.isArray(data) ? (data as Prompt[]) : [];
  } catch {
    // Fallback: empty list if backend not ready
  }

  return <PromptsListClient initialPrompts={prompts} />;
}
