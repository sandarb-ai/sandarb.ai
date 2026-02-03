import { getApsaraMessages, APSARA_CHANNELS, APSARA_AGENTS } from '@/lib/apsara-logs';
import { ApsaraChatClient } from './apsara-chat-client';

export const dynamic = 'force-dynamic';

export default async function ApsaraChatPage() {
  let messages: Awaited<ReturnType<typeof getApsaraMessages>> = [];

  try {
    messages = await getApsaraMessages(200);
  } catch (error) {
    console.error('Failed to fetch Apsara messages:', error);
    // Fallback: empty array
  }

  return (
    <div className="h-screen flex flex-col">
      <ApsaraChatClient initialMessages={messages} initialChannel="general" />
    </div>
  );
}
