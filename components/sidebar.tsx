'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';
import {
  LayoutDashboard,
  FileJson,
  FileText,
  Settings,
  Plus,
  Moon,
  Sun,
  Building2,
  Bot,
  Hash,
  FolderOpen,
  Activity,
  LogOut,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';

const DEMO_COOKIE_NAME = 'sandarb_demo';
const DEMO_PROVIDER_COOKIE = 'sandarb_demo_provider';

const workspaceNav = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Agent Pulse', href: '/agent-pulse', icon: Activity },
  { title: 'Organizations', href: '/organizations', icon: Building2 },
  { title: 'Agents', href: '/agents', icon: Bot },
];

const contentNav = [
  { title: 'Contexts', href: '/contexts', icon: FileJson },
  { title: 'Templates', href: '/templates', icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setIsDemo(document.cookie.includes(`${DEMO_COOKIE_NAME}=`));
    }
  }, []);

  const handleSignOut = () => {
    document.cookie = `${DEMO_COOKIE_NAME}=; path=/; max-age=0`;
    document.cookie = `${DEMO_PROVIDER_COOKIE}=; path=/; max-age=0`;
    setIsDemo(false);
    router.push('/');
    router.refresh();
  };

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

  const NavItem = ({
    href,
    icon: Icon,
    title,
    badge,
  }: {
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    badge?: React.ReactNode;
  }) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        className={cn(
          'group relative flex items-center gap-3 rounded-md px-2 py-2 text-[15px] font-medium transition-colors',
          'hover:bg-violet-100/80 dark:hover:bg-violet-900/20',
          active
            ? 'bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {/* Left accent bar on active — logo purple */}
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-0.5 rounded-full bg-violet-500 dark:bg-violet-400" />
        )}
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
            active
              ? 'bg-violet-200/80 text-violet-700 shadow-sm dark:bg-violet-800/50 dark:text-violet-200'
              : 'text-muted-foreground group-hover:text-foreground'
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 truncate">{title}</span>
        {badge}
      </Link>
    );
  };

  const Section = ({
    label,
    icon: Icon,
    action,
    children,
  }: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    action?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-1 px-2 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {label}
          </span>
        </div>
        {action}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-full w-[220px] flex-col border-r border-border/80 bg-background',
          'dark:border-border/60 dark:bg-[hsl(var(--background))]'
        )}
      >
        {/* Nav only — branding is in the top header bar */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2">
          <Section label="Workspace" icon={FolderOpen}>
            {workspaceNav.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                title={item.title}
              />
            ))}
          </Section>

          <Section
            label="Content"
            icon={Hash}
            action={
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/contexts/new"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-violet-100 hover:text-violet-700 dark:hover:bg-violet-900/40 dark:hover:text-violet-200"
                    aria-label="New context"
                  >
                    <Plus className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">New context</TooltipContent>
              </Tooltip>
            }
          >
            <NavItem href="/contexts" icon={FileJson} title="Contexts" />
            <NavItem href="/templates" icon={FileText} title="Templates" />
          </Section>
        </div>

        {/* Bottom - Settings, Sign out (when signed in), theme */}
        <div className="shrink-0 border-t border-border/80 py-2 px-2 dark:border-border/60">
          <NavItem href="/settings" icon={Settings} title="Settings" />
          {isDemo && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-md px-2 py-2 text-[15px] font-medium transition-colors',
                    'text-muted-foreground hover:bg-violet-100/80 hover:text-foreground dark:hover:bg-violet-900/20 dark:hover:text-foreground'
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground group-hover:text-foreground">
                    <LogOut className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 truncate">Sign out</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  const next = theme === 'dark' ? 'light' : 'dark';
                  setTheme(next);
                  fetch(apiUrl('/api/settings'), {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ theme: next }),
                  }).catch(() => {});
                }}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-md px-2 py-2 text-[15px] font-medium transition-colors',
                  'text-muted-foreground hover:bg-violet-100/80 hover:text-foreground dark:hover:bg-violet-900/20 dark:hover:text-foreground'
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground group-hover:text-foreground">
                  <Sun className="h-[18px] w-[18px] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-[18px] w-[18px] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                </span>
                <span className="min-w-0 truncate">
                  {theme === 'dark' ? 'Dark' : 'Light'} mode
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Toggle theme</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
