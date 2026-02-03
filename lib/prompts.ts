import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { getPool, query } from './pg';
import { normalizeApprovedBy } from './utils';
import type { Prompt, PromptVersion, PromptVariable, PromptVersionStatus, PromptVersionCreateInput } from '@/types';

// ============================================================================
// UTILITIES
// ============================================================================

/** Generate SHA256 hash of prompt content for immutability verification. */
export const hashPromptContent = (content: string, systemPrompt?: string | null): string => {
  const combined = `${content}||${systemPrompt ?? ''}`;
  return createHash('sha256').update(combined).digest('hex');
};

// ============================================================================
// PROMPT CRUD
// ============================================================================

export const getAllPrompts = async (): Promise<Prompt[]> => {
  const rows = await query<Record<string, unknown>>(`
    SELECT * FROM prompts ORDER BY updated_at DESC
  `);
  return rows.map(rowToPrompt);
};

export const getPromptById = async (id: string): Promise<Prompt | null> => {
  const rows = await query<Record<string, unknown>>(`SELECT * FROM prompts WHERE id = $1`, [id]);
  return rows.length > 0 ? rowToPrompt(rows[0]) : null;
};

export const getPromptByName = async (name: string): Promise<Prompt | null> => {
  const rows = await query<Record<string, unknown>>(`SELECT * FROM prompts WHERE name = $1`, [name]);
  return rows.length > 0 ? rowToPrompt(rows[0]) : null;
};

export const createPrompt = async (input: {
  name: string;
  description?: string;
  projectId?: string;
  tags?: string[];
}): Promise<Prompt> => {
  const id = uuidv4();
  const now = new Date().toISOString();

  await query(
    `INSERT INTO prompts (id, name, description, tags, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $5)`,
    [id, input.name, input.description || null, JSON.stringify(input.tags || []), now]
  );
  return (await getPromptById(id))!;
};

export const updatePrompt = async (id: string, input: {
  name?: string;
  description?: string;
  currentVersionId?: string;
  projectId?: string;
  tags?: string[];
}): Promise<Prompt | null> => {
  const existing = await getPromptById(id);
  if (!existing) return null;

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(input.name);
  }
  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(input.description);
  }
  if (input.currentVersionId !== undefined) {
    updates.push(`current_version_id = $${paramIndex++}`);
    values.push(input.currentVersionId);
  }
  if (input.tags !== undefined) {
    updates.push(`tags = $${paramIndex++}`);
    values.push(JSON.stringify(input.tags));
  }
  if (updates.length === 0) return existing;

  updates.push(`updated_at = $${paramIndex++}`);
  values.push(new Date().toISOString());
  values.push(id);

  await query(`UPDATE prompts SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values);
  return getPromptById(id);
};

export const deletePrompt = async (id: string): Promise<boolean> => {
  const pool = await getPool();
  if (!pool) return false;
  const result = await pool.query(`DELETE FROM prompts WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
};

// ============================================================================
// PROMPT VERSIONS
// ============================================================================

export const getPromptVersions = async (promptId: string): Promise<PromptVersion[]> => {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM prompt_versions WHERE prompt_id = $1 ORDER BY version DESC`,
    [promptId]
  );
  return rows.map(rowToPromptVersion);
};

export const getPromptVersionById = async (id: string): Promise<PromptVersion | null> => {
  const rows = await query<Record<string, unknown>>(`SELECT * FROM prompt_versions WHERE id = $1`, [id]);
  return rows.length > 0 ? rowToPromptVersion(rows[0]) : null;
};

export const getLatestPromptVersion = async (promptId: string): Promise<PromptVersion | null> => {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM prompt_versions WHERE prompt_id = $1 ORDER BY version DESC LIMIT 1`,
    [promptId]
  );
  return rows.length > 0 ? rowToPromptVersion(rows[0]) : null;
};

/** Get the current (approved) version of a prompt. */
export const getCurrentPromptVersion = async (promptId: string): Promise<PromptVersion | null> => {
  const prompt = await getPromptById(promptId);
  if (prompt?.currentVersionId) {
    const version = await getPromptVersionById(prompt.currentVersionId);
    // Ensure current version is approved
    if (version?.status === 'approved') {
      return version;
    }
  }
  // Fallback: find the latest approved version
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM prompt_versions WHERE prompt_id = $1 AND status = 'approved' ORDER BY version DESC LIMIT 1`,
    [promptId]
  );
  return rows.length > 0 ? rowToPromptVersion(rows[0]) : null;
};

/**
 * Create a new prompt version with governance workflow.
 * By default, versions are created as 'proposed' and require approval.
 * Set autoApprove: true for backward compatibility (immediate approval).
 */
export const createPromptVersion = async (input: PromptVersionCreateInput): Promise<PromptVersion> => {
  const id = uuidv4();
  const now = new Date().toISOString();

  // Get next version number and parent version
  const latestVersion = await getLatestPromptVersion(input.promptId);
  const nextVersion = latestVersion ? latestVersion.version + 1 : 1;
  const parentVersionId = latestVersion?.id ?? null;

  // Generate content hash for immutability
  const sha256Hash = hashPromptContent(input.content, input.systemPrompt);

  // Determine initial status (proposed by default, approved if autoApprove)
  const status: PromptVersionStatus = input.autoApprove ? 'approved' : 'proposed';
  const createdByNorm = normalizeApprovedBy(input.createdBy ?? 'system');
  const approvedBy = input.autoApprove ? createdByNorm : null;
  const approvedAt = input.autoApprove ? now : null;
  const submittedBy = status === 'proposed' ? createdByNorm : null;
  const updatedAt = input.autoApprove ? now : null;
  const updatedBy = input.autoApprove ? approvedBy : null;

  await query(
    `INSERT INTO prompt_versions (
      id, prompt_id, version, content, system_prompt, model,
      commit_message, created_by, created_at, submitted_by, status, approved_by, approved_at, updated_at, updated_by, parent_version_id, sha256_hash
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
    [
      id,
      input.promptId,
      nextVersion,
      input.content,
      input.systemPrompt || null,
      input.model || 'gpt-4',
      input.commitMessage || null,
      createdByNorm,
      now,
      submittedBy,
      status,
      approvedBy,
      approvedAt,
      updatedAt,
      updatedBy,
      parentVersionId,
      sha256Hash
    ]
  );

  if (input.autoApprove) {
    await query(
      `UPDATE prompts SET current_version_id = $1, updated_at = $2 WHERE id = $3`,
      [id, now, input.promptId]
    );
  }

  const prompt = await getPromptById(input.promptId);
  await logPromptVersionActivity(
    input.autoApprove ? 'version_approved' : 'version_proposed',
    input.promptId,
    prompt?.name ?? 'unknown',
    id,
    input.createdBy
  );

  return (await getPromptVersionById(id))!;
};

// ============================================================================
// APPROVAL WORKFLOW
// ============================================================================

/** Get all proposed (pending approval) versions for a prompt. */
export const getProposedPromptVersions = async (promptId: string): Promise<PromptVersion[]> => {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM prompt_versions WHERE prompt_id = $1 AND status = 'proposed' ORDER BY version DESC`,
    [promptId]
  );
  return rows.map(rowToPromptVersion);
};

/** Get all proposed versions across all prompts (for governance dashboard). */
export const getAllProposedPromptVersions = async (): Promise<PromptVersion[]> => {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM prompt_versions WHERE status = 'proposed' ORDER BY created_at DESC`
  );
  return rows.map(rowToPromptVersion);
};

/** Approve a prompt version: sets status to 'approved' and makes it the current version. */
export const approvePromptVersion = async (
  versionId: string,
  approvedBy?: string
): Promise<PromptVersion | null> => {
  const version = await getPromptVersionById(versionId);
  if (!version) return null;
  if (version.status !== 'proposed') {
    // Only proposed versions can be approved
    return null;
  }

  const now = new Date().toISOString();
  const normalized = normalizeApprovedBy(approvedBy);

  await query(
    `UPDATE prompt_versions SET status = 'approved', approved_by = $1, approved_at = $2, updated_at = $2, updated_by = $1 WHERE id = $3`,
    [normalized, now, versionId]
  );

  await query(
    `UPDATE prompts SET current_version_id = $1, updated_at = $2, updated_by = $3 WHERE id = $4`,
    [versionId, now, normalized, version.promptId]
  );

  const prompt = await getPromptById(version.promptId);
  await logPromptVersionActivity('version_approved', version.promptId, prompt?.name != null ? prompt.name : 'unknown', versionId, normalized ?? undefined);

  return getPromptVersionById(versionId);
};

/** Reject a prompt version: sets status to 'rejected'. */
export const rejectPromptVersion = async (
  versionId: string,
  rejectedBy?: string
): Promise<PromptVersion | null> => {
  const version = await getPromptVersionById(versionId);
  if (!version) return null;
  if (version.status !== 'proposed') {
    // Only proposed versions can be rejected
    return null;
  }

  const now = new Date().toISOString();
  const normalized = normalizeApprovedBy(rejectedBy);

  await query(
    `UPDATE prompt_versions SET status = 'rejected', approved_by = $1, approved_at = $2, updated_at = $2, updated_by = $1 WHERE id = $3`,
    [normalized, now, versionId]
  );

  const prompt = await getPromptById(version.promptId);
  await logPromptVersionActivity('version_rejected', version.promptId, prompt?.name != null ? prompt.name : 'unknown', versionId, rejectedBy ?? undefined);

  return getPromptVersionById(versionId);
};

/** Archive a prompt version (for decommissioning old versions). */
export const archivePromptVersion = async (
  versionId: string,
  archivedBy?: string
): Promise<PromptVersion | null> => {
  const version = await getPromptVersionById(versionId);
  if (!version) return null;
  if (version.status === 'archived') return version;

  const now = new Date().toISOString();
  const normalized = normalizeApprovedBy(archivedBy);

  await query(
    `UPDATE prompt_versions SET status = 'archived', approved_by = $1, approved_at = $2, updated_at = $2, updated_by = $1 WHERE id = $3`,
    [normalized, now, versionId]
  );

  const prompt = await getPromptById(version.promptId);
  if (prompt?.currentVersionId === versionId) {
    const rows = await query<{ id: string }>(
      `SELECT id FROM prompt_versions WHERE prompt_id = $1 AND status = 'approved' AND id != $2 ORDER BY version DESC LIMIT 1`,
      [version.promptId, versionId]
    );
    await query(
      `UPDATE prompts SET current_version_id = $1, updated_at = $2 WHERE id = $3`,
      [rows[0]?.id ?? null, now, version.promptId]
    );
  }

  await logPromptVersionActivity('version_archived', version.promptId, prompt?.name != null ? prompt.name : 'unknown', versionId, archivedBy ?? undefined);
  return getPromptVersionById(versionId);
};

/** Verify content integrity by comparing stored hash with computed hash. */
export const verifyPromptVersionIntegrity = async (versionId: string): Promise<boolean> => {
  const version = await getPromptVersionById(versionId);
  if (!version || !version.sha256Hash) return false;

  const computedHash = hashPromptContent(version.content, version.systemPrompt);
  return computedHash === version.sha256Hash;
};

// ============================================================================
// ACTIVITY LOGGING
// ============================================================================

/** Log prompt version activity for audit trail. */
async function logPromptVersionActivity(
  type: string,
  promptId: string,
  promptName: string,
  versionId: string,
  userId?: string
): Promise<void> {
  const id = uuidv4();
  const now = new Date().toISOString();

  try {
    await query(
      `INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, details, created_by, created_at)
       VALUES ($1, $2, 'prompt', $3, $4, $5, $6, $7)`,
      [id, type, promptId, promptName, JSON.stringify({ versionId }), userId ?? null, now]
    );
  } catch {
    // Activity log may not exist, ignore
  }
}

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

const parseTags = (tags: unknown): string[] => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // If not valid JSON, treat as a single tag or comma-separated
      return tags.split(',').map(t => t.trim()).filter(Boolean);
    }
  }
  return [];
};

const rowToPrompt = (row: Record<string, unknown>): Prompt => ({
  id: row.id as string,
  name: row.name as string,
  description: row.description as string | null,
  currentVersionId: row.current_version_id as string | null,
  projectId: row.project_id as string | null,
  tags: parseTags(row.tags),
  createdBy: row.created_by as string | null,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
  updatedBy: row.updated_by as string | null,
});

const parseJson = <T>(val: unknown, fallback: T): T => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val as T;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
};

const rowToPromptVersion = (row: Record<string, unknown>): PromptVersion => ({
  id: row.id as string,
  promptId: row.prompt_id as string,
  version: row.version as number,
  content: row.content as string,
  variables: parseJson<PromptVariable[]>(row.variables, []),
  model: row.model as string | null,
  temperature: row.temperature as number | null,
  maxTokens: row.max_tokens as number | null,
  systemPrompt: row.system_prompt as string | null,
  metadata: parseJson<Record<string, unknown>>(row.metadata, {}),
  commitMessage: row.commit_message as string | null,
  createdBy: row.created_by as string | null,
  createdAt: row.created_at as string,
  submittedBy: row.submitted_by as string | null,
  updatedAt: row.updated_at != null ? String(row.updated_at) : null,
  updatedBy: row.updated_by as string | null,
  // Governance fields
  status: (row.status as PromptVersionStatus) ?? 'approved',
  approvedBy: row.approved_by as string | null,
  approvedAt: row.approved_at as string | null,
  parentVersionId: row.parent_version_id as string | null,
  sha256Hash: row.sha256_hash as string | null,
});

// ============================================================================
// STATISTICS
// ============================================================================

export const getPromptCount = async (): Promise<number> => {
  const rows = await query<{ count: string }>(`SELECT COUNT(*)::text as count FROM prompts`);
  return parseInt(rows[0]?.count || '0', 10);
};

export const getPromptStats = async (): Promise<{ total: number; active: number }> => {
  const rows = await query<{ total: string; active: string }>(`
    SELECT 
      COUNT(*)::text as total,
      COUNT(CASE WHEN current_version_id IS NOT NULL THEN 1 END)::text as active
    FROM prompts
  `);
  return {
    total: parseInt(rows[0]?.total || '0', 10),
    active: parseInt(rows[0]?.active || '0', 10),
  };
};

export const getRecentPrompts = async (limit: number = 6): Promise<Prompt[]> => {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM prompts ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows.map(rowToPrompt);
};
