# Sandarb Test Suite

Sandarb has comprehensive test coverage for both **frontend** (Next.js) and **backend** (FastAPI).

## Quick Start

```bash
# Run all tests (frontend + backend)
npm run test:all

# Frontend tests only (Vitest)
npm run test           # watch mode
npm run test:run       # single run (CI)
npm run test:coverage  # with coverage

# Backend tests only (Pytest)
npm run test:backend        # run backend tests
npm run test:backend:cov    # with coverage
```

## Test Summary

| Suite | Framework | Tests | Coverage |
|-------|-----------|-------|----------|
| Frontend | Vitest | 67 tests | lib/, API client |
| Backend | Pytest | 53 tests | All API endpoints |
| **Total** | | **120 tests** | |

---

## Frontend Tests (Vitest)

This folder (`tests/`) contains unit tests for the Next.js frontend and shared lib.

## Test structure

| Directory   | Purpose |
|------------|---------|
| **`tests/lib/`** | Unit tests for core library code (utils, policy, governance types). No DB; pure logic. |

Test files must be named `*.test.ts` or `*.test.tsx` and live under `tests/`. Vitest is configured in `vitest.config.ts` (Node environment, `@` alias to project root).

## What is covered

### Lib tests (`tests/lib/`)

- **`utils.test.ts`** — `formatApprovedBy`, `normalizeApprovedBy`, `formatDate`, `formatDateTime`, `formatRelativeTime`, `isValidResourceName` / `isValidContextName`, `slugify`, `safeJsonParse`, `truncate`, `substituteVariables`, `formatContent` (json/yaml/text), `cn`.
- **`policy.test.ts`** — LOB policy: `ownerTeamToLOB`, `checkInjectPolicy` (cross-LOB context access); edge cases (same LOB, retail vs wealth vs investment_banking).
- **`governance.test.ts`** — Governance types (ScanTarget, UnauthenticatedDetection) from `@/types`.

### Behaviors we assert

1. **Governance display** — Approved-by and created-by use `@username`; formatting and normalization (utils).
2. **Governance policy** — Cross-LOB access denied; same-LOB and unrestricted contexts allowed; LOB slug normalization (policy.test.ts).
3. **Types** — ScanTarget and UnauthenticatedDetection shapes (governance.test.ts).

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

- **Naming** — `tests/lib/<module>.test.ts`.
- **No real DB** — Keep tests fast and CI-friendly; lib tests use pure logic or types.
- **Coverage** — `npm run test:coverage` reports on `lib/**`; add tests for new lib functions you add.

## Configuration

- **Vitest** — `vitest.config.ts`: Node environment, `tests/**/*.test.{ts,tsx}`, `@` alias to project root.
- **Coverage** — v8 provider; includes `lib/**/*.ts`; excludes types, configs, node_modules, and `tests/**`.

If you add a new lib module, consider adding a corresponding test file so the suite stays the single place to validate behavior.

---

## Backend Tests (Pytest)

Backend API tests are in `backend/tests/` and use **Pytest** with FastAPI's `TestClient`.

### Running Backend Tests

```bash
npm run test:backend              # run all backend tests
npm run test:backend:cov          # with coverage report

# Or directly with pytest
cd backend
python -m pytest tests/ -v
```

### Test Structure

| File | Coverage |
|------|----------|
| `test_agents.py` | CRUD, approval workflow, context linking |
| `test_contexts.py` | CRUD, pagination, revisions, compliance fields |
| `test_prompts.py` | CRUD, versions, approval/rejection, pull API |
| `test_organizations.py` | CRUD, hierarchy, agent associations |
| `test_health.py` | Health check, dashboard, settings |
| `conftest.py` | Shared fixtures (client, DB, sample data) |

### Adding Backend Tests

1. Create `backend/tests/test_<module>.py`
2. Use the shared `client` fixture for API calls
3. Clean up test data in fixtures

Example:

```python
import pytest

class TestMyFeature:
    @pytest.fixture(autouse=True)
    def setup(self, client):
        self.client = client
        yield
        # cleanup

    def test_list_items(self):
        response = self.client.get("/api/my-endpoint")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_create_item(self):
        response = self.client.post("/api/my-endpoint", json={"name": "test"})
        assert response.status_code in [200, 201]
```

### Backend Test Configuration

- **pytest.ini** — Test paths, patterns, options
- **conftest.py** — Fixtures: `client`, `db_connection`, sample data
- **Requirements** — `pytest`, `pytest-asyncio`, `httpx` (in `backend/requirements.txt`)

---

## CI Integration

Both test suites can run in CI:

```yaml
# Example GitHub Actions
- name: Run all tests
  run: npm run test:all
```

The combined `test:all` script runs frontend tests first, then backend tests.
