/**
 * Contexts: reference data for AI agents. Postgres (pg) only.
 */

import * as contextsPg from './contexts-pg';
import type {
  Context,
  ContextCreateInput,
  ContextUpdateInput,
  LineOfBusiness,
  DataClassification,
  RegulatoryHook,
} from '@/types';

export interface ComplianceFilters {
  lineOfBusiness?: LineOfBusiness;
  dataClassification?: DataClassification;
  regulatoryHook?: RegulatoryHook;
}

export async function getAllContexts(): Promise<Context[]> {
  return contextsPg.getAllContextsPg();
}

export async function getContextsPaginated(limit: number, offset: number): Promise<{ contexts: Context[]; total: number }> {
  return contextsPg.getContextsPaginatedPg(limit, offset);
}

export async function getActiveContexts(): Promise<Context[]> {
  return contextsPg.getActiveContextsPg();
}

export async function getContextById(id: string): Promise<Context | null> {
  return contextsPg.getContextByIdPg(id);
}

export async function getContextByName(name: string): Promise<Context | null> {
  return contextsPg.getContextByNamePg(name);
}

export async function searchContexts(query: string): Promise<Context[]> {
  return contextsPg.searchContextsPg(query);
}

export async function getContextsByComplianceFilters(filters: ComplianceFilters): Promise<Context[]> {
  return contextsPg.getContextsByComplianceFiltersPg(filters);
}

export async function createContext(input: ContextCreateInput): Promise<Context> {
  return contextsPg.createContextPg(input);
}

export async function updateContext(id: string, input: ContextUpdateInput): Promise<Context | null> {
  return contextsPg.updateContextPg(id, input);
}

export async function deleteContext(id: string): Promise<boolean> {
  return contextsPg.deleteContextPg(id);
}

export async function getContextsByTemplate(templateId: string): Promise<Context[]> {
  return contextsPg.getContextsByTemplatePg(templateId);
}

export async function logInjection(contextName: string): Promise<void> {
  await contextsPg.logInjectionPg(contextName);
}

export async function getRecentActivity(limit: number = 10): Promise<Record<string, unknown>[]> {
  return contextsPg.getRecentActivityPg(limit);
}

export async function getContextCount(): Promise<{ total: number; active: number }> {
  return contextsPg.getContextCountPg();
}

export async function getContextCountByTag(tag: string): Promise<number> {
  return contextsPg.getContextCountByTagPg(tag);
}

export async function getRecentContexts(limit: number = 6): Promise<Context[]> {
  return contextsPg.getRecentContextsPg(limit);
}

export async function getLatestApprovedVersion(contextId: string): Promise<{
  content: Record<string, unknown>;
  versionId: string | null;
  versionLabel: string | null;
} | null> {
  return contextsPg.getLatestApprovedVersionPg(contextId);
}
