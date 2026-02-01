'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LogOut, User, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DEMO_COOKIE_NAME = 'sandarb_demo';
const DEMO_PROVIDER_COOKIE = 'sandarb_demo_provider';

function getDemoState(): { signedIn: boolean; provider: string | null } {
  if (typeof document === 'undefined') return { signedIn: false, provider: null };
  const signedIn = document.cookie.includes(`${DEMO_COOKIE_NAME}=`);
  if (!signedIn) return { signedIn: false, provider: null };
  const match = document.cookie.match(new RegExp(`${DEMO_PROVIDER_COOKIE}=([^;]+)`));
  const provider = match ? decodeURIComponent(match[1].trim()) : null;
  return { signedIn, provider };
}

export function UserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [demoState, setDemoState] = useState({ signedIn: false, provider: null as string | null });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDemoState(getDemoState());
  }, []);

  const handleLogout = () => {
    document.cookie = `${DEMO_COOKIE_NAME}=; path=/; max-age=0`;
    document.cookie = `${DEMO_PROVIDER_COOKIE}=; path=/; max-age=0`;
    setDemoState({ signedIn: false, provider: null });
    router.push('/');
    router.refresh();
  };

  if (!mounted) return null;

  if (demoState.signedIn) {
    const label = demoState.provider && demoState.provider !== 'Demo'
      ? `Signed in with ${demoState.provider}`
      : 'Demo user';
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground" title={label}>
          <User className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline truncate max-w-[140px]">{label}</span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    );
  }

  // Try the demo is in the hero on home; don't show on signup (user is already there)
  if (pathname === '/' || pathname === '/signup') return null;

  return (
    <Link href="/signup">
      <Button size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white">
        Try the demo
        <ArrowRight className="h-4 w-4" />
      </Button>
    </Link>
  );
}
