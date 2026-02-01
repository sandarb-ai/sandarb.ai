'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
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
  const pathname = usePathname();
  const [demoState, setDemoState] = useState({ signedIn: false, provider: null as string | null });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDemoState(getDemoState());
  }, []);

  if (!mounted) return null;

  // On home page (/): show nothing
  if (pathname === '/') return null;
  if (pathname === '/signup') return null;

  // When signed in: show defaults (no "Signed in with Google" / "Sign out" in header). Sign out is in the sidebar.
  if (demoState.signedIn) return null;

  return (
    <Link href="/signup">
      <Button size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white">
        Try the demo
        <ArrowRight className="h-4 w-4" />
      </Button>
    </Link>
  );
}
