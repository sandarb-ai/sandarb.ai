/**
 * Postgres implementation for templates.
 */

import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, getPool } from './pg';
import type { Template, TemplateCreateInput, TemplateUpdateInput } from '@/types';

function rowToTemplate(row: Record<string, unknown>): Template {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description != null ? String(row.description) : null,
    schema: typeof row.schema === 'object' ? (row.schema as Template['schema']) : JSON.parse(String(row.schema || '{}')),
    defaultValues: typeof row.default_values === 'object' ? (row.default_values as Template['defaultValues']) : JSON.parse(String(row.default_values || '{}')),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
  };
}

export async function getAllTemplatesPg(): Promise<Template[]> {
  const rows = await query<Record<string, unknown>>('SELECT * FROM templates ORDER BY name ASC');
  return rows.map(rowToTemplate);
}

export async function getTemplateByIdPg(id: string): Promise<Template | null> {
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM templates WHERE id = $1', [id]);
  return row ? rowToTemplate(row) : null;
}

export async function getTemplateByNamePg(name: string): Promise<Template | null> {
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM templates WHERE name = $1', [name]);
  return row ? rowToTemplate(row) : null;
}

export async function createTemplatePg(input: TemplateCreateInput): Promise<Template> {
  const pool = await getPool();
  if (!pool) throw new Error('Postgres not configured');
  const id = uuidv4();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO templates (id, name, description, schema, default_values, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $6)`,
    [id, input.name, input.description || null, JSON.stringify(input.schema), JSON.stringify(input.defaultValues || {}), now]
  );
  return (await getTemplateByIdPg(id))!;
}

export async function updateTemplatePg(id: string, input: TemplateUpdateInput): Promise<Template | null> {
  const existing = await getTemplateByIdPg(id);
  if (!existing) return null;
  const pool = await getPool();
  if (!pool) return null;
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
  if (input.schema !== undefined) {
    updates.push(`schema = $${i++}`);
    values.push(JSON.stringify(input.schema));
  }
  if (input.defaultValues !== undefined) {
    updates.push(`default_values = $${i++}`);
    values.push(JSON.stringify(input.defaultValues));
  }
  if (updates.length === 0) return existing;
  updates.push(`updated_at = $${i++}`);
  values.push(new Date().toISOString());
  values.push(id);
  await pool.query(`UPDATE templates SET ${updates.join(', ')} WHERE id = $${i}`, values);
  return getTemplateByIdPg(id);
}

export async function deleteTemplatePg(id: string): Promise<boolean> {
  const pool = await getPool();
  if (!pool) return false;
  const result = await pool.query('DELETE FROM templates WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function getTemplateCountPg(): Promise<number> {
  const rows = await query<{ count: string }>('SELECT COUNT(*)::text as count FROM templates');
  return parseInt(rows[0]?.count || '0', 10);
}
