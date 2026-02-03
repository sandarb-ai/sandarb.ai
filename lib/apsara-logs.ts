/**
 * Sandarb.AI Team Logs - Server-side log parsing
 * Parse and manage OpenClaw agent communication logs
 * NOTE: This file uses Node.js APIs and should only be imported in server components/API routes
 */

import fs from 'fs/promises';
import path from 'path';
import type { ApsaraMessage, ApsaraAgentId } from './apsara-constants';
import { APSARA_CHANNELS } from './apsara-constants';

// Re-export for convenience
export * from './apsara-constants';

// Map agents to their primary channels
const AGENT_CHANNEL_MAP: Record<ApsaraAgentId, string> = {
  punjikasthala: 'a2a-protocol',
  mishrakeshi: 'prompts',
  rambha: 'agents',
  tilottama: 'audit',
  ghritachi: 'workflows',
  alambusha: 'infra',
  urvashi: 'dashboard',
  menaka: 'ui',
  sandarb: 'general',
};

/**
 * Parse log file content into structured messages
 */
function parseLogContent(content: string, source: string): ApsaraMessage[] {
  const messages: ApsaraMessage[] = [];
  const lines = content.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const message = parseLogLine(line, source);
    if (message) {
      messages.push(message);
    }
  }

  return messages;
}

/**
 * Parse a single log line into an ApsaraMessage
 */
function parseLogLine(line: string, source: string): ApsaraMessage | null {
  // Match timestamp patterns: [2026-02-02T21:12:51.212Z] or [2026-02-02 00:21:00]
  const timestampMatch = line.match(/^\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)\]\s*(.*)$/);
  
  if (!timestampMatch) return null;
  
  const [, timestamp, content] = timestampMatch;
  const normalizedTimestamp = timestamp.includes('T') ? timestamp : `${timestamp.replace(' ', 'T')}Z`;
  
  // Detect message type and agent
  let agentId: ApsaraAgentId | 'system' = 'system';
  let type: ApsaraMessage['type'] = 'message';
  let channel = 'general';
  let messageContent = content;
  let metadata: ApsaraMessage['metadata'] = {};

  // Session markers
  if (content.includes('SESSION STARTED') || content.includes('═══')) {
    type = 'session_start';
    channel = 'general';
    if (content.includes('Mission:')) {
      messageContent = content;
    }
  }
  // Session end
  else if (content.includes('ALL 8 APSARAS DISPATCHED') || content.includes('✅')) {
    type = 'session_end';
    channel = 'general';
  }
  // Agent starting work
  else if (content.match(/^(⚖️|🎭|🔱|💎|⚙️|🏛️|🪷|✨)\s*(\w+):\s*Starting work/)) {
    const agentMatch = content.match(/^(⚖️|🎭|🔱|💎|⚙️|🏛️|🪷|✨)\s*(\w+):\s*Starting work on (.+)$/);
    if (agentMatch) {
      const [, , name, task] = agentMatch;
      agentId = name.toLowerCase() as ApsaraAgentId;
      type = 'task_start';
      channel = AGENT_CHANNEL_MAP[agentId] || 'general';
      messageContent = `Starting work on ${task}`;
    }
  }
  // User relay: "👤 You → AgentName: message"
  else if (content.startsWith('👤 You → ')) {
    const relayMatch = content.match(/^👤 You → (.+?): (.*)$/);
    if (relayMatch) {
      const [, toName, msg] = relayMatch;
      agentId = 'system';
      type = 'message';
      channel = 'general';
      messageContent = `You → ${toName.trim()}: ${msg.trim()}`;
    }
  }
  // Team chat: "emoji Name: message" (agents chatting among themselves)
  else if (content.match(/^(⚖️|🎭|🔱|💎|⚙️|🏛️|🪷|✨)\s*\S+:\s*.+$/)) {
    const chatMatch = content.match(/^(⚖️|🎭|🔱|💎|⚙️|🏛️|🪷|✨)\s*([^:]+):\s*(.*)$/);
    if (chatMatch) {
      const [, , namePart, msg] = chatMatch;
      const name = namePart.trim().split(/\s+/)[0]; // "Punjikasthala" or "Sandarb.AI"
      const agentSlug = (name.toLowerCase().replace(/\./g, '') === 'sandarbai' ? 'sandarb' : name.toLowerCase()) as ApsaraAgentId;
      const knownAgents: ApsaraAgentId[] = ['punjikasthala', 'mishrakeshi', 'rambha', 'tilottama', 'ghritachi', 'alambusha', 'urvashi', 'menaka', 'sandarb'];
      agentId = knownAgents.includes(agentSlug) ? agentSlug : 'system';
      type = 'message';
      channel = 'general';
      messageContent = msg.trim();
    }
  }
  // Agent features
  else if (content.trim().startsWith('Features:')) {
    type = 'feature';
    const features = content.replace('Features:', '').split(',').map(f => f.trim());
    metadata.features = features;
    messageContent = content;
    channel = 'features';
  }
  // Agent response
  else if (content.trim().startsWith('Response:')) {
    const responseContent = content.replace('Response:', '').trim();
    
    // Check for errors
    if (responseContent.includes('Error:') || responseContent.includes('402')) {
      type = 'error';
      channel = 'errors';
      metadata.error = responseContent;
    } else {
      type = 'message';
    }
    messageContent = responseContent;
  }
  // Build status
  else if (content.includes('BUILD SUCCESSFUL') || content.includes('BUILD')) {
    type = 'task_complete';
    channel = 'infra';
    agentId = 'alambusha';
  }
  // Feature additions
  else if (content.includes('Added') || content.includes('Implemented') || content.includes('Created')) {
    type = 'feature';
    channel = 'features';
  }

  return {
    id: `${source}-${normalizedTimestamp}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: normalizedTimestamp,
    agentId,
    type,
    content: messageContent,
    channel,
    metadata,
  };
}

/**
 * Detect agent from context in surrounding log lines
 */
function detectAgentFromEmoji(emoji: string): ApsaraAgentId | null {
  const emojiMap: Record<string, ApsaraAgentId> = {
    '⚖️': 'punjikasthala',
    '🎭': 'mishrakeshi',
    '🔱': 'rambha',
    '💎': 'tilottama',
    '⚙️': 'ghritachi',
    '🏛️': 'alambusha',
    '🪷': 'urvashi',
    '✨': 'menaka',
  };
  return emojiMap[emoji] || null;
}

const TEAM_CHAT_LOG = 'team-chat.log';

/**
 * Read only team-chat.log (used by Team Chat UI to avoid repeating system lines from features.log).
 */
export async function getTeamChatMessages(limit: number = 200): Promise<ApsaraMessage[]> {
  const logsDir = path.join(process.cwd(), 'logs');
  const filePath = path.join(logsDir, TEAM_CHAT_LOG);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const messages = parseLogContent(content, 'team-chat');
    // Slack-style: oldest first (chronological), newest at bottom
    return messages
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-limit);
  } catch {
    return [];
  }
}

/**
 * Read all log files and return unified messages
 */
export async function getApsaraMessages(limit: number = 200): Promise<ApsaraMessage[]> {
  const logsDir = path.join(process.cwd(), 'logs');
  const allMessages: ApsaraMessage[] = [];

  try {
    const files = await fs.readdir(logsDir);
    const logFiles = files.filter(f => f.endsWith('.log'));

    for (const file of logFiles) {
      try {
        const filePath = path.join(logsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const source = file.replace('.log', '');
        const messages = parseLogContent(content, source);
        allMessages.push(...messages);
      } catch (err) {
        console.warn(`Failed to read log file ${file}:`, err);
      }
    }

    // Slack-style: oldest first (chronological), newest at bottom
    return allMessages
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-limit);
  } catch (err) {
    console.error('Failed to read logs directory:', err);
    return [];
  }
}

/**
 * Get messages for a specific channel
 */
export async function getChannelMessages(channelId: string, limit: number = 100): Promise<ApsaraMessage[]> {
  const allMessages = await getApsaraMessages(500);
  
  if (channelId === 'general') {
    return allMessages.slice(-limit);
  }
  
  const channelMessages = allMessages.filter(m => m.channel === channelId);
  return channelMessages.slice(-limit);
}

/**
 * Get recent activity count per channel
 */
export async function getChannelActivity(): Promise<Record<string, number>> {
  const messages = await getApsaraMessages(500);
  const activity: Record<string, number> = {};
  
  // Count messages in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  for (const channel of APSARA_CHANNELS) {
    activity[channel.id] = messages.filter(
      m => m.channel === channel.id && new Date(m.timestamp) > oneHourAgo
    ).length;
  }
  
  return activity;
}

/**
 * Append a message to the appropriate log file
 */
export async function logApsaraMessage(
  agentId: ApsaraAgentId,
  content: string,
  channel?: string
): Promise<void> {
  const logsDir = path.join(process.cwd(), 'logs');
  const timestamp = new Date().toISOString();
  const agent = APSARA_AGENTS[agentId];
  
  const logLine = `[${timestamp}] ${agent.emoji} ${agent.name}: ${content}\n`;
  
  // Write to features.log for all feature work
  const logFile = path.join(logsDir, 'features.log');
  
  try {
    await fs.appendFile(logFile, logLine);
  } catch (err) {
    console.error('Failed to write log:', err);
  }
}
