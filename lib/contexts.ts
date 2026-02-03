import { v4 as uuidv4 } from 'uuid';
import db, { rowToContext } from './db';
import { usePg } from './pg';
import * as contextsPg from './contexts-pg';
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

// --- SQLite implementations (used when DATABASE_URL is not set) ---

function getAllContextsSqlite(): Context[] {
  const rows = db.prepare(`
    SELECT * FROM contexts
    ORDER BY updated_at DESC
  `).all();
  return (rows as Record<string, unknown>[]).map(rowToContext);
}

function getContextsPaginatedSqlite(limit: number, offset: number): { contexts: Context[]; total: number } {
  const total = (db.prepare(`SELECT COUNT(*) as count FROM contexts`).get() as { count: number }).count;
  const rows = db.prepare(`
    SELECT * FROM contexts
    ORDER BY updated_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  const contexts = (rows as Record<string, unknown>[]).map(rowToContext);
  return { contexts, total };
}

function getActiveContextsSqlite(): Context[] {
  const rows = db.prepare(`
    SELECT * FROM contexts
    WHERE is_active = 1
    ORDER BY updated_at DESC
  `).all();
  return (rows as Record<string, unknown>[]).map(rowToContext);
}

function getContextByIdSqlite(id: string): Context | null {
  const row = db.prepare(`SELECT * FROM contexts WHERE id = ?`).get(id);
  return row ? rowToContext(row as Record<string, unknown>) : null;
}

function getContextByNameSqlite(name: string): Context | null {
  const row = db.prepare(`SELECT * FROM contexts WHERE name = ?`).get(name);
  return row ? rowToContext(row as Record<string, unknown>) : null;
}

function searchContextsSqlite(query: string): Context[] {
  const searchTerm = `%${query}%`;
  const rows = db.prepare(`
    SELECT * FROM contexts
    WHERE name LIKE ? OR description LIKE ? OR tags LIKE ?
    ORDER BY updated_at DESC
  `).all(searchTerm, searchTerm, searchTerm);
  return (rows as Record<string, unknown>[]).map(rowToContext);
}

export interface ComplianceFilters {
  lineOfBusiness?: LineOfBusiness;
  dataClassification?: DataClassification;
  regulatoryHook?: RegulatoryHook;
}

function getContextsByComplianceFiltersSqlite(filters: ComplianceFilters): Context[] {
  let rows = db.prepare(`SELECT * FROM contexts ORDER BY updated_at DESC`).all() as Record<string, unknown>[];
  if (filters.lineOfBusiness) rows = rows.filter((r) => r.line_of_business === filters.lineOfBusiness);
  if (filters.dataClassification) rows = rows.filter((r) => r.data_classification === filters.dataClassification);
  if (filters.regulatoryHook) {
    rows = rows.filter((r) => {
      const hooks = JSON.parse((r.regulatory_hooks as string) || '[]') as string[];
      return hooks.includes(filters.regulatoryHook!);
    });
  }
  return rows.map((r) => rowToContext(r));
}

function normalizeLineOfBusiness(v: LineOfBusiness | null | undefined): LineOfBusiness | null {
  if (v == null) return null;
  return LINE_OF_BUSINESS_OPTIONS.includes(v) ? v : null;
}
function normalizeDataClassification(v: DataClassification | null | undefined): DataClassification | null {
  if (v == null) return null;
  return DATA_CLASSIFICATION_OPTIONS.includes(v) ? v : null;
}
function normalizeRegulatoryHooks(v: RegulatoryHook[] | null | undefined): RegulatoryHook[] {
  if (!v || !Array.isArray(v)) return [];
  return v.filter((h) => REGULATORY_HOOK_OPTIONS.includes(h));
}

function createContextSqlite(input: ContextCreateInput): Context {
  const id = uuidv4();
  const now = new Date().toISOString();
  const lineOfBusiness = normalizeLineOfBusiness(input.lineOfBusiness);
  const dataClassification = normalizeDataClassification(input.dataClassification);
  const regulatoryHooks = normalizeRegulatoryHooks(input.regulatoryHooks);

  db.prepare(`
    INSERT INTO contexts (id, name, description, content, template_id, tags, created_at, updated_at, line_of_business, data_classification, regulatory_hooks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.name,
    input.description || null,
    JSON.stringify(input.content),
    input.templateId || null,
    JSON.stringify(input.tags || []),
    now,
    now,
    lineOfBusiness,
    dataClassification,
    JSON.stringify(regulatoryHooks)
  );

  logActivitySqlite('create', id, input.name);
  return getContextByIdSqlite(id)!;
}

function updateContextSqlite(id: string, input: ContextUpdateInput): Context | null {
  const existing = getContextByIdSqlite(id);
  if (!existing) return null;

  const updates: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    values.push(input.name);
  }
  if (input.description !== undefined) {
    updates.push('description = ?');
    values.push(input.description);
  }
  if (input.content !== undefined) {
    updates.push('content = ?');
    values.push(JSON.stringify(input.content));
  }
  if (input.templateId !== undefined) {
    updates.push('template_id = ?');
    values.push(input.templateId);
  }
  if (input.tags !== undefined) {
    updates.push('tags = ?');
    values.push(JSON.stringify(input.tags));
  }
  if (input.isActive !== undefined) {
    updates.push('is_active = ?');
    values.push(input.isActive ? 1 : 0);
  }
  if (input.lineOfBusiness !== undefined) {
    updates.push('line_of_business = ?');
    values.push(normalizeLineOfBusiness(input.lineOfBusiness));
  }
  if (input.dataClassification !== undefined) {
    updates.push('data_classification = ?');
    values.push(normalizeDataClassification(input.dataClassification));
  }
  if (input.regulatoryHooks !== undefined) {
    updates.push('regulatory_hooks = ?');
    values.push(JSON.stringify(normalizeRegulatoryHooks(input.regulatoryHooks)));
  }

  if (updates.length === 0) return existing;

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.prepare(`
    UPDATE contexts
    SET ${updates.join(', ')}
    WHERE id = ?
  `).run(...values);

  logActivitySqlite('update', id, input.name || existing.name);
  return getContextByIdSqlite(id);
}

function deleteContextSqlite(id: string): boolean {
  const existing = getContextByIdSqlite(id);
  if (!existing) return false;
  const result = db.prepare(`DELETE FROM contexts WHERE id = ?`).run(id);
  if (result.changes > 0) {
    logActivitySqlite('delete', id, existing.name);
    return true;
  }
  return false;
}

function getContextsByTemplateSqlite(templateId: string): Context[] {
  const rows = db.prepare(`
    SELECT * FROM contexts WHERE template_id = ?
    ORDER BY updated_at DESC
  `).all(templateId);
  return (rows as Record<string, unknown>[]).map(rowToContext);
}

function logActivitySqlite(type: string, resourceId: string, resourceName: string, details?: string, createdBy?: string) {
  const id = uuidv4();
  db.prepare(`
    INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, details, created_by, created_at)
    VALUES (?, ?, 'context', ?, ?, ?, ?, ?)
  `).run(id, type, resourceId, resourceName, details ?? null, createdBy ?? null, new Date().toISOString());
}

function getRecentActivitySqlite(limit: number = 10) {
  return db.prepare(`
    SELECT * FROM activity_log
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);
}

function getContextCountSqlite(): { total: number; active: number } {
  const total = db.prepare(`SELECT COUNT(*) as count FROM contexts`).get() as { count: number };
  const active = db.prepare(`SELECT COUNT(*) as count FROM contexts WHERE is_active = 1`).get() as { count: number };
  return { total: total.count, active: active.count };
}

function getRecentContextsSqlite(limit: number = 6): Context[] {
  const rows = db.prepare(`
    SELECT * FROM contexts
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);
  return (rows as Record<string, unknown>[]).map(rowToContext);
}

function getContextCountByTagSqlite(tag: string): number {
  const row = db.prepare(`SELECT COUNT(*) as count FROM contexts WHERE tags LIKE ?`).get(`%"${tag}"%`) as { count: number };
  return row?.count ?? 0;
}

// --- Public API: async when Postgres, sync wrapped in Promise when SQLite ---

export async function getAllContexts(): Promise<Context[]> {
  return usePg() ? contextsPg.getAllContextsPg() : Promise.resolve(getAllContextsSqlite());
}

export async function getContextsPaginated(limit: number, offset: number): Promise<{ contexts: Context[]; total: number }> {
  return usePg() ? contextsPg.getContextsPaginatedPg(limit, offset) : Promise.resolve(getContextsPaginatedSqlite(limit, offset));
}

export async function getActiveContexts(): Promise<Context[]> {
  return usePg() ? contextsPg.getActiveContextsPg() : Promise.resolve(getActiveContextsSqlite());
}

export async function getContextById(id: string): Promise<Context | null> {
  return usePg() ? contextsPg.getContextByIdPg(id) : Promise.resolve(getContextByIdSqlite(id));
}

export async function getContextByName(name: string): Promise<Context | null> {
  return usePg() ? contextsPg.getContextByNamePg(name) : Promise.resolve(getContextByNameSqlite(name));
}

export async function searchContexts(query: string): Promise<Context[]> {
  return usePg() ? contextsPg.searchContextsPg(query) : Promise.resolve(searchContextsSqlite(query));
}

export async function getContextsByComplianceFilters(filters: ComplianceFilters): Promise<Context[]> {
  return usePg() ? contextsPg.getContextsByComplianceFiltersPg(filters) : Promise.resolve(getContextsByComplianceFiltersSqlite(filters));
}

export async function createContext(input: ContextCreateInput): Promise<Context> {
  return usePg() ? contextsPg.createContextPg(input) : Promise.resolve(createContextSqlite(input));
}

export async function updateContext(id: string, input: ContextUpdateInput): Promise<Context | null> {
  return usePg() ? contextsPg.updateContextPg(id, input) : Promise.resolve(updateContextSqlite(id, input));
}

export async function deleteContext(id: string): Promise<boolean> {
  return usePg() ? contextsPg.deleteContextPg(id) : Promise.resolve(deleteContextSqlite(id));
}

export async function getContextsByTemplate(templateId: string): Promise<Context[]> {
  return usePg() ? contextsPg.getContextsByTemplatePg(templateId) : Promise.resolve(getContextsByTemplateSqlite(templateId));
}

export async function logInjection(contextName: string): Promise<void> {
  if (usePg()) await contextsPg.logInjectionPg(contextName);
  else logInjectionPg(contextName);
}
function logInjectionPg(contextName: string) {
  logActivitySqlite('inject', '', contextName);
}

export async function getRecentActivity(limit: number = 10): Promise<Record<string, unknown>[]> {
  if (usePg()) return contextsPg.getRecentActivityPg(limit);
  return Promise.resolve(getRecentActivitySqlite(limit) as Record<string, unknown>[]);
}

export async function getContextCount(): Promise<{ total: number; active: number }> {
  return usePg() ? contextsPg.getContextCountPg() : Promise.resolve(getContextCountSqlite());
}

export async function getContextCountByTag(tag: string): Promise<number> {
  return usePg() ? contextsPg.getContextCountByTagPg(tag) : Promise.resolve(getContextCountByTagSqlite(tag));
}

export async function getRecentContexts(limit: number = 6): Promise<Context[]> {
  return usePg() ? contextsPg.getRecentContextsPg(limit) : Promise.resolve(getRecentContextsSqlite(limit));
}

/** Get the latest approved version info for governance tracking (Postgres only). */
export async function getLatestApprovedVersion(contextId: string): Promise<{
  content: Record<string, unknown>;
  versionId: string | null;
  versionLabel: string | null;
} | null> {
  if (usePg()) {
    return contextsPg.getLatestApprovedVersionPg(contextId);
  }
  // SQLite doesn't have separate version tracking in the same way
  const context = await getContextById(contextId);
  return context ? { content: context.content, versionId: null, versionLabel: null } : null;
}
