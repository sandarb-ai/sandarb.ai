import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import db from './db';
import { usePg, getPool, query } from './pg';
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
  if (usePg()) {
    const rows = await query<Record<string, unknown>>(`
      SELECT * FROM prompts ORDER BY updated_at DESC
    `);
    return rows.map(rowToPrompt);
  }
  const rows = db.prepare(`
    SELECT * FROM prompts
    ORDER BY updated_at DESC
  `).all();

  return (rows as Record<string, unknown>[]).map(rowToPrompt);
};

export const getPromptById = async (id: string): Promise<Prompt | null> => {
  if (usePg()) {
    const rows = await query<Record<string, unknown>>(`SELECT * FROM prompts WHERE id = $1`, [id]);
    return rows.length > 0 ? rowToPrompt(rows[0]) : null;
  }
  const row = db.prepare(`SELECT * FROM prompts WHERE id = ?`).get(id);
  return row ? rowToPrompt(row as Record<string, unknown>) : null;
};

export const getPromptByName = async (name: string): Promise<Prompt | null> => {
  if (usePg()) {
    const rows = await query<Record<string, unknown>>(`SELECT * FROM prompts WHERE name = $1`, [name]);
    return rows.length > 0 ? rowToPrompt(rows[0]) : null;
  }
  const row = db.prepare(`SELECT * FROM prompts WHERE name = ?`).get(name);
  return row ? rowToPrompt(row as Record<string, unknown>) : null;
};

export const createPrompt = async (input: {
  name: string;
  description?: string;
  projectId?: string;
  tags?: string[];
}): Promise<Prompt> => {
  const id = uuidv4();
  const now = new Date().toISOString();

  if (usePg()) {
    await query(
      `INSERT INTO prompts (id, name, description, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)`,
      [id, input.name, input.description || null, JSON.stringify(input.tags || []), now]
    );
    return (await getPromptById(id))!;
  }

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

  if (usePg()) {
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
  }

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

export const deletePrompt = async (id: string): Promise<boolean> => {
  if (usePg()) {
    // CASCADE handles versions
    const result = await query(`DELETE FROM prompts WHERE id = $1`, [id]);
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }
  // Delete all versions first
  db.prepare(`DELETE FROM prompt_versions WHERE prompt_id = ?`).run(id);
  const result = db.prepare(`DELETE FROM prompts WHERE id = ?`).run(id);
  return result.changes > 0;
};

// ============================================================================
// PROMPT VERSIONS
// ============================================================================

export const getPromptVersions = async (promptId: string): Promise<PromptVersion[]> => {
  if (usePg()) {
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM prompt_versions WHERE prompt_id = $1 ORDER BY version DESC`,
      [promptId]
    );
    return rows.map(rowToPromptVersion);
  }
  const rows = db.prepare(`
    SELECT * FROM prompt_versions
    WHERE prompt_id = ?
    ORDER BY version DESC
  `).all(promptId);

  return (rows as Record<string, unknown>[]).map(rowToPromptVersion);
};

export const getPromptVersionById = async (id: string): Promise<PromptVersion | null> => {
  if (usePg()) {
    const rows = await query<Record<string, unknown>>(`SELECT * FROM prompt_versions WHERE id = $1`, [id]);
    return rows.length > 0 ? rowToPromptVersion(rows[0]) : null;
  }
  const row = db.prepare(`SELECT * FROM prompt_versions WHERE id = ?`).get(id);
  return row ? rowToPromptVersion(row as Record<string, unknown>) : null;
};

export const getLatestPromptVersion = async (promptId: string): Promise<PromptVersion | null> => {
  if (usePg()) {
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM prompt_versions WHERE prompt_id = $1 ORDER BY version DESC LIMIT 1`,
      [promptId]
    );
    return rows.length > 0 ? rowToPromptVersion(rows[0]) : null;
  }
  const row = db.prepare(`
    SELECT * FROM prompt_versions
    WHERE prompt_id = ?
    ORDER BY version DESC
    LIMIT 1
  `).get(promptId);

  return row ? rowToPromptVersion(row as Record<string, unknown>) : null;
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
  if (usePg()) {
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM prompt_versions WHERE prompt_id = $1 AND status = 'approved' ORDER BY version DESC LIMIT 1`,
      [promptId]
    );
    return rows.length > 0 ? rowToPromptVersion(rows[0]) : null;
  }
  const row = db.prepare(`
    SELECT * FROM prompt_versions
    WHERE prompt_id = ? AND status = 'approved'
    ORDER BY version DESC
    LIMIT 1
  `).get(promptId);

  return row ? rowToPromptVersion(row as Record<string, unknown>) : null;
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
  const approvedBy = input.autoApprove ? (input.createdBy ?? 'system') : null;
  const approvedAt = input.autoApprove ? now : null;

  if (usePg()) {
    await query(
      `INSERT INTO prompt_versions (
        id, prompt_id, version, content, system_prompt, model,
        commit_message, created_at, status, approved_by, approved_at, parent_version_id, sha256_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id,
        input.promptId,
        nextVersion,
        input.content,
        input.systemPrompt || null,
        input.model || 'gpt-4',
        input.commitMessage || null,
        now,
        status,
        approvedBy,
        approvedAt,
        parentVersionId,
        sha256Hash
      ]
    );

    // Only update prompt's current version if auto-approved
    if (input.autoApprove) {
      await query(
        `UPDATE prompts SET current_version_id = $1, updated_at = $2 WHERE id = $3`,
        [id, now, input.promptId]
      );
    }

    // Log activity
    const prompt = await getPromptById(input.promptId);
    await logPromptVersionActivity(
      input.autoApprove ? 'version_approved' : 'version_proposed',
      input.promptId,
      prompt?.name ?? 'unknown',
      id,
      input.createdBy
    );

    return (await getPromptVersionById(id))!;
  }

  db.prepare(`
    INSERT INTO prompt_versions (
      id, prompt_id, version, content, variables, model, temperature,
      max_tokens, system_prompt, metadata, commit_message, created_by, created_at,
      status, approved_by, approved_at, parent_version_id, sha256_hash
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    now,
    status,
    approvedBy,
    approvedAt,
    parentVersionId,
    sha256Hash
  );

  // Only update prompt's current version if auto-approved
  if (input.autoApprove) {
    db.prepare(`
      UPDATE prompts SET current_version_id = ?, updated_at = ? WHERE id = ?
    `).run(id, now, input.promptId);
  }

  // Log activity
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
  if (usePg()) {
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM prompt_versions WHERE prompt_id = $1 AND status = 'proposed' ORDER BY version DESC`,
      [promptId]
    );
    return rows.map(rowToPromptVersion);
  }
  const rows = db.prepare(`
    SELECT * FROM prompt_versions
    WHERE prompt_id = ? AND status = 'proposed'
    ORDER BY version DESC
  `).all(promptId);

  return (rows as Record<string, unknown>[]).map(rowToPromptVersion);
};

/** Get all proposed versions across all prompts (for governance dashboard). */
export const getAllProposedPromptVersions = async (): Promise<PromptVersion[]> => {
  if (usePg()) {
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM prompt_versions WHERE status = 'proposed' ORDER BY created_at DESC`
    );
    return rows.map(rowToPromptVersion);
  }
  const rows = db.prepare(`
    SELECT * FROM prompt_versions
    WHERE status = 'proposed'
    ORDER BY created_at DESC
  `).all();

  return (rows as Record<string, unknown>[]).map(rowToPromptVersion);
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

  if (usePg()) {
    // Update version status
    await query(
      `UPDATE prompt_versions SET status = 'approved', approved_by = $1, approved_at = $2 WHERE id = $3`,
      [approvedBy ?? null, now, versionId]
    );

    // Set as current version on the prompt
    await query(
      `UPDATE prompts SET current_version_id = $1, updated_at = $2 WHERE id = $3`,
      [versionId, now, version.promptId]
    );

    // Log activity
    const prompt = await getPromptById(version.promptId);
    await logPromptVersionActivity('version_approved', version.promptId, prompt?.name ?? 'unknown', versionId, approvedBy);

    return getPromptVersionById(versionId);
  }

  // Update version status
  db.prepare(`
    UPDATE prompt_versions
    SET status = 'approved', approved_by = ?, approved_at = ?
    WHERE id = ?
  `).run(approvedBy ?? null, now, versionId);

  // Set as current version on the prompt
  db.prepare(`
    UPDATE prompts SET current_version_id = ?, updated_at = ? WHERE id = ?
  `).run(versionId, now, version.promptId);

  // Log activity
  const prompt = await getPromptById(version.promptId);
  await logPromptVersionActivity('version_approved', version.promptId, prompt?.name ?? 'unknown', versionId, approvedBy);

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

  if (usePg()) {
    await query(
      `UPDATE prompt_versions SET status = 'rejected', approved_by = $1, approved_at = $2 WHERE id = $3`,
      [rejectedBy ?? null, now, versionId]
    );

    // Log activity
    const prompt = await getPromptById(version.promptId);
    await logPromptVersionActivity('version_rejected', version.promptId, prompt?.name ?? 'unknown', versionId, rejectedBy);

    return getPromptVersionById(versionId);
  }

  // Update version status (reuse approved_by/approved_at for rejection tracking)
  db.prepare(`
    UPDATE prompt_versions
    SET status = 'rejected', approved_by = ?, approved_at = ?
    WHERE id = ?
  `).run(rejectedBy ?? null, now, versionId);

  // Log activity
  const prompt = await getPromptById(version.promptId);
  await logPromptVersionActivity('version_rejected', version.promptId, prompt?.name ?? 'unknown', versionId, rejectedBy);

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

  if (usePg()) {
    await query(
      `UPDATE prompt_versions SET status = 'archived', approved_by = $1, approved_at = $2 WHERE id = $3`,
      [archivedBy ?? null, now, versionId]
    );

    // If this was the current version, clear it
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

    await logPromptVersionActivity('version_archived', version.promptId, prompt?.name ?? 'unknown', versionId, archivedBy);
    return getPromptVersionById(versionId);
  }

  db.prepare(`
    UPDATE prompt_versions
    SET status = 'archived', approved_by = ?, approved_at = ?
    WHERE id = ?
  `).run(archivedBy ?? null, now, versionId);

  // If this was the current version, clear it
  const prompt = await getPromptById(version.promptId);
  if (prompt?.currentVersionId === versionId) {
    // Find the most recent approved version to set as current
    const approvedVersions = db.prepare(`
      SELECT id FROM prompt_versions
      WHERE prompt_id = ? AND status = 'approved' AND id != ?
      ORDER BY version DESC
      LIMIT 1
    `).get(version.promptId, versionId) as { id: string } | undefined;

    db.prepare(`
      UPDATE prompts SET current_version_id = ?, updated_at = ? WHERE id = ?
    `).run(approvedVersions?.id ?? null, now, version.promptId);
  }

  await logPromptVersionActivity('version_archived', version.promptId, prompt?.name ?? 'unknown', versionId, archivedBy);

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

  if (usePg()) {
    try {
      await query(
        `INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, details, created_by, created_at)
         VALUES ($1, $2, 'prompt', $3, $4, $5, $6, $7)`,
        [id, type, promptId, promptName, JSON.stringify({ versionId }), userId ?? null, now]
      );
    } catch {
      // Activity log may not exist in Postgres, ignore
    }
    return;
  }

  db.prepare(`
    INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, details, created_by, created_at)
    VALUES (?, ?, 'prompt', ?, ?, ?, ?, ?)
  `).run(
    id,
    type,
    promptId,
    promptName,
    JSON.stringify({ versionId }),
    userId ?? null,
    now
  );
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
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
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
  if (usePg()) {
    const rows = await query<{ count: string }>(`SELECT COUNT(*)::text as count FROM prompts`);
    return parseInt(rows[0]?.count || '0', 10);
  }
  const result = db.prepare(`SELECT COUNT(*) as count FROM prompts`).get() as { count: number };
  return result.count;
};

export const getPromptStats = async (): Promise<{ total: number; active: number }> => {
  if (usePg()) {
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
  }
  const result = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN current_version_id IS NOT NULL THEN 1 ELSE 0 END) as active
    FROM prompts
  `).get() as { total: number; active: number };
  return { total: result.total, active: result.active || 0 };
};

export const getRecentPrompts = async (limit: number = 6): Promise<Prompt[]> => {
  if (usePg()) {
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM prompts ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return rows.map(rowToPrompt);
  }
  const rows = db.prepare(`
    SELECT * FROM prompts
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as Record<string, unknown>[];
  return rows.map(rowToPrompt);
};
