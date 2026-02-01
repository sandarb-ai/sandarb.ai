/**
 * Postgres audit: sandarb_access_logs (log_id, agent_id, trace_id, version_id, request_ip, metadata).
 * action_type, context_id, context_name etc. stored in metadata JSONB.
 */

import { getPool, query } from './pg';
import type { BlockedInjectionEntry, LineageEntry } from './audit';

interface ContextDeliveryInputPg {
  sourceAgent: string | null;
  contextId: string;
  contextName: string;
  intent?: string;
  agentId?: string | null;
  traceId?: string | null;
  versionId?: string | null;
}

export async function logContextDeliveryPg(input: ContextDeliveryInputPg, versionId?: string | null): Promise<void> {
  const pool = await getPool();
  if (!pool) return;
  const traceId = input.traceId ?? 'unknown';
  const agentId = input.agentId ?? input.sourceAgent ?? 'unknown';
  const metadata = {
    action_type: 'INJECT_SUCCESS',
    context_id: input.contextId,
    contextName: input.contextName,
    intent: input.intent ?? null,
    sourceAgent: input.sourceAgent ?? null,
  };
  await pool.query(
    `INSERT INTO sandarb_access_logs (agent_id, trace_id, version_id, metadata)
     VALUES ($1, $2, $3, $4)`,
    [agentId, traceId, versionId ?? null, JSON.stringify(metadata)]
  );
}

export async function logBlockedInjectionPg(input: {
  agentId: string;
  traceId?: string | null;
  contextId: string;
  contextName: string;
  reason: string;
}): Promise<void> {
  const pool = await getPool();
  if (!pool) return;
  const traceId = input.traceId ?? 'unknown';
  const metadata = {
    action_type: 'INJECT_DENIED',
    context_id: input.contextId,
    contextName: input.contextName,
    reason: input.reason,
  };
  await pool.query(
    `INSERT INTO sandarb_access_logs (agent_id, trace_id, metadata)
     VALUES ($1, $2, $3)`,
    [input.agentId, traceId, JSON.stringify(metadata)]
  );
}

export async function getBlockedInjectionsPg(limit: number = 50): Promise<BlockedInjectionEntry[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT log_id AS id, accessed_at AS created_at,
            metadata->>'context_id' AS resource_id,
            metadata->>'contextName' AS resource_name,
            agent_id AS created_by,
            metadata AS details
     FROM sandarb_access_logs
     WHERE metadata->>'action_type' = 'INJECT_DENIED'
     ORDER BY accessed_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((r) => {
    const details = (typeof r.details === 'object' && r.details ? r.details : {}) as Record<string, unknown>;
    return {
      id: String(r.id),
      resourceId: r.resource_id != null ? String(r.resource_id) : null,
      resourceName: (r.resource_name as string) ?? (details.contextName as string) ?? '',
      createdBy: r.created_by != null ? String(r.created_by) : null,
      details: { reason: details.reason, agentId: r.created_by, traceId: details.traceId } as { agentId?: string; traceId?: string; reason?: string },
      createdAt: String(r.created_at),
    };
  });
}

export async function getLineagePg(limit: number = 50): Promise<LineageEntry[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT log_id AS id, agent_id, trace_id, metadata->>'context_id' AS context_id, version_id, accessed_at, metadata
     FROM sandarb_access_logs
     WHERE metadata->>'action_type' = 'INJECT_SUCCESS'
     ORDER BY accessed_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((r) => {
    const metadata = (typeof r.metadata === 'object' && r.metadata ? r.metadata : {}) as Record<string, unknown>;
    return {
      id: String(r.id),
      type: 'context_delivered',
      resourceType: 'context',
      resourceId: r.context_id != null ? String(r.context_id) : null,
      resourceName: (metadata.contextName as string) ?? '',
      sourceAgent: r.agent_id != null ? String(r.agent_id) : null,
      details: {
        intent: metadata.intent as string,
        sourceAgent: metadata.sourceAgent as string,
        agentId: r.agent_id as string,
        traceId: r.trace_id as string,
      },
      createdAt: String(r.accessed_at),
    };
  });
}

/** Unified A2A log: all agent ↔ Sandarb communication (INJECT_SUCCESS + INJECT_DENIED) for Slack-like chat UI */
export interface A2ALogEntry {
  id: string;
  agentId: string;
  traceId: string;
  accessedAt: string;
  actionType: 'INJECT_SUCCESS' | 'INJECT_DENIED';
  contextName: string;
  contextId: string | null;
  reason?: string;
  intent?: string | null;
}

export async function getA2ALogPg(limit: number = 200): Promise<A2ALogEntry[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT log_id AS id, agent_id, trace_id, accessed_at,
            metadata->>'action_type' AS action_type,
            metadata->>'context_id' AS context_id,
            metadata->>'contextName' AS context_name,
            metadata->>'reason' AS reason,
            metadata->>'intent' AS intent
     FROM sandarb_access_logs
     WHERE metadata->>'action_type' IN ('INJECT_SUCCESS', 'INJECT_DENIED')
     ORDER BY accessed_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({
    id: String(r.id),
    agentId: String(r.agent_id ?? ''),
    traceId: String(r.trace_id ?? ''),
    accessedAt: String(r.accessed_at),
    actionType: (r.action_type === 'INJECT_DENIED' ? 'INJECT_DENIED' : 'INJECT_SUCCESS') as 'INJECT_SUCCESS' | 'INJECT_DENIED',
    contextName: String(r.context_name ?? ''),
    contextId: r.context_id != null ? String(r.context_id) : null,
    reason: r.reason != null ? String(r.reason) : undefined,
    intent: r.intent != null ? String(r.intent) : null,
  }));
}
