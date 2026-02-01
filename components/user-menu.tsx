'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LogOut, User, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DEMO_COOKIE_NAME = 'sandarb_demo';

function hasDemoCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.includes(`${DEMO_COOKIE_NAME}=`);
}

export function UserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [isDemo, setIsDemo] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDemo(hasDemoCookie());
  }, []);

  const handleLogout = () => {
    document.cookie = `${DEMO_COOKIE_NAME}=; path=/; max-age=0`;
    setIsDemo(false);
    router.push('/');
    router.refresh();
  };

  if (!mounted) return null;

  if (isDemo) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          Demo user
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    );
  }

  // Try the demo is in the hero on the home page; show in header on other pages
  if (pathname === '/') return null;

  return (
    <Link href="/signup">
      <Button size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white">
        Try the demo
        <ArrowRight className="h-4 w-4" />
      </Button>
    </Link>
  );
}
