-- Migration 003: Add ai_instructions column to context_versions
--
-- Stores the natural language instructions used to generate a Jinja2 template
-- via the AI Generate feature. Both the AI instructions and the resulting
-- Jinja2 template are versioned together in the same context_version row.
--
-- This column is nullable — templates authored directly in Jinja2 won't have
-- AI instructions, while AI-generated templates will store the English prompt.

ALTER TABLE context_versions ADD COLUMN IF NOT EXISTS ai_instructions TEXT;
