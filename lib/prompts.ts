import { v4 as uuidv4 } from 'uuid';
import db from './db';
import type { Prompt, PromptVersion, PromptVariable } from '@/types';

// ============================================================================
// PROMPT CRUD
// ============================================================================

export const getAllPrompts = (): Prompt[] => {
  const rows = db.prepare(`
    SELECT * FROM prompts
    ORDER BY updated_at DESC
  `).all();

  return (rows as Record<string, unknown>[]).map(rowToPrompt);
};

export const getPromptById = (id: string): Prompt | null => {
  const row = db.prepare(`SELECT * FROM prompts WHERE id = ?`).get(id);
  return row ? rowToPrompt(row as Record<string, unknown>) : null;
};

export const getPromptByName = (name: string): Prompt | null => {
  const row = db.prepare(`SELECT * FROM prompts WHERE name = ?`).get(name);
  return row ? rowToPrompt(row as Record<string, unknown>) : null;
};

export const createPrompt = (input: {
  name: string;
  description?: string;
  projectId?: string;
  tags?: string[];
}): Prompt => {
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO prompts (id, name, description, project_id, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.name,
    input.description || null,
    input.projectId || null,
    JSON.stringify(input.tags || []),
    now,
    now
  );

  return getPromptById(id)!;
};

export const updatePrompt = (id: string, input: {
  name?: string;
  description?: string;
  currentVersionId?: string;
  projectId?: string;
  tags?: string[];
}): Prompt | null => {
  const existing = getPromptById(id);
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
  if (input.currentVersionId !== undefined) {
    updates.push('current_version_id = ?');
    values.push(input.currentVersionId);
  }
  if (input.projectId !== undefined) {
    updates.push('project_id = ?');
    values.push(input.projectId);
  }
  if (input.tags !== undefined) {
    updates.push('tags = ?');
    values.push(JSON.stringify(input.tags));
  }

  if (updates.length === 0) return existing;

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.prepare(`
    UPDATE prompts SET ${updates.join(', ')} WHERE id = ?
  `).run(...values);

  return getPromptById(id);
};

export const deletePrompt = (id: string): boolean => {
  // Delete all versions first
  db.prepare(`DELETE FROM prompt_versions WHERE prompt_id = ?`).run(id);
  const result = db.prepare(`DELETE FROM prompts WHERE id = ?`).run(id);
  return result.changes > 0;
};

// ============================================================================
// PROMPT VERSIONS
// ============================================================================

export const getPromptVersions = (promptId: string): PromptVersion[] => {
  const rows = db.prepare(`
    SELECT * FROM prompt_versions
    WHERE prompt_id = ?
    ORDER BY version DESC
  `).all(promptId);

  return (rows as Record<string, unknown>[]).map(rowToPromptVersion);
};

export const getPromptVersionById = (id: string): PromptVersion | null => {
  const row = db.prepare(`SELECT * FROM prompt_versions WHERE id = ?`).get(id);
  return row ? rowToPromptVersion(row as Record<string, unknown>) : null;
};

export const getLatestPromptVersion = (promptId: string): PromptVersion | null => {
  const row = db.prepare(`
    SELECT * FROM prompt_versions
    WHERE prompt_id = ?
    ORDER BY version DESC
    LIMIT 1
  `).get(promptId);

  return row ? rowToPromptVersion(row as Record<string, unknown>) : null;
};

export const getCurrentPromptVersion = (promptId: string): PromptVersion | null => {
  const prompt = getPromptById(promptId);
  if (!prompt?.currentVersionId) {
    return getLatestPromptVersion(promptId);
  }
  return getPromptVersionById(prompt.currentVersionId);
};

export const createPromptVersion = (input: {
  promptId: string;
  content: string;
  variables?: PromptVariable[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  metadata?: Record<string, unknown>;
  commitMessage?: string;
  createdBy?: string;
}): PromptVersion => {
  const id = uuidv4();
  const now = new Date().toISOString();

  // Get next version number
  const latestVersion = getLatestPromptVersion(input.promptId);
  const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

  db.prepare(`
    INSERT INTO prompt_versions (
      id, prompt_id, version, content, variables, model, temperature,
      max_tokens, system_prompt, metadata, commit_message, created_by, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.promptId,
    nextVersion,
    input.content,
    JSON.stringify(input.variables || []),
    input.model || null,
    input.temperature || null,
    input.maxTokens || null,
    input.systemPrompt || null,
    JSON.stringify(input.metadata || {}),
    input.commitMessage || null,
    input.createdBy || null,
    now
  );

  // Update prompt's current version
  db.prepare(`
    UPDATE prompts SET current_version_id = ?, updated_at = ? WHERE id = ?
  `).run(id, now, input.promptId);

  return getPromptVersionById(id)!;
};

// ============================================================================
// VARIABLE INTERPOLATION
// ============================================================================

export const interpolatePrompt = (
  content: string,
  variables: Record<string, unknown>
): string => {
  let result = content;

  // Replace {{variable}} patterns
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(pattern, String(value));
  }

  return result;
};

export const extractVariables = (content: string): string[] => {
  const pattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = pattern.exec(content)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables;
};

// ============================================================================
// HELPERS
// ============================================================================

const rowToPrompt = (row: Record<string, unknown>): Prompt => ({
  id: row.id as string,
  name: row.name as string,
  description: row.description as string | null,
  currentVersionId: row.current_version_id as string | null,
  projectId: row.project_id as string | null,
  tags: JSON.parse(row.tags as string),
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

const rowToPromptVersion = (row: Record<string, unknown>): PromptVersion => ({
  id: row.id as string,
  promptId: row.prompt_id as string,
  version: row.version as number,
  content: row.content as string,
  variables: JSON.parse(row.variables as string),
  model: row.model as string | null,
  temperature: row.temperature as number | null,
  maxTokens: row.max_tokens as number | null,
  systemPrompt: row.system_prompt as string | null,
  metadata: JSON.parse(row.metadata as string),
  commitMessage: row.commit_message as string | null,
  createdBy: row.created_by as string | null,
  createdAt: row.created_at as string,
});

// ============================================================================
// STATISTICS
// ============================================================================

export const getPromptCount = (): number => {
  const result = db.prepare(`SELECT COUNT(*) as count FROM prompts`).get() as { count: number };
  return result.count;
};
