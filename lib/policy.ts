/**
 * Governance policy: prevent cross-LOB context access.
 * E.g. a Wealth Management agent must not pull a context tagged as Investment Banking.
 */

import type { RegisteredAgent } from '@/types';
import type { Context } from '@/types';
import type { LineOfBusiness } from '@/types';

const SLUG_TO_LOB: Record<string, LineOfBusiness> = {
  retail: 'retail',
  'retail-banking': 'retail',
  investment_banking: 'investment_banking',
  'investment-banking': 'investment_banking',
  wealth_management: 'wealth_management',
  'wealth-management': 'wealth_management',
};

/** Map agent owner_team (slug) to LineOfBusiness for policy check. */
export function ownerTeamToLOB(ownerTeam: string | null): LineOfBusiness | null {
  if (!ownerTeam) return null;
  const normalized = ownerTeam.toLowerCase().replace(/\s+/g, '-');
  return SLUG_TO_LOB[normalized] ?? null;
}

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Policy: agent may only pull context if context LOB is null (no restriction)
 * or agent's LOB matches context LOB. Prevents cross-contamination (e.g. WM pulling IB context).
 */
export function checkInjectPolicy(agent: RegisteredAgent, context: Context): PolicyCheckResult {
  const contextLOB = context.lineOfBusiness ?? null;
  if (!contextLOB) {
    return { allowed: true };
  }
  const agentLOB = ownerTeamToLOB(agent.ownerTeam ?? null);
  if (!agentLOB) {
    return { allowed: true }; // Agent has no LOB; allow (or could deny for strict mode)
  }
  if (agentLOB !== contextLOB) {
    return {
      allowed: false,
      reason: `Policy violation: agent LOB (${agentLOB}) does not match context LOB (${contextLOB}). Cross-LOB access is blocked.`,
    };
  }
  return { allowed: true };
}
