/**
 * Organizations: root + sub-org hierarchy.
 * Postgres (pg) only.
 */

import * as orgsPg from './organizations-pg';
import type {
  Organization,
  OrganizationCreateInput,
  OrganizationUpdateInput,
  OrgRole,
} from '@/types';

export async function getRootOrganization(): Promise<Organization | null> {
  return orgsPg.getRootOrganizationPg();
}

export async function getOrganizationById(id: string): Promise<Organization | null> {
  return orgsPg.getOrganizationByIdPg(id);
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  return orgsPg.getOrganizationBySlugPg(slug);
}

export async function getAllOrganizations(): Promise<Organization[]> {
  return orgsPg.getAllOrganizationsPg();
}

export async function getChildOrganizations(parentId: string): Promise<Organization[]> {
  return orgsPg.getChildOrganizationsPg(parentId);
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

export async function createOrganization(input: OrganizationCreateInput): Promise<Organization> {
  return orgsPg.createOrganizationPg(input);
}

export async function updateOrganization(id: string, input: OrganizationUpdateInput): Promise<Organization | null> {
  return orgsPg.updateOrganizationPg(id, input);
}

export async function deleteOrganization(id: string): Promise<boolean> {
  return orgsPg.deleteOrganizationPg(id);
}

export async function addOrgMember(orgId: string, userId: string, role: OrgRole = 'member'): Promise<void> {
  return orgsPg.addOrgMemberPg(orgId, userId, role);
}

export async function getOrgMemberRole(orgId: string, userId: string): Promise<OrgRole | null> {
  return orgsPg.getOrgMemberRolePg(orgId, userId);
}

export async function canCreateSubOrg(orgId: string, _userId?: string): Promise<boolean> {
  const org = await getOrganizationById(orgId);
  return !!org;
}
