/**
 * API base URL for client-side fetch calls.
 * - Explicit: set NEXT_PUBLIC_API_URL to override (e.g. http://localhost:4001 or https://api.sandarb.ai).
 * - Local: when UI is on localhost/127.0.0.1, defaults to http://localhost:4001.
 * - GCP (sandarb.ai): when UI host contains "sandarb.ai", defaults to https://api.sandarb.ai.
 * - Otherwise: same-origin (empty string).
 */
export function getApiBase(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (explicit) return explicit;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:4001';
    if (host.endsWith('sandarb.ai')) return 'https://api.sandarb.ai';
  }

  return '';
}

export function apiUrl(path: string): string {
  const base = getApiBase().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}
