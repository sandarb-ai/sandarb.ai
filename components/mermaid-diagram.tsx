'use client';

import { useEffect, useRef, useState } from 'react';

export function MermaidDiagram({ chart, title }: { chart: string; title?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chart || !containerRef.current) return;
    setError(null);
    const el = document.createElement('div');
    el.className = 'mermaid mermaid-fit-container';
    el.textContent = chart;
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(el);

    import('mermaid')
      .then((mermaid) => {
        mermaid.default.initialize({ startOnLoad: false, theme: 'neutral' });
        return mermaid.default.run({ nodes: [el] });
      })
      .then(() => {
        if (!containerRef.current) return;
        const svg = containerRef.current.querySelector('svg');
        if (svg) {
          svg.style.maxWidth = '100%';
          svg.style.height = 'auto';
          svg.setAttribute('width', '100%');
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [chart]);

  return (
    <div className="my-6 w-full rounded-lg border border-border bg-muted/30 overflow-hidden">
      {title && (
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border bg-muted/50">
          {title}
        </div>
      )}
      <div
        ref={containerRef}
        className="mermaid-diagram-content w-full p-4 overflow-x-auto overflow-y-hidden min-h-[140px] [&_.mermaid-fit-container]:flex [&_.mermaid-fit-container]:justify-center [&_.mermaid-fit-container_svg]:max-w-full [&_.mermaid-fit-container_svg]:h-auto"
      />
      {error && <p className="px-4 pb-4 text-sm text-destructive">{error}</p>}
    </div>
  );
}
