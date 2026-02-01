/**
 * Postgres implementation for organizations.
 */

import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, getPool } from './pg';
import type { Organization, OrganizationCreateInput, OrganizationUpdateInput } from '@/types';

function rowToOrg(row: Record<string, unknown>): Organization {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: row.description != null ? String(row.description) : null,
    parentId: row.parent_id != null ? String(row.parent_id) : null,
    isRoot: Boolean(row.is_root),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
  };
}

export async function getRootOrganizationPg(): Promise<Organization | null> {
  const row = await queryOne<Record<string, unknown>>(
    "SELECT * FROM organizations WHERE is_root = true OR slug = 'root' LIMIT 1"
  );
  return row ? rowToOrg(row) : null;
}

export async function getOrganizationByIdPg(id: string): Promise<Organization | null> {
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM organizations WHERE id = $1', [id]);
  return row ? rowToOrg(row) : null;
}

export async function getOrganizationBySlugPg(slug: string): Promise<Organization | null> {
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM organizations WHERE slug = $1', [slug]);
  return row ? rowToOrg(row) : null;
}

export async function getAllOrganizationsPg(): Promise<Organization[]> {
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM organizations ORDER BY is_root DESC, name ASC'
  );
  return rows.map(rowToOrg);
}

export async function getChildOrganizationsPg(parentId: string): Promise<Organization[]> {
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM organizations WHERE parent_id = $1 ORDER BY name ASC',
    [parentId]
  );
  return rows.map(rowToOrg);
}

export async function createOrganizationPg(input: OrganizationCreateInput): Promise<Organization> {
  const pool = await getPool();
  if (!pool) throw new Error('Postgres not configured');
  const id = uuidv4();
  const now = new Date().toISOString();
  const slug = input.slug ?? input.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  await pool.query(
    `INSERT INTO organizations (id, name, slug, description, parent_id, is_root, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, false, $6, $6)`,
    [id, input.name, slug, input.description ?? null, input.parentId ?? null, now]
  );
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM organizations WHERE id = $1', [id]);
  return rowToOrg(row!);
}

export async function updateOrganizationPg(id: string, input: OrganizationUpdateInput): Promise<Organization | null> {
  const existing = await getOrganizationByIdPg(id);
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
  if (input.slug !== undefined) {
    updates.push(`slug = $${i++}`);
    values.push(input.slug);
  }
  if (input.description !== undefined) {
    updates.push(`description = $${i++}`);
    values.push(input.description);
  }
  if (input.parentId !== undefined) {
    updates.push(`parent_id = $${i++}`);
    values.push(input.parentId);
  }
  if (updates.length === 0) return existing;
  updates.push(`updated_at = $${i++}`);
  values.push(new Date().toISOString());
  values.push(id);
  await pool.query(`UPDATE organizations SET ${updates.join(', ')} WHERE id = $${i}`, values);
  return getOrganizationByIdPg(id);
}

export async function deleteOrganizationPg(id: string): Promise<boolean> {
  const org = await getOrganizationByIdPg(id);
  if (!org || org.isRoot) return false;
  const pool = await getPool();
  if (!pool) return false;
  await pool.query('DELETE FROM organizations WHERE id = $1', [id]);
  return true;
}
