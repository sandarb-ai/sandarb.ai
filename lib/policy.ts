/**
 * Governance policy for context injection.
 * LOB (Line of Business) policy has been removed; access is gated by agent–context linking only.
 */

import type { RegisteredAgent } from '@/types';
import type { Context } from '@/types';

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Policy: access is allowed when context is linked to the agent (enforced in backend).
 * No LOB/organization cross-check; org is for display/filtering only.
 */
export function checkInjectPolicy(_agent: RegisteredAgent, _context: Context): PolicyCheckResult {
  return { allowed: true };
}
