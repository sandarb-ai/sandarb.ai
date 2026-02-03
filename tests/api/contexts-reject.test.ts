/**
 * API tests for POST /api/contexts/[id]/revisions/[revId]/reject — reject context revision.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRejectRevision = vi.fn();
vi.mock('@/lib/revisions', () => ({
  rejectRevision: (...args: unknown[]) => mockRejectRevision(...args),
}));

describe('POST /api/contexts/[id]/revisions/[revId]/reject', () => {
  const contextId = 'ctx1';
  const revId = 'rev1';
  const revision = {
    id: revId,
    contextId,
    status: 'rejected' as const,
    rejectedBy: '@compliance',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRejectRevision.mockResolvedValue(revision);
  });

  it('returns 200 and revision when rejection succeeds', async () => {
    const { POST } = await import('@/app/api/contexts/[id]/revisions/[revId]/reject/route');
    const req = new Request('http://localhost/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectedBy: '@compliance' }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: contextId, revId }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(revision);
    expect(mockRejectRevision).toHaveBeenCalledWith(revId, '@compliance');
  });

  it('passes rejectedBy from body to rejectRevision', async () => {
    const { POST } = await import('@/app/api/contexts/[id]/revisions/[revId]/reject/route');
    const req = new Request('http://localhost/reject', {
      method: 'POST',
      body: JSON.stringify({ rejectedBy: 'bob' }),
    });
    await POST(req, { params: Promise.resolve({ id: contextId, revId }) });

    expect(mockRejectRevision).toHaveBeenCalledWith(revId, 'bob');
  });

  it('returns 404 when revision not found or not proposed', async () => {
    mockRejectRevision.mockResolvedValue(null);

    const { POST } = await import('@/app/api/contexts/[id]/revisions/[revId]/reject/route');
    const req = new Request('http://localhost/reject', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: contextId, revId: 'bad-rev' }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('not found');
  });

  it('returns 500 when rejectRevision throws', async () => {
    mockRejectRevision.mockRejectedValue(new Error('DB error'));

    const { POST } = await import('@/app/api/contexts/[id]/revisions/[revId]/reject/route');
    const req = new Request('http://localhost/reject', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: contextId, revId }) });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Failed to reject revision');
  });
});
