'use client';

/* Modern minimal: light fills, thin strokes, smooth motion */
const AGENTS = [
  { label: 'Retail', x: 200, y: 72, letter: 'R', color: '#fce7f3' },
  { label: 'Wealth', x: 332, y: 200, letter: 'W', color: '#ede9fe' },
  { label: 'Compliance', x: 200, y: 328, letter: 'C', color: '#e0f2fe' },
  { label: 'Data', x: 68, y: 200, letter: 'D', color: '#fef9c3' },
];
const CENTER = { x: 200, y: 200 };
const CENTER_COLOR = '#c7d2fe';
const NODE_R = 24;
const CENTER_R = 32;
const LINE_STROKE = '#e5e7eb';
const DOT_R = 3;
const DUR = '2.5';

export function MultiAgentA2ADiagram() {
  return (
    <div className="relative w-full max-w-sm mx-auto text-foreground">
      <svg
        viewBox="0 0 400 400"
        className="w-full h-auto a2a-diagram-svg"
        aria-hidden
      >
        <defs>
          <linearGradient id="a2a-center-glow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c7d2fe" />
            <stop offset="100%" stopColor="#a5b4fc" />
          </linearGradient>
          <filter id="a2a-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
            <feOffset dx="0" dy="1" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.12" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Thin connection lines */}
        <g stroke={LINE_STROKE} strokeWidth="1" fill="none">
          {AGENTS.map((agent, i) => (
            <line
              key={i}
              x1={agent.x}
              y1={agent.y}
              x2={CENTER.x}
              y2={CENTER.y}
            />
          ))}
        </g>

        {/* Traveling dots: agent → center */}
        {AGENTS.map((agent, i) => (
          <g key={`dot-out-${i}`}>
            <circle r={DOT_R} fill={agent.color} className="a2a-dot">
              <animateMotion
                dur={`${DUR}s`}
                repeatCount="indefinite"
                path={`M ${agent.x} ${agent.y} L ${CENTER.x} ${CENTER.y}`}
              />
            </circle>
            <circle r={DOT_R} fill={agent.color} opacity={0.7}>
              <animateMotion
                dur={`${DUR}s`}
                repeatCount="indefinite"
                begin={`${Number(DUR) * 0.4}s`}
                path={`M ${agent.x} ${agent.y} L ${CENTER.x} ${CENTER.y}`}
              />
            </circle>
          </g>
        ))}
        {/* Traveling dots: center → agent */}
        {AGENTS.map((agent, i) => (
          <g key={`dot-back-${i}`}>
            <circle r={DOT_R} fill={CENTER_COLOR} className="a2a-dot">
              <animateMotion
                dur={`${DUR}s`}
                repeatCount="indefinite"
                begin={`${Number(DUR) * 0.25}s`}
                path={`M ${CENTER.x} ${CENTER.y} L ${agent.x} ${agent.y}`}
              />
            </circle>
          </g>
        ))}

        {/* Agent nodes — light fill, thin border */}
        {AGENTS.map((agent) => (
          <g key={agent.label}>
            <circle
              cx={agent.x}
              cy={agent.y}
              r={NODE_R}
              fill={agent.color}
              stroke={LINE_STROKE}
              strokeWidth="1.5"
            />
            <text
              x={agent.x}
              y={agent.y + 4}
              textAnchor="middle"
              fill="#374151"
              style={{ fontSize: '12px', fontWeight: 600 }}
            >
              {agent.letter}
            </text>
          </g>
        ))}

        {/* Sandarb center — gradient + soft shadow */}
        <g filter="url(#a2a-soft-shadow)">
          <circle
            cx={CENTER.x}
            cy={CENTER.y}
            r={CENTER_R}
            fill="url(#a2a-center-glow)"
            stroke="#a5b4fc"
            strokeWidth="1.5"
            className="a2a-center-pulse"
          />
          <text
            x={CENTER.x}
            y={CENTER.y + 5}
            textAnchor="middle"
            fill="#4338ca"
            style={{ fontSize: '14px', fontWeight: 700 }}
          >
            S
          </text>
        </g>

        {/* Labels */}
        {AGENTS.map((agent) => (
          <text
            key={agent.label}
            x={agent.x}
            y={agent.y + NODE_R + 14}
            textAnchor="middle"
            fill="#6b7280"
            style={{ fontSize: '10px', fontWeight: 500 }}
          >
            {agent.label}
          </text>
        ))}
        <text
          x={CENTER.x}
          y={CENTER.y + CENTER_R + 16}
          textAnchor="middle"
          fill="#4f46e5"
          style={{ fontSize: '10px', fontWeight: 600 }}
        >
          Sandarb.AI
        </text>
        <text
          x={CENTER.x}
          y={CENTER.y + CENTER_R + 28}
          textAnchor="middle"
          fill="#9ca3af"
          style={{ fontSize: '9px' }}
        >
          Governance
        </text>
      </svg>
    </div>
  );
}
