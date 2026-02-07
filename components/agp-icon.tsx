/**
 * AGP (AI Governance Proof) Icon
 *
 * Concept: A shield (governance) with a connected-node circuit pattern inside (AI agent).
 * The central node represents the AI agent, surrounding nodes represent governance checkpoints,
 * and connecting lines represent the proof chain.
 */
export function AgpIcon({
  className = 'h-6 w-6',
  ...props
}: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      {...props}
    >
      {/* Shield outline */}
      <path
        d="M12 2L3.5 6.5V11.5C3.5 16.45 7.14 21.03 12 22C16.86 21.03 20.5 16.45 20.5 11.5V6.5L12 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Central agent node (larger) */}
      <circle cx="12" cy="11" r="2.2" fill="currentColor" opacity="0.9" />
      {/* Top governance node */}
      <circle cx="12" cy="6" r="1.2" fill="currentColor" opacity="0.7" />
      {/* Bottom-left governance node */}
      <circle cx="8" cy="14.5" r="1.2" fill="currentColor" opacity="0.7" />
      {/* Bottom-right governance node */}
      <circle cx="16" cy="14.5" r="1.2" fill="currentColor" opacity="0.7" />
      {/* Connecting proof lines: central to top */}
      <line x1="12" y1="8.8" x2="12" y2="7.2" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      {/* Connecting proof lines: central to bottom-left */}
      <line x1="10.3" y1="12.5" x2="9" y2="13.5" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      {/* Connecting proof lines: central to bottom-right */}
      <line x1="13.7" y1="12.5" x2="15" y2="13.5" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      {/* Hash tick mark inside central node */}
      <path
        d="M11 11L11.7 11.7L13.2 10.2"
        stroke="white"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
