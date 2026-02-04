'use client';

import { useEffect, useRef, useState } from 'react';

export function MermaidDiagram({ chart, title }: { chart: string; title?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chart || !containerRef.current) return;
    setError(null);
    const el = document.createElement('div');
    el.className = 'mermaid';
    el.textContent = chart;
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(el);

    import('mermaid')
      .then((mermaid) => {
        mermaid.default.initialize({ startOnLoad: false, theme: 'neutral' });
        return mermaid.default.run({ nodes: [el] });
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [chart]);

  return (
    <div className="my-4 rounded-lg border border-border bg-muted/30 overflow-hidden">
      {title && (
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border bg-muted/50">
          {title}
        </div>
      )}
      <div ref={containerRef} className="p-4 flex justify-center overflow-x-auto min-h-[120px]" />
      {error && <p className="px-4 pb-4 text-sm text-destructive">{error}</p>}
    </div>
  );
}
