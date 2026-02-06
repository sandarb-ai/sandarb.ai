import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeSync } from '@/components/theme-sync';
import { AppShell } from '@/components/app-shell';
import { PublicHeader } from '@/components/public-header';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DEMO_COOKIE_NAME } from '@/components/signed-in-strip';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Sandarb - AI Governance for AI Agents',
  description:
    'Regulatory, controls, risk management, and compliance for AI agents. Sandarb runs as UI, API, and A2A agent so other agents talk to it for validation, audit, and approved context.',
  keywords: ['AI', 'agents', 'governance', 'compliance', 'A2A', 'controls', 'risk', 'audit'],
  icons: {
    icon: '/favicon.svg',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const initialSignedIn = !!cookieStore.get(DEMO_COOKIE_NAME);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          storageKey="sandarb-theme"
          disableTransitionOnChange
        >
          <ThemeSync />
          <TooltipProvider>
            <div className="flex flex-col h-screen min-h-0 w-full">
              <PublicHeader initialSignedIn={initialSignedIn} />
              <AppShell>{children}</AppShell>
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
