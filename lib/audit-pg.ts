/**
 * Postgres audit: sandarb_access_logs (log_id, agent_id, trace_id, context_id, version_id, prompt_id, prompt_version_id, request_ip, metadata).
 * Enables full governance intersection tracking: "Agent X used Prompt v4.2 and accessed Context Chunk #992"
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
    contextName: input.contextName,
    intent: input.intent ?? null,
    sourceAgent: input.sourceAgent ?? null,
  };
  // Use proper column for context_id instead of just metadata
  await pool.query(
    `INSERT INTO sandarb_access_logs (agent_id, trace_id, context_id, version_id, metadata)
     VALUES ($1, $2, $3::uuid, $4, $5)`,
    [agentId, traceId, input.contextId, versionId ?? null, JSON.stringify(metadata)]
  );
}

/** Log prompt usage for governance tracking. */
export interface PromptUsageInputPg {
  agentId: string;
  traceId: string;
  promptId: string;
  promptVersionId: string;
  promptName: string;
  intent?: string;
}

export async function logPromptUsagePg(input: PromptUsageInputPg): Promise<void> {
  const pool = await getPool();
  if (!pool) return;
  const metadata = {
    action_type: 'PROMPT_USED',
    promptName: input.promptName,
    intent: input.intent ?? null,
  };
  await pool.query(
    `INSERT INTO sandarb_access_logs (agent_id, trace_id, prompt_id, prompt_version_id, metadata)
     VALUES ($1, $2, $3::uuid, $4::uuid, $5)`,
    [input.agentId, input.traceId, input.promptId, input.promptVersionId, JSON.stringify(metadata)]
  );
}

/** Log combined prompt + context usage for full governance intersection. */
export interface GovernanceIntersectionInputPg {
  agentId: string;
  traceId: string;
  contextId?: string | null;
  contextVersionId?: string | null;
  contextName?: string;
  promptId?: string | null;
  promptVersionId?: string | null;
  promptName?: string;
  intent?: string;
  requestIp?: string;
}

export async function logGovernanceIntersectionPg(input: GovernanceIntersectionInputPg): Promise<void> {
  const pool = await getPool();
  if (!pool) return;
  const metadata = {
    action_type: 'INFERENCE_EVENT',
    contextName: input.contextName ?? null,
    promptName: input.promptName ?? null,
    intent: input.intent ?? null,
  };
  await pool.query(
    `INSERT INTO sandarb_access_logs (agent_id, trace_id, context_id, version_id, prompt_id, prompt_version_id, request_ip, metadata)
     VALUES ($1, $2, $3::uuid, $4::uuid, $5::uuid, $6::uuid, $7, $8)`,
    [
      input.agentId,
      input.traceId,
      input.contextId ?? null,
      input.contextVersionId ?? null,
      input.promptId ?? null,
      input.promptVersionId ?? null,
      input.requestIp ?? null,
      JSON.stringify(metadata),
    ]
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

/** Input for logging an A2A JSON-RPC call (all agent ↔ Sandarb conversations). */
export interface A2ACallLogInputPg {
  agentId: string;
  traceId: string;
  method: string;
  inputSummary?: string | null;
  resultSummary?: string | null;
  error?: string | null;
  requestIp?: string | null;
}

/** Log every A2A conversation (JSON-RPC method + params summary + result/error) for visibility. */
export async function logA2ACallPg(input: A2ACallLogInputPg): Promise<void> {
  const pool = await getPool();
  if (!pool) return;
  const metadata = {
    action_type: 'A2A_CALL',
    method: input.method,
    inputSummary: input.inputSummary ?? null,
    resultSummary: input.resultSummary ?? null,
    error: input.error ?? null,
  };
  await pool.query(
    `INSERT INTO sandarb_access_logs (agent_id, trace_id, request_ip, metadata)
     VALUES ($1, $2, $3, $4)`,
    [
      input.agentId,
      input.traceId,
      input.requestIp ?? null,
      JSON.stringify(metadata),
    ]
  );
}

/** Unified A2A log: all agent ↔ Sandarb communication (INJECT_* + PROMPT_USED + A2A_CALL) for Slack-like chat UI */
export interface A2ALogEntry {
  id: string;
  agentId: string;
  traceId: string;
  accessedAt: string;
  actionType: 'INJECT_SUCCESS' | 'INJECT_DENIED' | 'PROMPT_USED' | 'INFERENCE_EVENT' | 'A2A_CALL';
  contextName: string;
  contextId: string | null;
  contextVersionId: string | null;
  promptName?: string;
  promptId?: string | null;
  promptVersionId?: string | null;
  reason?: string;
  intent?: string | null;
  /** A2A_CALL: JSON-RPC method */
  method?: string;
  /** A2A_CALL: short input/result summary */
  inputSummary?: string | null;
  resultSummary?: string | null;
  /** A2A_CALL: error message when call failed */
  error?: string | null;
}

export async function getA2ALogPg(limit: number = 200): Promise<A2ALogEntry[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT log_id AS id, agent_id, trace_id, accessed_at,
            context_id, version_id, prompt_id, prompt_version_id,
            metadata->>'action_type' AS action_type,
            metadata->>'contextName' AS context_name,
            metadata->>'promptName' AS prompt_name,
            metadata->>'reason' AS reason,
            metadata->>'intent' AS intent,
            metadata->>'method' AS method,
            metadata->>'inputSummary' AS input_summary,
            metadata->>'resultSummary' AS result_summary,
            metadata->>'error' AS error
     FROM sandarb_access_logs
     WHERE metadata->>'action_type' IN ('INJECT_SUCCESS', 'INJECT_DENIED', 'PROMPT_USED', 'INFERENCE_EVENT', 'A2A_CALL')
     ORDER BY accessed_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((r) => {
    const actionType = (r.action_type as A2ALogEntry['actionType']) ?? 'INJECT_SUCCESS';
    const method = r.method != null ? String(r.method) : undefined;
    const inputSummary = r.input_summary != null ? String(r.input_summary) : undefined;
    const resultSummary = r.result_summary != null ? String(r.result_summary) : undefined;
    const contextName =
      actionType === 'A2A_CALL' && method
        ? `[A2A] ${method}${inputSummary ? ` ${inputSummary}` : ''}`.trim().slice(0, 200)
        : String(r.context_name ?? '');
    return {
      id: String(r.id),
      agentId: String(r.agent_id ?? ''),
      traceId: String(r.trace_id ?? ''),
      accessedAt: String(r.accessed_at),
      actionType,
      contextName,
      contextId: r.context_id != null ? String(r.context_id) : null,
      contextVersionId: r.version_id != null ? String(r.version_id) : null,
      promptName: r.prompt_name != null ? String(r.prompt_name) : undefined,
      promptId: r.prompt_id != null ? String(r.prompt_id) : null,
      promptVersionId: r.prompt_version_id != null ? String(r.prompt_version_id) : null,
      reason: r.reason != null ? String(r.reason) : undefined,
      intent: r.intent != null ? String(r.intent) : null,
      method,
      inputSummary: inputSummary ?? null,
      resultSummary: resultSummary ?? null,
      error: r.error != null ? String(r.error) : null,
    };
  });
}

/** 
 * Get governance intersection log: enables reconstructing 
 * "On Feb 1st at 2:00 PM, Agent X used Prompt v4.2 and accessed Context Chunk #992"
 */
export interface GovernanceIntersectionEntry {
  id: string;
  agentId: string;
  traceId: string;
  timestamp: string;
  // Context information
  contextId: string | null;
  contextVersionId: string | null;
  contextName: string | null;
  // Prompt information
  promptId: string | null;
  promptVersionId: string | null;
  promptName: string | null;
  // Additional metadata
  intent: string | null;
  requestIp: string | null;
}

export async function getGovernanceIntersectionLogPg(
  limit: number = 100,
  filters?: {
    agentId?: string;
    traceId?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<GovernanceIntersectionEntry[]> {
  let whereClause = "WHERE metadata->>'action_type' IN ('INJECT_SUCCESS', 'INFERENCE_EVENT')";
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters?.agentId) {
    whereClause += ` AND agent_id = $${paramIndex++}`;
    params.push(filters.agentId);
  }
  if (filters?.traceId) {
    whereClause += ` AND trace_id = $${paramIndex++}`;
    params.push(filters.traceId);
  }
  if (filters?.startDate) {
    whereClause += ` AND accessed_at >= $${paramIndex++}`;
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    whereClause += ` AND accessed_at <= $${paramIndex++}`;
    params.push(filters.endDate);
  }

  params.push(limit);

  const rows = await query<Record<string, unknown>>(
    `SELECT log_id AS id, agent_id, trace_id, accessed_at,
            context_id, version_id AS context_version_id,
            prompt_id, prompt_version_id,
            metadata->>'contextName' AS context_name,
            metadata->>'promptName' AS prompt_name,
            metadata->>'intent' AS intent,
            request_ip
     FROM sandarb_access_logs
     ${whereClause}
     ORDER BY accessed_at DESC
     LIMIT $${paramIndex}`,
    params
  );

  return rows.map((r) => ({
    id: String(r.id),
    agentId: String(r.agent_id ?? ''),
    traceId: String(r.trace_id ?? ''),
    timestamp: String(r.accessed_at),
    contextId: r.context_id != null ? String(r.context_id) : null,
    contextVersionId: r.context_version_id != null ? String(r.context_version_id) : null,
    contextName: r.context_name != null ? String(r.context_name) : null,
    promptId: r.prompt_id != null ? String(r.prompt_id) : null,
    promptVersionId: r.prompt_version_id != null ? String(r.prompt_version_id) : null,
    promptName: r.prompt_name != null ? String(r.prompt_name) : null,
    intent: r.intent != null ? String(r.intent) : null,
    requestIp: r.request_ip != null ? String(r.request_ip) : null,
  }));
}
