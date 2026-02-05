/**
 * Unit tests for lib/policy.ts — governance policy (context access).
 * LOB policy has been removed; access is gated by agent–context linking only.
 */

import { describe, it, expect } from 'vitest';
import { checkInjectPolicy } from '@/lib/policy';
import type { RegisteredAgent } from '@/types';
import type { Context } from '@/types';

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
    orgId: null,
    dataClassification: null,
    regulatoryHooks: [],
    ...overrides,
  };
}

describe('checkInjectPolicy', () => {
  it('allows when context is linked (policy only checks link; LOB removed)', () => {
    const agent = mockAgent({ ownerTeam: 'wealth-management' });
    const context = mockContext({ orgId: 'org-1' });
    expect(checkInjectPolicy(agent, context)).toEqual({ allowed: true });
  });

  it('allows for any agent/context combination (link check is enforced in backend)', () => {
    const agent = mockAgent({ ownerTeam: 'retail' });
    const context = mockContext({ orgId: 'org-2' });
    expect(checkInjectPolicy(agent, context)).toEqual({ allowed: true });
  });
});
