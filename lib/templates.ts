/**
 * Templates: JSON schema and default values for context content.
 * Postgres (pg) only.
 */

import * as templatesPg from './templates-pg';
import type { Template, TemplateCreateInput, TemplateUpdateInput } from '@/types';

export const getAllTemplates = (): Promise<Template[]> => templatesPg.getAllTemplatesPg();
export const getTemplateById = (id: string): Promise<Template | null> => templatesPg.getTemplateByIdPg(id);
export const getTemplateByName = (name: string): Promise<Template | null> => templatesPg.getTemplateByNamePg(name);
export const createTemplate = (input: TemplateCreateInput): Promise<Template> => templatesPg.createTemplatePg(input);
export const updateTemplate = (id: string, input: TemplateUpdateInput): Promise<Template | null> =>
  templatesPg.updateTemplatePg(id, input);
export const deleteTemplate = (id: string): Promise<boolean> => templatesPg.deleteTemplatePg(id);
export const getTemplateCount = (): Promise<number> => templatesPg.getTemplateCountPg();
