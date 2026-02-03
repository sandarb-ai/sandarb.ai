/**
 * API tests for POST /api/agents/[id]/approve — governance: approve agent registration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApproveAgent = vi.fn();
vi.mock('@/lib/agents', () => ({
  approveAgent: (...args: unknown[]) => mockApproveAgent(...args),
}));

describe('POST /api/agents/[id]/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 and agent when approval succeeds', async () => {
    const agent = {
      id: 'agent-1',
      name: 'Test Agent',
      approvalStatus: 'approved' as const,
      approvedBy: '@alice',
      approvedAt: new Date().toISOString(),
    };
    mockApproveAgent.mockResolvedValue(agent);

    const { POST } = await import('@/app/api/agents/[id]/approve/route');
    const req = new Request('http://localhost/api/agents/agent-1/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedBy: '@alice' }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'agent-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(agent);
    expect(mockApproveAgent).toHaveBeenCalledWith('agent-1', '@alice');
  });

  it('passes approvedBy from body to approveAgent', async () => {
    mockApproveAgent.mockResolvedValue({ id: 'a1', approvedBy: '@bob' });

    const { POST } = await import('@/app/api/agents/[id]/approve/route');
    const req = new Request('http://localhost/api/agents/a1/approve', {
      method: 'POST',
      body: JSON.stringify({ approvedBy: 'bob' }),
    });
    await POST(req, { params: Promise.resolve({ id: 'a1' }) });

    expect(mockApproveAgent).toHaveBeenCalledWith('a1', 'bob');
  });

  it('returns 404 when agent not found or not pending', async () => {
    mockApproveAgent.mockResolvedValue(null);

    const { POST } = await import('@/app/api/agents/[id]/approve/route');
    const req = new Request('http://localhost/api/agents/bad-id/approve', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'bad-id' }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('not found');
  });

  it('returns 500 when approveAgent throws', async () => {
    mockApproveAgent.mockRejectedValue(new Error('DB error'));

    const { POST } = await import('@/app/api/agents/[id]/approve/route');
    const req = new Request('http://localhost/api/agents/a1/approve', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'a1' }) });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Failed');
  });
});
