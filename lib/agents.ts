/**
 * Registered agents: A2A-compatible agent registry.
 * When DATABASE_URL is set uses Postgres (agents-pg); else SQLite.
 */

import { v4 as uuidv4 } from 'uuid';
import db, { rowToAgent } from './db';
import { usePg } from './pg';
import * as agentsPg from './agents-pg';
import { getRootOrganization, getOrganizationBySlug, getOrganizationById } from './organizations';
import type {
  RegisteredAgent,
  RegisteredAgentCreateInput,
  RegisteredAgentUpdateInput,
  AgentCard,
  SandarbManifest,
} from '@/types';

export async function getAllAgents(orgId?: string): Promise<RegisteredAgent[]> {
  if (usePg()) return agentsPg.getAllAgentsPg(orgId);
  const rows = orgId
    ? db.prepare('SELECT * FROM agents WHERE org_id = ? ORDER BY name ASC').all(orgId)
    : db.prepare('SELECT * FROM agents ORDER BY name ASC').all();
  return (rows as Record<string, unknown>[]).map((r) => rowToAgent(r));
}

export async function getAgentById(id: string): Promise<RegisteredAgent | null> {
  if (usePg()) return agentsPg.getAgentByIdPg(id);
  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  return row ? rowToAgent(row as Record<string, unknown>) : null;
}

export async function getAgentByAgentId(orgId: string, agentId: string): Promise<RegisteredAgent | null> {
  if (usePg()) return agentsPg.getAgentByAgentIdPg(orgId, agentId);
  const row = db.prepare('SELECT * FROM agents WHERE org_id = ? AND agent_id = ?').get(orgId, agentId);
  return row ? rowToAgent(row as Record<string, unknown>) : null;
}

export async function getAgentByIdentifier(identifier: string): Promise<RegisteredAgent | null> {
  if (usePg()) return agentsPg.getAgentByIdentifierPg(identifier);
  const trimmed = identifier?.trim();
  if (!trimmed) return null;
  const row = db.prepare('SELECT * FROM agents WHERE agent_id = ? OR name = ? LIMIT 1').get(trimmed, trimmed);
  return row ? rowToAgent(row as Record<string, unknown>) : null;
}

export async function isUrlRegistered(a2aUrl: string): Promise<boolean> {
  if (usePg()) return agentsPg.isUrlRegisteredPg(a2aUrl);
  const normalized = a2aUrl.replace(/\/$/, '');
  const row = db.prepare('SELECT id FROM agents WHERE a2a_url = ? OR a2a_url = ? LIMIT 1').get(normalized, normalized + '/');
  return !!row;
}

export async function getAgentsByOrg(orgId: string): Promise<RegisteredAgent[]> {
  return getAllAgents(orgId);
}

export async function getAgentCount(orgId?: string): Promise<number> {
  if (usePg()) return agentsPg.getAgentCountPg(orgId);
  const row = orgId
    ? db.prepare('SELECT COUNT(*) as count FROM agents WHERE org_id = ?').get(orgId)
    : db.prepare('SELECT COUNT(*) as count FROM agents').get();
  return (row as { count: number })?.count ?? 0;
}

export async function createAgent(input: RegisteredAgentCreateInput): Promise<RegisteredAgent> {
  if (usePg()) return agentsPg.createAgentPg(input);
  const id = uuidv4();
  const now = new Date().toISOString();
  const agentCardJson = input.agentCard ? JSON.stringify(input.agentCard) : null;
  const toolsUsed = JSON.stringify(input.toolsUsed ?? []);
  const allowedDataScopes = JSON.stringify(input.allowedDataScopes ?? []);
  const regulatoryScope = JSON.stringify(input.regulatoryScope ?? []);

  db.prepare(
    `INSERT INTO agents (id, org_id, agent_id, name, description, a2a_url, agent_card, status, approval_status, created_by, created_at, updated_at, owner_team, tools_used, allowed_data_scopes, pii_handling, regulatory_scope)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'pending_approval', ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.orgId,
    input.agentId ?? null,
    input.name,
    input.description ?? null,
    input.a2aUrl,
    agentCardJson,
    (input as { createdBy?: string }).createdBy ?? null,
    now,
    now,
    input.ownerTeam ?? null,
    toolsUsed,
    allowedDataScopes,
    input.piiHandling ? 1 : 0,
    regulatoryScope
  );

  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as Record<string, unknown>;
  return rowToAgent(row);
}

export async function updateAgent(id: string, input: RegisteredAgentUpdateInput): Promise<RegisteredAgent | null> {
  if (usePg()) return agentsPg.updateAgentPg(id, input);
  const agent = await getAgentById(id);
  if (!agent) return null;

  const updates: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    values.push(input.name);
  }
  if (input.description !== undefined) {
    updates.push('description = ?');
    values.push(input.description);
  }
  if (input.a2aUrl !== undefined) {
    updates.push('a2a_url = ?');
    values.push(input.a2aUrl);
  }
  if (input.agentCard !== undefined) {
    updates.push('agent_card = ?');
    values.push(input.agentCard ? JSON.stringify(input.agentCard) : null);
  }
  if (input.status !== undefined) {
    updates.push('status = ?');
    values.push(input.status);
  }
  if (input.approvalStatus !== undefined) {
    updates.push('approval_status = ?');
    values.push(input.approvalStatus);
  }
  if (input.approvedBy !== undefined) {
    updates.push('approved_by = ?');
    values.push(input.approvedBy);
  }
  if (input.approvedAt !== undefined) {
    updates.push('approved_at = ?');
    values.push(input.approvedAt);
  }
  if (input.ownerTeam !== undefined) {
    updates.push('owner_team = ?');
    values.push(input.ownerTeam);
  }
  if (input.toolsUsed !== undefined) {
    updates.push('tools_used = ?');
    values.push(JSON.stringify(input.toolsUsed));
  }
  if (input.allowedDataScopes !== undefined) {
    updates.push('allowed_data_scopes = ?');
    values.push(JSON.stringify(input.allowedDataScopes));
  }
  if (input.piiHandling !== undefined) {
    updates.push('pii_handling = ?');
    values.push(input.piiHandling ? 1 : 0);
  }
  if (input.regulatoryScope !== undefined) {
    updates.push('regulatory_scope = ?');
    values.push(JSON.stringify(input.regulatoryScope));
  }

  if (updates.length === 0) return agent;

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.prepare(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return getAgentById(id);
}

export async function deleteAgent(id: string): Promise<boolean> {
  if (usePg()) return agentsPg.deleteAgentPg(id);
  const agent = await getAgentById(id);
  if (!agent) return false;
  db.prepare('DELETE FROM agents WHERE id = ?').run(id);
  return true;
}

/** Approve agent registration. */
export async function approveAgent(id: string, approvedBy?: string): Promise<RegisteredAgent | null> {
  const agent = await getAgentById(id);
  if (!agent || agent.approvalStatus !== 'pending_approval') return null;
  const now = new Date().toISOString();
  return updateAgent(id, { approvalStatus: 'approved', approvedBy: approvedBy ?? null, approvedAt: now });
}

/** Reject agent registration. */
export async function rejectAgent(id: string, rejectedBy?: string): Promise<RegisteredAgent | null> {
  const agent = await getAgentById(id);
  if (!agent || agent.approvalStatus !== 'pending_approval') return null;
  return updateAgent(id, { approvalStatus: 'rejected', approvedBy: rejectedBy ?? null, approvedAt: new Date().toISOString() });
}

/**
 * Fetch Agent Card from an A2A endpoint.
 * Tries url first, then url/.well-known/agent.json if url does not return JSON with "skills".
 */
export async function fetchAgentCardFromUrl(baseUrl: string): Promise<AgentCard> {
  const url = baseUrl.replace(/\/$/, '');
  const candidates = [
    url,
    `${url}/.well-known/agent.json`,
    `${url}/api/a2a`,
    `${url}/a2a`,
  ];

  let lastError: Error | null = null;
  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && typeof data === 'object' && (data.skills || data.name)) {
        return normalizeAgentCard(data, candidate.startsWith(url) && !candidate.endsWith('.json') ? candidate : url);
      }
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError || new Error('Could not fetch Agent Card from any candidate URL');
}

function normalizeAgentCard(raw: Record<string, unknown>, url: string): AgentCard {
  let capabilities: AgentCard['capabilities'] = [];
  if (Array.isArray(raw.capabilities)) {
    capabilities = raw.capabilities as AgentCard['capabilities'];
  } else if (raw.capabilities && typeof raw.capabilities === 'object') {
    const cap = raw.capabilities as Record<string, unknown>;
    if (cap.streaming) capabilities.push({ name: 'streaming', description: 'SSE streaming', streaming: true });
    if (cap.pushNotifications) capabilities.push({ name: 'pushNotifications', description: 'Push notifications', streaming: false });
  }
  return {
    name: (raw.name as string) || 'Unknown Agent',
    description: (raw.description as string) || '',
    url: (raw.url as string) || url,
    version: (raw.version as string) || '0.0.0',
    capabilities,
    skills: Array.isArray(raw.skills) ? (raw.skills as AgentCard['skills']) : [],
    authentication: raw.authentication as AgentCard['authentication'],
  };
}

/**
 * Register an agent by A2A URL: fetch Agent Card and create record.
 */
export async function registerAgentByUrl(
  orgId: string,
  a2aUrl: string,
  overrides?: { name?: string; description?: string }
): Promise<RegisteredAgent> {
  const agentCard = await fetchAgentCardFromUrl(a2aUrl);
  return createAgent({
    orgId,
    name: overrides?.name ?? agentCard.name,
    description: overrides?.description ?? agentCard.description,
    a2aUrl: agentCard.url || a2aUrl,
    agentCard,
  });
}

/** Normalize regulatory_scope to string[]. */
function normalizeRegulatoryScope(v: string | string[] | undefined): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  return v.split(/[,/]+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Protocol-based registration: agent pings Sandarb with its manifest (sandarb.json / Agent Card).
 * Upserts by (org, agent_id). Resolves org from manifest.owner_team (slug) or options.orgId, else root.
 * New or updated agents enter pending_approval; governance can approve/reject.
 */
export async function registerByManifest(
  manifest: SandarbManifest,
  options?: { orgId?: string }
): Promise<RegisteredAgent> {
  const org = options?.orgId
    ? await getOrganizationById(options.orgId)
    : (await getOrganizationBySlug(manifest.owner_team)) ?? (await getRootOrganization());
  if (!org) throw new Error('No organization found; create a root org or pass orgId.');

  const agentId = manifest.agent_id;
  const existing = await getAgentByAgentId(org.id, agentId);

  const name = manifest.name ?? manifest.agent_id;
  const description = manifest.description ?? null;
  const url = manifest.url.replace(/\/$/, '');
  const toolsUsed = manifest.tools_used ?? [];
  const allowedDataScopes = manifest.allowed_data_scopes ?? [];
  const piiHandling = manifest.pii_handling ?? false;
  const regulatoryScope = normalizeRegulatoryScope(manifest.regulatory_scope);

  let agentCard: AgentCard | null = manifest.agent_card ?? null;
  if (!agentCard) {
    try {
      agentCard = await fetchAgentCardFromUrl(url);
    } catch {
      // Optional: keep agent_card null if endpoint not reachable at ping time
    }
  }

  if (existing) {
    const updated = await updateAgent(existing.id, {
      name,
      description: description ?? undefined,
      a2aUrl: url,
      agentCard,
      ownerTeam: manifest.owner_team,
      toolsUsed,
      allowedDataScopes,
      piiHandling,
      regulatoryScope,
    });
    return updated!;
  }

  return createAgent({
    orgId: org.id,
    agentId,
    name,
    description: description ?? undefined,
    a2aUrl: url,
    agentCard,
    ownerTeam: manifest.owner_team,
    toolsUsed,
    allowedDataScopes,
    piiHandling,
    regulatoryScope,
  });
}
