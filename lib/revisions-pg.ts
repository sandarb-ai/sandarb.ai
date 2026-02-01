/**
 * Postgres implementation for context_versions (user schema).
 * version_label (e.g. v1.0.1), sha256_hash, status: Draft|Pending|Approved|Archived.
 */

import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getPool, query, queryOne } from './pg';
import { getContextByIdPg, updateContextPg } from './contexts-pg';
import type { ContextRevision, ContextRevisionCreateInput } from '@/types';

function mapStatus(s: string): 'proposed' | 'approved' | 'rejected' {
  if (s === 'Approved') return 'approved';
  if (s === 'Archived') return 'rejected';
  return 'proposed';
}

function rowToRevision(row: Record<string, unknown>): ContextRevision {
  return {
    id: String(row.id),
    contextId: String(row.context_id),
    content: typeof row.content === 'object' ? (row.content as Record<string, unknown>) : JSON.parse(String(row.content ?? '{}')),
    commitMessage: row.commit_message != null ? String(row.commit_message) : null,
    createdBy: row.created_by != null ? String(row.created_by) : null,
    createdAt: String(row.created_at),
    status: mapStatus(String(row.status ?? 'Draft')),
    approvedBy: row.approved_by != null ? String(row.approved_by) : null,
    approvedAt: row.approved_at != null ? String(row.approved_at) : null,
    parentRevisionId: null,
  };
}

export async function getRevisionsByContextIdPg(contextId: string): Promise<ContextRevision[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM context_versions WHERE context_id = $1 ORDER BY created_at DESC`,
    [contextId]
  );
  return rows.map(rowToRevision);
}

export async function getRevisionByIdPg(id: string): Promise<ContextRevision | null> {
  const row = await queryOne<Record<string, unknown>>(`SELECT * FROM context_versions WHERE id = $1`, [id]);
  return row ? rowToRevision(row) : null;
}

export async function getProposedRevisionsPg(contextId: string): Promise<ContextRevision[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM context_versions WHERE context_id = $1 AND status = 'Pending' ORDER BY created_at DESC`,
    [contextId]
  );
  return rows.map(rowToRevision);
}

export async function getAllProposedRevisionsPg(): Promise<ContextRevision[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM context_versions WHERE status = 'Pending' ORDER BY created_at DESC`
  );
  return rows.map(rowToRevision);
}

export async function proposeRevisionPg(input: ContextRevisionCreateInput): Promise<ContextRevision> {
  const context = await getContextByIdPg(input.contextId);
  if (!context) throw new Error('Context not found');

  const pool = await getPool();
  if (!pool) throw new Error('Postgres not configured');

  const id = uuidv4();
  const now = new Date().toISOString();
  const content = input.content || {};
  const sha256Hash = createHash('sha256').update(JSON.stringify(content)).digest('hex');
  const countResult = await queryOne<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM context_versions WHERE context_id = $1`,
    [input.contextId]
  );
  const nextNum = parseInt(countResult?.cnt ?? '0', 10) + 1;
  const versionLabel = `v1.0.${nextNum}`;

  await pool.query(
    `INSERT INTO context_versions (id, context_id, version_label, content, sha256_hash, created_by, created_at, status, commit_message, is_active)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, 'Pending', $8, false)`,
    [id, input.contextId, versionLabel, JSON.stringify(content), sha256Hash, input.createdBy ?? 'system', now, input.commitMessage ?? null]
  );

  const activityId = uuidv4();
  await pool.query(
    `INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, details, created_by, created_at)
     VALUES ($1, 'revision_proposed', 'context', $2, $3, $4, $5, $6)`,
    [activityId, input.contextId, context.name, JSON.stringify({ revisionId: id }), input.createdBy ?? null, now]
  );

  return getRevisionByIdPg(id) as Promise<ContextRevision>;
}

export async function approveRevisionPg(revisionId: string, approvedBy?: string): Promise<ContextRevision | null> {
  const revision = await getRevisionByIdPg(revisionId);
  if (!revision || revision.status !== 'proposed') return null;

  const context = await getContextByIdPg(revision.contextId);
  if (!context) return null;

  const pool = await getPool();
  if (!pool) return null;

  const now = new Date().toISOString();
  await pool.query(
    `UPDATE context_versions SET status = 'Approved', approved_by = $1, approved_at = $2, is_active = true WHERE id = $3`,
    [approvedBy ?? null, now, revisionId]
  );

  await updateContextPg(revision.contextId, { content: revision.content });

  const activityId = uuidv4();
  await pool.query(
    `INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, details, created_by, created_at)
     VALUES ($1, 'revision_approved', 'context', $2, $3, $4, $5, $6)`,
    [activityId, revision.contextId, context.name, JSON.stringify({ revisionId }), approvedBy ?? null, now]
  );

  return getRevisionByIdPg(revisionId);
}

export async function rejectRevisionPg(revisionId: string, rejectedBy?: string): Promise<ContextRevision | null> {
  const revision = await getRevisionByIdPg(revisionId);
  if (!revision || revision.status !== 'proposed') return null;

  const context = await getContextByIdPg(revision.contextId);
  if (!context) return null;

  const pool = await getPool();
  if (!pool) return null;

  const now = new Date().toISOString();
  await pool.query(
    `UPDATE context_versions SET status = 'Archived', approved_by = $1, approved_at = $2 WHERE id = $3`,
    [rejectedBy ?? null, now, revisionId]
  );

  const activityId = uuidv4();
  await pool.query(
    `INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, details, created_by, created_at)
     VALUES ($1, 'revision_rejected', 'context', $2, $3, $4, $5, $6)`,
    [activityId, revision.contextId, context.name, JSON.stringify({ revisionId }), rejectedBy ?? null, now]
  );

  return getRevisionByIdPg(revisionId);
}
