'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === '/';
  const isDocs = pathname?.startsWith('/docs');
  const isApsaraChat = pathname?.startsWith('/apsara-chat');

  // Full-screen pages without main sidebar (landing, docs, team chat)
  if (isLanding || isDocs || isApsaraChat) {
    return (
      <main className="flex-1 min-w-0 min-h-0 overflow-auto flex flex-col bg-background">
        {children}
      </main>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 w-full">
      <Sidebar />
      <main className="flex-1 min-w-0 min-h-0 overflow-auto flex flex-col bg-background">{children}</main>
    </div>
  );
}
