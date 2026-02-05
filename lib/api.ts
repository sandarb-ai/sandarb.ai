/**
 * API base URL for fetch calls (Dashboard API: prompts, contexts, agents, etc.).
 * Next.js UI talks to FastAPI backend; without a base URL, SSR fetch would 404 (no Next.js API routes).
 * - NEXT_PUBLIC_API_URL: explicit override (client + server when set at build).
 * - Client (localhost): defaults to http://localhost:8000.
 * - Client (sandarb.ai): defaults to https://api.sandarb.ai.
 * - Server: BACKEND_URL or NEXT_PUBLIC_API_URL; in development fallback to http://localhost:8000 so SSR shows loaded data.
 */
export function getApiBase(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (explicit) return explicit;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8000';
    if (host.endsWith('sandarb.ai')) return 'https://api.sandarb.ai';
    // Cloud Run URL (sandarb-ui-xxx.run.app): use sandarb-api-xxx.run.app so /api/* hits the backend
    if (host.includes('run.app') && host.startsWith('sandarb-ui')) {
      const apiHost = host.replace(/^sandarb-ui/, 'sandarb-api');
      return `${window.location.protocol}//${apiHost}`;
    }
  } else {
    // Server-side (SSR): use BACKEND_URL or NEXT_PUBLIC_API_URL so dashboard hits FastAPI/Postgres
    const serverBackend = process.env.BACKEND_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
    if (serverBackend) return serverBackend;
    // In development, default to FastAPI so Agent/Prompt/Context lists show loaded data without .env
    if (process.env.NODE_ENV === 'development') return 'http://localhost:8000';
  }

  return '';
}

/**
 * Agent base URL (A2A endpoint). When running locally, same as API (single backend on :8000).
 * - NEXT_PUBLIC_AGENT_URL: explicit override.
 * - Local: defaults to http://localhost:8000.
 * - GCP: defaults to https://agent.sandarb.ai.
 */
export function getAgentBase(): string {
  const explicit = process.env.NEXT_PUBLIC_AGENT_URL?.trim();
  if (explicit) return explicit;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8000';
    if (host.endsWith('sandarb.ai')) return 'https://agent.sandarb.ai';
    if (host.includes('run.app') && host.startsWith('sandarb-ui')) {
      const agentHost = host.replace(/^sandarb-ui/, 'sandarb-agent');
      return `${window.location.protocol}//${agentHost}`;
    }
  }

  return getApiBase() || '';
}

export function apiUrl(path: string): string {
  const base = getApiBase().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

/** Build full URL for agent (A2A) requests. Use when calling the agent subdomain. */
export function agentUrl(path: string): string {
  const base = getAgentBase().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}
