/**
 * API tests for GET /api/governance/blocked-injections — list policy-blocked injections.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetBlockedInjections = vi.fn();
vi.mock('@/lib/audit', () => ({
  getBlockedInjections: (...args: unknown[]) => mockGetBlockedInjections(...args),
}));

describe('GET /api/governance/blocked-injections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 and items array', async () => {
    const items = [
      { id: '1', agentId: 'agent-1', contextName: 'ib-limits', reason: 'Policy violation' },
    ];
    mockGetBlockedInjections.mockResolvedValue(items);

    const { GET } = await import('@/app/api/governance/blocked-injections/route');
    const req = new Request('http://localhost/api/governance/blocked-injections');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toEqual(items);
    expect(mockGetBlockedInjections).toHaveBeenCalledWith(50);
  });

  it('respects limit query param and caps at 100', async () => {
    mockGetBlockedInjections.mockResolvedValue([]);

    const { GET } = await import('@/app/api/governance/blocked-injections/route');
    await GET(new Request('http://localhost/api/governance/blocked-injections?limit=25'));
    expect(mockGetBlockedInjections).toHaveBeenCalledWith(25);

    await GET(new Request('http://localhost/api/governance/blocked-injections?limit=200'));
    expect(mockGetBlockedInjections).toHaveBeenLastCalledWith(100);
  });

  it('returns 500 when getBlockedInjections throws', async () => {
    mockGetBlockedInjections.mockRejectedValue(new Error('DB error'));

    const { GET } = await import('@/app/api/governance/blocked-injections/route');
    const res = await GET(new Request('http://localhost/api/governance/blocked-injections'));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toContain('blocked injections');
  });
});
