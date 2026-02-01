/**
 * API base URL for client-side fetch calls.
 * When running UI on port 4000 and API on port 4001, set NEXT_PUBLIC_API_URL=http://localhost:4001
 * Leave unset for same-origin (single server).
 */
export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL ?? '';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? '';
}

export function apiUrl(path: string): string {
  const base = getApiBase().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}
