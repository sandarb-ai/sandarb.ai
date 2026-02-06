/**
 * Unit tests for lib/api-client.ts — API client functions with mocked fetch.
 * Covers pagination response handling for agents, organizations, prompts, and contexts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the api module
vi.mock('@/lib/api', () => ({
  apiUrl: (path: string) => `http://localhost:8000${path}`,
}));

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ---------------------------------------------------------------------------
  // getAgents
  // ---------------------------------------------------------------------------
  describe('getAgents', () => {
    it('returns array of agents from paginated response', async () => {
      const mockAgents = [
        { id: '1', name: 'Agent 1' },
        { id: '2', name: 'Agent 2' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { agents: mockAgents, total: 951, limit: 500, offset: 0 },
        }),
      });

      const { getAgents } = await import('@/lib/api-client');
      const result = await getAgents();

      expect(result).toEqual(mockAgents);
      // Should include limit and offset params
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=500'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=0'),
        expect.any(Object)
      );
    });

    it('returns array from bare array response (backward compat)', async () => {
      const mockAgents = [
        { id: '1', name: 'Agent 1' },
        { id: '2', name: 'Agent 2' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockAgents }),
      });

      const { getAgents } = await import('@/lib/api-client');
      const result = await getAgents();

      expect(result).toEqual(mockAgents);
    });

    it('returns empty array on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error' }),
      });

      const { getAgents } = await import('@/lib/api-client');
      const result = await getAgents();

      expect(result).toEqual([]);
    });

    it('passes orgId as query param when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { agents: [], total: 0, limit: 500, offset: 0 } }),
      });

      const { getAgents } = await import('@/lib/api-client');
      await getAgents('org-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('org_id=org-123'),
        expect.any(Object)
      );
    });

    it('passes approvalStatus as query param when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { agents: [], total: 0, limit: 500, offset: 0 } }),
      });

      const { getAgents } = await import('@/lib/api-client');
      await getAgents(undefined, 'approved');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('approval_status=approved'),
        expect.any(Object)
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getAgentsPaginated
  // ---------------------------------------------------------------------------
  describe('getAgentsPaginated', () => {
    it('returns paginated response with agents, total, limit, offset', async () => {
      const mockAgents = [{ id: '1', name: 'Agent 1' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { agents: mockAgents, total: 951, limit: 10, offset: 20 },
        }),
      });

      const { getAgentsPaginated } = await import('@/lib/api-client');
      const result = await getAgentsPaginated(undefined, undefined, 10, 20);

      expect(result.agents).toEqual(mockAgents);
      expect(result.total).toBe(951);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(20);
    });

    it('returns empty response on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Error',
        json: async () => ({}),
      });

      const { getAgentsPaginated } = await import('@/lib/api-client');
      const result = await getAgentsPaginated();

      expect(result.agents).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('passes limit and offset in URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { agents: [], total: 0, limit: 25, offset: 50 } }),
      });

      const { getAgentsPaginated } = await import('@/lib/api-client');
      await getAgentsPaginated(undefined, undefined, 25, 50);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=25'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=50'),
        expect.any(Object)
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getAgentById
  // ---------------------------------------------------------------------------
  describe('getAgentById', () => {
    it('returns agent data on success', async () => {
      const mockAgent = { id: '1', name: 'Test Agent' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockAgent }),
      });

      const { getAgentById } = await import('@/lib/api-client');
      const result = await getAgentById('1');

      expect(result).toEqual(mockAgent);
    });

    it('returns null on not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        json: async () => ({ detail: 'Agent not found' }),
      });

      const { getAgentById } = await import('@/lib/api-client');
      const result = await getAgentById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getAgentStats
  // ---------------------------------------------------------------------------
  describe('getAgentStats', () => {
    it('calculates stats from paginated agents response', async () => {
      const mockAgents = [
        { id: '1', status: 'active', approvalStatus: 'approved' },
        { id: '2', status: 'active', approvalStatus: 'approved' },
        { id: '3', status: 'inactive', approvalStatus: 'draft' },
        { id: '4', status: 'active', approvalStatus: 'pending_approval' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { agents: mockAgents, total: 4, limit: 500, offset: 0 },
        }),
      });

      const { getAgentStats } = await import('@/lib/api-client');
      const result = await getAgentStats();

      expect(result.total).toBe(4);
      expect(result.active).toBe(3);
      expect(result.approved).toBe(2);
      expect(result.draft).toBe(1);
      expect(result.pending_approval).toBe(1);
    });

    it('uses total from backend (not array length) for accurate count', async () => {
      // Backend says total=951 but only returns 500 in the page
      const mockAgents = Array.from({ length: 500 }, (_, i) => ({
        id: String(i),
        status: 'active',
        approvalStatus: 'approved',
      }));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { agents: mockAgents, total: 951, limit: 500, offset: 0 },
        }),
      });

      const { getAgentStats } = await import('@/lib/api-client');
      const result = await getAgentStats();

      // total should come from backend's total field, not array.length
      expect(result.total).toBe(951);
    });

    it('handles snake_case approval_status from backend', async () => {
      const mockAgents = [
        { id: '1', status: 'active', approval_status: 'approved' },
        { id: '2', status: 'active', approval_status: 'draft' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { agents: mockAgents, total: 2, limit: 500, offset: 0 },
        }),
      });

      const { getAgentStats } = await import('@/lib/api-client');
      const result = await getAgentStats();

      expect(result.approved).toBe(1);
      expect(result.draft).toBe(1);
    });

    it('calculates stats from bare array response (backward compat)', async () => {
      const mockAgents = [
        { id: '1', status: 'active', approvalStatus: 'approved' },
        { id: '2', status: 'inactive', approvalStatus: 'draft' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockAgents }),
      });

      const { getAgentStats } = await import('@/lib/api-client');
      const result = await getAgentStats();

      expect(result.total).toBe(2);
      expect(result.active).toBe(1);
      expect(result.approved).toBe(1);
      expect(result.draft).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // getAgentCount
  // ---------------------------------------------------------------------------
  describe('getAgentCount', () => {
    it('returns total from paginated response (not array length)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { agents: [{ id: '1' }], total: 951, limit: 1, offset: 0 },
        }),
      });

      const { getAgentCount } = await import('@/lib/api-client');
      const result = await getAgentCount();

      expect(result).toBe(951);
      // Should use limit=1 to minimize data transfer
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=1'),
        expect.any(Object)
      );
    });

    it('returns 0 on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Error',
        json: async () => ({}),
      });

      const { getAgentCount } = await import('@/lib/api-client');
      const result = await getAgentCount();

      expect(result).toBe(0);
    });

    it('falls back to array length for bare array response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [{ id: '1' }, { id: '2' }] }),
      });

      const { getAgentCount } = await import('@/lib/api-client');
      const result = await getAgentCount();

      expect(result).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // getOrganizations
  // ---------------------------------------------------------------------------
  describe('getOrganizations', () => {
    it('extracts organizations from paginated response', async () => {
      const mockOrgs = [
        { id: '1', name: 'Org 1', slug: 'org-1' },
        { id: '2', name: 'Org 2', slug: 'org-2' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { organizations: mockOrgs, total: 10, limit: 500, offset: 0 },
        }),
      });

      const { getOrganizations } = await import('@/lib/api-client');
      const result = await getOrganizations();

      expect(result).toEqual(mockOrgs);
    });

    it('returns organizations from bare array (backward compat)', async () => {
      const mockOrgs = [
        { id: '1', name: 'Org 1', slug: 'org-1' },
        { id: '2', name: 'Org 2', slug: 'org-2' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockOrgs }),
      });

      const { getOrganizations } = await import('@/lib/api-client');
      const result = await getOrganizations();

      expect(result).toEqual(mockOrgs);
    });

    it('flat list mode includes limit and offset params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { organizations: [], total: 0, limit: 500, offset: 0 },
        }),
      });

      const { getOrganizations } = await import('@/lib/api-client');
      await getOrganizations();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=500'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=0'),
        expect.any(Object)
      );
    });

    it('tree mode does NOT add limit/offset params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      const { getOrganizations } = await import('@/lib/api-client');
      await getOrganizations(true);

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('tree=true');
      expect(calledUrl).not.toContain('limit=');
      expect(calledUrl).not.toContain('offset=');
    });

    it('adds tree=true param when tree option is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      const { getOrganizations } = await import('@/lib/api-client');
      await getOrganizations(true);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('tree=true'),
        expect.any(Object)
      );
    });

    it('adds root=true param when root option is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      const { getOrganizations } = await import('@/lib/api-client');
      await getOrganizations(false, true);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('root=true'),
        expect.any(Object)
      );
    });

    it('returns empty array on failure for flat list mode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Error',
        json: async () => ({}),
      });

      const { getOrganizations } = await import('@/lib/api-client');
      const result = await getOrganizations();

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getOrganizationById
  // ---------------------------------------------------------------------------
  describe('getOrganizationById', () => {
    it('returns organization data on success', async () => {
      const mockOrg = { id: '1', name: 'Test Org', slug: 'test-org' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockOrg }),
      });

      const { getOrganizationById } = await import('@/lib/api-client');
      const result = await getOrganizationById('1');

      expect(result).toEqual(mockOrg);
    });

    it('returns null when not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        json: async () => ({ detail: 'Organization not found' }),
      });

      const { getOrganizationById } = await import('@/lib/api-client');
      const result = await getOrganizationById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getContextsPaginated
  // ---------------------------------------------------------------------------
  describe('getContextsPaginated', () => {
    it('returns contexts with pagination data', async () => {
      const mockContexts = [
        { id: '1', name: 'Context 1' },
        { id: '2', name: 'Context 2' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { contexts: mockContexts, total: 100 },
        }),
      });

      const { getContextsPaginated } = await import('@/lib/api-client');
      const result = await getContextsPaginated(10, 0);

      expect(result.contexts).toEqual(mockContexts);
      expect(result.total).toBe(100);
    });

    it('returns empty contexts on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Error',
        json: async () => ({}),
      });

      const { getContextsPaginated } = await import('@/lib/api-client');
      const result = await getContextsPaginated(10, 0);

      expect(result.contexts).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('includes limit and offset in URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { contexts: [], total: 0 } }),
      });

      const { getContextsPaginated } = await import('@/lib/api-client');
      await getContextsPaginated(25, 50);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=25'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=50'),
        expect.any(Object)
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getPrompts
  // ---------------------------------------------------------------------------
  describe('getPrompts', () => {
    it('returns normalized prompts array from bare array', async () => {
      const mockPrompts = [
        {
          id: '1',
          name: 'Prompt 1',
          description: 'Description 1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockPrompts }),
      });

      const { getPrompts } = await import('@/lib/api-client');
      const result = await getPrompts();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Prompt 1');
      expect(result[0].createdAt).toBe('2024-01-01T00:00:00Z');
    });

    it('returns normalized prompts from paginated response', async () => {
      const mockPrompts = [
        { id: '1', name: 'Prompt 1', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-02T00:00:00Z' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { prompts: mockPrompts, total: 100, limit: 50, offset: 0 },
        }),
      });

      const { getPrompts } = await import('@/lib/api-client');
      const result = await getPrompts();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Prompt 1');
    });

    it('returns empty array on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Error',
        json: async () => ({}),
      });

      const { getPrompts } = await import('@/lib/api-client');
      const result = await getPrompts();

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getPromptsPaginated
  // ---------------------------------------------------------------------------
  describe('getPromptsPaginated', () => {
    it('returns prompts with pagination metadata from paginated response', async () => {
      const mockPrompts = [
        { id: '1', name: 'P1', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-02T00:00:00Z' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { prompts: mockPrompts, total: 100, totalActive: 80, totalDraft: 20, limit: 50, offset: 0 },
        }),
      });

      const { getPromptsPaginated } = await import('@/lib/api-client');
      const result = await getPromptsPaginated(50, 0);

      expect(result.prompts).toHaveLength(1);
      expect(result.total).toBe(100);
      expect(result.totalActive).toBe(80);
      expect(result.totalDraft).toBe(20);
    });

    it('returns empty result on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Error',
        json: async () => ({}),
      });

      const { getPromptsPaginated } = await import('@/lib/api-client');
      const result = await getPromptsPaginated();

      expect(result.prompts).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getRecentAgents
  // ---------------------------------------------------------------------------
  describe('getRecentAgents', () => {
    it('extracts agents from paginated response', async () => {
      const mockAgents = [{ id: '1', name: 'Recent 1' }, { id: '2', name: 'Recent 2' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { agents: mockAgents, total: 951, limit: 6, offset: 0 },
        }),
      });

      const { getRecentAgents } = await import('@/lib/api-client');
      const result = await getRecentAgents(6);

      expect(result).toEqual(mockAgents);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=6'),
        expect.any(Object)
      );
    });

    it('handles bare array (backward compat)', async () => {
      const mockAgents = [{ id: '1', name: 'Agent 1' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockAgents }),
      });

      const { getRecentAgents } = await import('@/lib/api-client');
      const result = await getRecentAgents();

      expect(result).toEqual(mockAgents);
    });
  });

  // ---------------------------------------------------------------------------
  // getTemplates
  // ---------------------------------------------------------------------------
  describe('getTemplates', () => {
    it('returns templates array on success', async () => {
      const mockTemplates = [
        { id: '1', name: 'Template 1' },
        { id: '2', name: 'Template 2' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTemplates }),
      });

      const { getTemplates } = await import('@/lib/api-client');
      const result = await getTemplates();

      expect(result).toEqual(mockTemplates);
    });

    it('returns empty array on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Error',
        json: async () => ({}),
      });

      const { getTemplates } = await import('@/lib/api-client');
      const result = await getTemplates();

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getSettings
  // ---------------------------------------------------------------------------
  describe('getSettings', () => {
    it('returns settings object on success', async () => {
      const mockSettings = { theme: 'dark', lang: 'en' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockSettings }),
      });

      const { getSettings } = await import('@/lib/api-client');
      const result = await getSettings();

      expect(result).toEqual(mockSettings);
    });

    it('returns empty object on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Error',
        json: async () => ({}),
      });

      const { getSettings } = await import('@/lib/api-client');
      const result = await getSettings();

      expect(result).toEqual({});
    });
  });

  // ---------------------------------------------------------------------------
  // getDashboard
  // ---------------------------------------------------------------------------
  describe('getDashboard', () => {
    it('returns dashboard data on success', async () => {
      const mockDashboard = {
        contextStats: { total: 10, active: 5 },
        promptStats: { total: 20, active: 15 },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockDashboard }),
      });

      const { getDashboard } = await import('@/lib/api-client');
      const result = await getDashboard();

      expect(result).toEqual(mockDashboard);
    });

    it('returns null on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Error',
        json: async () => ({}),
      });

      const { getDashboard } = await import('@/lib/api-client');
      const result = await getDashboard();

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Audit/Governance functions
  // ---------------------------------------------------------------------------
  describe('Audit/Governance functions', () => {
    it('getBlockedInjections returns array', async () => {
      const mockData = [{ id: '1', reason: 'Policy violation' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockData }),
      });

      const { getBlockedInjections } = await import('@/lib/api-client');
      const result = await getBlockedInjections();

      expect(result).toEqual(mockData);
    });

    it('getA2ALog returns array', async () => {
      const mockData = [{ id: '1', event: 'agent_call' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockData }),
      });

      const { getA2ALog } = await import('@/lib/api-client');
      const result = await getA2ALog();

      expect(result).toEqual(mockData);
    });

    it('getUnauthenticatedDetections returns array', async () => {
      const mockData = [{ id: '1', sourceUrl: 'http://bad.com' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockData }),
      });

      const { getUnauthenticatedDetections } = await import('@/lib/api-client');
      const result = await getUnauthenticatedDetections();

      expect(result).toEqual(mockData);
    });
  });
});
