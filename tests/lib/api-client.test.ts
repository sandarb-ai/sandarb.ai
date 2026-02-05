/**
 * Unit tests for lib/api-client.ts — API client functions with mocked fetch.
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

  describe('getAgents', () => {
    it('returns array of agents on success', async () => {
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
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/agents',
        expect.objectContaining({
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
        })
      );
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
        json: async () => ({ success: true, data: [] }),
      });

      const { getAgents } = await import('@/lib/api-client');
      await getAgents('org-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('org_id=org-123'),
        expect.any(Object)
      );
    });
  });

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

  describe('getOrganizations', () => {
    it('returns organizations array on success', async () => {
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
  });

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

  describe('getPrompts', () => {
    it('returns normalized prompts array', async () => {
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

  describe('getAgentStats', () => {
    it('calculates stats from agents list', async () => {
      const mockAgents = [
        { id: '1', status: 'active', approvalStatus: 'approved' },
        { id: '2', status: 'active', approvalStatus: 'approved' },
        { id: '3', status: 'inactive', approvalStatus: 'draft' },
        { id: '4', status: 'active', approvalStatus: 'pending_approval' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockAgents }),
      });

      const { getAgentStats } = await import('@/lib/api-client');
      const result = await getAgentStats();

      expect(result.total).toBe(4);
      expect(result.active).toBe(3);
      expect(result.approved).toBe(2);
      expect(result.draft).toBe(1);
      expect(result.pending_approval).toBe(1);
    });
  });

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
