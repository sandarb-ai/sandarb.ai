'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { SignupForm } from './signup-form';
import { setDemoCookies } from './actions';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
const SESSION_KEY = 'sandarb_human_verified';

function isLocalhostHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

function setVerifiedSession() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY, '1');
    }
  } catch {
    // ignore
  }
}

const BOOT_LINES = [
  '> connecting to sandarb node...',
  '> allocating memory...',
  '> checking bot status...',
  '> initializing human verification...',
];

export function SignupCardOrTerminal({ from }: { from?: string }) {
  const [view, setView] = useState<'card' | 'terminal'>('card');
  const [bootLineIndex, setBootLineIndex] = useState(0);
  const [accessGranted, setAccessGranted] = useState(false);
  const [bypassCountdown, setBypassCountdown] = useState<number | null>(null);
  const [bypassBootIndex, setBypassBootIndex] = useState(0);
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    setIsLocalhost(isLocalhostHost());
  }, []);

  const useTurnstile = Boolean(SITE_KEY) && !isLocalhost;

  const handleContinueClick = useCallback(() => {
    setView('terminal');
  }, []);

  // Helper to set cookies and redirect
  const performRedirect = useCallback(async () => {
    if (isRedirecting) return;
    setIsRedirecting(true);
    setVerifiedSession();

    const fd = new FormData();
    if (from) fd.set('from', from);

    try {
      // Set cookies via server action (returns target path)
      const targetPath = await setDemoCookies(fd);
      // Use hard navigation to ensure cookies are sent with the request
      // router.push can cause race conditions with middleware cookie checks
      window.location.href = targetPath;
    } catch (error) {
      // Fallback to direct navigation
      const targetPath = from?.startsWith('/') ? from : '/dashboard';
      window.location.href = targetPath;
    }
  }, [from, isRedirecting]);

  // Boot sequence: reveal one line every ~400ms
  useEffect(() => {
    if (view !== 'terminal') return;
    if (!useTurnstile) {
      // Bypass flow: run bypass boot
      return;
    }
    if (bootLineIndex < BOOT_LINES.length) {
      const t = setTimeout(() => setBootLineIndex((i) => i + 1), 400);
      return () => clearTimeout(t);
    }
    setAccessGranted(true);
  }, [view, bootLineIndex, useTurnstile]);

  // When ACCESS GRANTED (has key): set session for verified user, then redirect after 1s
  useEffect(() => {
    if (!accessGranted || !useTurnstile || isRedirecting) return;
    const t = setTimeout(() => {
      performRedirect();
    }, 1000);
    return () => clearTimeout(t);
  }, [accessGranted, useTurnstile, isRedirecting, performRedirect]);

  // Bypass (no key or localhost): boot lines then countdown
  useEffect(() => {
    if (view !== 'terminal' || useTurnstile) return;
    if (bypassBootIndex < BOOT_LINES.length) {
      const t = setTimeout(() => setBypassBootIndex((i) => i + 1), 400);
      return () => clearTimeout(t);
    }
    if (bypassCountdown === null) setBypassCountdown(3);
  }, [view, useTurnstile, bypassBootIndex, bypassCountdown]);

  // Bypass countdown hit 0: set session, call server action to set cookies + redirect
  useEffect(() => {
    if (bypassCountdown === null || bypassCountdown > 0 || isRedirecting) return;
    performRedirect();
  }, [bypassCountdown, isRedirecting, performRedirect]);

  useEffect(() => {
    if (bypassCountdown === null || bypassCountdown <= 0) return;
    const t = setTimeout(
      () => setBypassCountdown((c) => (c === null ? null : c - 1)),
      1000
    );
    return () => clearTimeout(t);
  }, [bypassCountdown]);

  if (view === 'terminal') {
    const isBypass = !useTurnstile;
    const bootIndex = isBypass ? bypassBootIndex : bootLineIndex;
    const showWarn = isBypass && bypassBootIndex >= BOOT_LINES.length;
    const showAccessGranted = !isBypass && (accessGranted || bootLineIndex >= BOOT_LINES.length);

    return (
      <div className="w-full rounded-2xl border-2 border-green-900/80 bg-black shadow-2xl shadow-green-950/20 overflow-hidden font-mono">
        <div className="flex items-center gap-2 border-b border-green-900/60 bg-zinc-900/80 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-600" aria-hidden />
            <span className="h-3 w-3 rounded-full bg-amber-500" aria-hidden />
            <span className="h-3 w-3 rounded-full bg-green-600" aria-hidden />
          </div>
          <span className="ml-2 text-[11px] text-zinc-500 uppercase tracking-wider">
            sandarb — verification
          </span>
        </div>
        <div className="p-5 text-sm text-green-500 space-y-1 min-h-[220px]">
          {BOOT_LINES.slice(0, bootIndex).map((line, i) => (
            <div key={i} className="animate-in fade-in duration-200">
              {line}
            </div>
          ))}
          {showWarn && (
            <>
              <div className="text-green-400 animate-pulse">
                &gt; human verification complete
              </div>
              <div className="text-green-600">
                &gt; granting access in {bypassCountdown ?? 3}s...
              </div>
            </>
          )}
          {showAccessGranted && (
            <div className="pt-2 text-green-400 font-semibold animate-pulse flex items-center gap-1">
              &gt; ACCESS GRANTED
              <span className="inline-block w-2 h-4 bg-green-500 animate-pulse" aria-hidden />
            </div>
          )}
          {isRedirecting && (
            <div className="pt-1 text-zinc-400 animate-pulse">
              &gt; redirecting to dashboard...
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
      {/* Sandarb branding header */}
      <div className="flex flex-col items-center gap-3 pt-8 pb-6 px-8 bg-gradient-to-b from-violet-50/80 to-transparent dark:from-violet-950/30 dark:to-transparent">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 shadow-md shadow-violet-500/20">
          <Image src="/logo.svg" alt="" width={28} height={28} />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Sandarb
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 tracking-wide uppercase">
            AI Governance
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-8 border-t border-border" />

      {/* Form content */}
      <div className="px-8 pt-6 pb-8">
        <h2 className="text-lg font-medium text-foreground text-center">
          Try the demo
        </h2>
        <p className="text-sm text-muted-foreground text-center mt-1.5 mb-6">
          Quick human check — no signup, no account, nothing stored.
        </p>

        <SignupForm from={from} onContinueClick={handleContinueClick} />

        <p className="text-[11px] text-muted-foreground text-center mt-6 flex items-center justify-center gap-2 flex-wrap">
          <span>Protected by</span>
          <a
            href="https://www.cloudflare.com/products/turnstile/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-violet-600 dark:text-violet-400 hover:underline font-medium"
            aria-label="Cloudflare Turnstile"
          >
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/b/b2/Cloudflare_Turnstile_logo.svg"
              alt=""
              width={18}
              height={18}
              className="inline-block shrink-0"
            />
            Cloudflare Turnstile
          </a>
        </p>
      </div>
    </div>
  );
}
