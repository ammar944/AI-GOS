# GTM Brief Phase 1 — Schemas, Scaffold, Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the contract layer of the GTM Brief architecture — Zod schemas, folder scaffold, and the Supabase migration — so every later phase builds on locked types.

**Architecture:** Introduce `src/lib/gtm/` (schemas, workflow, contracts), mirror the schemas under `research-worker/src/schemas/gtm/` (the worker cannot import from `src/lib`), scaffold empty `src/features/gtm/*`, `src/app/gtm/*`, `src/app/api/gtm/*/route.ts`, and `research-worker/src/{stages,runtime,adapters,jobs}/*`, and add a migration that creates `gtm_briefs`, `gtm_brief_snapshots`, and `gtm_runs`. No product behavior changes in Phase 1 — later phases fill the stubs.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Zod v4.2.x, Vitest v4, Supabase Postgres, Vercel AI SDK v6 (worker runtime), Railway worker boundary.

---

## Spec

Canonical: `docs/superpowers/specs/2026-04-24-gtm-brief-architecture.md` (locked 2026-04-24).

Superseded (do not copy verbatim — terminology has shifted):
- `docs/superpowers/specs/2026-04-24-business-profile-first-design.md`
- `docs/superpowers/plans/2026-04-24-business-profile-first.md`

Terminology the plan must use consistently:

| Canonical term | Never use |
|---|---|
| `GtmBrief` | `BusinessProfile`, `Company Snapshot` (as canonical type) |
| `GtmBriefField` | `ProfileFieldState` |
| `EvidenceSource` | `ProfileFieldEvidence` |
| `GtmBriefSnapshot` | "frozen profile", "snapshot profile" |
| `GtmRun` | `JourneySession` (as new-code type) |
| `briefSnapshotId` | "profile snapshot id" |
| `GtmStageKey` | `SectionKey` (as the new stage enum) |
| Strategy Synthesis | Cross Analysis (in new code) |

## Scope Check

Phase 1 covers one subsystem: the contract layer. It does NOT touch:

- Existing `business_profiles` table or `BusinessProfile` reads. Those keep working.
- Existing `research-worker/src/runners/*`. Those stay the live path until later phases.
- The `journey/` pipeline and chat sidebar.
- Anything under `skills/` (Phase 1 does not generate skills, only contracts that future skills will use).

First shippable slice:

```text
npm run test:run -- src/lib/gtm && npm run test:run -- research-worker/src/schemas/gtm && npm run lint && npm run build   ->   all green
```

After this lands, existing legacy code is untouched, and Phase 2 (URL → draft brief) can start against stable types.

## File Map

### Create — frontend (`src/`)

- `src/lib/gtm/schemas/evidence.ts` — `EvidenceSource` Zod schema + type.
- `src/lib/gtm/schemas/gtm-brief.ts` — `GtmBriefField` + `GtmBrief` + `GTM_BRIEF_FIELD_KEYS` + `GTM_BRIEF_FIELD_GROUPS`.
- `src/lib/gtm/schemas/gtm-brief-snapshot.ts` — `GtmBriefSnapshot` (immutable copy with snapshotId + parentBriefId + createdAt).
- `src/lib/gtm/schemas/gtm-run.ts` — `GtmStageKey`, `GtmRunStatus`, `GtmRun`.
- `src/lib/gtm/schemas/research-sections.ts` — 6 section output stubs (one schema per section).
- `src/lib/gtm/schemas/strategy-synthesis.ts` — synthesis output stub.
- `src/lib/gtm/schemas/media-plan.ts` — media plan output stub.
- `src/lib/gtm/schemas/script-pack.ts` — script pack output stub.
- `src/lib/gtm/schemas/index.ts` — barrel.
- `src/lib/gtm/workflow/stage-registry.ts` — canonical ordered stage list + helpers.
- `src/lib/gtm/workflow/section-order.ts` — research-section subset of stages.
- `src/lib/gtm/workflow/run-state.ts` — run status transition helpers.
- `src/lib/gtm/workflow/index.ts` — barrel.
- `src/lib/gtm/contracts/stage-inputs.ts` — per-stage input schemas (thin, read brief snapshot + prior outputs).
- `src/lib/gtm/contracts/stage-outputs.ts` — per-stage output schemas (thin, references section outputs).
- `src/lib/gtm/contracts/index.ts` — barrel.
- `src/lib/gtm/index.ts` — top-level barrel.
- `src/lib/gtm/schemas/__tests__/evidence.test.ts`
- `src/lib/gtm/schemas/__tests__/gtm-brief.test.ts`
- `src/lib/gtm/schemas/__tests__/gtm-brief-snapshot.test.ts`
- `src/lib/gtm/schemas/__tests__/gtm-run.test.ts`
- `src/lib/gtm/schemas/__tests__/stage-outputs.test.ts`
- `src/lib/gtm/workflow/__tests__/stage-registry.test.ts`
- `src/lib/gtm/workflow/__tests__/run-state.test.ts`

### Create — features/app scaffold (empty but importable)

- `src/features/gtm/intake/index.ts`
- `src/features/gtm/brief/index.ts`
- `src/features/gtm/research-workspace/index.ts`
- `src/features/gtm/media-plan/index.ts`
- `src/features/gtm/scripts/index.ts`
- `src/features/gtm/runs/index.ts`
- `src/app/gtm/page.tsx` — placeholder that renders "GTM workspace (coming in Phase 2)".
- `src/app/api/gtm/runs/route.ts` — stub returning 501.
- `src/app/api/gtm/brief/route.ts` — stub returning 501.
- `src/app/api/gtm/research/route.ts` — stub returning 501.
- `src/app/api/gtm/media-plan/route.ts` — stub returning 501.
- `src/app/api/gtm/scripts/route.ts` — stub returning 501.

### Create — worker (`research-worker/src/`)

- `research-worker/src/schemas/gtm/evidence.ts` — **exact mirror** of frontend `evidence.ts`.
- `research-worker/src/schemas/gtm/gtm-brief.ts` — mirror.
- `research-worker/src/schemas/gtm/gtm-brief-snapshot.ts` — mirror.
- `research-worker/src/schemas/gtm/gtm-run.ts` — mirror.
- `research-worker/src/schemas/gtm/research-sections.ts` — mirror.
- `research-worker/src/schemas/gtm/strategy-synthesis.ts` — mirror.
- `research-worker/src/schemas/gtm/media-plan.ts` — mirror.
- `research-worker/src/schemas/gtm/script-pack.ts` — mirror.
- `research-worker/src/schemas/gtm/index.ts` — mirror.
- `research-worker/src/schemas/gtm/__tests__/schema-parity.test.ts` — parity test (loads both files via Node fs + hashes normalized source).
- `research-worker/src/stages/discover-url.ts` — stub export.
- `research-worker/src/stages/enrich-brief.ts` — stub.
- `research-worker/src/stages/lock-brief.ts` — stub.
- `research-worker/src/stages/run-research-section.ts` — stub.
- `research-worker/src/stages/synthesize-strategy.ts` — stub.
- `research-worker/src/stages/generate-media-plan.ts` — stub.
- `research-worker/src/stages/generate-scripts.ts` — stub.
- `research-worker/src/stages/index.ts` — barrel.
- `research-worker/src/runtime/skill-loader.ts` — stub.
- `research-worker/src/runtime/anthropic-runner.ts` — stub.
- `research-worker/src/runtime/output-validator.ts` — stub.
- `research-worker/src/runtime/citation-normalizer.ts` — stub.
- `research-worker/src/runtime/index.ts` — barrel.
- `research-worker/src/adapters/web-search.ts` — stub.
- `research-worker/src/adapters/firecrawl.ts` — stub.
- `research-worker/src/adapters/supabase.ts` — stub.
- `research-worker/src/adapters/ad-library.ts` — stub.
- `research-worker/src/adapters/index.ts` — barrel.
- `research-worker/src/jobs/run-gtm-workflow.ts` — stub.

### Create — migration

- `docs/migrations/2026-04-24-add-gtm-brief-tables.sql`

### Modify

**None** in Phase 1 — this is a pure-add phase. If you find you need to modify a file, STOP and flag it; the phase is designed to be additive per the Meta-Harness lesson in `.claude/rules/learned-patterns.md`.

---

## Pre-flight

Before starting Task 1, confirm the tree is clean for Phase 1:

```bash
# All should print "does not exist":
ls src/lib/gtm 2>/dev/null || echo "src/lib/gtm: does not exist"
ls src/features/gtm 2>/dev/null || echo "src/features/gtm: does not exist"
ls src/app/gtm 2>/dev/null || echo "src/app/gtm: does not exist"
ls src/app/api/gtm 2>/dev/null || echo "src/app/api/gtm: does not exist"
ls research-worker/src/stages 2>/dev/null || echo "research-worker/src/stages: does not exist"
ls research-worker/src/runtime 2>/dev/null || echo "research-worker/src/runtime: does not exist"
ls research-worker/src/adapters 2>/dev/null || echo "research-worker/src/adapters: does not exist"
ls research-worker/src/schemas/gtm 2>/dev/null || echo "research-worker/src/schemas/gtm: does not exist"
```

If any target path already exists with content, STOP. Do not proceed — reconcile the conflict with the user first. (As of 2026-04-24 17:50, all eight paths are confirmed greenfield.)

---

## Task 1: Evidence Source Schema

**Files:**
- Create: `src/lib/gtm/schemas/evidence.ts`
- Create: `src/lib/gtm/schemas/__tests__/evidence.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/gtm/schemas/__tests__/evidence.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_SOURCE_TYPES,
  evidenceSourceSchema,
  type EvidenceSource,
} from '@/lib/gtm/schemas/evidence';

describe('evidenceSourceSchema', () => {
  const validSource: EvidenceSource = {
    id: 'src_01HXYZ',
    type: 'url',
    label: 'aigos.ai homepage',
    url: 'https://aigos.ai',
    excerpt: 'We help SaaS companies run GTM experiments.',
    capturedAt: '2026-04-24T12:00:00.000Z',
  };

  it('round-trips a valid source', () => {
    expect(evidenceSourceSchema.parse(validSource)).toEqual(validSource);
  });

  it('accepts every declared source type', () => {
    for (const type of EVIDENCE_SOURCE_TYPES) {
      const parsed = evidenceSourceSchema.parse({ ...validSource, type });
      expect(parsed.type).toBe(type);
    }
  });

  it('rejects unknown source types', () => {
    const result = evidenceSourceSchema.safeParse({ ...validSource, type: 'slack' });
    expect(result.success).toBe(false);
  });

  it('allows url and excerpt to be omitted', () => {
    const result = evidenceSourceSchema.safeParse({
      id: 'src_1',
      type: 'manual_note',
      label: 'founder note',
      capturedAt: '2026-04-24T12:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing id', () => {
    const { id: _omitted, ...rest } = validSource;
    const result = evidenceSourceSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
npm run test:run -- src/lib/gtm/schemas/__tests__/evidence.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/gtm/schemas/evidence'".

- [ ] **Step 3: Implement the schema**

Create `src/lib/gtm/schemas/evidence.ts`:

```typescript
import { z } from 'zod';

export const EVIDENCE_SOURCE_TYPES = [
  'url',
  'document',
  'transcript',
  'manual_note',
  'web_research',
  'ad_library',
  'tool_result',
] as const;

export const evidenceSourceSchema = z.object({
  id: z.string().min(1),
  type: z.enum(EVIDENCE_SOURCE_TYPES),
  label: z.string().min(1),
  url: z.string().url().optional(),
  excerpt: z.string().optional(),
  capturedAt: z.string().datetime(),
});

export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm run test:run -- src/lib/gtm/schemas/__tests__/evidence.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gtm/schemas/evidence.ts src/lib/gtm/schemas/__tests__/evidence.test.ts
git commit -m "feat(gtm): add evidence source schema"
```

---

## Task 2: GTM Brief Field + Brief Schema

**Files:**
- Create: `src/lib/gtm/schemas/gtm-brief.ts`
- Create: `src/lib/gtm/schemas/__tests__/gtm-brief.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/gtm/schemas/__tests__/gtm-brief.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  GTM_BRIEF_FIELD_KEYS,
  GTM_BRIEF_FIELD_GROUPS,
  gtmBriefFieldSchema,
  gtmBriefSchema,
  buildEmptyGtmBrief,
  type GtmBrief,
  type GtmBriefField,
  type GtmBriefFieldKey,
} from '@/lib/gtm/schemas/gtm-brief';

describe('gtmBriefFieldSchema', () => {
  const field: GtmBriefField = {
    value: 'AIGOS',
    status: 'confirmed',
    confidence: 'high',
    sources: [],
    updatedBy: 'user',
    updatedAt: '2026-04-24T12:00:00.000Z',
  };

  it('round-trips a valid field', () => {
    expect(gtmBriefFieldSchema.parse(field)).toEqual(field);
  });

  it('rejects unknown status', () => {
    const result = gtmBriefFieldSchema.safeParse({ ...field, status: 'approved' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown confidence', () => {
    const result = gtmBriefFieldSchema.safeParse({ ...field, confidence: 'certain' });
    expect(result.success).toBe(false);
  });

  it('requires updatedBy to be ai | user | system', () => {
    for (const updatedBy of ['ai', 'user', 'system'] as const) {
      expect(gtmBriefFieldSchema.safeParse({ ...field, updatedBy }).success).toBe(true);
    }
    expect(gtmBriefFieldSchema.safeParse({ ...field, updatedBy: 'bot' }).success).toBe(false);
  });
});

describe('GTM_BRIEF_FIELD_GROUPS', () => {
  it('every declared field key belongs to exactly one group', () => {
    const grouped = Object.values(GTM_BRIEF_FIELD_GROUPS).flat();
    const unique = new Set(grouped);
    expect(grouped.length).toBe(unique.size);
    expect(unique.size).toBe(GTM_BRIEF_FIELD_KEYS.length);
    for (const key of GTM_BRIEF_FIELD_KEYS) {
      expect(unique.has(key)).toBe(true);
    }
  });
});

describe('gtmBriefSchema', () => {
  it('buildEmptyGtmBrief produces a parseable, missing-everywhere brief', () => {
    const brief = buildEmptyGtmBrief();
    const parsed = gtmBriefSchema.parse(brief);
    for (const key of GTM_BRIEF_FIELD_KEYS) {
      expect(parsed.fields[key].status).toBe('missing');
      expect(parsed.fields[key].confidence).toBe('missing');
      expect(parsed.fields[key].value).toBe('');
    }
  });

  it('requires every field key to be present', () => {
    const brief = buildEmptyGtmBrief();
    // biome-ignore lint: explicit delete for negative test
    delete (brief.fields as Record<string, unknown>).companyName;
    expect(gtmBriefSchema.safeParse(brief).success).toBe(false);
  });

  it('requires briefId and a versioned updatedAt', () => {
    const brief = buildEmptyGtmBrief({ briefId: 'brief_01', updatedAt: '2026-04-24T12:00:00.000Z' });
    expect(brief.briefId).toBe('brief_01');
    expect(brief.updatedAt).toBe('2026-04-24T12:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
npm run test:run -- src/lib/gtm/schemas/__tests__/gtm-brief.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the schema**

Create `src/lib/gtm/schemas/gtm-brief.ts`:

```typescript
import { z } from 'zod';
import { evidenceSourceSchema } from '@/lib/gtm/schemas/evidence';

export const GTM_BRIEF_FIELD_STATUSES = ['missing', 'suggested', 'needs_review', 'confirmed'] as const;
export const GTM_BRIEF_FIELD_CONFIDENCES = ['missing', 'low', 'medium', 'high'] as const;
export const GTM_BRIEF_UPDATED_BY = ['ai', 'user', 'system'] as const;

export const gtmBriefFieldSchema = z.object({
  value: z.string(),
  status: z.enum(GTM_BRIEF_FIELD_STATUSES),
  confidence: z.enum(GTM_BRIEF_FIELD_CONFIDENCES),
  sources: z.array(evidenceSourceSchema),
  updatedBy: z.enum(GTM_BRIEF_UPDATED_BY),
  updatedAt: z.string().datetime(),
});

export type GtmBriefField = z.infer<typeof gtmBriefFieldSchema>;

export const GTM_BRIEF_FIELD_GROUPS = {
  companyIdentity: ['companyName', 'companyUrl', 'category', 'market', 'geography', 'hqLocation'],
  productAndOffer: ['productDescription', 'useCases', 'corePromise', 'cta', 'packaging', 'pricingModel'],
  icp: ['icpSegment', 'icpRoles', 'companySize', 'buyingCommittee', 'icpPains', 'icpTriggers', 'icpObjections'],
  gtmMotion: ['gtmMotion'],
  funnel: ['conversionPath', 'landingPages', 'salesHandoff', 'lifecycleConstraints'],
  economics: ['acv', 'ltv', 'cacTarget', 'monthlyBudget', 'salesCycle', 'marginAssumptions'],
  competitive: ['knownCompetitors', 'alternatives', 'categoryFrames', 'differentiation'],
  proof: ['testimonials', 'caseStudies', 'logos', 'metrics', 'claims', 'styleReferences'],
  brandAndConstraints: ['tone', 'forbiddenClaims', 'compliance', 'brandGeography', 'timeline'],
  goal: ['campaignObjective', 'expectedOutput', 'targetMarket', 'launchUrgency'],
} as const;

export type GtmBriefFieldGroup = keyof typeof GTM_BRIEF_FIELD_GROUPS;

export const GTM_BRIEF_FIELD_KEYS = Object.values(GTM_BRIEF_FIELD_GROUPS).flat() as readonly string[] as readonly GtmBriefFieldKey[];

type FlattenGroups<T> = T extends Readonly<Record<string, readonly (infer K)[]>> ? K : never;
export type GtmBriefFieldKey = FlattenGroups<typeof GTM_BRIEF_FIELD_GROUPS>;

const fieldsShape = GTM_BRIEF_FIELD_KEYS.reduce<Record<string, typeof gtmBriefFieldSchema>>((acc, key) => {
  acc[key] = gtmBriefFieldSchema;
  return acc;
}, {});

export const gtmBriefFieldsSchema = z.object(fieldsShape);

export const gtmBriefSchema = z.object({
  briefId: z.string().min(1),
  clientId: z.string().min(1).nullable(),
  fields: gtmBriefFieldsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type GtmBrief = z.infer<typeof gtmBriefSchema>;

export interface BuildEmptyBriefOptions {
  briefId?: string;
  clientId?: string | null;
  updatedAt?: string;
  createdAt?: string;
}

export function buildEmptyGtmBriefField(now = new Date().toISOString()): GtmBriefField {
  return {
    value: '',
    status: 'missing',
    confidence: 'missing',
    sources: [],
    updatedBy: 'system',
    updatedAt: now,
  };
}

export function buildEmptyGtmBrief(options: BuildEmptyBriefOptions = {}): GtmBrief {
  const now = options.updatedAt ?? new Date().toISOString();
  const fields = Object.fromEntries(
    GTM_BRIEF_FIELD_KEYS.map((key) => [key, buildEmptyGtmBriefField(now)]),
  ) as GtmBrief['fields'];
  return {
    briefId: options.briefId ?? 'brief_draft',
    clientId: options.clientId ?? null,
    fields,
    createdAt: options.createdAt ?? now,
    updatedAt: now,
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm run test:run -- src/lib/gtm/schemas/__tests__/gtm-brief.test.ts
```

Expected: all tests in both `describe` blocks pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gtm/schemas/gtm-brief.ts src/lib/gtm/schemas/__tests__/gtm-brief.test.ts
git commit -m "feat(gtm): add gtm brief field + brief schema"
```

---

## Task 3: Brief Snapshot Schema

**Files:**
- Create: `src/lib/gtm/schemas/gtm-brief-snapshot.ts`
- Create: `src/lib/gtm/schemas/__tests__/gtm-brief-snapshot.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/gtm/schemas/__tests__/gtm-brief-snapshot.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { buildEmptyGtmBrief } from '@/lib/gtm/schemas/gtm-brief';
import {
  gtmBriefSnapshotSchema,
  freezeBriefAsSnapshot,
  type GtmBriefSnapshot,
} from '@/lib/gtm/schemas/gtm-brief-snapshot';

describe('gtmBriefSnapshotSchema', () => {
  it('round-trips a valid snapshot', () => {
    const brief = buildEmptyGtmBrief({ briefId: 'brief_01', updatedAt: '2026-04-24T12:00:00.000Z' });
    const snapshot: GtmBriefSnapshot = {
      snapshotId: 'snap_01',
      parentBriefId: 'brief_01',
      fields: brief.fields,
      briefCreatedAt: brief.createdAt,
      briefUpdatedAt: brief.updatedAt,
      snapshotCreatedAt: '2026-04-24T12:01:00.000Z',
    };
    expect(gtmBriefSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it('rejects missing snapshotId', () => {
    const brief = buildEmptyGtmBrief({ briefId: 'brief_01' });
    const result = gtmBriefSnapshotSchema.safeParse({
      parentBriefId: 'brief_01',
      fields: brief.fields,
      briefCreatedAt: brief.createdAt,
      briefUpdatedAt: brief.updatedAt,
      snapshotCreatedAt: '2026-04-24T12:01:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('freezeBriefAsSnapshot', () => {
  it('produces a snapshot that parses and carries the source brief id', () => {
    const brief = buildEmptyGtmBrief({ briefId: 'brief_01', updatedAt: '2026-04-24T12:00:00.000Z' });
    const snapshot = freezeBriefAsSnapshot(brief, { snapshotId: 'snap_01', now: '2026-04-24T12:01:00.000Z' });
    expect(gtmBriefSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot.parentBriefId).toBe('brief_01');
    expect(snapshot.snapshotCreatedAt).toBe('2026-04-24T12:01:00.000Z');
  });

  it('does not share field references with the source brief (immutability)', () => {
    const brief = buildEmptyGtmBrief({ briefId: 'brief_01' });
    const snapshot = freezeBriefAsSnapshot(brief, { snapshotId: 'snap_01' });
    expect(snapshot.fields).not.toBe(brief.fields);
    expect(snapshot.fields.companyName).not.toBe(brief.fields.companyName);
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
npm run test:run -- src/lib/gtm/schemas/__tests__/gtm-brief-snapshot.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the schema**

Create `src/lib/gtm/schemas/gtm-brief-snapshot.ts`:

```typescript
import { z } from 'zod';
import { gtmBriefFieldsSchema, type GtmBrief } from '@/lib/gtm/schemas/gtm-brief';

export const gtmBriefSnapshotSchema = z.object({
  snapshotId: z.string().min(1),
  parentBriefId: z.string().min(1),
  fields: gtmBriefFieldsSchema,
  briefCreatedAt: z.string().datetime(),
  briefUpdatedAt: z.string().datetime(),
  snapshotCreatedAt: z.string().datetime(),
});

export type GtmBriefSnapshot = z.infer<typeof gtmBriefSnapshotSchema>;

export interface FreezeBriefOptions {
  snapshotId: string;
  now?: string;
}

export function freezeBriefAsSnapshot(brief: GtmBrief, options: FreezeBriefOptions): GtmBriefSnapshot {
  return {
    snapshotId: options.snapshotId,
    parentBriefId: brief.briefId,
    fields: JSON.parse(JSON.stringify(brief.fields)) as GtmBriefSnapshot['fields'],
    briefCreatedAt: brief.createdAt,
    briefUpdatedAt: brief.updatedAt,
    snapshotCreatedAt: options.now ?? new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm run test:run -- src/lib/gtm/schemas/__tests__/gtm-brief-snapshot.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/gtm/schemas/gtm-brief-snapshot.ts src/lib/gtm/schemas/__tests__/gtm-brief-snapshot.test.ts
git commit -m "feat(gtm): add brief snapshot schema + freeze helper"
```

---

## Task 4: GtmRun + Stage Keys + Run Status

**Files:**
- Create: `src/lib/gtm/schemas/gtm-run.ts`
- Create: `src/lib/gtm/schemas/__tests__/gtm-run.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/gtm/schemas/__tests__/gtm-run.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  GTM_STAGE_KEYS,
  GTM_RUN_STATUSES,
  gtmRunSchema,
  type GtmRun,
  type GtmStageKey,
} from '@/lib/gtm/schemas/gtm-run';

describe('GTM_STAGE_KEYS', () => {
  const expected: readonly GtmStageKey[] = [
    'discover-url',
    'enrich-brief',
    'review-brief',
    'lock-brief',
    'research-market-category',
    'research-buyer-icp',
    'research-competitors',
    'research-voc',
    'research-demand-intent',
    'research-offer-funnel',
    'synthesize-strategy',
    'generate-media-plan',
    'generate-scripts',
  ];

  it('matches the canonical stage order in the spec', () => {
    expect(GTM_STAGE_KEYS).toEqual(expected);
  });

  it('has no duplicates', () => {
    expect(new Set(GTM_STAGE_KEYS).size).toBe(GTM_STAGE_KEYS.length);
  });
});

describe('gtmRunSchema', () => {
  const validRun: GtmRun = {
    id: 'run_01',
    userId: 'user_01',
    clientId: 'client_01',
    briefId: 'brief_01',
    briefSnapshotId: 'snap_01',
    status: 'running',
    currentStage: 'research-market-category',
    createdAt: '2026-04-24T12:00:00.000Z',
    updatedAt: '2026-04-24T12:00:00.000Z',
  };

  it('round-trips a valid run', () => {
    expect(gtmRunSchema.parse(validRun)).toEqual(validRun);
  });

  it('rejects unknown status', () => {
    const result = gtmRunSchema.safeParse({ ...validRun, status: 'paused' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown stage', () => {
    const result = gtmRunSchema.safeParse({ ...validRun, currentStage: 'finish-everything' });
    expect(result.success).toBe(false);
  });

  it('requires briefSnapshotId', () => {
    const { briefSnapshotId: _omitted, ...rest } = validRun;
    expect(gtmRunSchema.safeParse(rest).success).toBe(false);
  });

  it('accepts every declared status', () => {
    for (const status of GTM_RUN_STATUSES) {
      expect(gtmRunSchema.safeParse({ ...validRun, status }).success).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
npm run test:run -- src/lib/gtm/schemas/__tests__/gtm-run.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the schema**

Create `src/lib/gtm/schemas/gtm-run.ts`:

```typescript
import { z } from 'zod';

export const GTM_STAGE_KEYS = [
  'discover-url',
  'enrich-brief',
  'review-brief',
  'lock-brief',
  'research-market-category',
  'research-buyer-icp',
  'research-competitors',
  'research-voc',
  'research-demand-intent',
  'research-offer-funnel',
  'synthesize-strategy',
  'generate-media-plan',
  'generate-scripts',
] as const;

export type GtmStageKey = (typeof GTM_STAGE_KEYS)[number];

export const gtmStageKeySchema = z.enum(GTM_STAGE_KEYS);

export const GTM_RUN_STATUSES = ['draft', 'running', 'needs_review', 'completed', 'failed'] as const;
export type GtmRunStatus = (typeof GTM_RUN_STATUSES)[number];

export const gtmRunStatusSchema = z.enum(GTM_RUN_STATUSES);

export const gtmRunSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  clientId: z.string().min(1).nullable(),
  briefId: z.string().min(1),
  briefSnapshotId: z.string().min(1),
  status: gtmRunStatusSchema,
  currentStage: gtmStageKeySchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type GtmRun = z.infer<typeof gtmRunSchema>;
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm run test:run -- src/lib/gtm/schemas/__tests__/gtm-run.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/gtm/schemas/gtm-run.ts src/lib/gtm/schemas/__tests__/gtm-run.test.ts
git commit -m "feat(gtm): add gtm run + stage key schemas"
```

---

## Task 5: Stage Output Stubs

Phase 1 only needs **stub shapes** for research-sections, strategy-synthesis, media-plan, and script-pack outputs — one schema per canonical stage. Later phases will expand them. The stubs share a common shape so `stage-outputs.ts` can compose them.

**Files:**
- Create: `src/lib/gtm/schemas/research-sections.ts`
- Create: `src/lib/gtm/schemas/strategy-synthesis.ts`
- Create: `src/lib/gtm/schemas/media-plan.ts`
- Create: `src/lib/gtm/schemas/script-pack.ts`
- Create: `src/lib/gtm/schemas/__tests__/stage-outputs.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/gtm/schemas/__tests__/stage-outputs.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { marketCategoryOutputSchema, buyerIcpOutputSchema, competitorsOutputSchema, vocOutputSchema, demandIntentOutputSchema, offerFunnelOutputSchema } from '@/lib/gtm/schemas/research-sections';
import { strategySynthesisOutputSchema } from '@/lib/gtm/schemas/strategy-synthesis';
import { mediaPlanOutputSchema } from '@/lib/gtm/schemas/media-plan';
import { scriptPackOutputSchema } from '@/lib/gtm/schemas/script-pack';

const emptyStubPayload = { summary: '', keyFindings: [], evidenceIds: [], assumptions: [] };

describe('stage output stubs', () => {
  for (const [name, schema] of [
    ['marketCategory', marketCategoryOutputSchema],
    ['buyerIcp', buyerIcpOutputSchema],
    ['competitors', competitorsOutputSchema],
    ['voc', vocOutputSchema],
    ['demandIntent', demandIntentOutputSchema],
    ['offerFunnel', offerFunnelOutputSchema],
    ['strategySynthesis', strategySynthesisOutputSchema],
    ['mediaPlan', mediaPlanOutputSchema],
    ['scriptPack', scriptPackOutputSchema],
  ] as const) {
    it(`${name} accepts an empty stub payload`, () => {
      expect(schema.safeParse(emptyStubPayload).success).toBe(true);
    });

    it(`${name} rejects unknown top-level fields`, () => {
      // Zod object schemas strip unknown keys by default; we want to catch typos. Assert with strict().
      const strict = schema.strict();
      const result = strict.safeParse({ ...emptyStubPayload, bogus: 1 });
      expect(result.success).toBe(false);
    });
  }
});
```

- [ ] **Step 2: Run the failing test**

```bash
npm run test:run -- src/lib/gtm/schemas/__tests__/stage-outputs.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the six research-section output stubs**

Create `src/lib/gtm/schemas/research-sections.ts`:

```typescript
import { z } from 'zod';

const baseSectionOutputSchema = z.object({
  summary: z.string(),
  keyFindings: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  assumptions: z.array(z.string()),
});

export const marketCategoryOutputSchema = baseSectionOutputSchema;
export const buyerIcpOutputSchema = baseSectionOutputSchema;
export const competitorsOutputSchema = baseSectionOutputSchema;
export const vocOutputSchema = baseSectionOutputSchema;
export const demandIntentOutputSchema = baseSectionOutputSchema;
export const offerFunnelOutputSchema = baseSectionOutputSchema;

export type MarketCategoryOutput = z.infer<typeof marketCategoryOutputSchema>;
export type BuyerIcpOutput = z.infer<typeof buyerIcpOutputSchema>;
export type CompetitorsOutput = z.infer<typeof competitorsOutputSchema>;
export type VocOutput = z.infer<typeof vocOutputSchema>;
export type DemandIntentOutput = z.infer<typeof demandIntentOutputSchema>;
export type OfferFunnelOutput = z.infer<typeof offerFunnelOutputSchema>;
```

- [ ] **Step 4: Implement the strategy + media + scripts stubs**

Create `src/lib/gtm/schemas/strategy-synthesis.ts`:

```typescript
import { z } from 'zod';

export const strategySynthesisOutputSchema = z.object({
  summary: z.string(),
  keyFindings: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  assumptions: z.array(z.string()),
});

export type StrategySynthesisOutput = z.infer<typeof strategySynthesisOutputSchema>;
```

Create `src/lib/gtm/schemas/media-plan.ts`:

```typescript
import { z } from 'zod';

export const mediaPlanOutputSchema = z.object({
  summary: z.string(),
  keyFindings: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  assumptions: z.array(z.string()),
});

export type MediaPlanOutput = z.infer<typeof mediaPlanOutputSchema>;
```

Create `src/lib/gtm/schemas/script-pack.ts`:

```typescript
import { z } from 'zod';

export const scriptPackOutputSchema = z.object({
  summary: z.string(),
  keyFindings: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  assumptions: z.array(z.string()),
});

export type ScriptPackOutput = z.infer<typeof scriptPackOutputSchema>;
```

Note: these are intentionally identical. Later phases replace each with its full shape (channel mix / budget split / audience for media-plan; hooks / video scripts / ad copy for scripts; etc.). A Phase-1 stub exists so the stage registry can reference each output schema without a circular placeholder.

- [ ] **Step 5: Run tests — expect PASS**

```bash
npm run test:run -- src/lib/gtm/schemas/__tests__/stage-outputs.test.ts
```

Expected: 18 tests pass (9 accept + 9 reject).

- [ ] **Step 6: Commit**

```bash
git add src/lib/gtm/schemas/research-sections.ts src/lib/gtm/schemas/strategy-synthesis.ts src/lib/gtm/schemas/media-plan.ts src/lib/gtm/schemas/script-pack.ts src/lib/gtm/schemas/__tests__/stage-outputs.test.ts
git commit -m "feat(gtm): add stage output stub schemas"
```

---

## Task 6: Workflow — Stage Registry + Section Order + Run State

**Files:**
- Create: `src/lib/gtm/workflow/stage-registry.ts`
- Create: `src/lib/gtm/workflow/section-order.ts`
- Create: `src/lib/gtm/workflow/run-state.ts`
- Create: `src/lib/gtm/workflow/__tests__/stage-registry.test.ts`
- Create: `src/lib/gtm/workflow/__tests__/run-state.test.ts`

- [ ] **Step 1: Write failing tests for stage registry**

Create `src/lib/gtm/workflow/__tests__/stage-registry.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { GTM_STAGE_KEYS } from '@/lib/gtm/schemas/gtm-run';
import {
  firstStage,
  nextStage,
  previousStage,
  stageIndex,
  isTerminalStage,
} from '@/lib/gtm/workflow/stage-registry';
import { RESEARCH_SECTION_ORDER, isResearchSectionStage } from '@/lib/gtm/workflow/section-order';

describe('stage-registry', () => {
  it('first stage is discover-url', () => {
    expect(firstStage()).toBe('discover-url');
  });

  it('nextStage walks the registry in order', () => {
    expect(nextStage('discover-url')).toBe('enrich-brief');
    expect(nextStage('generate-media-plan')).toBe('generate-scripts');
  });

  it('nextStage on the final stage returns null', () => {
    expect(nextStage('generate-scripts')).toBeNull();
  });

  it('previousStage reverses nextStage', () => {
    expect(previousStage('enrich-brief')).toBe('discover-url');
    expect(previousStage('discover-url')).toBeNull();
  });

  it('stageIndex returns canonical 0-based position', () => {
    expect(stageIndex('discover-url')).toBe(0);
    expect(stageIndex('generate-scripts')).toBe(GTM_STAGE_KEYS.length - 1);
  });

  it('isTerminalStage returns true only for generate-scripts', () => {
    expect(isTerminalStage('generate-scripts')).toBe(true);
    expect(isTerminalStage('generate-media-plan')).toBe(false);
  });
});

describe('section-order', () => {
  it('lists the six research sections in the canonical order', () => {
    expect(RESEARCH_SECTION_ORDER).toEqual([
      'research-market-category',
      'research-buyer-icp',
      'research-competitors',
      'research-voc',
      'research-demand-intent',
      'research-offer-funnel',
    ]);
  });

  it('isResearchSectionStage matches the order list', () => {
    for (const stage of RESEARCH_SECTION_ORDER) {
      expect(isResearchSectionStage(stage)).toBe(true);
    }
    expect(isResearchSectionStage('discover-url')).toBe(false);
    expect(isResearchSectionStage('synthesize-strategy')).toBe(false);
  });
});
```

- [ ] **Step 2: Write failing tests for run state**

Create `src/lib/gtm/workflow/__tests__/run-state.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { canTransition, TERMINAL_STATUSES } from '@/lib/gtm/workflow/run-state';

describe('run-state.canTransition', () => {
  it('allows draft -> running', () => {
    expect(canTransition('draft', 'running')).toBe(true);
  });

  it('allows running -> needs_review, completed, failed', () => {
    expect(canTransition('running', 'needs_review')).toBe(true);
    expect(canTransition('running', 'completed')).toBe(true);
    expect(canTransition('running', 'failed')).toBe(true);
  });

  it('allows needs_review -> running or failed', () => {
    expect(canTransition('needs_review', 'running')).toBe(true);
    expect(canTransition('needs_review', 'failed')).toBe(true);
  });

  it('blocks transitions out of terminal statuses', () => {
    for (const terminal of TERMINAL_STATUSES) {
      expect(canTransition(terminal, 'running')).toBe(false);
    }
  });

  it('blocks draft -> completed directly', () => {
    expect(canTransition('draft', 'completed')).toBe(false);
  });
});
```

- [ ] **Step 3: Run both failing tests**

```bash
npm run test:run -- src/lib/gtm/workflow/__tests__
```

Expected: FAIL — modules not found.

- [ ] **Step 4: Implement stage-registry**

Create `src/lib/gtm/workflow/stage-registry.ts`:

```typescript
import { GTM_STAGE_KEYS, type GtmStageKey } from '@/lib/gtm/schemas/gtm-run';

export function firstStage(): GtmStageKey {
  return GTM_STAGE_KEYS[0];
}

export function stageIndex(stage: GtmStageKey): number {
  return GTM_STAGE_KEYS.indexOf(stage);
}

export function nextStage(stage: GtmStageKey): GtmStageKey | null {
  const idx = stageIndex(stage);
  if (idx < 0 || idx >= GTM_STAGE_KEYS.length - 1) return null;
  return GTM_STAGE_KEYS[idx + 1];
}

export function previousStage(stage: GtmStageKey): GtmStageKey | null {
  const idx = stageIndex(stage);
  if (idx <= 0) return null;
  return GTM_STAGE_KEYS[idx - 1];
}

export function isTerminalStage(stage: GtmStageKey): boolean {
  return stageIndex(stage) === GTM_STAGE_KEYS.length - 1;
}
```

- [ ] **Step 5: Implement section-order**

Create `src/lib/gtm/workflow/section-order.ts`:

```typescript
import type { GtmStageKey } from '@/lib/gtm/schemas/gtm-run';

export const RESEARCH_SECTION_ORDER = [
  'research-market-category',
  'research-buyer-icp',
  'research-competitors',
  'research-voc',
  'research-demand-intent',
  'research-offer-funnel',
] as const satisfies readonly GtmStageKey[];

export type ResearchSectionStage = (typeof RESEARCH_SECTION_ORDER)[number];

export function isResearchSectionStage(stage: GtmStageKey): stage is ResearchSectionStage {
  return (RESEARCH_SECTION_ORDER as readonly GtmStageKey[]).includes(stage);
}
```

- [ ] **Step 6: Implement run-state**

Create `src/lib/gtm/workflow/run-state.ts`:

```typescript
import type { GtmRunStatus } from '@/lib/gtm/schemas/gtm-run';

export const TERMINAL_STATUSES = ['completed', 'failed'] as const satisfies readonly GtmRunStatus[];

const ALLOWED_TRANSITIONS: Record<GtmRunStatus, ReadonlyArray<GtmRunStatus>> = {
  draft: ['running', 'failed'],
  running: ['needs_review', 'completed', 'failed'],
  needs_review: ['running', 'failed'],
  completed: [],
  failed: [],
};

export function canTransition(from: GtmRunStatus, to: GtmRunStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
```

- [ ] **Step 7: Run tests — expect PASS**

```bash
npm run test:run -- src/lib/gtm/workflow/__tests__
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/gtm/workflow/stage-registry.ts src/lib/gtm/workflow/section-order.ts src/lib/gtm/workflow/run-state.ts src/lib/gtm/workflow/__tests__/stage-registry.test.ts src/lib/gtm/workflow/__tests__/run-state.test.ts
git commit -m "feat(gtm): add stage registry + section order + run state"
```

---

## Task 7: Stage Contracts — Inputs and Outputs

**Files:**
- Create: `src/lib/gtm/contracts/stage-inputs.ts`
- Create: `src/lib/gtm/contracts/stage-outputs.ts`
- Create: `src/lib/gtm/contracts/index.ts`

These compose the already-tested schemas into per-stage contracts. They do not introduce new validation surface — they're lookup tables. No new test file; the existing schema tests cover correctness.

- [ ] **Step 1: Implement stage-inputs**

Create `src/lib/gtm/contracts/stage-inputs.ts`:

```typescript
import { z } from 'zod';
import { gtmBriefSnapshotSchema } from '@/lib/gtm/schemas/gtm-brief-snapshot';
import type { GtmStageKey } from '@/lib/gtm/schemas/gtm-run';

const sectionInputSchema = z.object({
  briefSnapshot: gtmBriefSnapshotSchema,
  priorOutputs: z.record(z.string(), z.unknown()),
});

export const stageInputSchemas: Record<GtmStageKey, z.ZodTypeAny> = {
  'discover-url': z.object({ url: z.string().url() }),
  'enrich-brief': z.object({ briefId: z.string().min(1), uploads: z.array(z.unknown()).default([]) }),
  'review-brief': z.object({ briefId: z.string().min(1) }),
  'lock-brief': z.object({ briefId: z.string().min(1) }),
  'research-market-category': sectionInputSchema,
  'research-buyer-icp': sectionInputSchema,
  'research-competitors': sectionInputSchema,
  'research-voc': sectionInputSchema,
  'research-demand-intent': sectionInputSchema,
  'research-offer-funnel': sectionInputSchema,
  'synthesize-strategy': sectionInputSchema,
  'generate-media-plan': sectionInputSchema,
  'generate-scripts': sectionInputSchema,
};

export type StageInputMap = {
  [K in GtmStageKey]: z.infer<(typeof stageInputSchemas)[K]>;
};
```

- [ ] **Step 2: Implement stage-outputs**

Create `src/lib/gtm/contracts/stage-outputs.ts`:

```typescript
import { z } from 'zod';
import {
  marketCategoryOutputSchema,
  buyerIcpOutputSchema,
  competitorsOutputSchema,
  vocOutputSchema,
  demandIntentOutputSchema,
  offerFunnelOutputSchema,
} from '@/lib/gtm/schemas/research-sections';
import { strategySynthesisOutputSchema } from '@/lib/gtm/schemas/strategy-synthesis';
import { mediaPlanOutputSchema } from '@/lib/gtm/schemas/media-plan';
import { scriptPackOutputSchema } from '@/lib/gtm/schemas/script-pack';
import { gtmBriefSchema } from '@/lib/gtm/schemas/gtm-brief';
import { gtmBriefSnapshotSchema } from '@/lib/gtm/schemas/gtm-brief-snapshot';
import type { GtmStageKey } from '@/lib/gtm/schemas/gtm-run';

export const stageOutputSchemas: Record<GtmStageKey, z.ZodTypeAny> = {
  'discover-url': gtmBriefSchema,
  'enrich-brief': gtmBriefSchema,
  'review-brief': gtmBriefSchema,
  'lock-brief': gtmBriefSnapshotSchema,
  'research-market-category': marketCategoryOutputSchema,
  'research-buyer-icp': buyerIcpOutputSchema,
  'research-competitors': competitorsOutputSchema,
  'research-voc': vocOutputSchema,
  'research-demand-intent': demandIntentOutputSchema,
  'research-offer-funnel': offerFunnelOutputSchema,
  'synthesize-strategy': strategySynthesisOutputSchema,
  'generate-media-plan': mediaPlanOutputSchema,
  'generate-scripts': scriptPackOutputSchema,
};

export type StageOutputMap = {
  [K in GtmStageKey]: z.infer<(typeof stageOutputSchemas)[K]>;
};
```

- [ ] **Step 3: Add contracts barrel**

Create `src/lib/gtm/contracts/index.ts`:

```typescript
export * from './stage-inputs';
export * from './stage-outputs';
```

- [ ] **Step 4: Typecheck by running the existing test suite**

```bash
npm run test:run -- src/lib/gtm
```

Expected: all previous tests still pass (18+ from tasks 1-6), zero new test files needed. If TypeScript errors in `stage-inputs.ts` or `stage-outputs.ts` bubble up, Vitest will surface them.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gtm/contracts
git commit -m "feat(gtm): add per-stage input/output contract maps"
```

---

## Task 8: Barrels and Top-Level Index

**Files:**
- Create: `src/lib/gtm/schemas/index.ts`
- Create: `src/lib/gtm/workflow/index.ts`
- Create: `src/lib/gtm/index.ts`

- [ ] **Step 1: Add schemas barrel**

Create `src/lib/gtm/schemas/index.ts`:

```typescript
export * from './evidence';
export * from './gtm-brief';
export * from './gtm-brief-snapshot';
export * from './gtm-run';
export * from './research-sections';
export * from './strategy-synthesis';
export * from './media-plan';
export * from './script-pack';
```

- [ ] **Step 2: Add workflow barrel**

Create `src/lib/gtm/workflow/index.ts`:

```typescript
export * from './stage-registry';
export * from './section-order';
export * from './run-state';
```

- [ ] **Step 3: Add top-level barrel**

Create `src/lib/gtm/index.ts`:

```typescript
export * from './schemas';
export * from './workflow';
export * from './contracts';
```

- [ ] **Step 4: Verify the barrels load**

```bash
npm run test:run -- src/lib/gtm
npm run lint
```

Expected: all tests pass; lint finds no unused-export errors. (ESLint default will not flag barrel re-exports.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/gtm/schemas/index.ts src/lib/gtm/workflow/index.ts src/lib/gtm/index.ts
git commit -m "feat(gtm): add barrel exports"
```

---

## Task 9: Feature Folder Scaffold

The `src/features/gtm/*` folders are structural placeholders. Phase 2+ fills them with UI components. Phase 1 just asserts the paths exist and compile.

**Files:**
- Create: `src/features/gtm/intake/index.ts`
- Create: `src/features/gtm/brief/index.ts`
- Create: `src/features/gtm/research-workspace/index.ts`
- Create: `src/features/gtm/media-plan/index.ts`
- Create: `src/features/gtm/scripts/index.ts`
- Create: `src/features/gtm/runs/index.ts`

- [ ] **Step 1: Write each placeholder**

Each file contains **exactly** this content:

```typescript
// Phase 1 placeholder. Populated in later phases.
export {};
```

Repeat for all six paths.

- [ ] **Step 2: Verify typecheck**

```bash
npm run test:run -- src/lib/gtm
npm run lint
```

Expected: lint passes, no TS errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/gtm
git commit -m "feat(gtm): scaffold features/gtm folder tree"
```

---

## Task 10: App Route Scaffold

**Files:**
- Create: `src/app/gtm/page.tsx`
- Create: `src/app/api/gtm/runs/route.ts`
- Create: `src/app/api/gtm/brief/route.ts`
- Create: `src/app/api/gtm/research/route.ts`
- Create: `src/app/api/gtm/media-plan/route.ts`
- Create: `src/app/api/gtm/scripts/route.ts`

- [ ] **Step 1: Write the GTM page stub**

Create `src/app/gtm/page.tsx`:

```typescript
export default function GtmPage(): React.ReactElement {
  return (
    <main className="mx-auto max-w-3xl p-10">
      <h1 className="text-2xl font-semibold">GTM workspace</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Phase 1 scaffold. Real UI ships in Phase 2 (URL intake and draft GTM Brief).
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Write five route stubs, identical shape**

Each of `src/app/api/gtm/{runs,brief,research,media-plan,scripts}/route.ts` contains:

```typescript
import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'not_implemented', phase: 'gtm-phase-1', endpoint: '<FILE-NAME>' },
    { status: 501 },
  );
}

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'not_implemented', phase: 'gtm-phase-1', endpoint: '<FILE-NAME>' },
    { status: 501 },
  );
}
```

Replace `<FILE-NAME>` with the directory name (`runs`, `brief`, `research`, `media-plan`, `scripts`).

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: Next.js build succeeds; five new route stubs appear in the build output; the `/gtm` page renders at build time with zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/gtm src/app/api/gtm
git commit -m "feat(gtm): scaffold /gtm page and api/gtm route stubs"
```

---

## Task 11: Worker Scaffold — Stages, Runtime, Adapters, Jobs

**Files:**
- Create: `research-worker/src/stages/{discover-url,enrich-brief,lock-brief,run-research-section,synthesize-strategy,generate-media-plan,generate-scripts}.ts`
- Create: `research-worker/src/stages/index.ts`
- Create: `research-worker/src/runtime/{skill-loader,anthropic-runner,output-validator,citation-normalizer}.ts`
- Create: `research-worker/src/runtime/index.ts`
- Create: `research-worker/src/adapters/{web-search,firecrawl,supabase,ad-library}.ts`
- Create: `research-worker/src/adapters/index.ts`
- Create: `research-worker/src/jobs/run-gtm-workflow.ts`

These are stubs. They exist so Phase 2+ code has a place to plug into without restructuring the worker tree.

- [ ] **Step 1: Write each stage stub**

Each stage file under `research-worker/src/stages/` has this shape (replace `stageName` and `StageName` appropriately; one file per stage):

```typescript
// Phase 1 stub for stage: <STAGE-KEY>.
// Real implementation lands in Phase <N>. See docs/superpowers/specs/2026-04-24-gtm-brief-architecture.md.

export async function runStage(): Promise<never> {
  throw new Error('gtm stage <STAGE-KEY> not implemented');
}
```

Write all seven files. Replace `<STAGE-KEY>` in the error message with the canonical stage key (`discover-url`, `enrich-brief`, `lock-brief`, `run-research-section`, `synthesize-strategy`, `generate-media-plan`, `generate-scripts`). Keep the exported function name `runStage` across files — later phases can rename if they need to differentiate.

- [ ] **Step 2: Write the stages barrel**

Create `research-worker/src/stages/index.ts`:

```typescript
// Phase 1 barrel. Named re-exports arrive in Phase 2.
export {};
```

- [ ] **Step 3: Write each runtime stub**

Each runtime file under `research-worker/src/runtime/`:

```typescript
// Phase 1 stub. Implemented in Phase <N>.
export {};
```

Four files: `skill-loader.ts`, `anthropic-runner.ts`, `output-validator.ts`, `citation-normalizer.ts`.

Plus barrel `research-worker/src/runtime/index.ts`:

```typescript
export {};
```

- [ ] **Step 4: Write each adapter stub**

Each adapter file under `research-worker/src/adapters/`:

```typescript
// Phase 1 stub. Implemented in Phase <N>.
export {};
```

Four files: `web-search.ts`, `firecrawl.ts`, `supabase.ts`, `ad-library.ts`.

Plus barrel `research-worker/src/adapters/index.ts`:

```typescript
export {};
```

- [ ] **Step 5: Write the jobs stub**

Create `research-worker/src/jobs/run-gtm-workflow.ts`:

```typescript
// Phase 1 stub. The real GTM workflow job lands in Phase 3 (research execution).
export async function runGtmWorkflow(): Promise<never> {
  throw new Error('gtm workflow job not implemented');
}
```

- [ ] **Step 6: Confirm the worker still typechecks and tests pass**

```bash
cd research-worker
npm run test:run 2>/dev/null || npx vitest run
cd ..
```

Use whichever test command the worker package.json declares. (As of 2026-04-24 the worker uses Vitest 4 with no `test:run` alias — run `npx vitest run` if `npm run test:run` is not defined.)

Expected: worker tests still pass (the new stubs have no tests and no behavior to break).

- [ ] **Step 7: Commit**

```bash
git add research-worker/src/stages research-worker/src/runtime research-worker/src/adapters research-worker/src/jobs
git commit -m "feat(gtm): scaffold worker stages, runtime, adapters, jobs"
```

---

## Task 12: Worker Schema Mirror + Parity Test

The Railway worker cannot import from `src/lib/` — the schemas must be mirrored. To guarantee the copy stays in sync, the parity test hashes the two source files after normalization.

**Files:**
- Create: `research-worker/src/schemas/gtm/{evidence,gtm-brief,gtm-brief-snapshot,gtm-run,research-sections,strategy-synthesis,media-plan,script-pack}.ts`
- Create: `research-worker/src/schemas/gtm/index.ts`
- Create: `research-worker/src/schemas/gtm/__tests__/schema-parity.test.ts`

- [ ] **Step 1: Copy each schema file verbatim**

For every schema in `src/lib/gtm/schemas/` (eight files), copy the content into `research-worker/src/schemas/gtm/` with **one change only**: rewrite internal imports from `@/lib/gtm/schemas/...` to relative paths (`./...`).

Example — `research-worker/src/schemas/gtm/gtm-brief-snapshot.ts` header becomes:

```typescript
import { z } from 'zod';
import { gtmBriefFieldsSchema, type GtmBrief } from './gtm-brief';
```

instead of the `@/lib/gtm/schemas/gtm-brief` import in the frontend file.

Add this comment at the top of every mirrored file:

```typescript
// MIRROR of src/lib/gtm/schemas/<file>.ts.
// The Railway worker cannot import from src/lib/. Keep this file byte-identical
// after normalizing the `@/lib/gtm/schemas/X` imports to `./X`.
// Parity enforced by research-worker/src/schemas/gtm/__tests__/schema-parity.test.ts.
```

- [ ] **Step 2: Write the worker barrel**

Create `research-worker/src/schemas/gtm/index.ts`:

```typescript
export * from './evidence';
export * from './gtm-brief';
export * from './gtm-brief-snapshot';
export * from './gtm-run';
export * from './research-sections';
export * from './strategy-synthesis';
export * from './media-plan';
export * from './script-pack';
```

- [ ] **Step 3: Write the parity test**

Create `research-worker/src/schemas/gtm/__tests__/schema-parity.test.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const FILES = [
  'evidence.ts',
  'gtm-brief.ts',
  'gtm-brief-snapshot.ts',
  'gtm-run.ts',
  'research-sections.ts',
  'strategy-synthesis.ts',
  'media-plan.ts',
  'script-pack.ts',
];

const repoRoot = resolve(__dirname, '..', '..', '..', '..', '..');
const frontendDir = resolve(repoRoot, 'src', 'lib', 'gtm', 'schemas');
const workerDir = resolve(repoRoot, 'research-worker', 'src', 'schemas', 'gtm');

/**
 * Normalize differences expected between the two copies:
 *   1. Strip the mirror-file comment header (worker files only).
 *   2. Rewrite `from './X'` -> `from '@/lib/gtm/schemas/X'` so the bodies match.
 */
function normalize(source: string, isWorker: boolean): string {
  let text = source;
  if (isWorker) {
    text = text.replace(/^\/\/ MIRROR[\s\S]*?parity\.test\.ts\.\n/, '');
    text = text.replace(/from '\.\/(evidence|gtm-brief|gtm-brief-snapshot|gtm-run|research-sections|strategy-synthesis|media-plan|script-pack)'/g, "from '@/lib/gtm/schemas/$1'");
  }
  return text.replace(/\r\n/g, '\n').trim();
}

describe('gtm schema parity', () => {
  for (const file of FILES) {
    it(`${file} frontend vs worker content matches after normalization`, () => {
      const frontend = readFileSync(resolve(frontendDir, file), 'utf8');
      const worker = readFileSync(resolve(workerDir, file), 'utf8');
      expect(normalize(worker, true)).toBe(normalize(frontend, false));
    });
  }
});
```

- [ ] **Step 4: Run the parity test**

```bash
cd research-worker && npx vitest run src/schemas/gtm/__tests__/schema-parity.test.ts && cd ..
```

Expected: 8 tests pass. If any fail, the mismatched file is flagged — fix the mirror before moving on.

- [ ] **Step 5: Commit**

```bash
git add research-worker/src/schemas/gtm
git commit -m "feat(gtm): mirror schemas into worker with parity test"
```

---

## Task 13: Supabase Migration

**Files:**
- Create: `docs/migrations/2026-04-24-add-gtm-brief-tables.sql`

The migration creates three tables — `gtm_briefs`, `gtm_brief_snapshots`, `gtm_runs` — with foreign keys and the indexes the run lookup path needs. No RLS in this migration (Phase 1 is contract-only); RLS policies land in Phase 2 with auth wiring.

- [ ] **Step 1: Write the migration**

Create `docs/migrations/2026-04-24-add-gtm-brief-tables.sql`:

```sql
-- Migration: GTM Brief tables (Phase 1, contract-only)
-- Date: 2026-04-24
-- Run via Supabase dashboard SQL Editor.
-- Canonical spec: docs/superpowers/specs/2026-04-24-gtm-brief-architecture.md

-- gtm_briefs: the mutable working brief, one per client run-set.
CREATE TABLE IF NOT EXISTS gtm_briefs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_id TEXT,
  fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE gtm_briefs IS
  'Canonical GTM Brief working record. Source of truth for a SaaS client run-set.';
COMMENT ON COLUMN gtm_briefs.fields IS
  'Map of GtmBriefFieldKey -> GtmBriefField. Validated by src/lib/gtm/schemas/gtm-brief.ts.';

CREATE INDEX IF NOT EXISTS idx_gtm_briefs_user_id ON gtm_briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_gtm_briefs_client_id ON gtm_briefs(client_id);

-- gtm_brief_snapshots: immutable snapshots. One per GtmRun.
CREATE TABLE IF NOT EXISTS gtm_brief_snapshots (
  id TEXT PRIMARY KEY,
  parent_brief_id TEXT NOT NULL REFERENCES gtm_briefs(id) ON DELETE RESTRICT,
  fields JSONB NOT NULL,
  brief_created_at TIMESTAMPTZ NOT NULL,
  brief_updated_at TIMESTAMPTZ NOT NULL,
  snapshot_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE gtm_brief_snapshots IS
  'Immutable snapshot of a GTM Brief. A GtmRun reads from a snapshot, never the live brief.';
COMMENT ON COLUMN gtm_brief_snapshots.fields IS
  'Frozen copy of gtm_briefs.fields at snapshot_created_at. Validated by src/lib/gtm/schemas/gtm-brief-snapshot.ts.';

CREATE INDEX IF NOT EXISTS idx_gtm_brief_snapshots_parent ON gtm_brief_snapshots(parent_brief_id);

-- gtm_runs: one execution pass from locked snapshot to scripts.
CREATE TABLE IF NOT EXISTS gtm_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_id TEXT,
  brief_id TEXT NOT NULL REFERENCES gtm_briefs(id) ON DELETE RESTRICT,
  brief_snapshot_id TEXT NOT NULL REFERENCES gtm_brief_snapshots(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft',
  current_stage TEXT NOT NULL DEFAULT 'discover-url',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gtm_runs_status_check CHECK (status IN ('draft', 'running', 'needs_review', 'completed', 'failed')),
  CONSTRAINT gtm_runs_stage_check CHECK (current_stage IN (
    'discover-url','enrich-brief','review-brief','lock-brief',
    'research-market-category','research-buyer-icp','research-competitors','research-voc',
    'research-demand-intent','research-offer-funnel',
    'synthesize-strategy','generate-media-plan','generate-scripts'
  ))
);

COMMENT ON TABLE gtm_runs IS
  'One execution of the GTM workflow, anchored to an immutable brief snapshot.';

CREATE INDEX IF NOT EXISTS idx_gtm_runs_user_id ON gtm_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_gtm_runs_brief_id ON gtm_runs(brief_id);
CREATE INDEX IF NOT EXISTS idx_gtm_runs_snapshot_id ON gtm_runs(brief_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_gtm_runs_status ON gtm_runs(status);
```

- [ ] **Step 2: Lint the SQL locally**

Run the SQL through `psql --no-psqlrc -f docs/migrations/2026-04-24-add-gtm-brief-tables.sql` against a throwaway local Postgres (optional, if Docker is available), or visually diff against `docs/migrations/2026-03-30-add-proof-points.sql` for style.

If no local Postgres is available, manually verify:

1. Every `CREATE TABLE` is `IF NOT EXISTS`.
2. Every foreign key references a table created earlier in the file.
3. Status and stage CHECK constraints match `GTM_RUN_STATUSES` and `GTM_STAGE_KEYS` in the TypeScript schemas.
4. Every index name is prefixed with `idx_<table>_`.

- [ ] **Step 3: Do NOT run the migration against production yet**

Phase 1 only ships the SQL file. Running it against Supabase happens as part of Phase 2 when the first `POST /api/gtm/brief` starts writing to the tables.

- [ ] **Step 4: Commit**

```bash
git add docs/migrations/2026-04-24-add-gtm-brief-tables.sql
git commit -m "feat(gtm): add migration for gtm_briefs + snapshots + runs"
```

---

## Task 14: Full Verification + Phase Handoff

- [ ] **Step 1: Run the full frontend suite**

```bash
npm run lint
npm run test:run
npm run build
```

Expected:

- Lint passes. Pre-existing warnings in openrouter + chat blueprint tests are known (see `.claude/rules/learned-patterns.md`); no new warnings from Phase 1.
- All new tests under `src/lib/gtm/` pass.
- Next build succeeds; `/gtm` and the five `api/gtm/*` routes appear in the build manifest.

- [ ] **Step 2: Run the worker suite**

```bash
cd research-worker && npx vitest run && cd ..
```

Expected: all worker tests pass, including `src/schemas/gtm/__tests__/schema-parity.test.ts`.

- [ ] **Step 3: Confirm no legacy files were modified**

```bash
git diff --name-only main...HEAD | grep -v '^docs/' | grep -v '^src/lib/gtm/' | grep -v '^src/features/gtm/' | grep -v '^src/app/gtm/' | grep -v '^src/app/api/gtm/' | grep -v '^research-worker/src/\(schemas/gtm\|stages\|runtime\|adapters\|jobs\)/'
```

Expected: empty output. (Any file shown here is a scope leak and must be reverted or justified.)

If Phase 1 lives on its own branch off `main` and the branch base is not `main`, replace `main` with the actual base branch.

- [ ] **Step 4: Summarize for the next phase**

Write a short summary to the conversation or PR description:

- What landed: "GTM Brief contract layer — 8 Zod schemas, 3 workflow helpers, per-stage input/output maps, folder scaffold for `src/lib/gtm/`, `src/features/gtm/`, `src/app/gtm/`, `src/app/api/gtm/`, `research-worker/src/{stages,runtime,adapters,jobs,schemas/gtm}/`, and the `gtm_briefs + gtm_brief_snapshots + gtm_runs` migration."
- What was NOT touched: existing `business_profiles`, `journey_sessions`, or `research-worker/src/runners/*`. Legacy paths unchanged.
- Migration status: SQL written, **not yet applied**. Apply in Phase 2 before the first `POST /api/gtm/brief` handler.
- Open decisions for Phase 2 (from `gtm-brief-architecture.md` §Open Decisions): backfill strategy for existing profiles, VoC runner ordering, whether `/gtm` replaces `/journey` or coexists.

- [ ] **Step 5: Final commit if any stragglers**

If Step 3's diff showed stragglers that are legit (e.g., a missed barrel), commit them:

```bash
git add .
git status
git commit -m "chore(gtm): finalize phase 1 scaffold"
```

Otherwise skip. Phase 1 is complete.

---

## Self-Review Notes

**Spec coverage check** (done during plan writing):

| Spec section | Covered by task(s) |
|---|---|
| Domain Language (GtmBrief, Run, Snapshot, etc.) | Tasks 1–4 (schemas) |
| Evidence Model | Task 1 |
| GTM Brief Fields + groups | Task 2 |
| Run Contract | Task 4 |
| Stage Order (13-stage list) | Task 4 + 6 |
| Research Sections (6) | Task 5 |
| Strategy Synthesis | Task 5 |
| Media Plan Contract (stub) | Task 5 |
| Script Pack Contract (stub) | Task 5 |
| Target Folder Structure (src/lib/gtm, src/features/gtm, src/app/gtm, src/app/api/gtm) | Tasks 6–10 |
| Worker folder structure (stages, runtime, adapters, jobs) | Task 11 |
| Skill Architecture | **Not in Phase 1** — spec order item 5+ ships it. Flagged as out-of-scope in "Scope Check". |
| Minimal Guardrails | Partially: Zod validation shipped; RLS/evals deferred to Phase 2 + Phase 5. |
| Implementation Order step 1 (lock doc) | Spec already committed — no task needed. |
| Implementation Order step 2 (schemas) | Tasks 1–5, 7 |
| Implementation Order step 3 (folder scaffold) | Tasks 6, 9, 10, 11 |

**Placeholder scan:** No `TBD`, `TODO`, or hand-wavy "add appropriate error handling" steps. Every code block is complete.

**Type consistency check:** `GtmStageKey` enum defined in Task 4 is the single source of truth referenced by Tasks 6, 7, 11, 13. `GtmBriefField.confidence` / `status` enums defined in Task 2 match the Task 1 `EvidenceSource` type list. Migration `CHECK` constraints in Task 13 match the TS enum members.

**Open risks:**

1. **Zod v4 enum signature** — project pins `zod@^4.2.1`. Code uses `z.enum([...])` which works in v4. If `z.enum()` changes behavior, Task 1 tests catch it first. No plan-level blocker.
2. **Worker parity test path math** — the `resolve(__dirname, '..', '..', '..', '..', '..')` expression assumes `research-worker/src/schemas/gtm/__tests__/schema-parity.test.ts` lives 5 levels below the repo root. Verify by running `pwd` from `__dirname` on first test run; adjust if off by one.
3. **Barrel re-exports** — `src/lib/gtm/index.ts` re-exports three subtrees. If two subtrees export the same symbol name (unlikely given naming), the barrel will throw a TS duplicate-export error. None of the Task 1–7 schemas name-collide, but keep an eye on this in Phase 2.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-24-gtm-brief-phase-1-schemas.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. Fits this plan well because every task is independent (no shared state between Tasks 1–13; Task 14 aggregates).

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints. Fits better if you want to observe each step.

Which approach?
