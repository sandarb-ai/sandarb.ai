import { NextRequest, NextResponse } from 'next/server';
import { getApsaraMessages, getTeamChatMessages, getChannelMessages, getChannelActivity, APSARA_CHANNELS, APSARA_AGENTS } from '@/lib/apsara-logs';
import { getA2ALog } from '@/lib/audit';
import type { A2ALogEntry } from '@/lib/audit';
import type { ApsaraMessage } from '@/lib/apsara-constants';

/**
 * Format an A2A log entry as a Team Chat message line (shown in #general).
 */
function a2aEntryToMessage(entry: A2ALogEntry): ApsaraMessage {
  const agent = entry.agentId && entry.agentId !== 'anonymous' ? entry.agentId : 'anonymous';
  const method = entry.method ?? entry.actionType;
  const summary = entry.inputSummary ? ` ${entry.inputSummary}` : '';
  const outcome = entry.error ? `error: ${entry.error}` : (entry.resultSummary ?? 'ok');
  const content =
    entry.actionType === 'A2A_CALL'
      ? `📡 A2A: ${agent} → ${method}${summary} (${outcome})`
      : `📡 ${entry.agentId}: ${entry.actionType} ${entry.contextName || ''}${entry.reason ? ` — ${entry.reason}` : ''}`;
  return {
    id: `a2a-${entry.id}`,
    timestamp: entry.accessedAt,
    agentId: 'sandarb',
    type: 'message',
    content,
    channel: 'general',
    metadata: { traceId: entry.traceId },
  };
}

/**
 * GET /api/apsara-chat/log
 * Fetch Sandarb.AI team (Apsara/OpenClaw agent) communication logs.
 * For channel=general, merges team-chat.log with A2A conversation log so all A2A traffic appears in #general.
 * Query params:
 *   - channel: Filter by channel (default: 'general' = all)
 *   - limit: Max messages to return (default: 200, max: 500)
 *   - activity: If 'true', return channel activity counts
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel') || 'general';
    const limitParam = searchParams.get('limit');
    const activityParam = searchParams.get('activity');
    const limit = limitParam
      ? Math.min(Math.max(parseInt(limitParam, 10) || 200, 1), 500)
      : 200;

    // Return channel activity counts
    if (activityParam === 'true') {
      const activity = await getChannelActivity();
      return NextResponse.json({
        success: true,
        data: {
          activity,
          channels: APSARA_CHANNELS,
          agents: APSARA_AGENTS,
        },
      });
    }

    let messages: ApsaraMessage[];

    if (channel === 'general') {
      // #general: team chat + all A2A communication (so Teams Chat shows what agents are doing)
      const [teamMessages, a2aEntries] = await Promise.all([
        getTeamChatMessages(limit + 100),
        getA2ALog(limit + 100).catch(() => [] as A2ALogEntry[]),
      ]);
      const a2aMessages = a2aEntries.map(a2aEntryToMessage);
      const merged = [...teamMessages, ...a2aMessages].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      messages = merged.slice(-limit);
    } else {
      messages = await getChannelMessages(channel, limit);
    }

    return NextResponse.json({
      success: true,
      data: {
        channel,
        messages,
        channels: APSARA_CHANNELS,
        agents: APSARA_AGENTS,
      },
    });
  } catch (error) {
    console.error('Failed to fetch Apsara chat log:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch Apsara chat log' },
      { status: 500 }
    );
  }
}
