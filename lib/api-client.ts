/**
 * API client: fetch from backend (FastAPI). Used by Server Components and client components.
 * Set NEXT_PUBLIC_API_URL to the FastAPI backend (e.g. http://localhost:8000).
 */

import { apiUrl } from './api';

async function fetchApi<T>(path: string, init?: RequestInit): Promise<{ success: boolean; data?: T; error?: string }> {
  const url = apiUrl(path);
  const res = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: (json as { detail?: string }).detail ?? json?.error ?? res.statusText };
  }
  return json as { success: boolean; data?: T; error?: string };
}

// Dashboard
export async function getDashboard() {
  const r = await fetchApi<Record<string, unknown>>('/api/dashboard');
  return r.success ? r.data : null;
}

// Agents
export async function getAgents(orgId?: string, approvalStatus?: string) {
  const q = new URLSearchParams();
  if (orgId) q.set('org_id', orgId);
  if (approvalStatus) q.set('approval_status', approvalStatus);
  const path = '/api/agents' + (q.toString() ? `?${q}` : '');
  const r = await fetchApi<unknown[]>(path);
  return r.success && Array.isArray(r.data) ? r.data : [];
}

export async function getAgentById(id: string) {
  const r = await fetchApi<unknown>(`/api/agents/${id}`);
  return r.success ? r.data : null;
}

export async function getAgentStats(orgId?: string): Promise<{ total: number; active: number; draft: number; pending_approval: number; approved: number; rejected: number }> {
  const agents = await getAgents(orgId);
  const total = agents.length;
  const byStatus = agents.reduce(
    (acc, a: Record<string, unknown>) => {
      const s = (a.approvalStatus as string) || 'draft';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const active = agents.filter((a: Record<string, unknown>) => a.status === 'active').length;
  return {
    total,
    active,
    draft: byStatus.draft ?? 0,
    pending_approval: byStatus.pending_approval ?? 0,
    approved: byStatus.approved ?? 0,
    rejected: byStatus.rejected ?? 0,
  };
}

// Organizations
export async function getOrganizations(tree?: boolean, root?: boolean) {
  const q = new URLSearchParams();
  if (tree) q.set('tree', 'true');
  if (root) q.set('root', 'true');
  const path = '/api/organizations' + (q.toString() ? `?${q}` : '');
  const r = await fetchApi<unknown>(path);
  return r.success ? r.data : (tree || root ? null : []);
}

export async function getRootOrganization() {
  const data = await getOrganizations(false, true);
  return data ?? null;
}

export async function getOrganizationById(id: string) {
  const r = await fetchApi<unknown>(`/api/organizations/${id}`);
  return r.success ? r.data : null;
}

export async function getChildOrganizations(parentId: string) {
  const all = (await getOrganizations()) as Array<{ parentId?: string; id?: string }> | null;
  if (!all || !Array.isArray(all)) return [];
  return all.filter((o) => o.parentId === parentId);
}

// Contexts
export async function getContextsPaginated(limit: number, offset: number) {
  const r = await fetchApi<{ contexts: unknown[]; total: number }>(
    `/api/contexts?limit=${limit}&offset=${offset}`
  );
  return r.success && r.data ? { contexts: r.data.contexts, total: r.data.total } : { contexts: [], total: 0 };
}

// Prompts
export async function getPrompts() {
  const r = await fetchApi<unknown[]>('/api/prompts');
  const raw = r.success && Array.isArray(r.data) ? r.data : [];
  return normalizePromptList(raw);
}

/** Normalize API response to Prompt[] (accept snake_case or camelCase from backend). */
function normalizePromptList(raw: unknown[]): import('@/types').Prompt[] {
  return raw.map((item) => {
    const o = item as Record<string, unknown>;
    const str = (v: unknown) => (v == null ? undefined : String(v));
    const tagsRaw = o.tags;
    const tagList = Array.isArray(tagsRaw) ? tagsRaw.map((x) => String(x)) : (typeof tagsRaw === 'string' ? (() => { try { const p = JSON.parse(tagsRaw); return Array.isArray(p) ? p.map(String) : []; } catch { return []; } })() : []);
    return {
      id: str(o.id) ?? '',
      name: str(o.name) ?? '',
      description: o.description != null ? str(o.description) : null,
      currentVersionId: (o.currentVersionId ?? o.current_version_id) != null ? str(o.currentVersionId ?? o.current_version_id) : null,
      projectId: (o.projectId ?? o.project_id) != null ? str(o.projectId ?? o.project_id) : null,
      tags: tagList,
      createdBy: (o.createdBy ?? o.created_by) != null ? str(o.createdBy ?? o.created_by) : null,
      createdAt: str(o.createdAt ?? o.created_at) ?? '',
      updatedAt: str(o.updatedAt ?? o.updated_at) ?? '',
      updatedBy: (o.updatedBy ?? o.updated_by) != null ? str(o.updatedBy ?? o.updated_by) : null,
      agents: (o.agents as import('@/types').LinkedAgent[] | undefined) ?? [],
    };
  });
}

// Templates
export async function getTemplates() {
  const r = await fetchApi<unknown[]>('/api/templates');
  return r.success && Array.isArray(r.data) ? r.data : [];
}

// Settings
export async function getSettings(): Promise<Record<string, string>> {
  const r = await fetchApi<Record<string, string>>('/api/settings');
  return r.success && r.data ? r.data : {};
}

// Audit / Agent pulse
export async function getBlockedInjections(limit = 50) {
  const r = await fetchApi<unknown[]>(`/api/governance/blocked-injections?limit=${limit}`);
  return r.success && Array.isArray(r.data) ? r.data : [];
}

export async function getA2ALog(limit = 200) {
  const r = await fetchApi<unknown[]>(`/api/agent-pulse/log?limit=${limit}`);
  return r.success && Array.isArray(r.data) ? r.data : [];
}

export async function getUnauthenticatedDetections(limit = 50) {
  const r = await fetchApi<unknown[]>(`/api/governance/unauthenticated-agents?limit=${limit}`);
  return r.success && Array.isArray(r.data) ? r.data : [];
}

// Agent count (for dashboard)
export async function getAgentCount(orgId?: string): Promise<number> {
  const agents = await getAgents(orgId);
  return agents.length;
}

export async function getRecentAgents(limit = 6) {
  const r = await fetchApi<unknown[]>(`/api/agents?limit=${limit}`);
  return r.success && Array.isArray(r.data) ? r.data.slice(0, limit) : [];
}

export async function getRecentOrganizationsWithCounts(limit = 6) {
  const d = await getDashboard();
  const recentOrgs = (d?.recentOrgs as unknown[]) ?? [];
  return recentOrgs.slice(0, limit);
}

export async function getRecentPrompts(limit = 6) {
  const d = await getDashboard();
  const recentPrompts = (d?.recentPrompts as unknown[]) ?? [];
  return recentPrompts.slice(0, limit);
}

export async function getContextCount(): Promise<{ total: number; active: number }> {
  const d = await getDashboard();
  const ctx = d?.contextStats as { total?: number; active?: number } | undefined;
  return ctx ? { total: ctx.total ?? 0, active: ctx.active ?? 0 } : { total: 0, active: 0 };
}

export async function getPromptStats(): Promise<{ total: number; active: number }> {
  const d = await getDashboard();
  const ps = d?.promptStats as { total?: number; active?: number } | undefined;
  return ps ? { total: ps.total ?? 0, active: ps.active ?? 0 } : { total: 0, active: 0 };
}

export async function getTemplateCount(): Promise<number> {
  const d = await getDashboard();
  return (d?.templateCount as number) ?? 0;
}
