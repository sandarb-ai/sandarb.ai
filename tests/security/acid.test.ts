/**
 * Security ACID test — rigorous assertions that critical security properties hold.
 * Run as part of security testing: npm run test:security
 *
 * Covers:
 * - Inject: audit IDs required; unregistered agent denied; cross-LOB denied; inactive context denied; format/input validation
 * - Policy: cross-LOB access blocked
 * - Input validation: resource names, variable substitution (no code execution)
 * - Approval workflow: only proposed versions can be approved/rejected
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Inject route security (GET /api/inject)
// ---------------------------------------------------------------------------

const mockGetContextById = vi.fn();
const mockGetContextByName = vi.fn();
const mockGetAgentByIdentifier = vi.fn();
const mockCheckInjectPolicy = vi.fn();
const mockLogBlockedInjection = vi.fn();
const mockLogInjection = vi.fn();
const mockLogContextDelivery = vi.fn();
const mockGetLatestApprovedVersion = vi.fn();
const mockFormatContent = vi.fn((c: Record<string, unknown>) => JSON.stringify(c));
const mockSubstituteVariables = vi.fn((c: unknown) => c);

vi.mock('@/lib/contexts', () => ({
  getContextById: (...args: unknown[]) => mockGetContextById(...args),
  getContextByName: (...args: unknown[]) => mockGetContextByName(...args),
  logInjection: (...args: unknown[]) => mockLogInjection(...args),
  getLatestApprovedVersion: (...args: unknown[]) => mockGetLatestApprovedVersion(...args),
}));
vi.mock('@/lib/audit', () => ({
  logContextDelivery: (...args: unknown[]) => mockLogContextDelivery(...args),
  logBlockedInjection: (...args: unknown[]) => mockLogBlockedInjection(...args),
}));
vi.mock('@/lib/agents', () => ({
  getAgentByIdentifier: (...args: unknown[]) => mockGetAgentByIdentifier(...args),
}));
vi.mock('@/lib/policy', () => ({
  checkInjectPolicy: (...args: unknown[]) => mockCheckInjectPolicy(...args),
}));
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    formatContent: (...args: unknown[]) => mockFormatContent(...args),
    substituteVariables: (...args: unknown[]) => mockSubstituteVariables(...args),
  };
});
vi.mock('@/lib/otel', () => ({
  withSpan: (_name: string, fn: () => Promise<unknown>) => fn(),
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function mockContext(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ctx-1',
    name: 'safe-context',
    content: { key: 'value' },
    isActive: true,
    lineOfBusiness: 'wealth_management',
    ...overrides,
  };
}

function mockAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agent-1',
    orgId: 'org-1',
    agentId: 'wm-agent-01',
    ownerTeam: 'wealth-management',
    approvalStatus: 'approved',
    ...overrides,
  };
}

describe('Security ACID — Inject (GET /api/inject)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLatestApprovedVersion.mockResolvedValue({ versionId: 'v1', versionLabel: 'v1.0.0' });
  });

  it('returns 400 when X-Sandarb-Agent-ID is missing', async () => {
    const { GET } = await import('@/app/api/inject/route');
    const req = new Request('http://localhost/api/inject?name=my-context', {
      headers: { 'X-Sandarb-Trace-ID': 'trace-123' },
    });
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('X-Sandarb-Agent-ID');
    expect(mockGetContextByName).not.toHaveBeenCalled();
  });

  it('returns 400 when X-Sandarb-Trace-ID is missing', async () => {
    const { GET } = await import('@/app/api/inject/route');
    const req = new Request('http://localhost/api/inject?name=my-context', {
      headers: { 'X-Sandarb-Agent-ID': 'my-agent' },
    });
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('X-Sandarb-Trace-ID');
    expect(mockGetContextByName).not.toHaveBeenCalled();
  });

  it('returns 400 when neither id nor name is provided', async () => {
    const { GET } = await import('@/app/api/inject/route');
    const req = new Request('http://localhost/api/inject', {
      headers: { 'X-Sandarb-Agent-ID': 'my-agent', 'X-Sandarb-Trace-ID': 'trace-1' },
    });
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('id or name');
  });

  it('returns 400 when format is invalid', async () => {
    mockGetContextByName.mockResolvedValue(mockContext());
    const { GET } = await import('@/app/api/inject/route');
    const req = new Request('http://localhost/api/inject?name=my-context&format=sql', {
      headers: { 'X-Sandarb-Agent-ID': 'sandarb-context-preview', 'X-Sandarb-Trace-ID': 'trace-1' },
    });
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('Invalid format');
  });

  it('returns 403 when context exists but is inactive', async () => {
    mockGetContextByName.mockResolvedValue(mockContext({ isActive: false }));
    const { GET } = await import('@/app/api/inject/route');
    const req = new Request('http://localhost/api/inject?name=my-context', {
      headers: { 'X-Sandarb-Agent-ID': 'sandarb-context-preview', 'X-Sandarb-Trace-ID': 'trace-1' },
    });
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error).toContain('inactive');
  });

  it('returns 403 when agent is not registered and logs blocked injection', async () => {
    mockGetContextByName.mockResolvedValue(mockContext());
    mockGetAgentByIdentifier.mockResolvedValue(null);
    const { GET } = await import('@/app/api/inject/route');
    const req = new Request('http://localhost/api/inject?name=my-context', {
      headers: { 'X-Sandarb-Agent-ID': 'unregistered-agent', 'X-Sandarb-Trace-ID': 'trace-1' },
    });
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error).toContain('not registered');
    expect(mockLogBlockedInjection).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'unregistered-agent',
        reason: expect.stringContaining('registered'),
      })
    );
  });

  it('returns 403 when agent is registered but cross-LOB (policy violation)', async () => {
    mockGetContextByName.mockResolvedValue(mockContext({ lineOfBusiness: 'investment_banking' }));
    mockGetAgentByIdentifier.mockResolvedValue(mockAgent({ ownerTeam: 'wealth-management' }));
    mockCheckInjectPolicy.mockReturnValue({ allowed: false, reason: 'Policy violation: cross-LOB.' });
    const { GET } = await import('@/app/api/inject/route');
    const req = new Request('http://localhost/api/inject?name=ib-context', {
      headers: { 'X-Sandarb-Agent-ID': 'wm-agent-01', 'X-Sandarb-Trace-ID': 'trace-1' },
    });
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error).toMatch(/Policy violation|cross-LOB/);
    expect(mockLogBlockedInjection).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Policy (cross-LOB) — security property (use real policy, not inject mocks)
// ---------------------------------------------------------------------------

import type { RegisteredAgent } from '@/types';
import type { Context } from '@/types';

describe('Security ACID — Policy (cross-LOB)', () => {
  it('denies cross-LOB context access (wealth agent cannot pull IB context)', async () => {
    const { checkInjectPolicy } = await vi.importActual<typeof import('@/lib/policy')>('@/lib/policy');
    const agent: RegisteredAgent = {
      ownerTeam: 'wealth-management',
      id: 'a1',
      orgId: 'o1',
      agentId: 'wm-01',
      name: 'WM Agent',
      description: null,
      a2aUrl: '',
      agentCard: null,
      status: 'active',
      approvalStatus: 'approved',
      approvedBy: null,
      approvedAt: null,
      submittedBy: null,
      createdBy: null,
      createdAt: '',
      updatedAt: '',
      updatedBy: null,
      toolsUsed: [],
      allowedDataScopes: [],
      piiHandling: false,
      regulatoryScope: [],
    } as RegisteredAgent;
    const context: Context = {
      id: 'c1',
      name: 'ib-context',
      lineOfBusiness: 'investment_banking',
      content: {},
      isActive: true,
      description: null,
      templateId: null,
      environment: 'production',
      tags: [],
      priority: 0,
      expiresAt: null,
      createdBy: null,
      createdAt: '',
      updatedAt: '',
      updatedBy: null,
      dataClassification: null,
      regulatoryHooks: [],
    };
    const result = checkInjectPolicy(agent, context);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Policy violation');
  });

  it('allows same-LOB context access', async () => {
    const { checkInjectPolicy } = await vi.importActual<typeof import('@/lib/policy')>('@/lib/policy');
    const agent: RegisteredAgent = {
      ownerTeam: 'wealth-management',
      id: 'a1',
      orgId: 'o1',
      agentId: 'wm-01',
      name: 'WM Agent',
      description: null,
      a2aUrl: '',
      agentCard: null,
      status: 'active',
      approvalStatus: 'approved',
      approvedBy: null,
      approvedAt: null,
      submittedBy: null,
      createdBy: null,
      createdAt: '',
      updatedAt: '',
      updatedBy: null,
      toolsUsed: [],
      allowedDataScopes: [],
      piiHandling: false,
      regulatoryScope: [],
    } as RegisteredAgent;
    const context: Context = {
      id: 'c1',
      name: 'wm-context',
      lineOfBusiness: 'wealth_management',
      content: {},
      isActive: true,
      description: null,
      templateId: null,
      environment: 'production',
      tags: [],
      priority: 0,
      expiresAt: null,
      createdBy: null,
      createdAt: '',
      updatedAt: '',
      updatedBy: null,
      dataClassification: null,
      regulatoryHooks: [],
    };
    expect(checkInjectPolicy(agent, context).allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Input validation — resource names and variable substitution (use real utils)
// ---------------------------------------------------------------------------

describe('Security ACID — Input validation', () => {
  describe('isValidResourceName', () => {
    it('rejects names with path traversal attempts', async () => {
      const { isValidResourceName } = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils');
      expect(isValidResourceName('../etc/passwd')).toBe(false);
      expect(isValidResourceName('..\\windows\\system32')).toBe(false);
    });

    it('rejects names with SQL-like or script injection characters', async () => {
      const { isValidResourceName } = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils');
      expect(isValidResourceName("'; DROP TABLE contexts;--")).toBe(false);
      expect(isValidResourceName('a<b>c')).toBe(false);
      expect(isValidResourceName('a\x00b')).toBe(false);
    });

    it('rejects empty and whitespace-only', async () => {
      const { isValidResourceName } = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils');
      expect(isValidResourceName('')).toBe(false);
      expect(isValidResourceName('   ')).toBe(false);
    });

    it('accepts only lowercase alphanumeric, hyphens, underscores', async () => {
      const { isValidResourceName } = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils');
      expect(isValidResourceName('valid-context_01')).toBe(true);
      expect(isValidResourceName('UPPERCASE')).toBe(false);
      expect(isValidResourceName('with space')).toBe(false);
    });
  });

  describe('substituteVariables (no code execution)', () => {
    it('only substitutes {{word}} placeholders (\\w+), not arbitrary expressions', async () => {
      const { substituteVariables } = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils');
      const content = { msg: 'Hello {{name}}, {{evil}}' };
      const result = substituteVariables(content, {
        name: 'User',
        evil: '${process.env.SECRET}',
      }) as { msg: string };
      expect(result.msg).toBe('Hello User, ${process.env.SECRET}');
    });

    it('does not interpret {{...}} as code', async () => {
      const { substituteVariables } = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils');
      const content = { msg: '{{x}}' };
      const result = substituteVariables(content, { x: '{{y}}' }) as { msg: string };
      expect(result.msg).toBe('{{y}}');
    });
  });
});

// ---------------------------------------------------------------------------
// Approval workflow — only proposed versions can be approved/rejected
// ---------------------------------------------------------------------------

const mockGetPromptById = vi.fn();
const mockGetPromptVersionById = vi.fn();
const mockApprovePromptVersion = vi.fn();

vi.mock('@/lib/prompts', () => ({
  getPromptById: (...args: unknown[]) => mockGetPromptById(...args),
  getPromptVersionById: (...args: unknown[]) => mockGetPromptVersionById(...args),
  approvePromptVersion: (...args: unknown[]) => mockApprovePromptVersion(...args),
}));

describe('Security ACID — Approval workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when approving a version that is not proposed', async () => {
    mockGetPromptById.mockResolvedValue({ id: 'p1', name: 'test-prompt' });
    mockGetPromptVersionById.mockResolvedValue({
      id: 'v1',
      promptId: 'p1',
      status: 'approved',
      version: 1,
    });
    const { POST } = await import('@/app/api/prompts/[id]/versions/[versionId]/approve/route');
    const req = new Request('http://localhost/api/prompts/p1/versions/v1/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedBy: 'admin' }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'p1', versionId: 'v1' }) });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/proposed|status/);
    expect(mockApprovePromptVersion).not.toHaveBeenCalled();
  });
});
