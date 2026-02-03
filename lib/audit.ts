/**
 * Audit logging for governance, controls, and risk.
 * Postgres (pg) only.
 */

import * as auditPg from './audit-pg';

export type { GovernanceIntersectionEntry } from './audit-pg';

export interface AuditEventInput {
  eventType: string;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  sourceAgent?: string;
  details?: Record<string, unknown>;
}

export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  await auditPg.logAuditEventPg(input);
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
  await auditPg.logContextDeliveryPg(input, input.versionId);
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
  await auditPg.logBlockedInjectionPg(input);
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
  return auditPg.getBlockedInjectionsPg(limit);
}

export async function getLineage(limit: number = 50): Promise<LineageEntry[]> {
  return auditPg.getLineagePg(limit);
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

export async function logA2ACall(input: A2ACallLogInput): Promise<void> {
  await auditPg.logA2ACallPg(input);
}

export async function getA2ALog(limit: number = 200): Promise<A2ALogEntry[]> {
  return auditPg.getA2ALogPg(limit);
}

export interface PromptUsageInput {
  agentId: string;
  traceId: string;
  promptId: string;
  promptVersionId: string;
  promptName: string;
  intent?: string;
}

export async function logPromptUsage(input: PromptUsageInput): Promise<void> {
  await auditPg.logPromptUsagePg(input);
}

export interface GovernanceIntersectionInput {
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

export async function logGovernanceIntersection(input: GovernanceIntersectionInput): Promise<void> {
  await auditPg.logGovernanceIntersectionPg(input);
}

export async function getGovernanceIntersectionLog(
  limit: number = 100,
  filters?: {
    agentId?: string;
    traceId?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<import('./audit-pg').GovernanceIntersectionEntry[]> {
  return auditPg.getGovernanceIntersectionLogPg(limit, filters);
}
