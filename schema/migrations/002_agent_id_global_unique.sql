-- Migration 002: Make agent_id globally unique (not per-org)
--
-- Previously: UNIQUE(org_id, agent_id) — agent_id was unique per organization
-- Now:        UNIQUE(agent_id) NOT NULL — agent_id is globally unique (like contexts.name and prompts.name)
--
-- This aligns agents with the SRN (Sandarb Resource Name, inspired by URN) convention: agent.{kebab-case} is a globally unique identifier.

-- Step 1: Backfill any NULL agent_id values (shouldn't exist with SRN seed data, but safety first)
UPDATE agents SET agent_id = 'agent.' || REPLACE(LOWER(name), ' ', '-') || '-' || LEFT(id::text, 8)
WHERE agent_id IS NULL;

-- Step 2: Drop the old composite unique constraint
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_org_id_agent_id_key;

-- Step 3: Make agent_id NOT NULL and globally unique
ALTER TABLE agents ALTER COLUMN agent_id SET NOT NULL;
ALTER TABLE agents ADD CONSTRAINT agents_agent_id_key UNIQUE (agent_id);
