# Business Profile-First Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `business_profiles` the canonical operating record that gates research, powers the Company Snapshot UI, and feeds research, media plan, and scripts.

**Architecture:** Add a typed `CompanySnapshot` read model on `business_profiles`, save profile snapshots during onboarding/preflight, pass `profile_id` and snapshot context into research dispatch, then update the workspace pipeline to six visible evidence sections plus internal synthesis. Keep legacy aliases so old sessions continue to render.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, Zod, Supabase, Vitest, React Testing Library, Vercel AI SDK / Anthropic worker boundary.

---

## Scope Check

This touches profile persistence, onboarding review, workspace state, research dispatch, worker contracts, media plan, and scripts. Land it in chunks. Do not attempt the whole migration in one commit.

The first shippable slice is:

```text
CompanySnapshot persistence + explicit profile linkage + UI labels/order compatibility
```

Only after that is stable should the worker produce a first-class `voiceOfCustomer` section.

## Relevant Specs

- `docs/superpowers/specs/2026-04-24-business-profile-first-design.md`
- `docs/superpowers/specs/2026-03-13-unified-onboarding-review-design.md`
- `docs/superpowers/specs/2026-03-13-artifact-workspace-design.md`
- `docs/superpowers/specs/2026-04-14-asset-collection-phase-design.md`

## File Map

Create:

- `src/lib/profiles/company-snapshot.ts` - typed snapshot schema, merge helpers, display helpers.
- `src/lib/profiles/__tests__/company-snapshot.test.ts` - snapshot merge and status tests.
- `src/components/profiles/company-snapshot-card.tsx` - reusable compact profile card.
- `src/components/profiles/__tests__/company-snapshot-card.test.tsx` - render/edit tests.
- `docs/migrations/2026-04-24-add-company-snapshot.sql` - Supabase migration.

Modify:

- `src/lib/profiles/business-profiles.ts` - map `company_snapshot`, save/update snapshot, remove unsafe auto-link behavior later in the plan.
- `src/app/api/profiles/route.ts` - return `profileId` and snapshot after save.
- `src/app/api/profiles/[id]/route.ts` - accept snapshot patch payload.
- `src/app/api/journey/session/route.ts` - allow explicit `profileId` when creating/clearing a run.
- `src/components/journey/unified-field-review.tsx` - save review edits into profile snapshot before research starts.
- `src/app/journey/page.tsx` - start research from a saved profile and pass profile context into dispatch.
- `src/lib/workspace/types.ts` - add `voiceOfCustomer`.
- `src/lib/workspace/pipeline.ts` - visible order, legacy aliases, readiness.
- `src/lib/journey/section-meta.ts` - new labels.
- `src/lib/journey/dispatch-client.ts` - update wave dispatch order.
- `src/app/api/journey/dispatch/route.ts` - section routing, context enrichment, doc budgets.
- `src/components/workspace/*` - visible tabs/gates/order changes.
- `src/lib/agents/types.ts` - align research bundle aliases.
- `src/lib/agents/prompts/agent-system.ts` - preserve six-section prompt.
- `research-worker/src/contracts.ts` and `research-worker/src/runners/*` - add `voiceOfCustomer` only after frontend compatibility lands.

## Chunk 1: Company Snapshot Contract

### Task 1: Add Snapshot Schema And Merge Helpers

**Files:**

- Create: `src/lib/profiles/company-snapshot.ts`
- Create: `src/lib/profiles/__tests__/company-snapshot.test.ts`
- Modify: `src/lib/profiles/business-profiles.ts`
- Create: `docs/migrations/2026-04-24-add-company-snapshot.sql`

- [ ] **Step 1: Write failing snapshot merge tests**

Create `src/lib/profiles/__tests__/company-snapshot.test.ts`.

```typescript
import { describe, expect, it } from 'vitest';
import {
  buildCompanySnapshotFromFields,
  mergeCompanySnapshot,
} from '@/lib/profiles/company-snapshot';

describe('company snapshot', () => {
  it('preserves confirmed manual values over suggested extracted values', (): void => {
    const existing = buildCompanySnapshotFromFields(
      {
        companyName: 'AIGOS',
        websiteUrl: 'https://aigos.ai',
        productDescription: 'Confirmed product',
      },
      { sourceType: 'manual', sourceLabel: 'User edit', confidence: 'high', status: 'confirmed' },
    );

    const incoming = buildCompanySnapshotFromFields(
      {
        productDescription: 'Scraped product',
      },
      { sourceType: 'url', sourceLabel: 'https://aigos.ai', confidence: 'medium', status: 'suggested' },
    );

    const merged = mergeCompanySnapshot(existing, incoming);

    expect(merged.offer.value).toBe('Confirmed product');
    expect(merged.offer.status).toBe('confirmed');
  });

  it('marks absent fields as missing', (): void => {
    const snapshot = buildCompanySnapshotFromFields({}, {
      sourceType: 'manual',
      sourceLabel: 'Empty review',
      confidence: 'low',
      status: 'suggested',
    });

    expect(snapshot.companyName.status).toBe('missing');
    expect(snapshot.companyName.confidence).toBe('missing');
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
npm run test:run -- src/lib/profiles/__tests__/company-snapshot.test.ts
```

Expected: fail because `company-snapshot.ts` does not exist.

- [ ] **Step 3: Implement snapshot types and helpers**

Create `src/lib/profiles/company-snapshot.ts`.

```typescript
import { z } from 'zod';

export const ProfileFieldEvidenceSchema = z.object({
  sourceType: z.enum(['url', 'document', 'meeting', 'manual', 'research']),
  sourceLabel: z.string(),
  extractedAt: z.string(),
});

export const ProfileFieldStateSchema = z.object({
  value: z.string(),
  confidence: z.enum(['high', 'medium', 'low', 'missing']),
  status: z.enum(['confirmed', 'suggested', 'needs_review', 'missing']),
  evidence: z.array(ProfileFieldEvidenceSchema),
});

export const CompanySnapshotSchema = z.object({
  companyName: ProfileFieldStateSchema,
  websiteUrl: ProfileFieldStateSchema,
  category: ProfileFieldStateSchema,
  offer: ProfileFieldStateSchema,
  primaryIcp: ProfileFieldStateSchema,
  pricingEconomics: ProfileFieldStateSchema,
  geography: ProfileFieldStateSchema,
  competitors: ProfileFieldStateSchema,
  updatedAt: z.string(),
});

export type ProfileFieldEvidence = z.infer<typeof ProfileFieldEvidenceSchema>;
export type ProfileFieldState = z.infer<typeof ProfileFieldStateSchema>;
export type CompanySnapshot = z.infer<typeof CompanySnapshotSchema>;

export interface SnapshotSourceInput {
  sourceType: ProfileFieldEvidence['sourceType'];
  sourceLabel: string;
  confidence: Exclude<ProfileFieldState['confidence'], 'missing'>;
  status: Exclude<ProfileFieldState['status'], 'missing'>;
}

const SNAPSHOT_FIELD_KEYS = [
  'companyName',
  'websiteUrl',
  'category',
  'offer',
  'primaryIcp',
  'pricingEconomics',
  'geography',
  'competitors',
] as const;

type SnapshotKey = (typeof SNAPSHOT_FIELD_KEYS)[number];

const FIELD_MAP: Record<SnapshotKey, readonly string[]> = {
  companyName: ['companyName'],
  websiteUrl: ['websiteUrl'],
  category: ['industryVertical', 'businessModel'],
  offer: ['productDescription', 'coreDeliverables', 'valueProp'],
  primaryIcp: ['targetCustomer', 'primaryIcpDescription'],
  pricingEconomics: ['pricingTiers', 'monthlyAdBudget', 'avgAcv', 'avgCustomerLtv', 'targetCac'],
  geography: ['geography', 'headquartersLocation'],
  competitors: ['topCompetitors', 'currentAlternative'],
};

function emptyField(): ProfileFieldState {
  return { value: '', confidence: 'missing', status: 'missing', evidence: [] };
}

function createField(value: string, source: SnapshotSourceInput): ProfileFieldState {
  const trimmed = value.trim();
  if (!trimmed) return emptyField();

  return {
    value: trimmed,
    confidence: source.confidence,
    status: source.status,
    evidence: [{
      sourceType: source.sourceType,
      sourceLabel: source.sourceLabel,
      extractedAt: new Date().toISOString(),
    }],
  };
}

function firstValue(fields: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === 'string' && value.trim().length > 0) return value;
    if (Array.isArray(value) && value.length > 0) return value.join(', ');
  }
  return '';
}

function shouldKeepExisting(existing: ProfileFieldState, incoming: ProfileFieldState): boolean {
  if (existing.status === 'confirmed' && incoming.status !== 'confirmed') return true;
  if (incoming.status === 'missing') return true;
  return false;
}

export function buildCompanySnapshotFromFields(
  fields: Record<string, unknown>,
  source: SnapshotSourceInput,
): CompanySnapshot {
  return {
    companyName: createField(firstValue(fields, FIELD_MAP.companyName), source),
    websiteUrl: createField(firstValue(fields, FIELD_MAP.websiteUrl), source),
    category: createField(firstValue(fields, FIELD_MAP.category), source),
    offer: createField(firstValue(fields, FIELD_MAP.offer), source),
    primaryIcp: createField(firstValue(fields, FIELD_MAP.primaryIcp), source),
    pricingEconomics: createField(firstValue(fields, FIELD_MAP.pricingEconomics), source),
    geography: createField(firstValue(fields, FIELD_MAP.geography), source),
    competitors: createField(firstValue(fields, FIELD_MAP.competitors), source),
    updatedAt: new Date().toISOString(),
  };
}

export function mergeCompanySnapshot(
  existing: CompanySnapshot | null,
  incoming: CompanySnapshot,
): CompanySnapshot {
  if (!existing) return incoming;

  const next: CompanySnapshot = { ...incoming };
  for (const key of SNAPSHOT_FIELD_KEYS) {
    next[key] = shouldKeepExisting(existing[key], incoming[key])
      ? existing[key]
      : incoming[key];
  }
  next.updatedAt = new Date().toISOString();
  return next;
}
```

- [ ] **Step 4: Add migration**

Create `docs/migrations/2026-04-24-add-company-snapshot.sql`.

```sql
ALTER TABLE business_profiles
ADD COLUMN IF NOT EXISTS company_snapshot JSONB DEFAULT NULL;
```

- [ ] **Step 5: Wire profile type mapping**

Modify `src/lib/profiles/business-profiles.ts`:

- Import `CompanySnapshot`, `CompanySnapshotSchema`, `buildCompanySnapshotFromFields`, `mergeCompanySnapshot`.
- Add `companySnapshot: CompanySnapshot | null` to `BusinessProfile`.
- In `saveBusinessProfile()`, read `company_snapshot` with `all_fields`.
- Build an incoming snapshot from merged metadata.
- Merge with existing snapshot.
- Write `company_snapshot`.
- In `mapRow()`, parse `row.company_snapshot` with `CompanySnapshotSchema.safeParse()`.

- [ ] **Step 6: Run tests**

Run:

```bash
npm run test:run -- src/lib/profiles/__tests__/company-snapshot.test.ts src/app/api/profiles/__tests__/patch.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/profiles/company-snapshot.ts src/lib/profiles/__tests__/company-snapshot.test.ts src/lib/profiles/business-profiles.ts docs/migrations/2026-04-24-add-company-snapshot.sql
git commit -m "feat: add company snapshot profile contract"
```

## Chunk 2: Profile API And Explicit Session Linkage

### Task 2: Patch Profiles With Snapshot Data

**Files:**

- Modify: `src/app/api/profiles/[id]/route.ts`
- Modify: `src/app/api/profiles/__tests__/patch.test.ts`
- Modify: `src/lib/profiles/business-profiles.ts`

- [ ] **Step 1: Add failing API test**

Extend `src/app/api/profiles/__tests__/patch.test.ts` to send:

```typescript
{
  fields: { productDescription: 'New offer' },
  snapshotSource: {
    sourceType: 'manual',
    sourceLabel: 'Profile edit',
    confidence: 'high',
    status: 'confirmed'
  }
}
```

Expected response: `{ ok: true }`, and mocked update receives `company_snapshot`.

- [ ] **Step 2: Run the failing test**

```bash
npm run test:run -- src/app/api/profiles/__tests__/patch.test.ts
```

Expected: fail because the route ignores `snapshotSource`.

- [ ] **Step 3: Implement route schema**

Update `PatchSchema` in `src/app/api/profiles/[id]/route.ts`:

```typescript
const SnapshotSourceSchema = z.object({
  sourceType: z.enum(['url', 'document', 'meeting', 'manual', 'research']),
  sourceLabel: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  status: z.enum(['confirmed', 'suggested', 'needs_review']),
});

const PatchSchema = z.object({
  fields: z.record(z.string(), z.string()),
  snapshotSource: SnapshotSourceSchema.optional(),
});
```

Add `snapshotSource` to `updateProfile()` parameters and update `company_snapshot` when provided.

- [ ] **Step 4: Run test**

```bash
npm run test:run -- src/app/api/profiles/__tests__/patch.test.ts
```

Expected: pass.

### Task 3: Require Explicit `profile_id` For New Runs

**Files:**

- Modify: `src/app/api/journey/session/route.ts`
- Modify: `src/app/api/profiles/route.ts`
- Modify: `src/lib/profiles/business-profiles.ts`
- Modify: `src/app/api/scripts/generate/route.ts`

- [ ] **Step 1: Add or extend tests for session profile linking**

Add coverage for:

- `PATCH /api/journey/session` accepts `profileId`.
- `clearResearchState()` inserts `profile_id`.
- `GET /api/journey/session?runId=` returns `profileId`.

- [ ] **Step 2: Update request types**

In `src/app/api/journey/session/route.ts`:

```typescript
interface JourneySessionPatchRequest {
  activeRunId?: string;
  sessionId?: string;
  profileId?: string;
  fields?: unknown;
  state?: unknown;
  clearResearch?: boolean;
}
```

Update `clearResearchState(userId, activeRunId, profileId)` to insert `profile_id: profileId ?? null`.

- [ ] **Step 3: Stop unsafe profile session auto-linking**

In `src/lib/profiles/business-profiles.ts`, change `getProfileSessions()`:

- Keep linked session query.
- Keep legacy unlinked sessions only when both profile company name and website match session metadata.
- Remove fire-and-forget backfill unless exact match passes.

- [ ] **Step 4: Stop script generation broad unlinked fallback**

In `src/app/api/scripts/generate/route.ts`, replace:

```typescript
.or(`profile_id.eq.${profileId},profile_id.is.null`)
```

with exact linked session lookup first. Only allow `profile_id.is.null` legacy fallback if session metadata company/website matches the selected profile.

- [ ] **Step 5: Run focused tests**

```bash
npm run test:run -- src/app/api/profiles/__tests__/patch.test.ts src/app/api/journey/__tests__/dispatch-identity.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/journey/session/route.ts src/app/api/profiles/route.ts src/app/api/profiles/[id]/route.ts src/lib/profiles/business-profiles.ts src/app/api/scripts/generate/route.ts src/app/api/profiles/__tests__/patch.test.ts
git commit -m "feat: link research runs to business profiles"
```

## Chunk 3: Snapshot UI And Preflight Save

### Task 4: Add Reusable Company Snapshot Card

**Files:**

- Create: `src/components/profiles/company-snapshot-card.tsx`
- Create: `src/components/profiles/__tests__/company-snapshot-card.test.tsx`
- Modify: `src/app/profiles/[id]/page.tsx`

- [ ] **Step 1: Write render test**

Test that the card renders company name, offer, confidence labels, and source count from `BusinessProfile.companySnapshot`.

- [ ] **Step 2: Implement component**

Component props:

```typescript
import type { CompanySnapshot } from '@/lib/profiles/company-snapshot';

interface CompanySnapshotCardProps {
  snapshot: CompanySnapshot | null;
  onEditField?: (key: keyof CompanySnapshot) => void;
}
```

Use existing design tokens. Do not create nested cards. Use rows, badges, and a source summary.

- [ ] **Step 3: Add to profile detail overview**

In `src/app/profiles/[id]/page.tsx`, render `CompanySnapshotCard` at the top of `OverviewTab`.

- [ ] **Step 4: Run component test**

```bash
npm run test:run -- src/components/profiles/__tests__/company-snapshot-card.test.tsx
```

### Task 5: Save Preflight Edits Into Profile Before Research

**Files:**

- Modify: `src/components/journey/unified-field-review.tsx`
- Modify: `src/app/journey/page.tsx`
- Modify: `src/lib/journey/context-string.ts`

- [ ] **Step 1: Add test for preflight start payload**

Cover that starting research:

- Saves profile first through `/api/profiles`.
- Receives `profileId`.
- Persists `profileId` into journey session.
- Builds research context with a Company Snapshot block.

- [ ] **Step 2: Update `onStart` path**

In `src/app/journey/page.tsx`, where `/api/profiles` is already called after start, move that save before `dispatchAllResearchParallel()`.

The order must be:

```text
persist journey fields -> POST /api/profiles -> PATCH /api/journey/session with profileId -> build context -> dispatch
```

- [ ] **Step 3: Include snapshot in context**

Update `buildJourneyResearchContext()` to include a bounded block:

```text
## Company Snapshot
Company: ...
Website: ...
Category: ...
Offer: ...
ICP: ...
Pricing/Economics: ...
Competitors: ...
Confidence warnings: ...
```

- [ ] **Step 4: Run focused tests**

```bash
npm run test:run -- src/lib/ai/__tests__/journey-stream-prep.test.ts src/lib/ai/__tests__/journey-state.test.ts src/app/journey/__tests__/page.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/profiles/company-snapshot-card.tsx src/components/profiles/__tests__/company-snapshot-card.test.tsx src/app/profiles/[id]/page.tsx src/components/journey/unified-field-review.tsx src/app/journey/page.tsx src/lib/journey/context-string.ts
git commit -m "feat: save profile snapshot before research"
```

## Chunk 4: Six Visible Research Sections

### Task 6: Add `voiceOfCustomer` To Workspace Contracts

**Files:**

- Modify: `src/lib/workspace/types.ts`
- Modify: `src/lib/workspace/pipeline.ts`
- Modify: `src/lib/journey/section-meta.ts`
- Modify: `src/lib/journey/research-realtime.ts`
- Modify: `src/components/workspace/status-strip.tsx`
- Modify: `src/components/workspace/artifact-canvas.tsx`
- Modify: `src/components/workspace/workspace-provider.tsx`
- Modify tests under `src/components/journey/__tests__/` and `src/lib/workspace/__tests__/`

- [ ] **Step 1: Update failing pipeline tests**

Expected visible research sections:

```typescript
[
  'industryMarket',
  'icpValidation',
  'competitors',
  'voiceOfCustomer',
  'keywordIntel',
  'offerAnalysis',
]
```

Expected full pipeline:

```typescript
[
  'industryMarket',
  'icpValidation',
  'competitors',
  'voiceOfCustomer',
  'keywordIntel',
  'offerAnalysis',
  'mediaPlan',
]
```

Legacy `crossAnalysis` should not count as a visible research gate.

- [ ] **Step 2: Run failing tests**

```bash
npm run test:run -- src/lib/workspace/__tests__/pipeline.test.ts src/components/journey/__tests__/journey-progress-panel.test.tsx
```

- [ ] **Step 3: Update contracts and labels**

Update `SectionKey`:

```typescript
export type SectionKey =
  | 'industryMarket'
  | 'competitors'
  | 'icpValidation'
  | 'voiceOfCustomer'
  | 'offerAnalysis'
  | 'keywordIntel'
  | 'crossAnalysis'
  | 'mediaPlan'
  | 'scripts';
```

Keep `crossAnalysis` as a valid key for legacy/internal data, but remove it from `RESEARCH_SECTIONS`.

- [ ] **Step 4: Add aliases**

In `src/lib/workspace/pipeline.ts`:

```typescript
const CANONICAL_ALIASES: Record<string, string[]> = {
  industryMarket: ['industryResearch', 'marketIntelligence'],
  icpValidation: ['buyerValidation'],
  competitors: ['competitorIntel', 'competitorLandscape'],
  voiceOfCustomer: ['voc', 'researchVoc'],
  keywordIntel: ['demandSignals'],
  offerAnalysis: ['offerDiagnostic'],
  mediaPlan: ['mediaPlan'],
};
```

- [ ] **Step 5: Run tests**

```bash
npm run test:run -- src/lib/workspace/__tests__/pipeline.test.ts src/components/journey/__tests__/journey-progress-panel.test.tsx src/components/workspace/cards/__tests__/review-card.test.tsx
```

### Task 7: Update Dispatch Waves Without Worker VoC Yet

**Files:**

- Modify: `src/lib/journey/dispatch-client.ts`
- Modify: `src/app/api/journey/dispatch/route.ts`
- Modify: `src/lib/journey/__tests__/dispatch-client-parallel.test.ts`

- [ ] **Step 1: Update dispatch-client tests**

Target transitional dispatch:

```text
identityResolution
  -> wave 1: industryMarket, icpValidation, competitors
  -> wave 2: voiceOfCustomer, keywordIntel
  -> wave 3: offerAnalysis
  -> internal: crossAnalysis before mediaPlan
```

If `voiceOfCustomer` worker is not implemented yet, dispatch should return an explicit "not implemented" error and UI should show queued/blocked, not crash.

- [ ] **Step 2: Update dispatch order constants**

In `src/app/api/journey/dispatch/route.ts`:

```typescript
export const DISPATCH_PIPELINE_ORDER = [
  'identityResolution',
  'industryMarket',
  'icpValidation',
  'competitors',
  'voiceOfCustomer',
  'keywordIntel',
  'offerAnalysis',
  'crossAnalysis',
  'mediaPlan',
] as const;
```

- [ ] **Step 3: Add section mapping placeholder**

Do not point `voiceOfCustomer` at the competitor runner. Add a real section key and return clear 501 until the worker exists:

```typescript
if (section === 'voiceOfCustomer') {
  return NextResponse.json(
    { error: 'voiceOfCustomer runner is not implemented yet' },
    { status: 501 },
  );
}
```

This prevents silent fake VoC.

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- src/lib/journey/__tests__/dispatch-client-parallel.test.ts src/app/api/journey/__tests__/dispatch-identity.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/workspace/types.ts src/lib/workspace/pipeline.ts src/lib/journey/section-meta.ts src/lib/journey/research-realtime.ts src/components/workspace/status-strip.tsx src/components/workspace/artifact-canvas.tsx src/components/workspace/workspace-provider.tsx src/lib/journey/dispatch-client.ts src/app/api/journey/dispatch/route.ts src/lib/journey/__tests__/dispatch-client-parallel.test.ts
git commit -m "feat: align workspace to six research sections"
```

## Chunk 5: Voice Of Customer Runner

### Task 8: Add Worker Contract And Minimal Runner

**Files:**

- Modify: `research-worker/src/contracts.ts`
- Create: `research-worker/src/runners/voc.ts`
- Modify: `research-worker/src/runners/index.ts`
- Create: `research-worker/src/__tests__/voc.test.ts`
- Modify: `src/app/api/journey/dispatch/route.ts`

- [ ] **Step 1: Write failing worker test**

Test that the VoC runner returns:

- Pain quotes.
- Objections.
- Switching stories.
- Success language.
- Citations.

No recommendations, no media strategy.

- [ ] **Step 2: Add contract**

Use the existing `VoiceOfCustomerSchema` shape from `src/lib/agents/types.ts` as the target. Duplicate schema in worker if required by the Railway boundary.

- [ ] **Step 3: Implement minimal runner**

Use real review/forum/search tools already present in worker:

- `research-worker/src/tools/reviews.ts`
- `research-worker/src/tools/firecrawl.ts`
- Sonar/web search if available in current worker patterns.

If no data is found, return empty arrays with a cited "no data found" note instead of inventing quotes.

- [ ] **Step 4: Wire dispatch route**

Update `SECTION_TO_TOOL.voiceOfCustomer = 'researchVoiceOfCustomer'`.

- [ ] **Step 5: Run worker tests**

```bash
npm run test:run -- research-worker/src/__tests__/voc.test.ts research-worker/src/__tests__/contracts.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add research-worker/src/contracts.ts research-worker/src/runners/voc.ts research-worker/src/runners/index.ts research-worker/src/__tests__/voc.test.ts src/app/api/journey/dispatch/route.ts
git commit -m "feat: add voice of customer research runner"
```

## Chunk 6: Internal Synthesis, Media Plan, Scripts

### Task 9: Make `crossAnalysis` Internal

**Files:**

- Modify: `src/components/workspace/artifact-canvas.tsx`
- Modify: `src/components/workspace/approval-gate.tsx`
- Modify: `src/components/workspace/media-plan-cta.tsx`
- Modify: `src/app/api/journey/dispatch/route.ts`

- [ ] **Step 1: Add gate tests**

Media plan CTA appears only when all six visible research sections are approved or reviewable.

- [ ] **Step 2: Dispatch internal synthesis before media plan**

When user clicks "Generate Media Plan":

```text
dispatch crossAnalysis internally -> wait/poll completion -> dispatch mediaPlan
```

Do not show `crossAnalysis` as a tab.

- [ ] **Step 3: Run tests**

```bash
npm run test:run -- src/components/journey/__tests__/artifact-panel.test.tsx src/components/workspace/cards/__tests__/review-card.test.tsx
```

### Task 10: Pass Snapshot And VoC Into Media Plan And Scripts

**Files:**

- Modify: `research-worker/src/runners/media-plan.ts`
- Modify: `src/app/api/scripts/generate/route.ts`
- Modify: `research-worker/src/scripts/pipeline.ts`
- Modify: `research-worker/src/scripts/stages/01-plan/planner.ts`
- Modify script tests under `research-worker/src/scripts/__tests__/`

- [ ] **Step 1: Add prompt/input tests**

Assert that media plan receives:

- Company snapshot.
- VoC objections.
- Demand signals.
- Offer diagnostic.

Assert scripts receive VoC phrase bank and objections.

- [ ] **Step 2: Update media-plan context build**

Use the profile snapshot block ahead of research results. Mark low-confidence profile fields as uncertain.

- [ ] **Step 3: Update script planning**

Add a VoC phrase bank section to the script planner input. Preserve exact quote/source pairs.

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- research-worker/src/__tests__/media-plan-round3.test.ts research-worker/src/scripts/__tests__/planner.test.ts research-worker/src/scripts/__tests__/quality-gate.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/artifact-canvas.tsx src/components/workspace/approval-gate.tsx src/components/workspace/media-plan-cta.tsx src/app/api/journey/dispatch/route.ts research-worker/src/runners/media-plan.ts src/app/api/scripts/generate/route.ts research-worker/src/scripts/pipeline.ts research-worker/src/scripts/stages/01-plan/planner.ts
git commit -m "feat: ground media plan and scripts in profile evidence"
```

## Full Verification

Run after all chunks:

```bash
npm run lint
npm run test:run
npm run build
```

Expected:

- Lint passes or only known pre-existing warnings remain.
- Vitest passes.
- Build passes.

Manual browser check:

```bash
npm run dev
```

Verify:

- `/profiles` renders profiles.
- `/profiles/[id]` renders Company Snapshot.
- `/journey` preflight saves profile before research.
- Workspace shows six visible research tabs.
- `crossAnalysis` is not visible as a tab.
- Media plan generation still works after internal synthesis.
- Scripts can generate from a linked profile/session.
