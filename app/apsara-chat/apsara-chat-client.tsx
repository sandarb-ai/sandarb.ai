'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Hash, MessageSquare, Users, ChevronDown, Search, ArrowLeft, Sparkles, Bot, AlertCircle, CheckCircle2, Rocket, Settings2, Send } from 'lucide-react';
import { apiUrl } from '@/lib/api';
import { formatDateTime, cn } from '@/lib/utils';
import type { ApsaraMessage, ApsaraAgentId } from '@/lib/apsara-constants';
import { APSARA_AGENTS, APSARA_CHANNELS, OPENCLAW_AGENT_IDS } from '@/lib/apsara-constants';

const RELAYABLE_AGENTS = (Object.keys(APSARA_AGENTS) as ApsaraAgentId[]).filter(
  (id) => OPENCLAW_AGENT_IDS[id] != null
);

const POLL_INTERVAL_MS = 3000;
const MAX_MESSAGES = 300;
const ANIMATION_DURATION_MS = 500;

const AGENT_STATUSES: Record<ApsaraAgentId, 'active' | 'away' | 'offline'> = {
  punjikasthala: 'active',
  mishrakeshi: 'active',
  rambha: 'active',
  tilottama: 'away',
  ghritachi: 'active',
  alambusha: 'away',
  urvashi: 'active',
  menaka: 'active',
  sandarb: 'active',
};

interface ApsaraChatClientProps {
  initialMessages: ApsaraMessage[];
  initialChannel?: string;
}

export function ApsaraChatClient({ initialMessages, initialChannel = 'general' }: ApsaraChatClientProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<ApsaraMessage[]>(initialMessages);
  const [activeChannel, setActiveChannel] = useState(initialChannel);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [channelActivity, setChannelActivity] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showAgentPanel, setShowAgentPanel] = useState(true);
  const [relayAgentId, setRelayAgentId] = useState<ApsaraAgentId | 'all'>('all');
  const [relayMessage, setRelayMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [relayError, setRelayError] = useState<string | null>(null);
  const [relayResult, setRelayResult] = useState<string | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    initialMessages.forEach((m) => knownIdsRef.current.add(m.id));
  }, []);

  const addNewIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setNewIds((prev) => new Set(Array.from(prev).concat(ids)));
    setTimeout(() => {
      setNewIds((prev) => {
        const next = new Set(Array.from(prev));
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }, ANIMATION_DURATION_MS);
  }, []);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(apiUrl(`/api/apsara-chat/log?channel=${activeChannel}&limit=100`));
        const data = await res.json().catch(() => ({}));
        if (!data.success || !Array.isArray(data.data?.messages)) return;
        const incoming = data.data.messages as ApsaraMessage[];
        const known = knownIdsRef.current;
        const newOnes = incoming.filter((m) => !known.has(m.id));
        if (newOnes.length === 0) return;
        newOnes.forEach((m) => known.add(m.id));
        setMessages((prev) => {
          const byId = new Map(prev.map((m) => [m.id, m]));
          newOnes.forEach((m) => byId.set(m.id, m));
          // Slack-style: oldest first, keep last MAX_MESSAGES (newest)
          return Array.from(byId.values())
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .slice(-MAX_MESSAGES);
        });
        addNewIds(newOnes.map((m) => m.id));
      } catch {
        // ignore
      }
    };
    const t = setInterval(poll, POLL_INTERVAL_MS);
    poll();
    return () => clearInterval(t);
  }, [activeChannel, addNewIds]);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch(apiUrl('/api/apsara-chat/log?activity=true'));
        const data = await res.json().catch(() => ({}));
        if (data.success && data.data?.activity) setChannelActivity(data.data.activity);
      } catch {
        // ignore
      }
    };
    fetchActivity();
    const t = setInterval(fetchActivity, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    const lastId = messages[messages.length - 1]?.id ?? null;
    const prevId = lastMessageIdRef.current;
    lastMessageIdRef.current = lastId;
    if (lastId && lastId !== prevId) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, [messages]);

  const handleChannelChange = (channelId: string) => {
    setActiveChannel(channelId);
    knownIdsRef.current.clear();
    setMessages([]);
  };

  const handleSendInstruction = async () => {
    const msg = relayMessage.trim();
    if (!msg || sending) return;
    setSending(true);
    setRelayError(null);
    setRelayResult(null);
    const isSendToAll = relayAgentId === 'all';
    const timeoutMs = isSendToAll ? 5 * 60 * 1000 : 130000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(apiUrl('/api/apsara-chat/send'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: relayAgentId, message: msg }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setRelayMessage('');
        if (data.sent != null) {
          setRelayResult(`Sent to ${data.sent}/${data.total ?? data.sent} Apsaras`);
        } else {
          setRelayResult((data.response || 'OK').substring(0, 200));
        }
        setTimeout(() => setRelayResult(null), 6000);
        // Next poll will pick up the new lines from team-chat.log
      } else {
        setRelayError(data.error || 'Send failed');
      }
    } catch (e) {
      clearTimeout(timeoutId);
      const message = e instanceof Error ? e.message : 'Failed to send';
      if (message === 'Failed to fetch' || (e instanceof Error && e.name === 'AbortError')) {
        setRelayError(
          'Request timed out or failed. Check that the app is running and that OpenClaw is installed with the gateway running (see scripts/start-apsara-team.sh).'
        );
      } else {
        setRelayError(message);
      }
    } finally {
      setSending(false);
    }
  };

  const filteredMessages = searchQuery
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()) || m.agentId.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const currentChannel = APSARA_CHANNELS.find(c => c.id === activeChannel) || APSARA_CHANNELS[0];

  return (
    <div className="flex flex-col h-full slack-chat">
      {/* Slack-style top bar */}
      <div className="slack-topbar">
        <div className="slack-topbar-left">
          <Link href="/dashboard" className="slack-back-link">
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Link>
          <div className="slack-topbar-divider" />
          <div className="slack-topbar-title">
            <Sparkles className="h-5 w-5 slack-topbar-icon" />
            <span>Sandarb.AI Team Chat</span>
          </div>
        </div>
        <div className="slack-topbar-right">
          <span className="slack-live-dot" />
          <span className="slack-live-text">Live</span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Slack sidebar */}
        <aside className="slack-sidebar">
          <div className="slack-workspace-header">
            <div className="slack-workspace-icon">
              <Bot className="h-5 w-5" />
            </div>
            <span className="slack-workspace-name">Sandarb.AI</span>
            <ChevronDown className="h-4 w-4 opacity-70" />
          </div>

          <nav className="slack-nav">
            <div className="slack-nav-section">
              <button type="button" className="slack-nav-section-header">
                <ChevronDown className="h-3 w-3" />
                Channels
              </button>
              <div className="slack-nav-list">
                {APSARA_CHANNELS.map((channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => handleChannelChange(channel.id)}
                    className={cn('slack-channel', activeChannel === channel.id && 'slack-channel-active')}
                  >
                    <span className="slack-channel-icon">
                      {channel.icon === '#' ? <Hash className="h-4 w-4" /> : channel.icon}
                    </span>
                    <span className="slack-channel-name">{channel.name}</span>
                    {channelActivity[channel.id] > 0 && (
                      <span className="slack-channel-badge">{channelActivity[channel.id]}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Apsaras live in the right panel only (toggle with 👥) — no duplicate list here */}
          </nav>
        </aside>

        {/* Main chat */}
        <main className="slack-main">
          <header className="slack-channel-header">
            <div className="slack-channel-header-left">
              <span className="slack-channel-header-icon">
                {currentChannel.icon === '#' ? <Hash className="h-5 w-5" /> : currentChannel.icon}
              </span>
              <div>
                <h1 className="slack-channel-header-name">{currentChannel.name}</h1>
                <p className="slack-channel-header-desc">{currentChannel.description}</p>
              </div>
            </div>
            <div className="slack-channel-header-right">
              <div className="slack-search-wrap">
                <Search className="slack-search-icon" />
                <input
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="slack-search-input"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowAgentPanel(!showAgentPanel)}
                className={cn('slack-header-btn', showAgentPanel && 'slack-header-btn-active')}
                title="Toggle members"
              >
                <Users className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="flex flex-1 min-h-0">
            <div className="slack-messages-wrap flex flex-col min-h-0">
              <div ref={scrollRef} className="slack-messages flex-1 min-h-0">
                {filteredMessages.length === 0 ? (
                  <div className="slack-empty">
                    <div className="slack-empty-icon">
                      <MessageSquare className="h-10 w-10" />
                    </div>
                    <p className="slack-empty-title">No messages yet</p>
                    <p className="slack-empty-desc">
                      Messages from Sandarb.AI agents (Apsaras) will appear here.
                    </p>
                  </div>
                ) : (
                  <>
                    {filteredMessages.map((message, idx) => (
                      <MessageItem
                        key={message.id}
                        message={message}
                        isNew={newIds.has(message.id)}
                        showHeader={idx === 0 || shouldShowHeader(filteredMessages[idx - 1], message)}
                      />
                    ))}
                    <div ref={bottomRef} aria-hidden className="h-0 overflow-hidden" />
                  </>
                )}
              </div>
              {/* Relay instruction: "Send to" is set by clicking an Apsara in the right panel (single list) */}
              <div className="slack-compose border-t border-border bg-background p-3 flex-shrink-0">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                    <span>Send to:</span>
                    <span className="font-medium text-foreground">
                      {APSARA_AGENTS[relayAgentId]?.emoji} {APSARA_AGENTS[relayAgentId]?.name ?? relayAgentId}
                    </span>
                    {!showAgentPanel && (
                      <button
                        type="button"
                        onClick={() => setShowAgentPanel(true)}
                        className="text-violet-600 dark:text-violet-400 hover:underline"
                      >
                        (show Apsaras to pick)
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      placeholder="Relay an instruction to this agent..."
                      value={relayMessage}
                      onChange={(e) => setRelayMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendInstruction();
                        }
                      }}
                      rows={2}
                      className="flex-1 text-sm border border-border rounded-md px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground resize-none"
                      disabled={sending}
                    />
                    <button
                      type="button"
                      onClick={handleSendInstruction}
                      disabled={sending || !relayMessage.trim()}
                      className="flex-shrink-0 self-end px-3 py-2 rounded-md bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      <Send className="h-4 w-4" />
                      {sending ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                  {relayError && (
                    <p className="text-xs text-destructive">{relayError}</p>
                  )}
                  {relayResult && (
                    <p className="text-xs text-muted-foreground">Response: {relayResult}{relayResult.length >= 200 ? '…' : ''}</p>
                  )}
                </div>
              </div>
            </div>

            {showAgentPanel && (
              <aside className="slack-members">
                <div className="slack-members-header">
                  <span className="slack-members-count">8</span>
                  <span className="slack-members-title">Apsaras</span>
                </div>
                <p className="px-3 py-1.5 text-xs text-muted-foreground border-b border-border">
                  @all or click one to send
                </p>
                <div className="slack-members-list">
                  <button
                    type="button"
                    onClick={() => setRelayAgentId('all')}
                    className={cn(
                      'slack-member w-full text-left border-0 bg-transparent cursor-pointer',
                      relayAgentId === 'all' && 'bg-violet-100 dark:bg-violet-900/30 ring-1 ring-violet-300 dark:ring-violet-700'
                    )}
                  >
                    <div className="slack-member-avatar-wrap">
                      <div className="slack-member-avatar bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center font-semibold text-sm">
                        @
                      </div>
                    </div>
                    <div className="slack-member-info">
                      <span className="slack-member-name">All Apsaras (8)</span>
                      <span className="slack-member-role">Message everyone</span>
                    </div>
                  </button>
                  {Object.values(APSARA_AGENTS).slice(0, 8).map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setRelayAgentId(agent.id as ApsaraAgentId)}
                      className={cn(
                        'slack-member w-full text-left border-0 bg-transparent cursor-pointer',
                        relayAgentId === agent.id && 'bg-violet-100 dark:bg-violet-900/30 ring-1 ring-violet-300 dark:ring-violet-700'
                      )}
                    >
                      <div className="slack-member-avatar-wrap">
                        <div
                          className="slack-member-avatar"
                          style={{ backgroundColor: agent.color + '30' }}
                        >
                          {agent.emoji}
                        </div>
                        <span
                          className={cn(
                            'slack-member-status',
                            AGENT_STATUSES[agent.id as ApsaraAgentId] === 'active' && 'slack-member-status-green',
                            AGENT_STATUSES[agent.id as ApsaraAgentId] === 'away' && 'slack-member-status-yellow'
                          )}
                        />
                      </div>
                      <div className="slack-member-info">
                        <span className="slack-member-name">{agent.name}</span>
                        <span className="slack-member-role">{agent.role}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </aside>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function shouldShowHeader(prev: ApsaraMessage, curr: ApsaraMessage): boolean {
  if (prev.agentId !== curr.agentId) return true;
  const gap = new Date(prev.timestamp).getTime() - new Date(curr.timestamp).getTime();
  return Math.abs(gap) > 5 * 60 * 1000;
}

interface MessageItemProps {
  message: ApsaraMessage;
  isNew: boolean;
  showHeader: boolean;
}

function MessageItem({ message, isNew, showHeader }: MessageItemProps) {
  const agent = message.agentId !== 'system' ? APSARA_AGENTS[message.agentId as ApsaraAgentId] : null;

  const getMessageMetaClass = () => {
    switch (message.type) {
      case 'error':
        return 'slack-msg-meta-error';
      case 'task_start':
        return 'slack-msg-meta-task';
      case 'task_complete':
        return 'slack-msg-meta-ok';
      case 'feature':
        return 'slack-msg-meta-feature';
      default:
        return '';
    }
  };

  const getMessageIcon = () => {
    switch (message.type) {
      case 'error':
        return <AlertCircle className="h-3.5 w-3.5 text-[#e01e5a]" />;
      case 'task_start':
        return <Settings2 className="h-3.5 w-3.5 text-[#1d9bd1]" />;
      case 'task_complete':
        return <CheckCircle2 className="h-3.5 w-3.5 text-[#2bac76]" />;
      case 'feature':
        return <Rocket className="h-3.5 w-3.5 text-[#e0a025]" />;
      default:
        return null;
    }
  };

  if (message.type === 'session_start' || message.type === 'session_end') {
    return (
      <div className={cn('slack-msg slack-msg-system', isNew && 'slack-msg-new')}>
        <p className="slack-msg-system-text">{message.content}</p>
        <span className="slack-msg-system-time">{formatDateTime(message.timestamp)}</span>
      </div>
    );
  }

  return (
    <div className={cn('slack-msg', isNew && 'slack-msg-new')}>
      {showHeader ? (
        <>
          <div
            className="slack-msg-avatar"
            style={{ backgroundColor: agent ? agent.color + '25' : 'var(--slack-msg-avatar-bg)' }}
          >
            {agent?.emoji || '🤖'}
          </div>
          <div className="slack-msg-body">
            <div className="slack-msg-meta">
              <span className="slack-msg-name">{agent?.name || 'System'}</span>
              <span className="slack-msg-time">{formatDateTime(message.timestamp)}</span>
              {getMessageIcon()}
              {agent && <span className="slack-msg-role">{agent.role.split(' ')[0]}</span>}
            </div>
            <div className={cn('slack-msg-content', getMessageMetaClass())}>
              <p className="slack-msg-text">{message.content}</p>
              {message.metadata?.features && (
                <div className="slack-msg-features">
                  {message.metadata.features.map((f, i) => (
                    <span key={i} className="slack-msg-tag">{f}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="slack-msg-avatar-placeholder" />
          <div className="slack-msg-body slack-msg-body-continuation">
            <span className="slack-msg-time-inline">{formatDateTime(message.timestamp)}</span>
            <div className={cn('slack-msg-content', getMessageMetaClass())}>
              <p className="slack-msg-text">{message.content}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
