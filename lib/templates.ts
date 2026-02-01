import { v4 as uuidv4 } from 'uuid';
import db, { rowToTemplate } from './db';
import type { Template, TemplateCreateInput, TemplateUpdateInput } from '@/types';

// Get all templates
export const getAllTemplates = (): Template[] => {
  const rows = db.prepare(`
    SELECT * FROM templates
    ORDER BY name ASC
  `).all();

  return (rows as Record<string, unknown>[]).map(rowToTemplate);
};

// Get template by ID
export const getTemplateById = (id: string): Template | null => {
  const row = db.prepare(`
    SELECT * FROM templates WHERE id = ?
  `).get(id);

  return row ? rowToTemplate(row as Record<string, unknown>) : null;
};

// Get template by name
export const getTemplateByName = (name: string): Template | null => {
  const row = db.prepare(`
    SELECT * FROM templates WHERE name = ?
  `).get(name);

  return row ? rowToTemplate(row as Record<string, unknown>) : null;
};

// Create new template
export const createTemplate = (input: TemplateCreateInput): Template => {
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO templates (id, name, description, schema, default_values, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.name,
    input.description || null,
    JSON.stringify(input.schema),
    JSON.stringify(input.defaultValues || {}),
    now,
    now
  );

  return getTemplateById(id)!;
};

// Update template
export const updateTemplate = (id: string, input: TemplateUpdateInput): Template | null => {
  const existing = getTemplateById(id);
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
  if (input.schema !== undefined) {
    updates.push('schema = ?');
    values.push(JSON.stringify(input.schema));
  }
  if (input.defaultValues !== undefined) {
    updates.push('default_values = ?');
    values.push(JSON.stringify(input.defaultValues));
  }

  if (updates.length === 0) return existing;

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.prepare(`
    UPDATE templates
    SET ${updates.join(', ')}
    WHERE id = ?
  `).run(...values);

  return getTemplateById(id);
};

// Delete template
export const deleteTemplate = (id: string): boolean => {
  const result = db.prepare(`DELETE FROM templates WHERE id = ?`).run(id);
  return result.changes > 0;
};

// Get template count
export const getTemplateCount = (): number => {
  const result = db.prepare(`SELECT COUNT(*) as count FROM templates`).get() as { count: number };
  return result.count;
};
