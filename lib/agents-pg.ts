/**
 * Postgres implementation for agents.
 */

import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, getPool } from './pg';
import type {
  RegisteredAgent,
  RegisteredAgentCreateInput,
  RegisteredAgentUpdateInput,
  AgentCard,
} from '@/types';

function parseJsonArray(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v as string[];
  try {
    const a = typeof v === 'string' ? JSON.parse(v) : v;
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

function rowToAgent(row: Record<string, unknown>): RegisteredAgent {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    agentId: row.agent_id != null ? String(row.agent_id) : null,
    name: String(row.name),
    description: row.description != null ? String(row.description) : null,
    a2aUrl: String(row.a2a_url),
    agentCard: row.agent_card != null && typeof row.agent_card === 'object' ? (row.agent_card as AgentCard) : null,
    status: (row.status as RegisteredAgent['status']) ?? 'active',
    approvalStatus: ((row.approval_status as string) || 'draft') as RegisteredAgent['approvalStatus'],
    approvedBy: row.approved_by != null ? String(row.approved_by) : null,
    approvedAt: row.approved_at != null ? String(row.approved_at) : null,
    submittedBy: row.submitted_by != null ? String(row.submitted_by) : null,
    createdBy: row.created_by != null ? String(row.created_by) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
    updatedBy: row.updated_by != null ? String(row.updated_by) : null,
    ownerTeam: row.owner_team != null ? String(row.owner_team) : null,
    toolsUsed: parseJsonArray(row.tools_used),
    allowedDataScopes: parseJsonArray(row.allowed_data_scopes),
    piiHandling: Boolean(row.pii_handling),
    regulatoryScope: parseJsonArray(row.regulatory_scope),
  };
}

export async function getAllAgentsPg(orgId?: string): Promise<RegisteredAgent[]> {
  const rows = orgId
    ? await query<Record<string, unknown>>('SELECT * FROM agents WHERE org_id = $1 ORDER BY updated_at DESC NULLS LAST, name ASC', [orgId])
    : await query<Record<string, unknown>>('SELECT * FROM agents ORDER BY updated_at DESC NULLS LAST, name ASC');
  return rows.map(rowToAgent);
}

export async function getAgentByIdPg(id: string): Promise<RegisteredAgent | null> {
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM agents WHERE id = $1', [id]);
  return row ? rowToAgent(row) : null;
}

export async function getAgentByAgentIdPg(orgId: string, agentId: string): Promise<RegisteredAgent | null> {
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM agents WHERE org_id = $1 AND agent_id = $2',
    [orgId, agentId]
  );
  return row ? rowToAgent(row) : null;
}

export async function getAgentByIdentifierPg(identifier: string): Promise<RegisteredAgent | null> {
  const trimmed = identifier?.trim();
  if (!trimmed) return null;
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM agents WHERE agent_id = $1 OR name = $1 LIMIT 1',
    [trimmed]
  );
  return row ? rowToAgent(row) : null;
}

export async function isUrlRegisteredPg(a2aUrl: string): Promise<boolean> {
  const normalized = a2aUrl.replace(/\/$/, '');
  const row = await queryOne<Record<string, unknown>>(
    'SELECT id FROM agents WHERE a2a_url = $1 OR a2a_url = $2 LIMIT 1',
    [normalized, normalized + '/']
  );
  return !!row;
}

export async function getAgentCountPg(orgId?: string): Promise<number> {
  const row = orgId
    ? await queryOne<{ count: string }>('SELECT COUNT(*)::text AS count FROM agents WHERE org_id = $1', [orgId])
    : await queryOne<{ count: string }>('SELECT COUNT(*)::text AS count FROM agents');
  return parseInt(row?.count ?? '0', 10);
}

export interface AgentStats {
  total: number;
  active: number;
  draft: number;
  pending_approval: number;
  approved: number;
  rejected: number;
}

export async function getAgentStatsPg(excludeOrgId?: string): Promise<AgentStats> {
  const where = excludeOrgId ? 'WHERE org_id != $1' : '';
  const params = excludeOrgId ? [excludeOrgId] : [];
  const totalRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM agents ${where}`,
    params.length ? params : undefined
  );
  const total = parseInt(totalRow?.count ?? '0', 10);
  const countByApproval = await query<{ approval_status: string; count: string }>(
    `SELECT COALESCE(approval_status, 'draft') AS approval_status, COUNT(*)::text AS count FROM agents ${where} GROUP BY approval_status`,
    params.length ? params : undefined
  );
  const byApproval: Record<string, number> = { draft: 0, pending_approval: 0, approved: 0, rejected: 0 };
  for (const r of countByApproval) {
    const k = (r.approval_status || 'draft') as keyof typeof byApproval;
    if (k in byApproval) byApproval[k] = parseInt(r.count, 10);
  }
  const activeWhere = excludeOrgId ? 'WHERE org_id != $1 AND status = \'active\'' : 'WHERE status = \'active\'';
  const activeRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM agents ${activeWhere}`,
    params.length ? params : undefined
  );
  return {
    total,
    active: parseInt(activeRow?.count ?? '0', 10),
    draft: byApproval.draft,
    pending_approval: byApproval.pending_approval,
    approved: byApproval.approved,
    rejected: byApproval.rejected,
  };
}

export async function getRecentAgentsPg(limit: number = 6): Promise<RegisteredAgent[]> {
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM agents ORDER BY created_at DESC LIMIT $1',
    [limit]
  );
  return rows.map(rowToAgent);
}

export async function createAgentPg(input: RegisteredAgentCreateInput): Promise<RegisteredAgent> {
  const pool = await getPool();
  if (!pool) throw new Error('Postgres not configured');
  const id = uuidv4();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO agents (id, org_id, agent_id, name, description, a2a_url, agent_card, status, approval_status, created_at, updated_at, tools_used, allowed_data_scopes, regulatory_scope)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', 'draft', $8, $8, '[]', '[]', '[]')`,
    [
      id,
      input.orgId,
      input.agentId ?? null,
      input.name,
      input.description ?? null,
      input.a2aUrl,
      input.agentCard ? JSON.stringify(input.agentCard) : null,
      now,
    ]
  );
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM agents WHERE id = $1', [id]);
  return rowToAgent(row!);
}

export async function updateAgentPg(id: string, input: RegisteredAgentUpdateInput): Promise<RegisteredAgent | null> {
  const existing = await getAgentByIdPg(id);
  if (!existing) return null;
  const pool = await getPool();
  if (!pool) return null;
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (input.name !== undefined) {
    updates.push(`name = $${i++}`);
    values.push(input.name);
  }
  if (input.description !== undefined) {
    updates.push(`description = $${i++}`);
    values.push(input.description);
  }
  if (input.a2aUrl !== undefined) {
    updates.push(`a2a_url = $${i++}`);
    values.push(input.a2aUrl);
  }
  if (input.status !== undefined) {
    updates.push(`status = $${i++}`);
    values.push(input.status);
  }
  if (input.approvalStatus !== undefined) {
    updates.push(`approval_status = $${i++}`);
    values.push(input.approvalStatus);
  }
  if (input.approvedBy !== undefined) {
    updates.push(`approved_by = $${i++}`);
    values.push(input.approvedBy);
  }
  if (input.approvedAt !== undefined) {
    updates.push(`approved_at = $${i++}`);
    values.push(input.approvedAt);
  }
  if (input.submittedBy !== undefined) {
    updates.push(`submitted_by = $${i++}`);
    values.push(input.submittedBy);
  }
  if (input.updatedBy !== undefined) {
    updates.push(`updated_by = $${i++}`);
    values.push(input.updatedBy);
  }
  if (updates.length === 0) return existing;
  updates.push(`updated_at = $${i++}`);
  values.push(new Date().toISOString());
  values.push(id);
  await pool.query(`UPDATE agents SET ${updates.join(', ')} WHERE id = $${i}`, values);
  return getAgentByIdPg(id);
}

export async function deleteAgentPg(id: string): Promise<boolean> {
  const agent = await getAgentByIdPg(id);
  if (!agent) return false;
  const pool = await getPool();
  if (!pool) return false;
  await pool.query('DELETE FROM agents WHERE id = $1', [id]);
  return true;
}
