/**
 * API tests for POST /api/prompts/[id]/versions/[versionId]/reject — reject proposed prompt version.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetPromptById = vi.fn();
const mockGetPromptVersionById = vi.fn();
const mockRejectPromptVersion = vi.fn();

vi.mock('@/lib/prompts', () => ({
  getPromptById: (...args: unknown[]) => mockGetPromptById(...args),
  getPromptVersionById: (...args: unknown[]) => mockGetPromptVersionById(...args),
  rejectPromptVersion: (...args: unknown[]) => mockRejectPromptVersion(...args),
}));

describe('POST /api/prompts/[id]/versions/[versionId]/reject', () => {
  const promptId = 'p1';
  const versionId = 'v1';
  const prompt = { id: promptId, name: 'My Prompt' };
  const proposedVersion = { id: versionId, promptId, status: 'proposed' as const, version: 2 };
  const rejectedVersion = { id: versionId, promptId, status: 'rejected' as const, version: 2, rejectedBy: '@compliance' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPromptById.mockResolvedValue(prompt);
    mockGetPromptVersionById.mockResolvedValue(proposedVersion);
    mockRejectPromptVersion.mockResolvedValue(rejectedVersion);
  });

  it('returns 200 and rejected version when rejection succeeds', async () => {
    const { POST } = await import('@/app/api/prompts/[id]/versions/[versionId]/reject/route');
    const req = new Request('http://localhost/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectedBy: '@compliance', reason: 'Out of scope' }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: promptId, versionId }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(rejectedVersion);
    expect(data.message).toContain(prompt.name);
    expect(data.message).toContain('Out of scope');
    expect(mockRejectPromptVersion).toHaveBeenCalledWith(versionId, '@compliance');
  });

  it('passes rejectedBy from body, fallback to x-user-id header', async () => {
    const { POST } = await import('@/app/api/prompts/[id]/versions/[versionId]/reject/route');
    const req = new Request('http://localhost/reject', {
      method: 'POST',
      headers: { 'x-user-id': 'bob' },
      body: JSON.stringify({}),
    });
    await POST(req, { params: Promise.resolve({ id: promptId, versionId }) });

    expect(mockRejectPromptVersion).toHaveBeenCalledWith(versionId, 'bob');
  });

  it('returns 404 when prompt not found', async () => {
    mockGetPromptById.mockResolvedValue(null);

    const { POST } = await import('@/app/api/prompts/[id]/versions/[versionId]/reject/route');
    const req = new Request('http://localhost/reject', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'bad-prompt', versionId }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Prompt not found');
    expect(mockRejectPromptVersion).not.toHaveBeenCalled();
  });

  it('returns 404 when version not found', async () => {
    mockGetPromptVersionById.mockResolvedValue(null);

    const { POST } = await import('@/app/api/prompts/[id]/versions/[versionId]/reject/route');
    const req = new Request('http://localhost/reject', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: promptId, versionId: 'bad-version' }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Version not found');
    expect(mockRejectPromptVersion).not.toHaveBeenCalled();
  });

  it('returns 400 when version status is not proposed', async () => {
    mockGetPromptVersionById.mockResolvedValue({ ...proposedVersion, status: 'approved' });

    const { POST } = await import('@/app/api/prompts/[id]/versions/[versionId]/reject/route');
    const req = new Request('http://localhost/reject', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: promptId, versionId }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Only proposed');
    expect(mockRejectPromptVersion).not.toHaveBeenCalled();
  });

  it('returns 500 when rejectPromptVersion returns null', async () => {
    mockRejectPromptVersion.mockResolvedValue(null);

    const { POST } = await import('@/app/api/prompts/[id]/versions/[versionId]/reject/route');
    const req = new Request('http://localhost/reject', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: promptId, versionId }) });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Failed to reject');
  });

  it('returns 500 when rejectPromptVersion throws', async () => {
    mockRejectPromptVersion.mockRejectedValue(new Error('DB error'));

    const { POST } = await import('@/app/api/prompts/[id]/versions/[versionId]/reject/route');
    const req = new Request('http://localhost/reject', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: promptId, versionId }) });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Failed to reject prompt version');
  });
});
