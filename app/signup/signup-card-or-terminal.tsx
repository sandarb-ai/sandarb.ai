'use client';

import { useState, useEffect, useCallback } from 'react';
import { SignupForm } from './signup-form';
import { startDemo } from './actions';

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

  useEffect(() => {
    setIsLocalhost(isLocalhostHost());
  }, []);

  const useTurnstile = Boolean(SITE_KEY) && !isLocalhost;

  const handleContinueClick = useCallback(() => {
    setView('terminal');
  }, []);

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
    if (!accessGranted || !useTurnstile) return;
    const t = setTimeout(() => {
      setVerifiedSession();
      const fd = new FormData();
      if (from) fd.set('from', from);
      startDemo(fd);
    }, 1000);
    return () => clearTimeout(t);
  }, [accessGranted, from, useTurnstile]);

  // Bypass (no key or localhost): boot lines then countdown
  useEffect(() => {
    if (view !== 'terminal' || useTurnstile) return;
    if (bypassBootIndex < BOOT_LINES.length) {
      const t = setTimeout(() => setBypassBootIndex((i) => i + 1), 400);
      return () => clearTimeout(t);
    }
    if (bypassCountdown === null) setBypassCountdown(3);
  }, [view, useTurnstile, bypassBootIndex, bypassCountdown]);

  // Bypass countdown hit 0: set session, call server action to set cookies + redirect; fallback client redirect if server redirect doesn't apply (e.g. in some production setups)
  useEffect(() => {
    if (bypassCountdown === null || bypassCountdown > 0) return;
    setVerifiedSession();
    const fd = new FormData();
    if (from) fd.set('from', from);
    const targetPath =
      (typeof from === 'string' && from.trim().startsWith('/')
        ? from.trim()
        : '/dashboard');
    startDemo(fd);
    const fallback = setTimeout(() => {
      window.location.href = targetPath;
    }, 2000);
    return () => clearTimeout(fallback);
  }, [bypassCountdown, from]);

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
              <div className="text-amber-500 animate-pulse">
                &gt; WARN: NO_API_KEY_FOUND. BYPASSING...
              </div>
              <div className="text-zinc-500">
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
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-border bg-card shadow-lg p-8">
      <h1 className="text-2xl font-semibold text-foreground text-center tracking-tight">
        Try the demo
      </h1>
      <p className="text-sm text-muted-foreground text-center mt-2 mb-8">
        We use Cloudflare Turnstile to make sure only humans try the demo. No signup, no account, nothing stored.
      </p>

      <SignupForm from={from} onContinueClick={handleContinueClick} />

      <p className="text-[11px] text-muted-foreground text-center mt-6 flex items-center justify-center gap-2 flex-wrap">
        <span>Human verification by</span>
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
            width={20}
            height={20}
            className="inline-block shrink-0"
          />
          Cloudflare Turnstile
        </a>
      </p>
    </div>
  );
}
