# Sandarb test suite

An AI governance tool must have a robust test suite so you can trust it to govern your agents. This folder contains **unit tests** and **API route tests** for Sandarb. All tests use **Vitest**; API tests mock the database and lib layer so no real DB is required.

## Running tests

```bash
npm run test           # watch mode (re-runs on file changes)
npm run test:run       # single run (use in CI)
npm run test:coverage  # single run with coverage report (lib + app/api)
npm run test:security  # security ACID tests only (use in security gate / CI)
```

Run these before committing. The suite is fast (no DB); typical run is under a second.

## Test structure

| Directory   | Purpose |
|------------|---------|
| **`tests/lib/`** | Unit tests for core library code. No DB; pure logic and (when needed) mocked `@/lib/pg`. |
| **`tests/api/`** | API route tests. Each file tests one route (or related routes). Lib modules are mocked with `vi.mock('@/lib/...')`. |
| **`tests/security/`** | Security ACID tests. Rigorous assertions that critical security properties hold (inject: audit IDs, unregistered/cross-LOB denied; policy; input validation; approval workflow). Run with `npm run test:security`. |

Test files must be named `*.test.ts` or `*.test.tsx` and live under `tests/`. Vitest is configured in `vitest.config.ts` (Node environment, `@` alias to project root).

## What is covered

### Lib tests (`tests/lib/`)

- **`utils.test.ts`** — `formatApprovedBy`, `normalizeApprovedBy`, `formatDate`, `formatDateTime`, `formatRelativeTime`, `isValidResourceName` / `isValidContextName`, `slugify`, `safeJsonParse`, `truncate`, `substituteVariables`, `formatContent` (json/yaml/text), `cn`.
- **`policy.test.ts`** — LOB policy: `ownerTeamToLOB`, `checkInjectPolicy` (cross-LOB context access); edge cases (same LOB, retail vs wealth vs investment_banking).
- **`governance.test.ts`** — Governance types (ScanTarget, UnauthenticatedDetection).

### API tests (`tests/api/`)

- **`health.test.ts`** — GET /api/health: healthy response shape, 503 when DB fails.
- **`inject.test.ts`** — Inject flow: policy checks and variable substitution (no real DB).
- **`agents-approve.test.ts`** — POST /api/agents/[id]/approve: 200/404/500, body `approvedBy` and header fallback.
- **`agents-reject.test.ts`** — POST /api/agents/[id]/reject: 200/404/500, body `rejectedBy`.
- **`prompts-approve.test.ts`** — POST /api/prompts/[id]/versions/[versionId]/approve: prompt/version lookup, 400 when version not proposed or wrong prompt, 200/500, `approvedBy` from body or `x-user-id`.
- **`prompts-reject.test.ts`** — POST /api/prompts/[id]/versions/[versionId]/reject: same validations, `rejectedBy`, optional `reason` in message.
- **`contexts-approve.test.ts`** — POST /api/contexts/[id]/revisions/[revId]/approve: 200/404/500, body `approvedBy`.
- **`contexts-reject.test.ts`** — POST /api/contexts/[id]/revisions/[revId]/reject: 200/404/500, body `rejectedBy`.
- **`governance-blocked.test.ts`** — GET /api/governance/blocked-injections: items array, limit param, 500 on error.
- **`governance-unauthenticated.test.ts`** — GET /api/governance/unauthenticated-agents: items array, limit cap 100, 500 on error.

### Security tests (`tests/security/`)

- **`acid.test.ts`** — Security ACID test: inject route (audit IDs required, unregistered agent 403, cross-LOB 403, inactive context 403, invalid format 400); policy (cross-LOB denied, same-LOB allowed); input validation (isValidResourceName rejects path traversal/SQL-like/empty; substituteVariables only substitutes `{{word}}`, no code execution); approval workflow (only proposed versions can be approved).

### Behaviors we assert

1. **Governance display** — Approved-by and created-by use `@username`; formatting and normalization (utils).
2. **Governance policy** — Cross-LOB access denied; same-LOB and unrestricted contexts allowed; LOB slug normalization.
3. **Inject flow** — Variable substitution `{{key}}` and policy enforcement.
4. **Resource naming** — Valid/invalid names and slugs for contexts and prompts.
5. **Approve/reject APIs** — Success (200 + data), 404 when resource not found or not in proposable state, 400 for bad state (e.g. not proposed), 500 when lib returns null or throws; body/header `approvedBy`/`rejectedBy` passed through to lib.
6. **Health & governance APIs** — Response shape, limit params, 500 on thrown errors.
7. **Security ACID** — Inject: audit IDs required; unregistered agent and cross-LOB denied; inactive context denied; format/input validation. Policy: cross-LOB blocked. Input: resource names and variable substitution safe (no path traversal, no code execution). Approval: only proposed versions can be approved.

## Extending the suite

Anyone using or modifying Sandarb can add or extend tests following the patterns below.

### Adding a new lib test file

1. Create `tests/lib/<module>.test.ts`.
2. Import the functions under test from `@/lib/<module>`.
3. Use `describe` / `it` / `expect`. If the code hits the DB, mock `@/lib/pg` or `getPool()` so the test stays unit-level.

Example (no DB):

```ts
import { describe, it, expect } from 'vitest';
import { myHelper } from '@/lib/utils';

describe('myHelper', () => {
  it('does something', () => {
    expect(myHelper('input')).toBe('expected');
  });
});
```

### Adding a new API route test file

1. Create `tests/api/<route-name>.test.ts` (e.g. `prompts-approve.test.ts`).
2. Mock the **lib** module the route uses (not the route itself). Use `vi.mock('@/lib/...')` at top level so the route handler calls your mocks.
3. In each test: set up mocks (e.g. `mockFn.mockResolvedValue(...)`), dynamically `import()` the route’s `POST`/`GET` from the real path, build a `Request` and call the handler with the correct `params` (Next.js uses a **Promise** of params).
4. Assert `res.status` and `res.json()` (or body) and that the lib was called with expected arguments.

Pattern for a POST route with dynamic segments:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSomeLibFn = vi.fn();
vi.mock('@/lib/some-module', () => ({
  someLibFn: (...args: unknown[]) => mockSomeLibFn(...args),
}));

describe('POST /api/your/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 and data when success', async () => {
    mockSomeLibFn.mockResolvedValue({ id: '1', name: 'Ok' });

    const { POST } = await import('@/app/api/your/route/route');
    const req = new Request('http://localhost/api/your/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'value' }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: '1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual({ id: '1', name: 'Ok' });
    expect(mockSomeLibFn).toHaveBeenCalledWith('1', 'value');
  });

  it('returns 404 when not found', async () => {
    mockSomeLibFn.mockResolvedValue(null);

    const { POST } = await import('@/app/api/your/route/route');
    const req = new Request('http://localhost/api/your/route', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'bad' }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
  });

  it('returns 500 when lib throws', async () => {
    mockSomeLibFn.mockRejectedValue(new Error('DB error'));

    const { POST } = await import('@/app/api/your/route/route');
    const req = new Request('http://localhost/api/your/route', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: '1' }) });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});
```

Important details:

- **Route path** — Use the real filesystem path under `app/api/`, e.g. `@/app/api/prompts/[id]/versions/[versionId]/approve/route`. The segment names in the path (e.g. `[id]`, `[versionId]`) define the keys in `params`.
- **params** — Next.js App Router passes `params` as a **Promise**. Use `{ params: Promise.resolve({ id: 'x', versionId: 'y' }) }` so the route’s `await params` works.
- **Multiple mocks** — If the route uses several lib functions (e.g. `getPromptById`, `getPromptVersionById`, `approvePromptVersion`), mock them all in one `vi.mock('@/lib/prompts', () => ({ ... }))` and set return values per test so the route sees the right preconditions (e.g. prompt found, version proposed).

### Extending an existing test file

- Add new `it('...')` blocks inside the same or a new `describe`.
- Reuse the same mocks; in `beforeEach` reset with `vi.clearAllMocks()` and set default resolved values so only the test that needs a different behavior overrides them.

### Conventions

- **Naming** — `tests/lib/<module>.test.ts`, `tests/api/<feature>-<action>.test.ts` (e.g. `agents-approve.test.ts`).
- **No real DB** — Keep tests fast and CI-friendly by mocking `@/lib/pg` or any module that talks to the DB.
- **Coverage** — `npm run test:coverage` reports on `lib/**` and `app/api/**`; add tests for new lib functions or API routes you add.

## Security testing

Run the security ACID test as part of your security gate (e.g. in CI):

```bash
npm run test:security
```

This runs only `tests/security/**/*.test.ts` and asserts critical security properties (inject audit IDs, unregistered/cross-LOB denial, input validation, approval workflow). Use it in addition to `npm run test:run` when you want a dedicated security pass.

## Configuration

- **Vitest** — `vitest.config.ts`: Node environment, `tests/**/*.test.{ts,tsx}`, `@` alias to project root.
- **Coverage** — v8 provider; includes `lib/**/*.ts` and `app/api/**/*.ts`; excludes types, configs, node_modules, and `tests/**`.

If you add a new API route or lib module, consider adding a corresponding test file so the suite stays the single place to validate behavior and so others can extend it with confidence.
