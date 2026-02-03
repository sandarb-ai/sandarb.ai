/**
 * Context revisions: git-like propose edit -> approve/reject.
 * Postgres (pg) only.
 */

import * as revisionsPg from './revisions-pg';
import type { ContextRevision, ContextRevisionCreateInput } from '@/types';

export async function getRevisionsByContextId(contextId: string): Promise<ContextRevision[]> {
  return revisionsPg.getRevisionsByContextIdPg(contextId);
}

export async function getRevisionById(id: string): Promise<ContextRevision | null> {
  return revisionsPg.getRevisionByIdPg(id);
}

export async function getProposedRevisions(contextId: string): Promise<ContextRevision[]> {
  return revisionsPg.getProposedRevisionsPg(contextId);
}

export async function getAllProposedRevisions(): Promise<ContextRevision[]> {
  return revisionsPg.getAllProposedRevisionsPg();
}

export async function proposeRevision(input: ContextRevisionCreateInput): Promise<ContextRevision> {
  return revisionsPg.proposeRevisionPg(input);
}

export async function approveRevision(revisionId: string, approvedBy?: string): Promise<ContextRevision | null> {
  return revisionsPg.approveRevisionPg(revisionId, approvedBy);
}

export async function rejectRevision(revisionId: string, rejectedBy?: string): Promise<ContextRevision | null> {
  return revisionsPg.rejectRevisionPg(revisionId, rejectedBy);
}
