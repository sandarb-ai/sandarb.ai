-- Migration 001: Add API key expiration to service_accounts
-- NULL expires_at = key never expires (backward compatible with existing keys)

ALTER TABLE service_accounts
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_service_accounts_expires_at
  ON service_accounts(expires_at)
  WHERE expires_at IS NOT NULL;
