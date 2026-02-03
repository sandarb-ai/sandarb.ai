/**
 * API tests for inject route — governance: agent identity, policy, variable substitution.
 * Uses mocks for DB; tests request parsing and policy logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkInjectPolicy } from '@/lib/policy';
import { substituteVariables } from '@/lib/utils';
import type { RegisteredAgent } from '@/types';
import type { Context } from '@/types';

// Re-use policy and utils (no DB) for inject logic tests
describe('inject route logic (policy + utils)', () => {
  function mockAgent(overrides: Partial<RegisteredAgent> = {}): RegisteredAgent {
    return {
      id: 'agent-1',
      orgId: 'org-1',
      agentId: 'inject-test-agent',
      name: 'Inject Test Agent',
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
      ownerTeam: 'wealth-management',
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
      content: { greeting: 'Hello {{client_name}}' },
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
      lineOfBusiness: 'wealth_management',
      dataClassification: null,
      regulatoryHooks: [],
      ...overrides,
    };
  }

  describe('policy used by inject', () => {
    it('allows same-LOB agent to pull context', () => {
      const agent = mockAgent({ ownerTeam: 'wealth-management' });
      const context = mockContext({ lineOfBusiness: 'wealth_management' });
      expect(checkInjectPolicy(agent, context).allowed).toBe(true);
    });

    it('denies cross-LOB agent from pulling context', () => {
      const agent = mockAgent({ ownerTeam: 'retail-banking' });
      const context = mockContext({ lineOfBusiness: 'wealth_management' });
      expect(checkInjectPolicy(agent, context).allowed).toBe(false);
    });
  });

  describe('variable substitution used by inject', () => {
    it('substitutes {{key}} in context content', () => {
      const content = { greeting: 'Hello {{client_name}}', id: '{{portfolio_id}}' };
      const result = substituteVariables(content, {
        client_name: 'Acme Corp',
        portfolio_id: 'P-123',
      }) as { greeting: string; id: string };
      expect(result.greeting).toBe('Hello Acme Corp');
      expect(result.id).toBe('P-123');
    });

    it('leaves placeholder when variable missing', () => {
      const content = { msg: 'Hello {{name}}' };
      const result = substituteVariables(content, {}) as { msg: string };
      expect(result.msg).toBe('Hello {{name}}');
    });
  });
});
