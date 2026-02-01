/**
 * Postgres implementation for contexts + context_versions (user schema).
 * lob_tag: Retail-Banking | Investment-Banking | Wealth-Management | Legal-Compliance
 * data_classification: Public | Internal | Confidential | Restricted | MNPI
 * context_versions: version_label, sha256_hash, status Draft|Pending|Approved|Archived
 */

import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getPool, query, queryOne } from './pg';
import type {
  Context,
  ContextCreateInput,
  ContextUpdateInput,
  LineOfBusiness,
  DataClassification,
  RegulatoryHook,
} from '@/types';
import {
  LINE_OF_BUSINESS_OPTIONS,
  DATA_CLASSIFICATION_OPTIONS,
  REGULATORY_HOOK_OPTIONS,
} from '@/types';

const LOB_APP_TO_DB: Record<string, string> = {
  retail: 'Retail-Banking',
  investment_banking: 'Investment-Banking',
  wealth_management: 'Wealth-Management',
};
const LOB_DB_TO_APP: Record<string, LineOfBusiness> = {
  'Retail-Banking': 'retail',
  'Investment-Banking': 'investment_banking',
  'Wealth-Management': 'wealth_management',
  'Legal-Compliance': 'investment_banking',
};
const DATA_CLASS_APP_TO_DB: Record<string, string> = {
  public: 'Public',
  internal: 'Internal',
  confidential: 'Confidential',
  restricted: 'Restricted',
};
const DATA_CLASS_DB_TO_APP: Record<string, DataClassification> = {
  Public: 'public',
  Internal: 'internal',
  Confidential: 'confidential',
  Restricted: 'restricted',
  MNPI: 'restricted',
};

const parseJson = (v: unknown): Record<string, unknown> => {
  if (v == null) return {};
  if (typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  try {
    return (typeof v === 'string' ? JSON.parse(v) : v) as Record<string, unknown>;
  } catch {
    return {};
  }
};
const parseJsonArray = (v: unknown): string[] => {
  if (v == null) return [];
  if (Array.isArray(v)) return v as string[];
  try {
    const a = typeof v === 'string' ? JSON.parse(v) : v;
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
};

function rowToContext(row: Record<string, unknown>, content?: Record<string, unknown>): Context {
  const lobDb = row.lob_tag != null ? String(row.lob_tag) : null;
  const dataDb = row.data_classification != null ? String(row.data_classification) : null;
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description != null ? String(row.description) : null,
    content: content ?? parseJson(row.content),
    templateId: null,
    environment: 'production',
    tags: parseJsonArray(row.tags),
    isActive: row.is_active !== false,
    priority: 0,
    expiresAt: null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
    lineOfBusiness: lobDb ? (LOB_DB_TO_APP[lobDb] ?? null) : null,
    dataClassification: dataDb ? (DATA_CLASS_DB_TO_APP[dataDb] ?? null) : null,
    regulatoryHooks: parseJsonArray(row.regulatory_hooks) as RegulatoryHook[],
  };
}

async function getLatestContent(contextId: string): Promise<Record<string, unknown>> {
  const row = await queryOne<{ content: unknown }>(
    `SELECT content FROM context_versions
     WHERE context_id = $1 AND status = 'Approved'
     ORDER BY created_at DESC
     LIMIT 1`,
    [contextId]
  );
  return row ? parseJson(row.content) : {};
}

export async function getAllContextsPg(): Promise<Context[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM contexts ORDER BY created_at DESC`
  );
  const result: Context[] = [];
  for (const row of rows) {
    const content = await getLatestContent(String(row.id));
    result.push(rowToContext(row, content));
  }
  return result;
}

export async function getActiveContextsPg(): Promise<Context[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM contexts WHERE is_active = true ORDER BY created_at DESC`
  );
  const result: Context[] = [];
  for (const row of rows) {
    const content = await getLatestContent(String(row.id));
    result.push(rowToContext(row, content));
  }
  return result;
}

export async function getContextByIdPg(id: string): Promise<Context | null> {
  const row = await queryOne<Record<string, unknown>>(`SELECT * FROM contexts WHERE id = $1`, [id]);
  if (!row) return null;
  const content = await getLatestContent(id);
  return rowToContext(row, content);
}

export async function getContextByNamePg(name: string): Promise<Context | null> {
  const row = await queryOne<Record<string, unknown>>(`SELECT * FROM contexts WHERE name = $1`, [name]);
  if (!row) return null;
  const content = await getLatestContent(String(row.id));
  return rowToContext(row, content);
}

function sha256Hash(content: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

function normalizeLob(v: LineOfBusiness | null | undefined): string {
  if (v == null) return 'Retail-Banking';
  return LOB_APP_TO_DB[v] ?? 'Retail-Banking';
}
function normalizeDataClass(v: DataClassification | null | undefined): string {
  if (v == null) return 'Internal';
  return DATA_CLASS_APP_TO_DB[v] ?? 'Internal';
}
function normalizeHooks(v: RegulatoryHook[] | null | undefined): string {
  if (!v || !Array.isArray(v)) return '[]';
  const filtered = v.filter((h) => REGULATORY_HOOK_OPTIONS.includes(h));
  return JSON.stringify(filtered);
}

export async function createContextPg(input: ContextCreateInput): Promise<Context> {
  const pool = await getPool();
  if (!pool) throw new Error('Postgres not configured');
  const id = uuidv4();
  const now = new Date().toISOString();
  const tags = JSON.stringify(input.tags || []);
  const regulatoryHooks = normalizeHooks(input.regulatoryHooks);
  const lobTag = normalizeLob(input.lineOfBusiness);
  const dataClass = normalizeDataClass(input.dataClassification);
  const ownerTeam = 'system';

  await pool.query(
    `INSERT INTO contexts (id, name, description, lob_tag, data_classification, owner_team, tags, regulatory_hooks, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
    [id, input.name, input.description ?? null, lobTag, dataClass, ownerTeam, tags, regulatoryHooks, now]
  );

  const content = input.content || {};
  const hash = sha256Hash(content);
  await pool.query(
    `INSERT INTO context_versions (id, context_id, version_label, content, sha256_hash, created_by, created_at, status, commit_message, approved_by, approved_at, is_active)
     VALUES (gen_random_uuid(), $1, 'v1.0.0', $2, $3, $4, $5, 'Approved', 'Initial version', $4, $5, true)`,
    [id, JSON.stringify(content), hash, ownerTeam, now]
  );

  const activityId = uuidv4();
  await pool.query(
    `INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, created_at)
     VALUES ($1, 'create', 'context', $2, $3, $4)`,
    [activityId, id, input.name, now]
  );

  return getContextByIdPg(id) as Promise<Context>;
}

export async function updateContextPg(id: string, input: ContextUpdateInput): Promise<Context | null> {
  const existing = await getContextByIdPg(id);
  if (!existing) return null;

  const pool = await getPool();
  if (!pool) throw new Error('Postgres not configured');

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
  if (input.isActive !== undefined) {
    updates.push(`is_active = $${i++}`);
    values.push(input.isActive);
  }
  if (input.lineOfBusiness !== undefined) {
    updates.push(`lob_tag = $${i++}`);
    values.push(normalizeLob(input.lineOfBusiness));
  }
  if (input.dataClassification !== undefined) {
    updates.push(`data_classification = $${i++}`);
    values.push(normalizeDataClass(input.dataClassification));
  }
  if (input.regulatoryHooks !== undefined) {
    updates.push(`regulatory_hooks = $${i++}`);
    values.push(normalizeHooks(input.regulatoryHooks));
  }
  if (input.tags !== undefined) {
    updates.push(`tags = $${i++}`);
    values.push(JSON.stringify(input.tags));
  }

  if (updates.length > 0) {
    updates.push(`updated_at = $${i++}`);
    values.push(new Date().toISOString());
    values.push(id);
    await pool.query(`UPDATE contexts SET ${updates.join(', ')} WHERE id = $${i}`, values);
  }

  if (input.content !== undefined) {
    const countResult = await queryOne<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM context_versions WHERE context_id = $1`,
      [id]
    );
    const nextNum = (parseInt(countResult?.cnt ?? '0', 10) + 1);
    const versionLabel = `v1.0.${nextNum}`;
    const hash = sha256Hash(input.content);
    await pool.query(
      `INSERT INTO context_versions (id, context_id, version_label, content, sha256_hash, created_by, created_at, status, commit_message, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'system', $5, 'Approved', 'Update', true)`,
      [id, versionLabel, JSON.stringify(input.content), hash, new Date().toISOString()]
    );
  }

  const activityId = uuidv4();
  await pool.query(
    `INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, created_at)
     VALUES ($1, 'update', 'context', $2, $3, $4)`,
    [activityId, id, input.name ?? existing.name, new Date().toISOString()]
  );

  return getContextByIdPg(id);
}

export async function deleteContextPg(id: string): Promise<boolean> {
  const existing = await getContextByIdPg(id);
  if (!existing) return false;
  const pool = await getPool();
  if (!pool) return false;
  const res = await pool.query('DELETE FROM contexts WHERE id = $1', [id]);
  if ((res.rowCount ?? 0) > 0) {
    const activityId = uuidv4();
    await pool.query(
      `INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, created_at)
       VALUES ($1, 'delete', 'context', $2, $3, $4)`,
      [activityId, id, existing.name, new Date().toISOString()]
    );
    return true;
  }
  return false;
}

export async function getContextsByComplianceFiltersPg(filters: {
  lineOfBusiness?: LineOfBusiness;
  dataClassification?: DataClassification;
  regulatoryHook?: RegulatoryHook;
}): Promise<Context[]> {
  let rows = await query<Record<string, unknown>>(`SELECT * FROM contexts ORDER BY updated_at DESC`);
  if (filters.lineOfBusiness) rows = rows.filter((r) => r.lob_tag === filters.lineOfBusiness);
  if (filters.dataClassification) rows = rows.filter((r) => r.data_classification === filters.dataClassification);
  if (filters.regulatoryHook) {
    rows = rows.filter((r) => {
      const hooks = parseJsonArray(r.regulatory_hooks);
      return hooks.includes(filters.regulatoryHook!);
    });
  }
  const result: Context[] = [];
  for (const row of rows) {
    const content = await getLatestContent(String(row.id));
    result.push(rowToContext(row, content));
  }
  return result;
}

export async function searchContextsPg(q: string): Promise<Context[]> {
  const searchTerm = `%${q}%`;
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM contexts WHERE name ILIKE $1 OR description ILIKE $2 OR tags::text ILIKE $3 ORDER BY updated_at DESC`,
    [searchTerm, searchTerm, searchTerm]
  );
  const result: Context[] = [];
  for (const row of rows) {
    const content = await getLatestContent(String(row.id));
    result.push(rowToContext(row, content));
  }
  return result;
}

export async function getContextCountPg(): Promise<{ total: number; active: number }> {
  const total = await queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM contexts`);
  const active = await queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM contexts WHERE is_active = true`);
  return {
    total: parseInt(total?.count ?? '0', 10),
    active: parseInt(active?.count ?? '0', 10),
  };
}

export async function getContextCountByTagPg(tag: string): Promise<number> {
  // tags is stored as JSON array e.g. ["retail-banking"]; use containment not key-exists
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM contexts WHERE tags::jsonb @> $1::jsonb`,
    [JSON.stringify([tag])]
  );
  return parseInt(row?.count ?? '0', 10);
}

export async function getContextsByTemplatePg(_templateId: string): Promise<Context[]> {
  return getAllContextsPg();
}

export async function logActivityPg(
  type: string,
  resourceId: string,
  resourceName: string,
  _details?: string,
  createdBy?: string
): Promise<void> {
  const pool = await getPool();
  if (!pool) return;
  await pool.query(
    `INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, created_by, created_at)
     VALUES ($1, $2, 'context', $3, $4, $5, $6)`,
    [uuidv4(), type, resourceId, resourceName, createdBy ?? null, new Date().toISOString()]
  );
}

export async function logInjectionPg(contextName: string): Promise<void> {
  await logActivityPg('inject', '', contextName);
}

export async function getRecentActivityPg(limit: number = 10): Promise<Record<string, unknown>[]> {
  return query(
    `SELECT id, type, resource_type, resource_id, resource_name, created_at FROM activity_log ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
}
