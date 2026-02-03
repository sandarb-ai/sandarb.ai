/**
 * API tests for POST /api/prompts/[id]/versions/[versionId]/approve — approve proposed prompt version.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetPromptById = vi.fn();
const mockGetPromptVersionById = vi.fn();
const mockApprovePromptVersion = vi.fn();

vi.mock('@/lib/prompts', () => ({
  getPromptById: (...args: unknown[]) => mockGetPromptById(...args),
  getPromptVersionById: (...args: unknown[]) => mockGetPromptVersionById(...args),
  approvePromptVersion: (...args: unknown[]) => mockApprovePromptVersion(...args),
}));

describe('POST /api/prompts/[id]/versions/[versionId]/approve', () => {
  const promptId = 'p1';
  const versionId = 'v1';
  const prompt = { id: promptId, name: 'My Prompt' };
  const proposedVersion = { id: versionId, promptId, status: 'proposed' as const, version: 2 };
  const approvedVersion = { id: versionId, promptId, status: 'approved' as const, version: 2, approvedBy: '@alice' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPromptById.mockResolvedValue(prompt);
    mockGetPromptVersionById.mockResolvedValue(proposedVersion);
    mockApprovePromptVersion.mockResolvedValue(approvedVersion);
  });

  it('returns 200 and approved version when approval succeeds', async () => {
    const { POST } = await import('@/app/api/prompts/[id]/versions/[versionId]/approve/route');
    const req = new Request('http://localhost/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedBy: '@alice' }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: promptId, versionId }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(approvedVersion);
    expect(data.message).toContain(prompt.name);
    expect(mockApprovePromptVersion).toHaveBeenCalledWith(versionId, '@alice');
  });

  it('passes approvedBy from body, fallback to x-user-id header', async () => {
    mockApprovePromptVersion.mockResolvedValue(approvedVersion);

    const { POST } = await import('@/app/api/prompts/[id]/versions/[versionId]/approve/route');
    const req = new Request('http://localhost/approve', {
      method: 'POST',
      headers: { 'x-user-id': 'bob' },
      body: JSON.stringify({}),
    });
    await POST(req, { params: Promise.resolve({ id: promptId, versionId }) });

    expect(mockApprovePromptVersion).toHaveBeenCalledWith(versionId, 'bob');
  });

  it('returns 404 when prompt not found', async () => {
    mockGetPromptById.mockResolvedValue(null);

    const { POST } = await import('@/app/api/prompts/[id]/versions/[versionId]/approve/route');
    const req = new Request('http://localhost/approve', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'bad-prompt', versionId }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Prompt not found');
    expect(mockApprovePromptVersion).not.toHaveBeenCalled();
  });

  it('returns 404 when version not found', async () => {
    mockGetPromptVersionById.mockResolvedValue(null);

    const { POST } = await import('@/app/api/prompts/[id]/versions/[versionId]/approve/route');
    const req = new Request('http://localhost/approve', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: promptId, versionId: 'bad-version' }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Version not found');
    expect(mockApprovePromptVersion).not.toHaveBeenCalled();
  });

  it('returns 400 when version does not belong to prompt', async () => {
    mockGetPromptVersionById.mockResolvedValue({ ...proposedVersion, promptId: 'other-prompt' });

    const { POST } = await import('@/app/api/prompts/[id]/versions/[versionId]/approve/route');
    const req = new Request('http://localhost/approve', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: promptId, versionId }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('does not belong');
    expect(mockApprovePromptVersion).not.toHaveBeenCalled();
  });

  it('returns 400 when version status is not proposed', async () => {
    mockGetPromptVersionById.mockResolvedValue({ ...proposedVersion, status: 'approved' });

    const { POST } = await import('@/app/api/prompts/[id]/versions/[versionId]/approve/route');
    const req = new Request('http://localhost/approve', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: promptId, versionId }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Only proposed');
    expect(mockApprovePromptVersion).not.toHaveBeenCalled();
  });

  it('returns 500 when approvePromptVersion returns null', async () => {
    mockApprovePromptVersion.mockResolvedValue(null);

    const { POST } = await import('@/app/api/prompts/[id]/versions/[versionId]/approve/route');
    const req = new Request('http://localhost/approve', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: promptId, versionId }) });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Failed to approve');
  });

  it('returns 500 when approvePromptVersion throws', async () => {
    mockApprovePromptVersion.mockRejectedValue(new Error('DB error'));

    const { POST } = await import('@/app/api/prompts/[id]/versions/[versionId]/approve/route');
    const req = new Request('http://localhost/approve', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: promptId, versionId }) });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Failed to approve prompt version');
  });
});
