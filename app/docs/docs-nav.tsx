'use client';

import { useEffect, useState } from 'react';

export type TocGroup = {
  label: string;
  items: { id: string; label: string }[];
};

export function DocsNav({ groups }: { groups: TocGroup[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const main = document.getElementById('docs-main');
    if (!main) return;

    const sectionIds = groups.flatMap((g) => g.items.map((i) => i.id));

    const onScroll = () => {
      const mainTop = main.getBoundingClientRect().top;
      const threshold = 120;
      let current: string | null = null;
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= mainTop + threshold) current = id;
      }
      setActiveId(current ?? sectionIds[0] ?? null);
    };

    onScroll();
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, [groups]);

  return (
    <nav className="sticky top-4 p-4 py-6">
      <p className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-3">
        In this doc
      </p>
      <ul className="space-y-4">
        {groups.map((group) => (
          <li key={group.label}>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(({ id, label }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className={`block text-sm py-2 px-3 rounded-md transition-colors ${
                      activeId === id
                        ? 'text-violet-700 dark:text-violet-300 bg-violet-100/70 dark:bg-violet-900/30 font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-violet-100/50 dark:hover:bg-violet-900/20'
                    }`}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
