/**
 * API tests for health route — response shape and error handling.
 * Mocks DB so tests run without a real database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/contexts', () => ({
  getContextCount: vi.fn(),
}));
vi.mock('@/lib/templates', () => ({
  getTemplateCount: vi.fn(),
}));

describe('health API', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns healthy response shape when DB is available', async () => {
    const { getContextCount } = await import('@/lib/contexts');
    const { getTemplateCount } = await import('@/lib/templates');
    vi.mocked(getContextCount).mockResolvedValue({ total: 10, active: 8 });
    vi.mocked(getTemplateCount).mockResolvedValue(5);

    const { GET } = await import('@/app/api/health/route');
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.timestamp).toBeDefined();
    expect(data.database).toEqual({
      status: 'connected',
      contexts: 10,
      templates: 5,
    });
  });

  it('returns 503 and unhealthy when DB fails', async () => {
    const { getContextCount } = await import('@/lib/contexts');
    vi.mocked(getContextCount).mockRejectedValue(new Error('Connection refused'));

    const { GET } = await import('@/app/api/health/route');
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.status).toBe('unhealthy');
    expect(data.error).toContain('Database');
  });
});
