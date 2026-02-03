/**
 * Audit logging for governance, controls, and risk.
 * When DATABASE_URL is set uses Postgres (sandarb_access_logs); else SQLite (activity_log).
 * 
 * Supports governance intersection tracking:
 * "On Feb 1st at 2:00 PM, Agent X used Prompt v4.2 and accessed Context Chunk #992"
 */

import { v4 as uuidv4 } from 'uuid';
import db from './db';
import { usePg } from './pg';
import * as auditPg from './audit-pg';

// Re-export types from audit-pg
export type { GovernanceIntersectionEntry } from './audit-pg';

export interface AuditEventInput {
  eventType: string;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  sourceAgent?: string;
  details?: Record<string, unknown>;
}

export function logAuditEvent(input: AuditEventInput): void {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, details, created_by, created_at)
    VALUES (?, 'audit', ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.resourceType ?? 'event',
    input.resourceId ?? null,
    input.resourceName ?? input.eventType,
    JSON.stringify({ eventType: input.eventType, sourceAgent: input.sourceAgent, ...input.details }),
    input.sourceAgent ?? null,
    now
  );
}

export interface ContextDeliveryInput {
  sourceAgent: string | null;
  contextId: string;
  contextName: string;
  intent?: string;
  agentId?: string | null;
  traceId?: string | null;
  versionId?: string | null;
}

export async function logContextDelivery(input: ContextDeliveryInput): Promise<void> {
  if (usePg()) {
    await auditPg.logContextDeliveryPg(input, input.versionId);
    return;
  }
  const id = uuidv4();
  const now = new Date().toISOString();
  const details = {
    intent: input.intent ?? null,
    sourceAgent: input.sourceAgent ?? null,
    agentId: input.agentId ?? null,
    traceId: input.traceId ?? null,
  };
  db.prepare(`
    INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, details, created_by, created_at)
    VALUES (?, 'context_delivered', 'context', ?, ?, ?, ?, ?)
  `).run(id, input.contextId, input.contextName, JSON.stringify(details), input.agentId ?? input.sourceAgent ?? null, now);
}

export interface LineageEntry {
  id: string;
  type: string;
  resourceType: string;
  resourceId: string | null;
  resourceName: string;
  sourceAgent: string | null;
  details: { intent?: string; sourceAgent?: string; agentId?: string; traceId?: string };
  createdAt: string;
}

export async function logBlockedInjection(input: {
  agentId: string;
  traceId?: string | null;
  contextId: string;
  contextName: string;
  reason: string;
}): Promise<void> {
  if (usePg()) {
    await auditPg.logBlockedInjectionPg(input);
    return;
  }
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, details, created_by, created_at)
    VALUES (?, 'inject_blocked', 'context', ?, ?, ?, ?, ?)
  `).run(
    id,
    input.contextId,
    input.contextName,
    JSON.stringify({ agentId: input.agentId, traceId: input.traceId ?? null, reason: input.reason }),
    input.agentId,
    now
  );
}

export interface BlockedInjectionEntry {
  id: string;
  resourceId: string | null;
  resourceName: string;
  createdBy: string | null;
  details: { agentId?: string; traceId?: string; reason?: string };
  createdAt: string;
}

export async function getBlockedInjections(limit: number = 50): Promise<BlockedInjectionEntry[]> {
  if (usePg()) return auditPg.getBlockedInjectionsPg(limit);
  const rows = db.prepare(`
    SELECT id, resource_type, resource_id, resource_name, details, created_by, created_at
    FROM activity_log
    WHERE type = 'inject_blocked'
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    resourceId: r.resource_id as string | null,
    resourceName: (r.resource_name as string) ?? '',
    createdBy: r.created_by as string | null,
    details: (r.details ? JSON.parse(r.details as string) : {}) as { agentId?: string; traceId?: string; reason?: string },
    createdAt: r.created_at as string,
  }));
}

export async function getLineage(limit: number = 50): Promise<LineageEntry[]> {
  if (usePg()) return auditPg.getLineagePg(limit);
  const rows = db.prepare(`
    SELECT id, type, resource_type, resource_id, resource_name, details, created_by, created_at
    FROM activity_log
    WHERE type = 'context_delivered'
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    type: r.type as string,
    resourceType: (r.resource_type as string) ?? 'context',
    resourceId: r.resource_id as string | null,
    resourceName: (r.resource_name as string) ?? '',
    sourceAgent: r.created_by as string | null,
    details: (r.details ? JSON.parse(r.details as string) : {}) as { intent?: string; sourceAgent?: string },
    createdAt: r.created_at as string,
  }));
}

export type A2ALogEntry = import('./audit-pg').A2ALogEntry;

export interface A2ACallLogInput {
  agentId: string;
  traceId: string;
  method: string;
  inputSummary?: string | null;
  resultSummary?: string | null;
  error?: string | null;
  requestIp?: string | null;
}

/** Log every A2A conversation (JSON-RPC method + params summary + result/error) so you can see what agents are doing. */
export async function logA2ACall(input: A2ACallLogInput): Promise<void> {
  if (usePg()) {
    await auditPg.logA2ACallPg(input);
    return;
  }
  // SQLite: no sandarb_access_logs equivalent for A2A_CALL; skip so UI still works
}

/** Unified A2A log for Slack-like chat: all agent ↔ Sandarb communication (delivered + denied + prompt used + A2A calls) */
export async function getA2ALog(limit: number = 200): Promise<A2ALogEntry[]> {
  if (usePg()) return auditPg.getA2ALogPg(limit);
  const delivered = await getLineage(limit);
  const blocked = await getBlockedInjections(limit);
  const entries: A2ALogEntry[] = [
    ...delivered.map((r) => ({
      id: r.id,
      agentId: r.sourceAgent ?? r.details?.agentId ?? 'unknown',
      traceId: r.details?.traceId ?? 'unknown',
      accessedAt: r.createdAt,
      actionType: 'INJECT_SUCCESS' as const,
      contextName: r.resourceName,
      contextId: r.resourceId,
      contextVersionId: null,
      reason: undefined,
      intent: r.details?.intent ?? null,
    })),
    ...blocked.map((b) => ({
      id: b.id,
      agentId: b.createdBy ?? b.details?.agentId ?? 'unknown',
      traceId: b.details?.traceId ?? 'unknown',
      accessedAt: b.createdAt,
      actionType: 'INJECT_DENIED' as const,
      contextName: b.resourceName,
      contextId: b.resourceId,
      contextVersionId: null,
      reason: b.details?.reason,
      intent: null,
    })),
  ];
  entries.sort((a, b) => new Date(b.accessedAt).getTime() - new Date(a.accessedAt).getTime());
  return entries.slice(0, limit);
}

// ============================================================================
// PROMPT USAGE LOGGING (Governance: track prompt behavior)
// ============================================================================

export interface PromptUsageInput {
  agentId: string;
  traceId: string;
  promptId: string;
  promptVersionId: string;
  promptName: string;
  intent?: string;
}

/** Log when a prompt is used by an agent. */
export async function logPromptUsage(input: PromptUsageInput): Promise<void> {
  if (usePg()) {
    await auditPg.logPromptUsagePg(input);
    return;
  }
  // SQLite fallback
  const id = uuidv4();
  const now = new Date().toISOString();
  const details = {
    promptId: input.promptId,
    promptVersionId: input.promptVersionId,
    promptName: input.promptName,
    intent: input.intent ?? null,
    traceId: input.traceId,
  };
  db.prepare(`
    INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, details, created_by, created_at)
    VALUES (?, 'prompt_used', 'prompt', ?, ?, ?, ?, ?)
  `).run(id, input.promptId, input.promptName, JSON.stringify(details), input.agentId, now);
}

// ============================================================================
// GOVERNANCE INTERSECTION LOGGING
// Enables: "On Feb 1st at 2:00 PM, Agent X used Prompt v4.2 and accessed Context Chunk #992"
// ============================================================================

export interface GovernanceIntersectionInput {
  agentId: string;
  traceId: string;
  // Context info (the "Reference Library")
  contextId?: string | null;
  contextVersionId?: string | null;
  contextName?: string;
  // Prompt info (the "Employee Handbook")
  promptId?: string | null;
  promptVersionId?: string | null;
  promptName?: string;
  // Additional metadata
  intent?: string;
  requestIp?: string;
}

/** 
 * Log a governance intersection event: captures both prompt and context usage together.
 * This is the critical audit log for incident reconstruction.
 */
export async function logGovernanceIntersection(input: GovernanceIntersectionInput): Promise<void> {
  if (usePg()) {
    await auditPg.logGovernanceIntersectionPg(input);
    return;
  }
  // SQLite fallback: store as unified activity log entry
  const id = uuidv4();
  const now = new Date().toISOString();
  const details = {
    contextId: input.contextId ?? null,
    contextVersionId: input.contextVersionId ?? null,
    contextName: input.contextName ?? null,
    promptId: input.promptId ?? null,
    promptVersionId: input.promptVersionId ?? null,
    promptName: input.promptName ?? null,
    intent: input.intent ?? null,
    traceId: input.traceId,
    requestIp: input.requestIp ?? null,
  };
  db.prepare(`
    INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, details, created_by, created_at)
    VALUES (?, 'inference_event', 'governance', ?, ?, ?, ?, ?)
  `).run(
    id,
    input.contextId ?? input.promptId ?? null,
    `${input.promptName ?? 'unknown-prompt'} + ${input.contextName ?? 'unknown-context'}`,
    JSON.stringify(details),
    input.agentId,
    now
  );
}

/** 
 * Get governance intersection log for incident reconstruction.
 * Enables querying: "What prompts and contexts did Agent X use on Feb 1st?"
 */
export async function getGovernanceIntersectionLog(
  limit: number = 100,
  filters?: {
    agentId?: string;
    traceId?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<import('./audit-pg').GovernanceIntersectionEntry[]> {
  if (usePg()) {
    return auditPg.getGovernanceIntersectionLogPg(limit, filters);
  }
  // SQLite fallback
  let sql = `
    SELECT id, resource_id, resource_name, details, created_by, created_at
    FROM activity_log
    WHERE type = 'inference_event'
  `;
  const params: unknown[] = [];

  if (filters?.agentId) {
    sql += ' AND created_by = ?';
    params.push(filters.agentId);
  }
  if (filters?.startDate) {
    sql += ' AND created_at >= ?';
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    sql += ' AND created_at <= ?';
    params.push(filters.endDate);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  return rows.map((r) => {
    const details = r.details ? JSON.parse(r.details as string) : {};
    return {
      id: r.id as string,
      agentId: r.created_by as string ?? '',
      traceId: details.traceId ?? '',
      timestamp: r.created_at as string,
      contextId: details.contextId ?? null,
      contextVersionId: details.contextVersionId ?? null,
      contextName: details.contextName ?? null,
      promptId: details.promptId ?? null,
      promptVersionId: details.promptVersionId ?? null,
      promptName: details.promptName ?? null,
      intent: details.intent ?? null,
      requestIp: details.requestIp ?? null,
    };
  });
}
