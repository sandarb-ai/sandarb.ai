import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeSync } from '@/components/theme-sync';
import { AppShell } from '@/components/app-shell';
import { UserMenu } from '@/components/user-menu';
import { TooltipProvider } from '@/components/ui/tooltip';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Sandarb - Governance for AI Agents',
  description:
    'Regulatory, controls, risk management, and compliance for AI agents. Sandarb runs as UI, API, and A2A agent so other agents talk to it for validation, audit, and approved context.',
  keywords: ['AI', 'agents', 'governance', 'compliance', 'A2A', 'controls', 'risk', 'audit'],
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeSync />
          <TooltipProvider>
            <div className="flex flex-col h-screen min-h-0 w-full">
              <header className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-2">
                <Link href="/" className="flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/50">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500">
                    <Image src="/logo.svg" alt="Sandarb" width={20} height={20} />
                  </div>
                  <span className="text-sm font-semibold text-foreground">Sandarb</span>
                </Link>
                <UserMenu />
              </header>
              <AppShell>{children}</AppShell>
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
