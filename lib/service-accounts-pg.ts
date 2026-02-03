/**
 * Service account lookup for A2A token auth. Verifies client_id/secret against
 * service_accounts table using bcrypt for the secret.
 *
 * To create a service account: hash the secret with hashSecret(), then
 * INSERT INTO service_accounts (client_id, secret_hash, agent_id) VALUES (...).
 */

import { queryOne } from '@/lib/pg';
import { compare, hash } from 'bcrypt';
import { logger } from './otel';

export interface ServiceAccountRow {
  id: string;
  client_id: string;
  secret_hash: string;
  agent_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Find a service account by client_id and verify the plaintext secret against
 * the stored bcrypt hash. Returns the agent_id to use in the JWT if valid.
 */
export async function verifyServiceAccount(
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  if (!clientId || !clientSecret) return null;
  const row = await queryOne<ServiceAccountRow>(
    'SELECT id, client_id, secret_hash, agent_id FROM service_accounts WHERE client_id = $1',
    [clientId]
  );
  if (!row) return null;
  try {
    const ok = await compare(clientSecret, row.secret_hash);
    if (!ok) return null;
    return row.agent_id;
  } catch (err) {
    logger.warn('Service account secret verification failed', {
      clientId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Hash a plaintext secret for storing in service_accounts.secret_hash (e.g. for manual INSERT or scripts). */
export async function hashSecret(plainSecret: string): Promise<string> {
  return hash(plainSecret, 10);
}
