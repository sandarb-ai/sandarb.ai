'use client';

import { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

export function DocsCodeBlock({ children, label }: { children: React.ReactNode; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    const text = typeof children === 'string' ? children : String(children);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mb-6 rounded-lg overflow-hidden border border-border/60 bg-[#1e1e1e] dark:bg-[#0d1117] shadow-lg">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-black/30">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" aria-hidden />
          <span className="text-xs font-medium text-zinc-400 truncate">{label ?? 'Code'}</span>
        </div>
        <button
          type="button"
          onClick={copyToClipboard}
          className="shrink-0 flex items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition-colors"
          aria-label="Copy to clipboard"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-4 text-[13px] font-mono text-zinc-300 leading-relaxed overflow-x-auto scrollbar-thin">
        <code>{children}</code>
      </pre>
    </div>
  );
}
