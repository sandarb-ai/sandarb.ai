/**
 * Context revisions: git-like propose edit -> approve/reject.
 * When DATABASE_URL is set uses Postgres (context_versions); else SQLite (context_revisions).
 */

import { v4 as uuidv4 } from 'uuid';
import db, { rowToContextRevision } from './db';
import { usePg } from './pg';
import * as revisionsPg from './revisions-pg';
import { getContextById, updateContext } from './contexts';
import type { ContextRevision, ContextRevisionCreateInput } from '@/types';

// --- SQLite implementations ---

function getRevisionsByContextIdSqlite(contextId: string): ContextRevision[] {
  const rows = db.prepare('SELECT * FROM context_revisions WHERE context_id = ? ORDER BY created_at DESC').all(contextId);
  return (rows as Record<string, unknown>[]).map((r) => rowToContextRevision(r));
}

function getRevisionByIdSqlite(id: string): ContextRevision | null {
  const row = db.prepare('SELECT * FROM context_revisions WHERE id = ?').get(id);
  return row ? rowToContextRevision(row as Record<string, unknown>) : null;
}

function getProposedRevisionsSqlite(contextId: string): ContextRevision[] {
  const rows = db.prepare('SELECT * FROM context_revisions WHERE context_id = ? AND status = ? ORDER BY created_at DESC').all(contextId, 'proposed');
  return (rows as Record<string, unknown>[]).map((r) => rowToContextRevision(r));
}

function getAllProposedRevisionsSqlite(): ContextRevision[] {
  const rows = db.prepare('SELECT * FROM context_revisions WHERE status = ? ORDER BY created_at DESC').all('proposed');
  return (rows as Record<string, unknown>[]).map((r) => rowToContextRevision(r));
}

async function proposeRevisionSqlite(input: ContextRevisionCreateInput): Promise<ContextRevision> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const context = await getContextById(input.contextId);
  if (!context) throw new Error('Context not found');

  db.prepare(
    `INSERT INTO context_revisions (id, context_id, content, commit_message, created_by, created_at, status, parent_revision_id)
     VALUES (?, ?, ?, ?, ?, ?, 'proposed', NULL)`
  ).run(id, input.contextId, JSON.stringify(input.content), input.commitMessage ?? null, input.createdBy ?? null, now);

  logRevisionActivitySqlite('propose', input.contextId, context.name, id, input.createdBy ?? undefined);
  return getRevisionByIdSqlite(id)!;
}

async function approveRevisionSqlite(revisionId: string, approvedBy?: string): Promise<ContextRevision | null> {
  const revision = getRevisionByIdSqlite(revisionId);
  if (!revision || revision.status !== 'proposed') return null;
  const context = await getContextById(revision.contextId);
  if (!context) return null;

  const now = new Date().toISOString();
  db.prepare(`UPDATE context_revisions SET status = 'approved', approved_by = ?, approved_at = ? WHERE id = ?`).run(approvedBy ?? null, now, revisionId);
  await updateContext(revision.contextId, { content: revision.content });
  logRevisionActivitySqlite('approve', revision.contextId, context.name, revisionId, approvedBy);
  return getRevisionByIdSqlite(revisionId);
}

async function rejectRevisionSqlite(revisionId: string, rejectedBy?: string): Promise<ContextRevision | null> {
  const revision = getRevisionByIdSqlite(revisionId);
  if (!revision || revision.status !== 'proposed') return null;
  const context = await getContextById(revision.contextId);
  if (!context) return null;

  db.prepare(`UPDATE context_revisions SET status = 'rejected', approved_by = ?, approved_at = ? WHERE id = ?`).run(rejectedBy ?? null, new Date().toISOString(), revisionId);
  logRevisionActivitySqlite('reject', revision.contextId, context.name, revisionId, rejectedBy);
  return getRevisionByIdSqlite(revisionId);
}

function logRevisionActivitySqlite(type: string, contextId: string, contextName: string, revisionId: string, userId?: string) {
  const id = uuidv4();
  const logType = type === 'propose' ? 'revision_proposed' : type === 'approve' ? 'revision_approved' : 'revision_rejected';
  db.prepare(`
    INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, details, created_by, created_at)
    VALUES (?, ?, 'context', ?, ?, ?, ?, ?)
  `).run(id, logType, contextId, contextName, JSON.stringify({ revisionId }), userId ?? null, new Date().toISOString());
}

// --- Public API (async) ---

export async function getRevisionsByContextId(contextId: string): Promise<ContextRevision[]> {
  return usePg() ? revisionsPg.getRevisionsByContextIdPg(contextId) : Promise.resolve(getRevisionsByContextIdSqlite(contextId));
}

export async function getRevisionById(id: string): Promise<ContextRevision | null> {
  return usePg() ? revisionsPg.getRevisionByIdPg(id) : Promise.resolve(getRevisionByIdSqlite(id));
}

export async function getProposedRevisions(contextId: string): Promise<ContextRevision[]> {
  return usePg() ? revisionsPg.getProposedRevisionsPg(contextId) : Promise.resolve(getProposedRevisionsSqlite(contextId));
}

export async function getAllProposedRevisions(): Promise<ContextRevision[]> {
  return usePg() ? revisionsPg.getAllProposedRevisionsPg() : Promise.resolve(getAllProposedRevisionsSqlite());
}

export async function proposeRevision(input: ContextRevisionCreateInput): Promise<ContextRevision> {
  return usePg() ? revisionsPg.proposeRevisionPg(input) : proposeRevisionSqlite(input);
}

export async function approveRevision(revisionId: string, approvedBy?: string): Promise<ContextRevision | null> {
  return usePg() ? revisionsPg.approveRevisionPg(revisionId, approvedBy) : approveRevisionSqlite(revisionId, approvedBy);
}

export async function rejectRevision(revisionId: string, rejectedBy?: string): Promise<ContextRevision | null> {
  return usePg() ? revisionsPg.rejectRevisionPg(revisionId, rejectedBy) : rejectRevisionSqlite(revisionId, rejectedBy);
}
