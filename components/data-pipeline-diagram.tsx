'use client';

/**
 * Animated AGP (AI Governance Proof) Pipeline diagram.
 *
 * Layout (left → right):
 *   [5 AI Agents] ⇄ [Sandarb logo+name rect] → [Kafka cylinder] → [SKCC stream] → [ClickHouse DB] → [Superset]
 *
 * Uses native SVG <animateMotion> for traveling dots — same lightweight
 * pattern as multi-agent-a2a-diagram.tsx. No JS animation library needed.
 */

const DUR = '2.5'; // seconds per segment traversal
const DOT_R = 3;

/* ── Agent nodes (left side, stacked vertically) ── */
const AGENTS = [
  { label: 'Agent 1', y: 50,  color: '#fce7f3', stroke: '#f9a8d4' },
  { label: 'Agent 2', y: 95,  color: '#ede9fe', stroke: '#c4b5fd' },
  { label: 'Agent 3', y: 140, color: '#e0f2fe', stroke: '#7dd3fc' },
  { label: 'Agent 4', y: 185, color: '#fef9c3', stroke: '#fde047' },
  { label: 'Agent 5', y: 230, color: '#d1fae5', stroke: '#6ee7b7' },
];
const AGENT_X = 55;
const AGENT_R = 20;

/* ── Sandarb rect position ── */
const SANDARB_X = 195;
const SANDARB_Y = 105;
const SANDARB_W = 100;
const SANDARB_H = 70;
const SANDARB_CX = SANDARB_X + SANDARB_W / 2;
const SANDARB_CY = SANDARB_Y + SANDARB_H / 2;

/* ── Pipeline node centers (after Sandarb) ── */
const KAFKA_CX = 390;
const CONSUMER_CX = 520;
const CLICKHOUSE_CX = 650;
const SUPERSET_CX = 775;
const PIPE_Y = 140; // vertical center line for pipeline nodes

const LINE_COLOR = '#e5e7eb';

export function DataPipelineDiagram() {
  return (
    <div className="relative w-full max-w-4xl mx-auto text-foreground">
      <svg
        viewBox="0 0 850 290"
        className="w-full h-auto min-h-[200px]"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <defs>
          {/* Sandarb purple gradient */}
          <linearGradient id="dp-sandarb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
          {/* Kafka yellow gradient */}
          <linearGradient id="dp-kafka-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fef9c3" />
            <stop offset="100%" stopColor="#fde68a" />
          </linearGradient>
          {/* ClickHouse pink gradient */}
          <linearGradient id="dp-ch-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fce7f3" />
            <stop offset="100%" stopColor="#fbcfe8" />
          </linearGradient>
          {/* Consumer green gradient */}
          <linearGradient id="dp-consumer-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d1fae5" />
            <stop offset="100%" stopColor="#a7f3d0" />
          </linearGradient>
          {/* Superset cyan gradient */}
          <linearGradient id="dp-superset-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#cffafe" />
            <stop offset="100%" stopColor="#a5f3fc" />
          </linearGradient>
          {/* Soft shadow */}
          <filter id="dp-shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
            <feOffset dx="0" dy="1" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.1" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Arrow marker */}
          <marker id="dp-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#d1d5db" />
          </marker>
          <marker id="dp-arrow-purple" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#a5b4fc" />
          </marker>
        </defs>

        {/* ═══════════════ BIDIRECTIONAL LINES: Agents ⇄ Sandarb ═══════════════ */}
        <g stroke={LINE_COLOR} strokeWidth="1" fill="none">
          {AGENTS.map((agent, i) => (
            <g key={`lines-${i}`}>
              {/* Agent → Sandarb (top line) */}
              <line
                x1={AGENT_X + AGENT_R + 2}
                y1={agent.y - 2}
                x2={SANDARB_X - 2}
                y2={SANDARB_CY - 2}
                markerEnd="url(#dp-arrow-purple)"
              />
              {/* Sandarb → Agent (bottom line) */}
              <line
                x1={SANDARB_X - 2}
                y1={SANDARB_CY + 2}
                x2={AGENT_X + AGENT_R + 2}
                y2={agent.y + 2}
                markerEnd="url(#dp-arrow)"
              />
            </g>
          ))}
        </g>

        {/* Pipeline connection lines: Sandarb → Kafka → Consumer → ClickHouse → Superset */}
        <g stroke={LINE_COLOR} strokeWidth="1.5" fill="none">
          <line x1={SANDARB_X + SANDARB_W + 2} y1={SANDARB_CY} x2={KAFKA_CX - 38} y2={PIPE_Y} markerEnd="url(#dp-arrow)" />
          <line x1={KAFKA_CX + 38} y1={PIPE_Y} x2={CONSUMER_CX - 35} y2={PIPE_Y} markerEnd="url(#dp-arrow)" />
          <line x1={CONSUMER_CX + 35} y1={PIPE_Y} x2={CLICKHOUSE_CX - 28} y2={PIPE_Y} markerEnd="url(#dp-arrow)" />
          <line x1={CLICKHOUSE_CX + 28} y1={PIPE_Y} x2={SUPERSET_CX - 28} y2={PIPE_Y} markerEnd="url(#dp-arrow)" />
        </g>

        {/* ═══════════════ TRAVELING DOTS: Agents → Sandarb ═══════════════ */}
        {AGENTS.map((agent, i) => (
          <g key={`agent-dots-${i}`}>
            <circle r={DOT_R} fill={agent.color} stroke={agent.stroke} strokeWidth="0.5">
              <animateMotion
                dur={`${DUR}s`}
                repeatCount="indefinite"
                begin={`${i * 0.5}s`}
                path={`M ${AGENT_X + AGENT_R} ${agent.y} L ${SANDARB_X} ${SANDARB_CY}`}
              />
            </circle>
            {/* Return dot: Sandarb → Agent */}
            <circle r={DOT_R * 0.7} fill="#c7d2fe" opacity={0.6}>
              <animateMotion
                dur={`${DUR}s`}
                repeatCount="indefinite"
                begin={`${i * 0.5 + 1.2}s`}
                path={`M ${SANDARB_X} ${SANDARB_CY} L ${AGENT_X + AGENT_R} ${agent.y}`}
              />
            </circle>
          </g>
        ))}

        {/* TRAVELING DOTS: Sandarb → Kafka → Consumer → ClickHouse → Superset */}
        {[
          { x1: SANDARB_X + SANDARB_W, y1: SANDARB_CY, x2: KAFKA_CX - 36, y2: PIPE_Y, color: '#c7d2fe' },
          { x1: KAFKA_CX + 36, y1: PIPE_Y, x2: CONSUMER_CX - 33, y2: PIPE_Y, color: '#fef9c3' },
          { x1: CONSUMER_CX + 33, y1: PIPE_Y, x2: CLICKHOUSE_CX - 26, y2: PIPE_Y, color: '#d1fae5' },
          { x1: CLICKHOUSE_CX + 26, y1: PIPE_Y, x2: SUPERSET_CX - 26, y2: PIPE_Y, color: '#fce7f3' },
        ].map((seg, i) => (
          <g key={`pipe-dots-${i}`}>
            <circle r={DOT_R} fill={seg.color}>
              <animateMotion
                dur={`${DUR}s`}
                repeatCount="indefinite"
                begin={`${i * 0.6}s`}
                path={`M ${seg.x1} ${seg.y1} L ${seg.x2} ${seg.y2}`}
              />
            </circle>
            <circle r={DOT_R * 0.6} fill={seg.color} opacity={0.5}>
              <animateMotion
                dur={`${DUR}s`}
                repeatCount="indefinite"
                begin={`${i * 0.6 + 1.3}s`}
                path={`M ${seg.x1} ${seg.y1} L ${seg.x2} ${seg.y2}`}
              />
            </circle>
          </g>
        ))}

        {/* ═══════════════ AI AGENT NODES (circles with bot icon) ═══════════════ */}
        {AGENTS.map((agent, i) => (
          <g key={`agent-${i}`} filter="url(#dp-shadow)">
            <circle
              cx={AGENT_X}
              cy={agent.y}
              r={AGENT_R}
              fill={agent.color}
              stroke={agent.stroke}
              strokeWidth="1.5"
            />
            {/* Bot icon — simplified head + antenna */}
            <g transform={`translate(${AGENT_X - 8}, ${agent.y - 9})`} fill="#6b7280">
              <rect x="2" y="6" width="12" height="10" rx="2" fill="none" stroke="#6b7280" strokeWidth="1.2" />
              <circle cx="6" cy="11" r="1.2" />
              <circle cx="10" cy="11" r="1.2" />
              <line x1="8" y1="3" x2="8" y2="6" stroke="#6b7280" strokeWidth="1" />
              <circle cx="8" cy="2" r="1.2" />
            </g>
          </g>
        ))}

        {/* Agent labels */}
        {AGENTS.map((agent, i) => (
          <text
            key={`agent-label-${i}`}
            x={AGENT_X}
            y={agent.y + AGENT_R + 12}
            textAnchor="middle"
            fill="#9ca3af"
            style={{ fontSize: '8px', fontWeight: 500 }}
          >
            {agent.label}
          </text>
        ))}

        {/* ═══════════════ SANDARB (rectangle with logo) ═══════════════ */}
        <g filter="url(#dp-shadow)">
          <rect
            x={SANDARB_X}
            y={SANDARB_Y}
            width={SANDARB_W}
            height={SANDARB_H}
            rx={12}
            fill="url(#dp-sandarb-grad)"
            stroke="#7c3aed"
            strokeWidth="1.5"
          />
          {/* Pulse ring */}
          <rect
            x={SANDARB_X}
            y={SANDARB_Y}
            width={SANDARB_W}
            height={SANDARB_H}
            rx={12}
            fill="none"
            stroke="#a78bfa"
            strokeWidth="1"
            className="a2a-center-pulse"
          />
          {/* Logo: O ring with dots (simplified from logo.svg) */}
          <g transform={`translate(${SANDARB_CX}, ${SANDARB_CY - 6})`}>
            <circle cx="0" cy="0" r="10" stroke="white" strokeWidth="2.5" fill="none" />
            <circle cx="0" cy="-10" r="2" fill="white" />
            <circle cx="10" cy="0" r="2" fill="white" />
            <circle cx="0" cy="10" r="2" fill="white" />
            <circle cx="-10" cy="0" r="2" fill="white" />
          </g>
          <text
            x={SANDARB_CX}
            y={SANDARB_CY + 24}
            textAnchor="middle"
            fill="white"
            style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px' }}
          >
            Sandarb
          </text>
        </g>

        {/* ═══════════════ KAFKA (horizontal cylinder) ═══════════════ */}
        <g filter="url(#dp-shadow)">
          {/* Cylinder body */}
          <rect
            x={KAFKA_CX - 34}
            y={PIPE_Y - 22}
            width={68}
            height={44}
            rx={0}
            fill="url(#dp-kafka-grad)"
            stroke="#fde047"
            strokeWidth="1.5"
          />
          {/* Left ellipse cap */}
          <ellipse
            cx={KAFKA_CX - 34}
            cy={PIPE_Y}
            rx={10}
            ry={22}
            fill="#fef9c3"
            stroke="#fde047"
            strokeWidth="1.5"
          />
          {/* Right ellipse cap (visible front) */}
          <ellipse
            cx={KAFKA_CX + 34}
            cy={PIPE_Y}
            rx={10}
            ry={22}
            fill="url(#dp-kafka-grad)"
            stroke="#fde047"
            strokeWidth="1.5"
          />
          {/* Interior lines for cylinder depth */}
          <line x1={KAFKA_CX - 34} y1={PIPE_Y - 22} x2={KAFKA_CX + 34} y2={PIPE_Y - 22} stroke="#fde047" strokeWidth="0.5" opacity="0.5" />
          <line x1={KAFKA_CX - 34} y1={PIPE_Y + 22} x2={KAFKA_CX + 34} y2={PIPE_Y + 22} stroke="#fde047" strokeWidth="0.5" opacity="0.5" />
          {/* Kafka text */}
          <text
            x={KAFKA_CX + 2}
            y={PIPE_Y + 4}
            textAnchor="middle"
            fill="#92400e"
            style={{ fontSize: '11px', fontWeight: 700 }}
          >
            Kafka
          </text>
        </g>
        <text x={KAFKA_CX + 2} y={PIPE_Y + 38} textAnchor="middle" fill="#9ca3af" style={{ fontSize: '8px' }}>
          AGP Events
        </text>

        {/* ═══════════════ CONSUMER (streaming process — wave icon) ═══════════════ */}
        <g filter="url(#dp-shadow)">
          <rect
            x={CONSUMER_CX - 32}
            y={PIPE_Y - 22}
            width={64}
            height={44}
            rx={8}
            fill="url(#dp-consumer-grad)"
            stroke="#6ee7b7"
            strokeWidth="1.5"
          />
          {/* Stream wave lines */}
          <g transform={`translate(${CONSUMER_CX - 14}, ${PIPE_Y - 12})`} stroke="#059669" strokeWidth="1.2" fill="none" strokeLinecap="round">
            <path d="M 0 4 Q 7 0, 14 4 Q 21 8, 28 4" />
            <path d="M 0 12 Q 7 8, 14 12 Q 21 16, 28 12" />
            <path d="M 0 20 Q 7 16, 14 20 Q 21 24, 28 20" />
          </g>
        </g>
        <text x={CONSUMER_CX} y={PIPE_Y + 38} textAnchor="middle" fill="#9ca3af" style={{ fontSize: '8px' }}>
          SKCC
        </text>

        {/* ═══════════════ CLICKHOUSE (OLAP DB — database cylinder) ═══════════════ */}
        <g filter="url(#dp-shadow)">
          {/* Cylinder body */}
          <rect
            x={CLICKHOUSE_CX - 26}
            y={PIPE_Y - 18}
            width={52}
            height={36}
            fill="url(#dp-ch-grad)"
            stroke="#f9a8d4"
            strokeWidth="1.5"
          />
          {/* Top ellipse */}
          <ellipse
            cx={CLICKHOUSE_CX}
            cy={PIPE_Y - 18}
            rx={26}
            ry={8}
            fill="#fce7f3"
            stroke="#f9a8d4"
            strokeWidth="1.5"
          />
          {/* Bottom ellipse (visible) */}
          <ellipse
            cx={CLICKHOUSE_CX}
            cy={PIPE_Y + 18}
            rx={26}
            ry={8}
            fill="url(#dp-ch-grad)"
            stroke="#f9a8d4"
            strokeWidth="1.5"
          />
          {/* Side lines */}
          <line x1={CLICKHOUSE_CX - 26} y1={PIPE_Y - 18} x2={CLICKHOUSE_CX - 26} y2={PIPE_Y + 18} stroke="#f9a8d4" strokeWidth="1.5" />
          <line x1={CLICKHOUSE_CX + 26} y1={PIPE_Y - 18} x2={CLICKHOUSE_CX + 26} y2={PIPE_Y + 18} stroke="#f9a8d4" strokeWidth="1.5" />
          {/* Internal shelf lines for OLAP rows feel */}
          <ellipse cx={CLICKHOUSE_CX} cy={PIPE_Y - 6} rx={26} ry={6} fill="none" stroke="#f9a8d4" strokeWidth="0.6" opacity="0.5" />
          <ellipse cx={CLICKHOUSE_CX} cy={PIPE_Y + 6} rx={26} ry={6} fill="none" stroke="#f9a8d4" strokeWidth="0.6" opacity="0.5" />
          {/* Label inside */}
          <text
            x={CLICKHOUSE_CX}
            y={PIPE_Y + 4}
            textAnchor="middle"
            fill="#9d174d"
            style={{ fontSize: '8px', fontWeight: 700 }}
          >
            ClickHouse
          </text>
        </g>
        <text x={CLICKHOUSE_CX} y={PIPE_Y + 42} textAnchor="middle" fill="#9ca3af" style={{ fontSize: '8px' }}>
          OLAP Database
        </text>

        {/* ═══════════════ SUPERSET (rounded rect with chart icon) ═══════════════ */}
        <g filter="url(#dp-shadow)">
          <rect
            x={SUPERSET_CX - 28}
            y={PIPE_Y - 22}
            width={56}
            height={44}
            rx={10}
            fill="url(#dp-superset-grad)"
            stroke="#67e8f9"
            strokeWidth="1.5"
          />
          {/* Bar chart icon inside */}
          <g transform={`translate(${SUPERSET_CX - 12}, ${PIPE_Y - 12})`} fill="#0891b2">
            <rect x="0" y="14" width="6" height="10" rx="1" />
            <rect x="9" y="6" width="6" height="18" rx="1" />
            <rect x="18" y="0" width="6" height="24" rx="1" />
          </g>
        </g>
        <text x={SUPERSET_CX} y={PIPE_Y + 38} textAnchor="middle" fill="#9ca3af" style={{ fontSize: '8px' }}>
          Superset Reports
        </text>
      </svg>
    </div>
  );
}
