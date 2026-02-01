/**
 * Organizations: root + sub-org hierarchy.
 * When DATABASE_URL is set uses Postgres (organizations-pg); else SQLite.
 */

import { v4 as uuidv4 } from 'uuid';
import db, { rowToOrganization } from './db';
import { usePg } from './pg';
import * as orgsPg from './organizations-pg';
import type {
  Organization,
  OrganizationCreateInput,
  OrganizationUpdateInput,
  OrgRole,
} from '@/types';

export async function getRootOrganization(): Promise<Organization | null> {
  if (usePg()) return orgsPg.getRootOrganizationPg();
  const row = db.prepare('SELECT * FROM organizations WHERE is_root = 1 LIMIT 1').get();
  return row ? rowToOrganization(row as Record<string, unknown>) : null;
}

export async function getOrganizationById(id: string): Promise<Organization | null> {
  if (usePg()) return orgsPg.getOrganizationByIdPg(id);
  const row = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id);
  return row ? rowToOrganization(row as Record<string, unknown>) : null;
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  if (usePg()) return orgsPg.getOrganizationBySlugPg(slug);
  const row = db.prepare('SELECT * FROM organizations WHERE slug = ?').get(slug);
  return row ? rowToOrganization(row as Record<string, unknown>) : null;
}

export async function getAllOrganizations(): Promise<Organization[]> {
  if (usePg()) return orgsPg.getAllOrganizationsPg();
  const rows = db.prepare('SELECT * FROM organizations ORDER BY is_root DESC, name ASC').all();
  return (rows as Record<string, unknown>[]).map((r) => rowToOrganization(r));
}

export async function getChildOrganizations(parentId: string): Promise<Organization[]> {
  if (usePg()) return orgsPg.getChildOrganizationsPg(parentId);
  const rows = db
    .prepare('SELECT * FROM organizations WHERE parent_id = ? ORDER BY name ASC')
    .all(parentId);
  return (rows as Record<string, unknown>[]).map((r) => rowToOrganization(r));
}

export async function getOrganizationsTree(): Promise<(Organization & { children: Organization[] })[]> {
  const all = await getAllOrganizations();
  const root = all.filter((o) => o.isRoot);
  const byParent = new Map<string, Organization[]>();
  for (const o of all) {
    if (!o.isRoot && o.parentId) {
      const list = byParent.get(o.parentId) || [];
      list.push(o);
      byParent.set(o.parentId, list);
    }
  }
  const build = (org: Organization): Organization & { children: Organization[] } => ({
    ...org,
    children: (byParent.get(org.id) || []).map(build),
  });
  return root.map(build);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export async function createOrganization(input: OrganizationCreateInput): Promise<Organization> {
  if (usePg()) return orgsPg.createOrganizationPg(input);
  const id = uuidv4();
  const slug = input.slug || slugify(input.name);
  const now = new Date().toISOString();
  const parentId = input.parentId ?? null;

  db.prepare(
    `INSERT INTO organizations (id, name, slug, description, parent_id, is_root, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(id, input.name, slug, input.description ?? null, parentId, now, now);

  const row = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id) as Record<string, unknown>;
  return rowToOrganization(row);
}

export async function updateOrganization(id: string, input: OrganizationUpdateInput): Promise<Organization | null> {
  if (usePg()) return orgsPg.updateOrganizationPg(id, input);
  const org = await getOrganizationById(id);
  if (!org) return null;

  const updates: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    values.push(input.name);
  }
  if (input.slug !== undefined) {
    updates.push('slug = ?');
    values.push(input.slug);
  }
  if (input.description !== undefined) {
    updates.push('description = ?');
    values.push(input.description);
  }
  if (input.parentId !== undefined) {
    updates.push('parent_id = ?');
    values.push(input.parentId);
  }

  if (updates.length === 0) return org;

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.prepare(`UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return getOrganizationById(id);
}

export async function deleteOrganization(id: string): Promise<boolean> {
  if (usePg()) return orgsPg.deleteOrganizationPg(id);
  const org = await getOrganizationById(id);
  if (!org || org.isRoot) return false;
  db.prepare('DELETE FROM organizations WHERE id = ?').run(id);
  return true;
}

// Org members (for future role-based create; no auth yet)
export function addOrgMember(orgId: string, userId: string, role: OrgRole = 'member'): void {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT OR REPLACE INTO org_members (id, org_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, orgId, userId, role, now);
}

export function getOrgMemberRole(orgId: string, userId: string): OrgRole | null {
  const row = db.prepare('SELECT role FROM org_members WHERE org_id = ? AND user_id = ?').get(orgId, userId);
  return row ? (row as { role: OrgRole }).role : null;
}

export async function canCreateSubOrg(orgId: string, _userId?: string): Promise<boolean> {
  const org = await getOrganizationById(orgId);
  return !!org;
}
