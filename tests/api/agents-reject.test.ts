/**
 * API tests for POST /api/agents/[id]/reject — governance: reject agent registration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRejectAgent = vi.fn();
vi.mock('@/lib/agents', () => ({
  rejectAgent: (...args: unknown[]) => mockRejectAgent(...args),
}));

describe('POST /api/agents/[id]/reject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 and agent when rejection succeeds', async () => {
    const agent = {
      id: 'agent-1',
      name: 'Test Agent',
      approvalStatus: 'rejected' as const,
      approvedBy: '@compliance',
    };
    mockRejectAgent.mockResolvedValue(agent);

    const { POST } = await import('@/app/api/agents/[id]/reject/route');
    const req = new Request('http://localhost/api/agents/agent-1/reject', {
      method: 'POST',
      body: JSON.stringify({ rejectedBy: '@compliance' }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'agent-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(agent);
    expect(mockRejectAgent).toHaveBeenCalledWith('agent-1', '@compliance');
  });

  it('returns 404 when agent not found or not pending', async () => {
    mockRejectAgent.mockResolvedValue(null);

    const { POST } = await import('@/app/api/agents/[id]/reject/route');
    const req = new Request('http://localhost/api/agents/bad-id/reject', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'bad-id' }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
  });

  it('returns 500 when rejectAgent throws', async () => {
    mockRejectAgent.mockRejectedValue(new Error('DB error'));

    const { POST } = await import('@/app/api/agents/[id]/reject/route');
    const req = new Request('http://localhost/api/agents/a1/reject', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'a1' }) });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toContain('Failed');
  });
});
