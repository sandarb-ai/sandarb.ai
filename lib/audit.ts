/**
 * Audit logging for governance, controls, and risk.
 * When DATABASE_URL is set uses Postgres (sandarb_access_logs); else SQLite (activity_log).
 */

import { v4 as uuidv4 } from 'uuid';
import db from './db';
import { usePg } from './pg';
import * as auditPg from './audit-pg';

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

/** Unified A2A log for Slack-like chat: all agent ↔ Sandarb communication (delivered + denied) */
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
      reason: b.details?.reason,
      intent: null,
    })),
  ];
  entries.sort((a, b) => new Date(b.accessedAt).getTime() - new Date(a.accessedAt).getTime());
  return entries.slice(0, limit);
}
