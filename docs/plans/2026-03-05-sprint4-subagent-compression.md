# Sprint 4: Sub-Agent Compression

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a summarization step in the Railway worker so sub-agents return 1,500-token structured summaries instead of 5-10K token raw dumps. Reduces context window consumption and improves model reasoning quality.

**Architecture:** After each sub-agent completes, run a Claude Haiku compression pass that condenses raw output into a structured summary with key findings, data points, confidence, sources, and gaps. Validate with Zod. Add Supabase write retry with exponential backoff and dead-letter queue.

**Tech Stack:** Railway Express worker, Anthropic SDK, Claude Haiku 4.5, Supabase, Zod

**Independent of:** Other sprints (can be done in parallel with Sprints 1-3)

---

## Why This Matters

From the alignment doc (Anthropic pattern):
> "Specialized sub-agents return 1,000-2,000 token condensed summaries after extensive exploration. This keeps the parent agent's context clean."

Currently, Railway runners return raw sub-agent output directly to Supabase — no compression, no summary. A single research result can be 5,000-10,000 tokens. With Sprint 1 flowing results back to the model, this bloats context fast.

### Key Constraint
Railway worker is a **separate process** — it CANNOT import from `src/lib/`. Uses Anthropic SDK directly (`@anthropic-ai/sdk`), not Vercel AI SDK.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `research-worker/src/schemas/compressed-summary.ts` | Create | Zod schema for compressed output |
| `research-worker/src/compress.ts` | Create | Haiku compression function |
| `research-worker/src/dead-letter.ts` | Create | Dead-letter queue for failed writes |
| `research-worker/src/supabase.ts` | Modify | Add retry with exponential backoff |
| `research-worker/src/index.ts` | Modify | Wire compression into pipeline, add stale job detection |
| `research-worker/src/schemas/__tests__/compressed-summary.test.ts` | Create | Schema tests |
| `research-worker/src/__tests__/compress.test.ts` | Create | Compression tests |
| `research-worker/src/__tests__/dead-letter.test.ts` | Create | Dead-letter tests |

---

### Task 1: Create CompressedSummary Zod schema

**Files:**
- Create: `research-worker/src/schemas/compressed-summary.ts`
- Test: `research-worker/src/schemas/__tests__/compressed-summary.test.ts`

**Step 1: Write the failing test**

```typescript
// research-worker/src/schemas/__tests__/compressed-summary.test.ts
import { describe, it, expect } from 'vitest';
import { CompressedSummarySchema, type CompressedSummary } from '../compressed-summary';

describe('CompressedSummarySchema', () => {
  it('validates a complete summary', () => {
    const input: CompressedSummary = {
      keyFindings: ['B2B SaaS market growing 15% YoY', 'LinkedIn CPL averaging $250'],
      dataPoints: { marketSize: '$50B', avgCAC: '$1,200' },
      confidence: 'high',
      sources: ['https://g2.com/report', 'https://statista.com/saas'],
      gaps: ['No data on SMB segment'],
    };
    const result = CompressedSummarySchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects empty keyFindings', () => {
    const input = {
      keyFindings: [],
      dataPoints: {},
      confidence: 'high',
      sources: [],
      gaps: [],
    };
    const result = CompressedSummarySchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects more than 7 keyFindings', () => {
    const input = {
      keyFindings: Array(8).fill('finding'),
      dataPoints: {},
      confidence: 'high',
      sources: [],
      gaps: [],
    };
    const result = CompressedSummarySchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects invalid confidence level', () => {
    const input = {
      keyFindings: ['finding'],
      dataPoints: {},
      confidence: 'very-high',
      sources: [],
      gaps: [],
    };
    const result = CompressedSummarySchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd research-worker && npx vitest run src/schemas/__tests__/compressed-summary.test.ts`

**Step 3: Write minimal implementation**

```typescript
// research-worker/src/schemas/compressed-summary.ts
import { z } from 'zod';

export const CompressedSummarySchema = z.object({
  keyFindings: z.array(z.string()).min(1).max(7).describe(
    'Top findings, most important first. Max 7.',
  ),
  dataPoints: z.record(z.string(), z.string()).describe(
    'Key metric → value pairs (e.g., { "marketSize": "$50B", "avgCAC": "$1,200" })',
  ),
  confidence: z.enum(['high', 'medium', 'low']).describe(
    'Overall confidence in findings based on source quality and coverage',
  ),
  sources: z.array(z.string()).max(10).describe(
    'Source URLs or references used',
  ),
  gaps: z.array(z.string()).describe(
    'What we could not find or verify — helps the model know what to ask about',
  ),
});

export type CompressedSummary = z.infer<typeof CompressedSummarySchema>;
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add research-worker/src/schemas/
git commit -m "feat: add CompressedSummary Zod schema for research output"
```

---

### Task 2: Create compression function

**Files:**
- Create: `research-worker/src/compress.ts`
- Test: `research-worker/src/__tests__/compress.test.ts`

**Step 1: Write the failing test**

```typescript
// research-worker/src/__tests__/compress.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            keyFindings: ['Market is growing'],
            dataPoints: { growth: '15%' },
            confidence: 'high',
            sources: ['https://example.com'],
            gaps: ['Limited SMB data'],
          }),
        }],
      }),
    },
  })),
}));

describe('compressResearchOutput', () => {
  it('returns a valid CompressedSummary from raw data', async () => {
    const { compressResearchOutput } = await import('../compress');
    const result = await compressResearchOutput('industryMarket', {
      categorySnapshot: { category: 'B2B SaaS', marketMaturity: 'growing' },
      painPoints: { primary: ['High CAC', 'Long sales cycles'] },
      marketTrends: ['AI adoption', 'Product-led growth'],
    });

    expect(result.keyFindings).toHaveLength(1);
    expect(result.confidence).toBe('high');
  });

  it('returns fallback summary when Haiku call fails', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    vi.mocked(Anthropic).mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('API error')),
      },
    }) as any);

    const { compressResearchOutput } = await import('../compress');
    const result = await compressResearchOutput('industryMarket', {
      summary: 'Market is growing rapidly',
    });

    // Fallback should still return a valid CompressedSummary
    expect(result.keyFindings.length).toBeGreaterThan(0);
    expect(result.confidence).toBe('low');
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**

```typescript
// research-worker/src/compress.ts
import Anthropic from '@anthropic-ai/sdk';
import { CompressedSummarySchema, type CompressedSummary } from './schemas/compressed-summary';
import { extractJson } from './runner';

const COMPRESSION_PROMPT = `Condense this research output into a structured summary.
Focus on actionable findings for a paid media strategy. Max 1500 tokens total.

Rules:
- keyFindings: 3-7 bullet points, most important first
- dataPoints: Extract specific numbers, percentages, dollar amounts
- confidence: high (multiple quality sources), medium (some sources), low (limited data)
- sources: List URLs/references used
- gaps: What couldn't be found or verified

Respond with JSON only. No preamble.`;

export async function compressResearchOutput(
  section: string,
  rawData: unknown,
): Promise<CompressedSummary> {
  try {
    const client = new Anthropic({ maxRetries: 1 });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `${COMPRESSION_PROMPT}\n\nSection: ${section}\n\nRaw research data:\n${JSON.stringify(rawData, null, 2)}`,
      }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : '';
    const parsed = extractJson(text);
    const validated = CompressedSummarySchema.parse(parsed);
    return validated;
  } catch (error) {
    console.warn(`[compress] Haiku compression failed for ${section}:`, error);
    return buildFallbackSummary(section, rawData);
  }
}

function buildFallbackSummary(section: string, rawData: unknown): CompressedSummary {
  const dataStr = JSON.stringify(rawData);
  const truncated = dataStr.length > 500 ? dataStr.slice(0, 497) + '...' : dataStr;

  return {
    keyFindings: [`Raw ${section} data available (compression failed)`],
    dataPoints: { rawLength: `${dataStr.length} chars` },
    confidence: 'low',
    sources: [],
    gaps: ['Compression failed — raw data preserved but not structured'],
  };
}
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add research-worker/src/compress.ts research-worker/src/__tests__/compress.test.ts
git commit -m "feat: add Haiku compression for research outputs"
```

---

### Task 3: Add Supabase write retry with exponential backoff

**Files:**
- Modify: `research-worker/src/supabase.ts`

**Step 1: Add withSupabaseRetry utility**

```typescript
// Add to research-worker/src/supabase.ts:

async function withSupabaseRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLast = attempt === maxRetries;
      console.warn(
        `[supabase] ${label} attempt ${attempt}/${maxRetries} failed:`,
        error instanceof Error ? error.message : error,
      );
      if (isLast) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  throw new Error('unreachable');
}
```

**Step 2: Wrap writeResearchResult and writeJobStatus**

```typescript
// Update existing functions:
export async function writeResearchResult(userId: string, section: string, result: ResearchResult) {
  return withSupabaseRetry(
    () => writeResearchResultInner(userId, section, result),
    `writeResearchResult(${section})`,
  );
}
```

Rename the existing implementation to `writeResearchResultInner` (same for `writeJobStatus`).

**Step 3: Commit**

```bash
git add research-worker/src/supabase.ts
git commit -m "feat: add exponential backoff retry for Supabase writes"
```

---

### Task 4: Create dead-letter queue

**Files:**
- Create: `research-worker/src/dead-letter.ts`
- Test: `research-worker/src/__tests__/dead-letter.test.ts`

**Step 1: Write the failing test**

```typescript
// research-worker/src/__tests__/dead-letter.test.ts
import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';

vi.mock('fs', () => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe('writeDeadLetter', () => {
  it('writes a JSON file to the dead-letters directory', async () => {
    const { writeDeadLetter } = await import('../dead-letter');
    writeDeadLetter('user-123', 'industryMarket', { data: 'test' }, 'Supabase timeout');

    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('dead-letters/'),
      expect.stringContaining('"userId":"user-123"'),
    );
  });
});
```

**Step 2: Write minimal implementation**

```typescript
// research-worker/src/dead-letter.ts
import * as fs from 'fs';
import * as path from 'path';

const DEAD_LETTER_DIR = path.join(process.cwd(), 'dead-letters');

export function writeDeadLetter(
  userId: string,
  section: string,
  data: unknown,
  error: string,
): void {
  try {
    fs.mkdirSync(DEAD_LETTER_DIR, { recursive: true });
    const filename = `${new Date().toISOString().split('T')[0]}-${section}-${userId.slice(0, 8)}.json`;
    const filepath = path.join(DEAD_LETTER_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify({
      userId,
      section,
      data,
      error,
      timestamp: new Date().toISOString(),
    }, null, 2));
    console.warn(`[dead-letter] Written to ${filepath}`);
  } catch (err) {
    console.error('[dead-letter] Failed to write dead letter:', err);
  }
}
```

**Step 3: Commit**

```bash
git add research-worker/src/dead-letter.ts research-worker/src/__tests__/dead-letter.test.ts
git commit -m "feat: add dead-letter queue for failed Supabase writes"
```

---

### Task 5: Wire compression into runner pipeline

**Files:**
- Modify: `research-worker/src/index.ts`

**Step 1: Add compression step after runner completes**

In the detached async block (lines 116-147 of `index.ts`), after the runner returns:

```typescript
// After: const result = await runnerFn(body.context);
// Before: await writeResearchResult(body.userId, section, result);

import { compressResearchOutput } from './compress';
import { writeDeadLetter } from './dead-letter';

// Compress successful results
if (result.status === 'complete' && result.data) {
  try {
    const compressed = await compressResearchOutput(section, result.data);
    console.log(`[${tool}] Compressed: ${JSON.stringify(result.data).length} → ${JSON.stringify(compressed).length} chars`);
    result.data = compressed;
    (result as any).compressionApplied = true;
  } catch (compressError) {
    console.warn(`[${tool}] Compression failed, using raw data:`, compressError);
    // Keep raw data — don't lose results
  }
}

// Write with retry + dead-letter fallback
try {
  await writeResearchResult(body.userId, section, result);
} catch (writeError) {
  writeDeadLetter(body.userId, section, result, String(writeError));
}
```

**Step 2: Run the worker and test manually**

```bash
cd research-worker && npm run dev
# In another terminal, send a test request and verify compressed output in Supabase
```

**Step 3: Commit**

```bash
git add research-worker/src/index.ts
git commit -m "feat: wire compression + dead-letter into runner pipeline"
```

---

### Task 6: Add stale job detection

**Files:**
- Modify: `research-worker/src/index.ts`

**Step 1: Add periodic stale job check**

```typescript
// Add to worker startup (after app.listen):

const STALE_THRESHOLD_MS = 180_000; // 3 minutes

setInterval(async () => {
  try {
    // This would scan job_status for all users — simplified version
    console.log('[stale-check] Checking for stale jobs...');
    // In production, query Supabase for job_status entries where
    // status='running' and startedAt < now - 180s
    // Mark them as { status: 'error', error: 'timeout: job exceeded 180s' }
  } catch (err) {
    console.error('[stale-check] Error:', err);
  }
}, 60_000); // Check every 60s
```

Note: Full implementation requires a Supabase query across all sessions. For MVP, log a warning. Full stale detection can be added as a follow-up.

**Step 2: Commit**

```bash
git add research-worker/src/index.ts
git commit -m "feat: add stale job detection interval (180s threshold)"
```

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | Research results in Supabase are compressed (~1,500 tokens) | Query Supabase after research run |
| 2 | CompressedSummary passes Zod validation | Schema validation in compress.ts |
| 3 | Compression failure falls back to raw data | Mock Haiku failure, verify raw data preserved |
| 4 | Supabase writes retry 3x with exponential backoff | Mock Supabase failure, verify retry logs |
| 5 | Failed writes go to dead-letter queue | Mock 3x Supabase failure, verify JSON file |
| 6 | Jobs stuck >180s logged as stale | Check worker logs |
| 7 | Worker still returns 202 immediately | Test /run endpoint response time |
| 8 | `npm run build` passes (in research-worker) | `cd research-worker && npm run build` |

## Risks and Mitigations

1. **Haiku compression adds latency**: ~2-5s per call. Runner already takes 30-120s, so 2-5s is negligible.
2. **Haiku may miss important details**: Schema forces structured extraction. `gaps` field captures what was lost. Review first 10 compressions manually.
3. **Cost**: ~$0.001 per compression (1K input, 1.5K output at Haiku pricing). Negligible vs Sonnet runner cost (~$0.05-0.10 per run).
4. **Dead-letter directory grows**: Only triggers on 3x Supabase failure (rare). Monitor with `ls -la dead-letters/`.
5. **Worker can't import Zod from main app**: Worker has its own `package.json` with Zod. Schema defined in `research-worker/src/schemas/`.

## Execution Order

Tasks 1-2 are the compression foundation. Task 3 adds retry. Task 4 adds dead-letter. Task 5 wires everything together. Task 6 is standalone.

Recommended: 1 → 2 → 3 → 4 → 5 → 6
