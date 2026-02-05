'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Terminal, 
  Play, 
  Pause, 
  Trash2,
  Maximize2,
  Minimize2,
  Circle,
  ArrowDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { A2ALogEntry } from '@/types';

// ============================================================================
// AGENT COLOR PALETTE
// Distinct, vibrant colors for each agent - easily distinguishable
// ============================================================================
const AGENT_COLORS = [
  { bg: '#3b82f6', text: '#ffffff', name: 'blue' },       // Blue
  { bg: '#10b981', text: '#ffffff', name: 'emerald' },    // Emerald
  { bg: '#f59e0b', text: '#000000', name: 'amber' },      // Amber
  { bg: '#ef4444', text: '#ffffff', name: 'red' },        // Red
  { bg: '#8b5cf6', text: '#ffffff', name: 'violet' },     // Violet
  { bg: '#ec4899', text: '#ffffff', name: 'pink' },       // Pink
  { bg: '#06b6d4', text: '#ffffff', name: 'cyan' },       // Cyan
  { bg: '#84cc16', text: '#000000', name: 'lime' },       // Lime
  { bg: '#f97316', text: '#ffffff', name: 'orange' },     // Orange
  { bg: '#6366f1', text: '#ffffff', name: 'indigo' },     // Indigo
  { bg: '#14b8a6', text: '#ffffff', name: 'teal' },       // Teal
  { bg: '#a855f7', text: '#ffffff', name: 'purple' },     // Purple
  { bg: '#eab308', text: '#000000', name: 'yellow' },     // Yellow
  { bg: '#22c55e', text: '#ffffff', name: 'green' },      // Green
  { bg: '#0ea5e9', text: '#ffffff', name: 'sky' },        // Sky
  { bg: '#e11d48', text: '#ffffff', name: 'rose' },       // Rose
];

// Sandarb AI Governance Agent color (special - always the same)
const SANDARB_COLOR = { bg: '#7c3aed', text: '#ffffff', name: 'sandarb-purple' };

// ============================================================================
// AGENT TYPE
// ============================================================================
interface AgentInfo {
  id: string;
  name: string;
  team: string;
}

// Fallback demo agents if none provided from DB
const FALLBACK_AGENTS: AgentInfo[] = [
  { id: 'retail-banking-agent', name: 'Retail Banking Agent', team: 'retail' },
  { id: 'investment-banking-agent', name: 'Investment Banking Agent', team: 'ib' },
  { id: 'wealth-management-agent', name: 'Wealth Management Agent', team: 'wm' },
  { id: 'compliance-agent', name: 'Compliance Agent', team: 'compliance' },
];

// ============================================================================
// DEMO DATA GENERATORS
// Realistic A2A communication scenarios
// ============================================================================
const DEMO_CONTEXTS = [
  { name: 'ib-trading-limits', lob: 'investment_banking' },
  { name: 'wm-suitability-policy', lob: 'wealth_management' },
  { name: 'retail-compliance-policy', lob: 'retail' },
  { name: 'aml-rules-v2', lob: 'compliance' },
  { name: 'kyc-requirements', lob: 'compliance' },
  { name: 'trade-settlement-rules', lob: 'trading' },
  { name: 'portfolio-constraints', lob: 'wealth_management' },
  { name: 'customer-data-policy', lob: 'retail' },
  { name: 'market-hours-config', lob: 'trading' },
  { name: 'risk-thresholds-prod', lob: 'risk' },
];

const DEMO_PROMPTS = [
  { name: 'compliance-check-prompt', desc: 'Pre-trade compliance verification' },
  { name: 'customer-response-prompt', desc: 'Customer inquiry response template' },
  { name: 'risk-assessment-prompt', desc: 'Portfolio risk evaluation' },
  { name: 'fraud-detection-prompt', desc: 'Transaction anomaly detection' },
  { name: 'kyc-extraction-prompt', desc: 'Document data extraction' },
];

const DEMO_INTENTS = [
  'Pre-trade compliance check',
  'Customer suitability assessment',
  'Risk threshold validation',
  'Transaction monitoring',
  'Document verification',
  'Portfolio rebalancing decision',
  'Fraud pattern analysis',
  'Regulatory reporting',
  'Market data enrichment',
  'Settlement instruction generation',
];

type DemoActionType = 'INJECT_SUCCESS' | 'INJECT_DENIED' | 'PROMPT_USED' | 'A2A_CALL' | 'INFERENCE_EVENT';

function createDemoEntryGenerator(agents: AgentInfo[]) {
  const agentList = agents.length > 0 ? agents : FALLBACK_AGENTS;
  
  return function generateDemoEntry(): A2ALogEntry {
    const now = new Date().toISOString();
    const agent = agentList[Math.floor(Math.random() * agentList.length)];
    const context = DEMO_CONTEXTS[Math.floor(Math.random() * DEMO_CONTEXTS.length)];
    const prompt = DEMO_PROMPTS[Math.floor(Math.random() * DEMO_PROMPTS.length)];
    const intent = DEMO_INTENTS[Math.floor(Math.random() * DEMO_INTENTS.length)];
    
    // Weight probabilities: more successes than failures
    const rand = Math.random();
    let actionType: DemoActionType;
    let reason: string | undefined;
    
    if (rand < 0.50) {
      actionType = 'INJECT_SUCCESS';
    } else if (rand < 0.65) {
      actionType = 'PROMPT_USED';
    } else if (rand < 0.80) {
      actionType = 'A2A_CALL';
    } else if (rand < 0.90) {
      actionType = 'INFERENCE_EVENT';
    } else {
      actionType = 'INJECT_DENIED';
      const reasons = [
        'Context not linked to agent',
        'Agent not registered in Sandarb',
        'Context requires approval status: approved',
        'Data classification restricted: confidential',
        'Regulatory scope mismatch',
      ];
      reason = reasons[Math.floor(Math.random() * reasons.length)];
    }

    return {
      id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      agentId: agent.id,
      traceId: `trace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      accessedAt: now,
      actionType,
      contextName: context.name,
      contextId: `ctx-${Math.random().toString(36).slice(2, 10)}`,
      contextVersionId: actionType === 'INJECT_SUCCESS' ? `v${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 20)}` : null,
      reason,
      intent,
      promptName: actionType === 'PROMPT_USED' ? prompt.name : undefined,
      promptId: actionType === 'PROMPT_USED' ? `prompt-${Math.random().toString(36).slice(2, 10)}` : undefined,
      method: actionType === 'A2A_CALL' ? ['tasks/send', 'tasks/get', 'tasks/cancel'][Math.floor(Math.random() * 3)] : undefined,
      inputSummary: actionType === 'A2A_CALL' ? `{ "task_id": "${Math.random().toString(36).slice(2, 10)}" }` : undefined,
      resultSummary: actionType === 'A2A_CALL' ? (Math.random() > 0.1 ? 'completed' : 'failed') : undefined,
      error: actionType === 'A2A_CALL' && Math.random() > 0.9 ? 'Connection timeout after 30s' : undefined,
    };
  };
}

// ============================================================================
// TERMINAL COMPONENT
// ============================================================================

interface AgentPulseTerminalProps {
  entries?: A2ALogEntry[];
  agents?: AgentInfo[];
  autoPlay?: boolean;
  fullScreen?: boolean;
  onToggleFullScreen?: () => void;
  /** Called when entries change so parent can update A2A / blocked counts. */
  onEntriesChange?: (entries: A2ALogEntry[]) => void;
}

export function AgentPulseTerminal({ 
  entries: initialEntries = [], 
  agents = [],
  autoPlay = true,
  fullScreen = false,
  onToggleFullScreen,
  onEntriesChange,
}: AgentPulseTerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<A2ALogEntry[]>(initialEntries);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [autoScroll, setAutoScroll] = useState(true);
  const [newEntryIds, setNewEntryIds] = useState<Set<string>>(new Set());
  const agentColorMapRef = useRef<Map<string, typeof AGENT_COLORS[0]>>(new Map());
  const colorIndexRef = useRef(0);
  
  // Create demo entry generator with real agents
  const generateDemoEntry = useMemo(() => createDemoEntryGenerator(agents), [agents]);

  // Assign colors to agents deterministically
  const getAgentColor = useCallback((agentId: string) => {
    if (agentId === 'sandarb' || agentId.toLowerCase().includes('sandarb')) {
      return SANDARB_COLOR;
    }
    
    if (!agentColorMapRef.current.has(agentId)) {
      const color = AGENT_COLORS[colorIndexRef.current % AGENT_COLORS.length];
      agentColorMapRef.current.set(agentId, color);
      colorIndexRef.current++;
    }
    return agentColorMapRef.current.get(agentId)!;
  }, []);

  // Demo mode: inject entries with randomized intervals for natural feel
  useEffect(() => {
    if (!isPlaying) return;
    
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let running = true;
    
    const scheduleNext = () => {
      // Random interval between 800ms and 3000ms for natural streaming feel
      const delay = 800 + Math.random() * 2200;
      timeoutId = setTimeout(() => {
        if (!running) return;
        
        const entry = generateDemoEntry();
        setEntries((prev) => [...prev.slice(-199), entry]);
        setNewEntryIds((prev) => new Set([...prev, entry.id]));
        
        // Clear animation class after animation completes
        setTimeout(() => {
          setNewEntryIds((prev) => {
            const next = new Set(prev);
            next.delete(entry.id);
            return next;
          });
        }, 600);
        
        // Schedule next entry
        if (running) {
          scheduleNext();
        }
      }, delay);
    };
    
    scheduleNext();
    
    return () => {
      running = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isPlaying, generateDemoEntry]);

  // Notify parent when entries change (for live stats)
  useEffect(() => {
    onEntriesChange?.(entries);
  }, [entries, onEntriesChange]);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setAutoScroll(true);
    }
  }, []);

  const clearEntries = useCallback(() => {
    setEntries([]);
  }, []);

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  };

  // Get action icon and color
  const getActionStyle = (actionType: string) => {
    switch (actionType) {
      case 'INJECT_SUCCESS':
        return { icon: '✓', color: '#10b981', label: 'INJECT_SUCCESS' };
      case 'INJECT_DENIED':
        return { icon: '✗', color: '#ef4444', label: 'INJECT_DENIED' };
      case 'PROMPT_USED':
        return { icon: '⚡', color: '#f59e0b', label: 'PROMPT_USED' };
      case 'A2A_CALL':
        return { icon: '↔', color: '#8b5cf6', label: 'A2A_CALL' };
      case 'INFERENCE_EVENT':
        return { icon: '🧠', color: '#06b6d4', label: 'INFERENCE_EVENT' };
      default:
        return { icon: '•', color: '#6b7280', label: actionType };
    }
  };

  // Unique agents for legend
  const activeAgents = useMemo(() => {
    const seen = new Set<string>();
    return entries
      .map((e) => e.agentId)
      .filter((id) => {
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .slice(0, 12);
  }, [entries]);

  return (
    <div className={`flex flex-col bg-[#0d1117] text-[#c9d1d9] font-mono text-sm ${fullScreen ? 'fixed inset-0 z-50' : 'h-full'}`}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d]">
        <div className="flex items-center gap-3">
          {/* Traffic light buttons */}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex items-center gap-2 text-[#8b949e]">
            <Terminal className="w-4 h-4" />
            <span className="text-xs font-medium">agent-pulse — A2A Communication Log</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Live indicator */}
          {isPlaying && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#238636]/20 text-[#3fb950]">
              <Circle className="w-2 h-2 fill-current animate-pulse" />
              <span className="text-xs font-medium">LIVE</span>
            </div>
          )}
          
          {/* Controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
            className="h-7 px-2 text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#30363d]"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearEntries}
            className="h-7 px-2 text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#30363d]"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          {onToggleFullScreen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleFullScreen}
              className="h-7 px-2 text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#30363d]"
            >
              {fullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* Agent Legend */}
      {activeAgents.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#0d1117] border-b border-[#30363d] overflow-x-auto">
          <span className="text-xs text-[#8b949e] shrink-0">Agents:</span>
          <div className="flex items-center gap-2 flex-wrap">
            {activeAgents.map((agentId) => {
              const color = getAgentColor(agentId);
              return (
                <div key={agentId} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color.bg }}
                  />
                  <span className="text-xs text-[#8b949e] truncate max-w-[140px]">{agentId}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-[#30363d]">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: SANDARB_COLOR.bg }}
              />
              <span className="text-xs text-[#8b949e]">Sandarb AI Governance</span>
            </div>
          </div>
        </div>
      )}

      {/* Terminal Output */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-1 terminal-scrollbar"
      >
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#8b949e]">
            <Terminal className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">Waiting for A2A communication...</p>
            <p className="text-xs mt-1 opacity-70">
              {isPlaying ? 'Demo mode active — entries will appear shortly' : 'Press play to start demo mode'}
            </p>
          </div>
        ) : (
          entries.map((entry) => {
            const agentColor = getAgentColor(entry.agentId);
            const actionStyle = getActionStyle(entry.actionType);
            const isNew = newEntryIds.has(entry.id);
            
            return (
              <div
                key={entry.id}
                className={`terminal-entry ${isNew ? 'terminal-entry-new' : ''}`}
              >
                {/* Line 1: Timestamp + Agent Request */}
                <div className="flex items-start gap-2 leading-relaxed">
                  <span className="text-[#6e7681] shrink-0 select-none">
                    [{formatDate(entry.accessedAt)} {formatTimestamp(entry.accessedAt)}]
                  </span>
                  <span
                    className="font-semibold shrink-0"
                    style={{ color: agentColor.bg }}
                  >
                    {entry.agentId}
                  </span>
                  <span className="text-[#6e7681]">→</span>
                  <span className="text-[#c9d1d9]">
                    {entry.actionType === 'A2A_CALL' ? (
                      <>
                        A2A call: <span className="text-[#79c0ff]">{entry.method || 'unknown'}</span>
                        {entry.inputSummary && (
                          <span className="text-[#8b949e] ml-2">{entry.inputSummary}</span>
                        )}
                      </>
                    ) : entry.actionType === 'PROMPT_USED' ? (
                      <>
                        Requested prompt: <span className="text-[#ffa657]">{entry.promptName || '—'}</span>
                      </>
                    ) : (
                      <>
                        Requested context: <span className="text-[#79c0ff]">{entry.contextName || '—'}</span>
                      </>
                    )}
                  </span>
                </div>
                
                {/* Line 2: Intent (if present) */}
                {entry.intent && (
                  <div className="flex items-start gap-2 ml-[1ch] text-[#8b949e] leading-relaxed">
                    <span className="shrink-0 select-none opacity-0">[{formatDate(entry.accessedAt)} {formatTimestamp(entry.accessedAt)}]</span>
                    <span>├─ intent: {entry.intent}</span>
                  </div>
                )}
                
                {/* Line 3: Trace ID */}
                <div className="flex items-start gap-2 ml-[1ch] text-[#484f58] leading-relaxed">
                  <span className="shrink-0 select-none opacity-0">[{formatDate(entry.accessedAt)} {formatTimestamp(entry.accessedAt)}]</span>
                  <span>├─ trace: {entry.traceId}</span>
                </div>
                
                {/* Line 4: Sandarb Response */}
                <div className="flex items-start gap-2 leading-relaxed">
                  <span className="text-[#6e7681] shrink-0 select-none">
                    [{formatDate(entry.accessedAt)} {formatTimestamp(entry.accessedAt)}]
                  </span>
                  <span
                    className="font-semibold shrink-0"
                    style={{ color: SANDARB_COLOR.bg }}
                  >
                    Sandarb
                  </span>
                  <span className="text-[#6e7681]">←</span>
                  <span
                    className="shrink-0"
                    style={{ color: actionStyle.color }}
                  >
                    [{actionStyle.label}]
                  </span>
                  <span className="text-[#c9d1d9]">
                    {entry.actionType === 'INJECT_SUCCESS' ? (
                      <>
                        Context delivered: <span className="text-[#79c0ff]">{entry.contextName}</span>
                        {entry.contextVersionId && (
                          <span className="text-[#8b949e] ml-2">v{entry.contextVersionId}</span>
                        )}
                      </>
                    ) : entry.actionType === 'INJECT_DENIED' ? (
                      <>
                        <span className="text-[#f85149]">Denied:</span>{' '}
                        <span className="text-[#f0883e]">{entry.reason || 'Policy violation'}</span>
                      </>
                    ) : entry.actionType === 'PROMPT_USED' ? (
                      <>
                        Prompt delivered: <span className="text-[#ffa657]">{entry.promptName}</span>
                      </>
                    ) : entry.actionType === 'A2A_CALL' ? (
                      entry.error ? (
                        <>
                          <span className="text-[#f85149]">Error:</span>{' '}
                          <span className="text-[#f0883e]">{entry.error}</span>
                        </>
                      ) : (
                        <>
                          Result: <span className="text-[#3fb950]">{entry.resultSummary || 'ok'}</span>
                        </>
                      )
                    ) : (
                      <>
                        Inference logged
                      </>
                    )}
                  </span>
                </div>
                
                {/* Separator line */}
                <div className="h-px bg-[#21262d] my-2" />
              </div>
            );
          })
        )}
      </div>

      {/* Scroll to bottom button */}
      {!autoScroll && entries.length > 0 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-20 right-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#238636] text-white text-xs font-medium hover:bg-[#2ea043] transition-colors shadow-lg"
        >
          <ArrowDown className="w-3 h-3" />
          Scroll to latest
        </button>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#161b22] border-t border-[#30363d] text-xs text-[#8b949e]">
        <div className="flex items-center gap-4">
          <span>{entries.length} entries</span>
          <span>{activeAgents.length} unique agents</span>
        </div>
        <div className="flex items-center gap-4">
          <span>
            {entries.filter((e) => e.actionType === 'INJECT_SUCCESS').length} success
          </span>
          <span className="text-[#f85149]">
            {entries.filter((e) => e.actionType === 'INJECT_DENIED').length} denied
          </span>
        </div>
      </div>
    </div>
  );
}
