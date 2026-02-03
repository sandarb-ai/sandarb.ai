/**
 * Registered agents: A2A-compatible agent registry.
 * Postgres (pg) only.
 */

import * as agentsPg from './agents-pg';
import { getRootOrganization, getOrganizationBySlug, getOrganizationById } from './organizations';
import type {
  RegisteredAgent,
  RegisteredAgentCreateInput,
  RegisteredAgentUpdateInput,
  AgentCard,
  SandarbManifest,
} from '@/types';

/** Normalize regulatory_scope to string[]. */
function normalizeRegulatoryScope(v: string | string[] | undefined): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  return v.split(/[,/]+/).map((s) => s.trim()).filter(Boolean);
}

/** Normalize fetched Agent Card to A2A spec shape. */
function normalizeAgentCard(raw: Record<string, unknown>, url: string): AgentCard {
  let capabilities: AgentCard['capabilities'] = {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  };
  if (raw.capabilities && typeof raw.capabilities === 'object' && !Array.isArray(raw.capabilities)) {
    const cap = raw.capabilities as Record<string, unknown>;
    capabilities = {
      streaming: Boolean(cap.streaming),
      pushNotifications: Boolean(cap.pushNotifications),
      stateTransitionHistory: Boolean(cap.stateTransitionHistory),
    };
  }
  const skills = Array.isArray(raw.skills)
    ? (raw.skills as AgentCard['skills']).map((s) => ({
        ...s,
        tags: Array.isArray((s as { tags?: string[] }).tags) ? (s as { tags: string[] }).tags : ['general'],
      }))
    : [];
  return {
    name: (raw.name as string) || 'Unknown Agent',
    description: (raw.description as string) || '',
    url: (raw.url as string) || url,
    version: (raw.version as string) || '0.0.0',
    capabilities,
    defaultInputModes: Array.isArray(raw.defaultInputModes) ? (raw.defaultInputModes as string[]) : ['application/json', 'text/plain'],
    defaultOutputModes: Array.isArray(raw.defaultOutputModes) ? (raw.defaultOutputModes as string[]) : ['application/json', 'text/plain'],
    skills,
    authentication: raw.authentication as AgentCard['authentication'],
  };
}

export async function getAllAgents(orgId?: string, approvalStatus?: string): Promise<RegisteredAgent[]> {
  return agentsPg.getAllAgentsPg(orgId, approvalStatus);
}

export async function getAgentById(id: string): Promise<RegisteredAgent | null> {
  return agentsPg.getAgentByIdPg(id);
}

export async function getAgentByAgentId(orgId: string, agentId: string): Promise<RegisteredAgent | null> {
  return agentsPg.getAgentByAgentIdPg(orgId, agentId);
}

export async function getAgentByIdentifier(identifier: string): Promise<RegisteredAgent | null> {
  return agentsPg.getAgentByIdentifierPg(identifier);
}

export async function isUrlRegistered(a2aUrl: string): Promise<boolean> {
  return agentsPg.isUrlRegisteredPg(a2aUrl);
}

export async function getAgentsByOrg(orgId: string): Promise<RegisteredAgent[]> {
  return getAllAgents(orgId);
}

export async function getAgentCount(orgId?: string): Promise<number> {
  return agentsPg.getAgentCountPg(orgId);
}

export type AgentStats = agentsPg.AgentStats;

export async function getAgentStats(excludeOrgId?: string): Promise<AgentStats> {
  return agentsPg.getAgentStatsPg(excludeOrgId);
}

export async function getRecentAgents(limit: number = 6): Promise<RegisteredAgent[]> {
  return agentsPg.getRecentAgentsPg(limit);
}

export async function createAgent(input: RegisteredAgentCreateInput): Promise<RegisteredAgent> {
  return agentsPg.createAgentPg(input);
}

export async function updateAgent(id: string, input: RegisteredAgentUpdateInput): Promise<RegisteredAgent | null> {
  return agentsPg.updateAgentPg(id, input);
}

export async function deleteAgent(id: string): Promise<boolean> {
  return agentsPg.deleteAgentPg(id);
}

/** Approve agent registration. approvedBy must be @username. */
export async function approveAgent(id: string, approvedBy?: string): Promise<RegisteredAgent | null> {
  const agent = await getAgentById(id);
  if (!agent || agent.approvalStatus !== 'pending_approval') return null;
  const now = new Date().toISOString();
  const normalized = approvedBy != null && approvedBy !== '' ? (approvedBy.startsWith('@') ? approvedBy : `@${approvedBy}`) : null;
  return updateAgent(id, { approvalStatus: 'approved', approvedBy: normalized, approvedAt: now, updatedBy: normalized });
}

/** Reject agent registration. rejectedBy must be @username. */
export async function rejectAgent(id: string, rejectedBy?: string): Promise<RegisteredAgent | null> {
  const agent = await getAgentById(id);
  if (!agent || agent.approvalStatus !== 'pending_approval') return null;
  const now = new Date().toISOString();
  const normalized = rejectedBy != null && rejectedBy !== '' ? (rejectedBy.startsWith('@') ? rejectedBy : `@${rejectedBy}`) : null;
  return updateAgent(id, { approvalStatus: 'rejected', approvedBy: normalized, approvedAt: now, updatedBy: normalized });
}

/** Fetch Agent Card from an A2A endpoint. */
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

/** Register an agent by A2A URL: fetch Agent Card and create record. */
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

/** Protocol-based registration: agent pings Sandarb with its manifest. Upserts by (org, agent_id). */
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
