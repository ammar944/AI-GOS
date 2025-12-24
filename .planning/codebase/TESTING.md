# Testing Patterns

**Analysis Date:** 2025-12-24

## Test Framework

**Runner:**
- NOT CONFIGURED - No test framework detected

**Assertion Library:**
- Not installed

**Run Commands:**
```bash
# No test commands available
# Recommended setup:
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm test                              # Run all tests (after setup)
npm test -- --watch                   # Watch mode
npm test -- path/to/file.test.ts     # Single file
npm run test:coverage                 # Coverage report
```

## Test File Organization

**Location:**
- No test files found in `src/`
- No `__tests__/` directories
- No `*.test.ts`, `*.test.tsx`, `*.spec.ts` files

**Naming (Recommended):**
- Unit tests: `module-name.test.ts` (co-located with source)
- Integration: `feature.integration.test.ts`
- E2E: `user-flow.e2e.test.ts`

**Structure (Recommended):**
```
src/
  lib/
    openrouter/
      client.ts
      client.test.ts
    media-plan/
      pipeline/
        extract.ts
        extract.test.ts
  components/
    ui/
      button.tsx
      button.test.tsx
```

## Test Structure

**Suite Organization (Recommended):**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ModuleName', () => {
  describe('functionName', () => {
    beforeEach(() => {
      // reset state
    });

    it('should handle valid input', () => {
      // arrange
      const input = createTestInput();

      // act
      const result = functionName(input);

      // assert
      expect(result).toEqual(expectedOutput);
    });

    it('should throw on invalid input', () => {
      expect(() => functionName(null)).toThrow('Invalid input');
    });
  });
});
```

**Patterns (Recommended):**
- Use beforeEach for per-test setup
- Use afterEach to restore mocks
- Arrange/Act/Assert structure
- One assertion focus per test

## Mocking

**Framework (Recommended):**
- Vitest built-in mocking (vi)
- Module mocking via vi.mock()

**Patterns (Recommended):**
```typescript
import { vi } from 'vitest';

// Mock OpenRouter client
vi.mock('@/lib/openrouter/client', () => ({
  createOpenRouterClient: vi.fn(() => ({
    complete: vi.fn().mockResolvedValue({ data: 'mocked' })
  }))
}));

// Mock fetch for external APIs
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ data: 'test' })
});
```

**What to Mock:**
- External API calls (OpenRouter, Supabase)
- localStorage operations
- Environment variables

**What NOT to Mock:**
- Pure utility functions (`src/lib/utils.ts`)
- Type validation functions
- Simple data transformations

## Fixtures and Factories

**Test Data (Recommended):**
```typescript
// Factory for NicheFormData
function createNicheFormData(overrides?: Partial<NicheFormData>): NicheFormData {
  return {
    industry: 'Test Industry',
    audience: 'Test Audience',
    icp: 'Test ICP',
    ...overrides
  };
}

// Factory for BriefingFormData
function createBriefingFormData(overrides?: Partial<BriefingFormData>): BriefingFormData {
  return {
    budget: 5000,
    price: 100,
    cycle: 30,
    ...overrides
  };
}
```

**Location (Recommended):**
- Factory functions: define in test file or `tests/factories/`
- Shared fixtures: `tests/fixtures/`

## Coverage

**Requirements:**
- None defined (tests not implemented)

**Configuration (Recommended):**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
    },
  },
});
```

**View Coverage (After Setup):**
```bash
npm run test:coverage
open coverage/index.html
```

## Test Types

**Unit Tests (Priority 1 - Critical):**
- `src/lib/openrouter/client.ts` - JSON extraction logic
- `src/lib/media-plan/pipeline/media-plan-generator.ts` - Section generation
- `src/lib/storage/local-storage.ts` - Storage operations
- Validation functions in API routes

**Integration Tests (Priority 2):**
- Media plan pipeline stages (mock external APIs)
- Strategic blueprint generator
- API route handlers with mocked dependencies

**E2E Tests (Priority 3):**
- Not currently planned
- Framework recommendation: Playwright

## Common Patterns

**Async Testing:**
```typescript
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe('expected');
});
```

**Error Testing:**
```typescript
it('should throw on invalid input', () => {
  expect(() => parse(null)).toThrow('Cannot parse null');
});

// Async error
it('should reject on failure', async () => {
  await expect(asyncCall()).rejects.toThrow('error message');
});
```

**API Route Testing:**
```typescript
import { POST } from '@/app/api/media-plan/generate/route';

it('should return 400 for invalid input', async () => {
  const request = new Request('http://test', {
    method: 'POST',
    body: JSON.stringify({ invalid: 'data' }),
  });

  const response = await POST(request);
  expect(response.status).toBe(400);
});
```

**Snapshot Testing:**
- Not recommended for this codebase
- Prefer explicit assertions

## Areas Needing Tests (Priority Order)

1. **Critical - JSON Extraction:**
   - `src/lib/openrouter/client.ts` - extractJSON() function
   - Multiple extraction strategies need verification

2. **Critical - Input Validation:**
   - API route validation functions
   - Sanitization for prompt injection

3. **High - Pipeline Stages:**
   - Individual stage functions with mocked AI responses
   - Progress callback behavior

4. **Medium - Components:**
   - Form wizard step transitions
   - Form validation UI feedback

5. **Low - UI Components:**
   - Button variants render correctly
   - Card composition works as expected

---

*Testing analysis: 2025-12-24*
*Update when test patterns change*
