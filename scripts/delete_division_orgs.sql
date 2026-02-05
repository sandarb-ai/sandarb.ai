-- Delete all organizations whose name matches "Division $number" (e.g. Division 1, Division 2).
-- Run: psql $DATABASE_URL -f scripts/delete_division_orgs.sql
-- Or: python -c "from backend.db import get_connection; ..." if you prefer.

-- 1. Unlink children: set parent_id to NULL for orgs whose parent is a "Division $number" org
UPDATE organizations
SET parent_id = NULL
WHERE parent_id IN (
  SELECT id FROM organizations WHERE name ~ '^Division [0-9]+$'
);

-- 2. Delete all organizations matching "Division $number"
-- (agents and org_members reference org_id ON DELETE CASCADE, so they are removed automatically)
DELETE FROM organizations
WHERE name ~ '^Division [0-9]+$';
