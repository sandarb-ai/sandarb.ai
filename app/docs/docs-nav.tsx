'use client';

import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import {
  Rocket, Eye, FileText, Shield, Zap, FileJson,
  Puzzle, Layers, Code, Bot, Network, Building, Settings,
  Globe, SwatchBook, Syringe, FlaskConical, ScrollText,
  Wrench, Play, Cpu, BookOpen,
  GitBranch, Lock, Users, LayoutTemplate, ClipboardList,
  Database, Key, ListOrdered, Gauge,
  Variable, CloudUpload,
} from 'lucide-react';
import { A2AIcon, MCPIcon } from './brand-icons';

type IconComponent = ComponentType<{ className?: string }>;

/** Helper: create an image-based icon component for brand logos stored in /public/icons/. */
function imgIcon(src: string, alt: string): IconComponent {
  return function ImgIcon({ className }: { className?: string }) {
    return <img src={src} alt={alt} className={className} />;
  };
}

/** Map of icon name strings to components — keeps serialisation safe across server→client boundary. */
const ICON_MAP: Record<string, IconComponent> = {
  Rocket, Eye, FileText, Shield, Zap, FileJson,
  Puzzle, Layers, Code, Bot, Network, Building, Settings,
  Globe, SwatchBook, Syringe, FlaskConical, ScrollText,
  Wrench, Play, Cpu, BookOpen,
  GitBranch, Lock, Users, LayoutTemplate, ClipboardList,
  Database, Key, ListOrdered, Gauge,
  Variable, CloudUpload,
  A2A: A2AIcon,
  MCP: MCPIcon,
  Python: imgIcon('/icons/python.svg', 'Python'),
  NodeJS: imgIcon('/icons/nodejs.svg', 'Node.js'),
  Go: imgIcon('/icons/go.svg', 'Go'),
  Java: imgIcon('/icons/java.svg', 'Java'),
};

export type TocGroup = {
  label: string;
  icon?: string;
  items: { id: string; label: string; icon?: string; indent?: boolean }[];
};

export function resolveIcon(name?: string): IconComponent | undefined {
  if (!name) return undefined;
  return ICON_MAP[name];
}

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
      <ul className="space-y-4">
        {groups.map((group) => {
          const GroupIcon = resolveIcon(group.icon);
          return (
            <li key={group.label}>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3 flex items-center gap-1.5">
                {GroupIcon && <GroupIcon className="h-3.5 w-3.5" />}
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map(({ id, label, icon, indent }) => {
                  const ItemIcon = resolveIcon(icon);
                  return (
                    <li key={id}>
                      <a
                        href={`#${id}`}
                        className={`text-sm py-2 rounded-md transition-colors flex items-center gap-2 ${
                          indent ? 'pl-7 pr-3 text-[13px]' : 'px-3'
                        } ${
                          activeId === id
                            ? 'text-violet-700 dark:text-violet-300 bg-violet-100/70 dark:bg-violet-900/30 font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-violet-100/50 dark:hover:bg-violet-900/20'
                        }`}
                      >
                        {ItemIcon && <ItemIcon className="h-3.5 w-3.5 shrink-0" />}
                        {label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
