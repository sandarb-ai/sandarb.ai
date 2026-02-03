/**
 * API tests for GET /api/governance/unauthenticated-agents — list shadow/unauthenticated agents.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUnauthenticatedDetections = vi.fn();
vi.mock('@/lib/governance', () => ({
  getUnauthenticatedDetections: (...args: unknown[]) => mockGetUnauthenticatedDetections(...args),
  getScanTargets: vi.fn(),
  recordUnauthenticatedAgent: vi.fn(),
  runDiscoveryScan: vi.fn(),
}));

describe('GET /api/governance/unauthenticated-agents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 and items array', async () => {
    const items = [
      {
        id: 'det-1',
        sourceUrl: 'https://shadow.example.com',
        detectedAgentId: null,
        details: {},
        scanRunAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    ];
    mockGetUnauthenticatedDetections.mockResolvedValue(items);

    const { GET } = await import('@/app/api/governance/unauthenticated-agents/route');
    const req = new Request('http://localhost/api/governance/unauthenticated-agents');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toEqual(items);
    expect(mockGetUnauthenticatedDetections).toHaveBeenCalledWith(50);
  });

  it('respects limit query param and caps at 100', async () => {
    mockGetUnauthenticatedDetections.mockResolvedValue([]);

    const { GET } = await import('@/app/api/governance/unauthenticated-agents/route');
    await GET(new Request('http://localhost/api/governance/unauthenticated-agents?limit=10'));
    expect(mockGetUnauthenticatedDetections).toHaveBeenCalledWith(10);

    await GET(new Request('http://localhost/api/governance/unauthenticated-agents?limit=200'));
    expect(mockGetUnauthenticatedDetections).toHaveBeenLastCalledWith(100);
  });

  it('returns 500 when getUnauthenticatedDetections throws', async () => {
    mockGetUnauthenticatedDetections.mockRejectedValue(new Error('DB error'));

    const { GET } = await import('@/app/api/governance/unauthenticated-agents/route');
    const res = await GET(new Request('http://localhost/api/governance/unauthenticated-agents'));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toContain('unauthenticated');
  });
});
