/**
 * API base URL for fetch calls (Dashboard API: prompts, contexts, agents, etc.).
 * Next.js UI talks to FastAPI backend; without a base URL, SSR fetch would 404 (no Next.js API routes).
 *
 * Configuration priority:
 * 1. NEXT_PUBLIC_API_URL: explicit override (client + server when set at build)
 * 2. NEXT_PUBLIC_DOMAIN + NEXT_PUBLIC_API_SUBDOMAIN: enterprise deployment (e.g., governance.company.com)
 * 3. Smart hostname detection for known patterns (sandarb.ai, Cloud Run, localhost)
 * 4. Server-side: BACKEND_URL fallback
 *
 * Enterprise deployment example:
 *   NEXT_PUBLIC_DOMAIN=governance.company.com
 *   NEXT_PUBLIC_API_SUBDOMAIN=api
 *   -> https://api.governance.company.com
 */
export function getApiBase(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (explicit) return explicit;

  // Enterprise deployment: configurable domain + subdomain
  const domain = process.env.NEXT_PUBLIC_DOMAIN?.trim();
  const apiSubdomain = process.env.NEXT_PUBLIC_API_SUBDOMAIN?.trim() || 'api';
  if (domain) {
    const protocol = domain.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${apiSubdomain}.${domain}`;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const protocol = window.location.protocol;

    // Local development
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8000';

    // Default sandarb.ai deployment
    if (host.endsWith('sandarb.ai')) return 'https://api.sandarb.ai';

    // Cloud Run URL (sandarb-ui-xxx.run.app): use sandarb-api-xxx.run.app so /api/* hits the backend
    if (host.includes('run.app') && host.startsWith('sandarb-ui')) {
      const apiHost = host.replace(/^sandarb-ui/, 'sandarb-api');
      return `${protocol}//${apiHost}`;
    }

    // Generic subdomain detection: ui.X -> api.X
    if (host.startsWith('ui.')) {
      const apiHost = host.replace(/^ui\./, 'api.');
      return `${protocol}//${apiHost}`;
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
 *
 * Configuration priority:
 * 1. NEXT_PUBLIC_AGENT_URL: explicit override
 * 2. NEXT_PUBLIC_DOMAIN + NEXT_PUBLIC_AGENT_SUBDOMAIN: enterprise deployment
 * 3. Smart hostname detection for known patterns
 * 4. Fallback to API base URL
 *
 * Enterprise deployment example:
 *   NEXT_PUBLIC_DOMAIN=governance.company.com
 *   NEXT_PUBLIC_AGENT_SUBDOMAIN=agent
 *   -> https://agent.governance.company.com
 */
export function getAgentBase(): string {
  const explicit = process.env.NEXT_PUBLIC_AGENT_URL?.trim();
  if (explicit) return explicit;

  // Enterprise deployment: configurable domain + subdomain
  const domain = process.env.NEXT_PUBLIC_DOMAIN?.trim();
  const agentSubdomain = process.env.NEXT_PUBLIC_AGENT_SUBDOMAIN?.trim() || 'agent';
  if (domain) {
    const protocol = domain.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${agentSubdomain}.${domain}`;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const protocol = window.location.protocol;

    // Local development
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8000';

    // Default sandarb.ai deployment
    if (host.endsWith('sandarb.ai')) return 'https://agent.sandarb.ai';

    // Cloud Run URL (sandarb-ui-xxx.run.app): use sandarb-agent-xxx.run.app
    if (host.includes('run.app') && host.startsWith('sandarb-ui')) {
      const agentHost = host.replace(/^sandarb-ui/, 'sandarb-agent');
      return `${protocol}//${agentHost}`;
    }

    // Generic subdomain detection: ui.X -> agent.X
    if (host.startsWith('ui.')) {
      const agentHost = host.replace(/^ui\./, 'agent.');
      return `${protocol}//${agentHost}`;
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

const WRITE_JWT_COOKIE_NAME = 'sandarb_write_jwt';

/**
 * Headers to send on write requests (POST/PUT/PATCH/DELETE) so backend can allow only WRITE_ALLOWED_EMAILS.
 * Call only from client (reads document.cookie). Returns {} if no token.
 */
export function getWriteAuthHeaders(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  const match = document.cookie.match(new RegExp(`(?:^|; )${WRITE_JWT_COOKIE_NAME}=([^;]*)`));
  const token = match ? decodeURIComponent(match[1]) : '';
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
