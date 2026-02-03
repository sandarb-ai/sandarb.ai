/**
 * Unit tests for lib/policy.ts — governance policy (cross-LOB context access).
 */

import { describe, it, expect } from 'vitest';
import { ownerTeamToLOB, checkInjectPolicy } from '@/lib/policy';
import type { RegisteredAgent } from '@/types';
import type { Context } from '@/types';

describe('ownerTeamToLOB', () => {
  it('maps retail slugs to retail', () => {
    expect(ownerTeamToLOB('retail')).toBe('retail');
    expect(ownerTeamToLOB('retail-banking')).toBe('retail');
  });

  it('maps investment banking slugs to investment_banking', () => {
    expect(ownerTeamToLOB('investment_banking')).toBe('investment_banking');
    expect(ownerTeamToLOB('investment-banking')).toBe('investment_banking');
  });

  it('maps wealth management slugs to wealth_management', () => {
    expect(ownerTeamToLOB('wealth-management')).toBe('wealth_management');
    expect(ownerTeamToLOB('wealth_management')).toBe('wealth_management');
  });

  it('returns null for null/empty', () => {
    expect(ownerTeamToLOB(null)).toBeNull();
    expect(ownerTeamToLOB('')).toBeNull();
  });

  it('returns null for unknown slug', () => {
    expect(ownerTeamToLOB('unknown-team')).toBeNull();
  });

  it('normalizes single space to hyphen for slug match', () => {
    expect(ownerTeamToLOB('Wealth Management')).toBe('wealth_management');
  });
});

function mockAgent(overrides: Partial<RegisteredAgent> = {}): RegisteredAgent {
  return {
    id: 'agent-1',
    orgId: 'org-1',
    agentId: 'agent-1',
    name: 'Test Agent',
    description: null,
    a2aUrl: 'https://example.com/agent',
    agentCard: null,
    status: 'active',
    approvalStatus: 'approved',
    approvedBy: null,
    approvedAt: null,
    submittedBy: null,
    createdBy: null,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
    ownerTeam: null,
    toolsUsed: [],
    allowedDataScopes: [],
    piiHandling: false,
    regulatoryScope: [],
    ...overrides,
  };
}

function mockContext(overrides: Partial<Context> = {}): Context {
  return {
    id: 'ctx-1',
    name: 'Test Context',
    description: null,
    content: {},
    templateId: null,
    environment: 'production',
    tags: [],
    isActive: true,
    priority: 0,
    expiresAt: null,
    createdBy: null,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
    lineOfBusiness: null,
    dataClassification: null,
    regulatoryHooks: [],
    ...overrides,
  };
}

describe('checkInjectPolicy', () => {
  it('allows when context has no LOB (no restriction)', () => {
    const agent = mockAgent({ ownerTeam: 'wealth-management' });
    const context = mockContext({ lineOfBusiness: null });
    expect(checkInjectPolicy(agent, context)).toEqual({ allowed: true });
  });

  it('allows when agent has no LOB', () => {
    const agent = mockAgent({ ownerTeam: null });
    const context = mockContext({ lineOfBusiness: 'retail' });
    expect(checkInjectPolicy(agent, context)).toEqual({ allowed: true });
  });

  it('allows when agent LOB matches context LOB', () => {
    const agent = mockAgent({ ownerTeam: 'wealth-management' });
    const context = mockContext({ lineOfBusiness: 'wealth_management' });
    expect(checkInjectPolicy(agent, context)).toEqual({ allowed: true });
  });

  it('denies when agent LOB does not match context LOB (cross-LOB)', () => {
    const agent = mockAgent({ ownerTeam: 'wealth-management' });
    const context = mockContext({ lineOfBusiness: 'retail' });
    const result = checkInjectPolicy(agent, context);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Policy violation');
    expect(result.reason).toContain('wealth_management');
    expect(result.reason).toContain('retail');
  });

  it('denies investment_banking agent pulling retail context', () => {
    const agent = mockAgent({ ownerTeam: 'investment-banking' });
    const context = mockContext({ lineOfBusiness: 'retail' });
    expect(checkInjectPolicy(agent, context).allowed).toBe(false);
  });

  it('allows when both LOBs are retail (same LOB)', () => {
    const agent = mockAgent({ ownerTeam: 'retail-banking' });
    const context = mockContext({ lineOfBusiness: 'retail' });
    expect(checkInjectPolicy(agent, context).allowed).toBe(true);
  });

  it('denies wealth_management agent pulling investment_banking context', () => {
    const agent = mockAgent({ ownerTeam: 'wealth-management' });
    const context = mockContext({ lineOfBusiness: 'investment_banking' });
    const result = checkInjectPolicy(agent, context);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('wealth_management');
    expect(result.reason).toContain('investment_banking');
  });
});
