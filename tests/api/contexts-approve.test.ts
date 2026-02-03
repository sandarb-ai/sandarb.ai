/**
 * API tests for POST /api/contexts/[id]/revisions/[revId]/approve — approve context revision.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApproveRevision = vi.fn();
vi.mock('@/lib/revisions', () => ({
  approveRevision: (...args: unknown[]) => mockApproveRevision(...args),
}));

describe('POST /api/contexts/[id]/revisions/[revId]/approve', () => {
  const contextId = 'ctx1';
  const revId = 'rev1';
  const revision = {
    id: revId,
    contextId,
    status: 'approved' as const,
    approvedBy: '@alice',
    approvedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockApproveRevision.mockResolvedValue(revision);
  });

  it('returns 200 and revision when approval succeeds', async () => {
    const { POST } = await import('@/app/api/contexts/[id]/revisions/[revId]/approve/route');
    const req = new Request('http://localhost/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedBy: '@alice' }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: contextId, revId }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(revision);
    expect(mockApproveRevision).toHaveBeenCalledWith(revId, '@alice');
  });

  it('passes approvedBy from body to approveRevision', async () => {
    const { POST } = await import('@/app/api/contexts/[id]/revisions/[revId]/approve/route');
    const req = new Request('http://localhost/approve', {
      method: 'POST',
      body: JSON.stringify({ approvedBy: 'bob' }),
    });
    await POST(req, { params: Promise.resolve({ id: contextId, revId }) });

    expect(mockApproveRevision).toHaveBeenCalledWith(revId, 'bob');
  });

  it('returns 404 when revision not found or not proposed', async () => {
    mockApproveRevision.mockResolvedValue(null);

    const { POST } = await import('@/app/api/contexts/[id]/revisions/[revId]/approve/route');
    const req = new Request('http://localhost/approve', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: contextId, revId: 'bad-rev' }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('not found');
  });

  it('returns 500 when approveRevision throws', async () => {
    mockApproveRevision.mockRejectedValue(new Error('DB error'));

    const { POST } = await import('@/app/api/contexts/[id]/revisions/[revId]/approve/route');
    const req = new Request('http://localhost/approve', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: contextId, revId }) });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Failed to approve revision');
  });
});
