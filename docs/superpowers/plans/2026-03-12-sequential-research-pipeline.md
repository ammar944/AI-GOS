# Sequential Research Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the lead-agent research orchestration with a deterministic TypeScript pipeline that executes 6 research sections sequentially with user-gated approvals and per-section chat refinement.

**Architecture:** Pure TypeScript pipeline controller dispatches to existing Railway workers via `dispatchResearchForUser`. Frontend polls via existing `useResearchRealtime`/`useResearchJobActivity` hooks. Lightweight Sonnet chat agent activates at each gate for section refinement. Pipeline state persisted in `journey_sessions.metadata.researchPipeline`.

**Tech Stack:** Next.js API routes, Vercel AI SDK (`streamText`), Supabase (existing RPCs), Clerk auth, existing Railway worker runners

**Spec:** `docs/superpowers/specs/2026-03-12-sequential-research-pipeline-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `src/lib/research/pipeline-types.ts` | Pipeline state types, section config, constants |
| `src/lib/research/pipeline-controller.ts` | State machine: init, advance, approve, invalidate |
| `src/lib/research/pipeline-context.ts` | Context builders that emit markdown the workers parse |
| `src/app/api/research/pipeline/start/route.ts` | POST: create run, dispatch section 0 |
| `src/app/api/research/pipeline/advance/route.ts` | POST: approve current, dispatch next |
| `src/app/api/research/section/route.ts` | PATCH: direct-edit persistence |
| `src/app/api/research/chat/route.ts` | POST: per-section Sonnet chat with editSection tool |
| `src/app/research/[runId]/page.tsx` | Pipeline view page |
| `src/components/research/pipeline-view.tsx` | Two-panel layout: chat + artifact cards |
| `src/components/research/section-card.tsx` | Individual section card (extends ResearchInlineCard) |
| `src/components/research/gate-controls.tsx` | Approve button + chat input + edit toggle |
| `src/lib/research/__tests__/pipeline-controller.test.ts` | Pipeline state machine tests |
| `src/lib/research/__tests__/pipeline-context.test.ts` | Context builder tests |
| `supabase/migrations/20260312_add_journey_session_metadata_merge_function.sql` | Atomic metadata merge RPC for pipeline + onboarding writes |

### Modified Files

| File | Change |
|---|---|
| `src/lib/journey/research-sections.ts` | Reuse existing `normalizeResearchSectionId` and `getAffectedResearchSections`; add helpers only if genuinely missing |
| `src/lib/journey/session-state.server.ts` | Add `persistPipelineState` and `readPipelineState` helpers on top of a new metadata merge RPC |

---

## Chunk 1: Pipeline Controller (Backend Core)

### Task 1: Pipeline Types and Constants

**Files:**
- Create: `src/lib/research/pipeline-types.ts`
- Test: `src/lib/research/__tests__/pipeline-controller.test.ts`

- [ ] **Step 1: Create pipeline types file**

```typescript
// src/lib/research/pipeline-types.ts
import type { CanonicalResearchSectionId } from '@/lib/journey/research-sections';

export type PipelineRunId = string;

// Subset of CanonicalResearchSectionId — excludes mediaPlan
export type PipelineSectionId = Exclude<CanonicalResearchSectionId, 'mediaPlan'>;

export const PIPELINE_SECTION_ORDER: readonly PipelineSectionId[] = [
  'industryResearch',
  'competitorIntel',
  'icpValidation',
  'offerAnalysis',
  'strategicSynthesis',
  'keywordIntel',
] as const;

export type PipelineStatus = 'idle' | 'running' | 'gated' | 'complete' | 'error';

export type SectionStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'complete'
  | 'approved'
  | 'editing'
  | 'stale'
  | 'error';

export interface SectionState {
  id: PipelineSectionId;
  toolName: string;
  boundaryKey: string;
  displayName: string;
  status: SectionStatus;
  data: Record<string, unknown> | null;
  jobId?: string | null;
  error?: string | null;
}

export interface PipelineState {
  runId: PipelineRunId;
  currentSectionId: PipelineSectionId | null;
  status: PipelineStatus;
  approvedSectionIds: PipelineSectionId[];
  sections: SectionState[];
}

// Maps toolName -> { sectionId, boundaryKey, displayName }
// Sourced from research-sections.ts canonical mappings
export const PIPELINE_SECTION_CONFIG: Record<
  PipelineSectionId,
  { toolName: string; boundaryKey: string; displayName: string }
> = {
  industryResearch: { toolName: 'researchIndustry', boundaryKey: 'industryMarket', displayName: 'Market Overview' },
  competitorIntel: { toolName: 'researchCompetitors', boundaryKey: 'competitors', displayName: 'Competitor Intel' },
  icpValidation: { toolName: 'researchICP', boundaryKey: 'icpValidation', displayName: 'ICP Validation' },
  offerAnalysis: { toolName: 'researchOffer', boundaryKey: 'offerAnalysis', displayName: 'Offer Analysis' },
  strategicSynthesis: { toolName: 'synthesizeResearch', boundaryKey: 'crossAnalysis', displayName: 'Strategic Synthesis' },
  keywordIntel: { toolName: 'researchKeywords', boundaryKey: 'keywordIntel', displayName: 'Keyword Intelligence' },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/research/pipeline-types.ts
git commit -m "feat: add pipeline types and section config constants"
```

---

### Task 2: Pipeline Controller State Machine

**Files:**
- Create: `src/lib/research/pipeline-controller.ts`
- Test: `src/lib/research/__tests__/pipeline-controller.test.ts`
- Reference: `src/lib/journey/research-sections.ts` (for `getAffectedResearchSections`)

- [ ] **Step 1: Write failing tests for pipeline initialization**

```typescript
// src/lib/research/__tests__/pipeline-controller.test.ts
import { describe, it, expect } from 'vitest';
import { createInitialPipelineState, getNextSectionId } from '../pipeline-controller';

describe('createInitialPipelineState', () => {
  it('creates state with 6 sections all pending', () => {
    const state = createInitialPipelineState('run-123');
    expect(state.runId).toBe('run-123');
    expect(state.status).toBe('idle');
    expect(state.currentSectionId).toBeNull();
    expect(state.approvedSectionIds).toEqual([]);
    expect(state.sections).toHaveLength(6);
    expect(state.sections[0].id).toBe('industryResearch');
    expect(state.sections[0].status).toBe('pending');
    expect(state.sections[5].id).toBe('keywordIntel');
  });
});

describe('getNextSectionId', () => {
  it('returns first section when none approved', () => {
    expect(getNextSectionId([])).toBe('industryResearch');
  });

  it('returns second section when first approved', () => {
    expect(getNextSectionId(['industryResearch'])).toBe('competitorIntel');
  });

  it('returns null when all approved', () => {
    const allApproved = [
      'industryResearch', 'competitorIntel', 'icpValidation',
      'offerAnalysis', 'strategicSynthesis', 'keywordIntel',
    ] as const;
    expect(getNextSectionId([...allApproved])).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/lib/research/__tests__/pipeline-controller.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement createInitialPipelineState and getNextSectionId**

```typescript
// src/lib/research/pipeline-controller.ts
import {
  type PipelineState,
  type PipelineRunId,
  type PipelineSectionId,
  PIPELINE_SECTION_ORDER,
  PIPELINE_SECTION_CONFIG,
} from './pipeline-types';

export function createInitialPipelineState(runId: PipelineRunId): PipelineState {
  return {
    runId,
    currentSectionId: null,
    status: 'idle',
    approvedSectionIds: [],
    sections: PIPELINE_SECTION_ORDER.map((id) => ({
      id,
      toolName: PIPELINE_SECTION_CONFIG[id].toolName,
      boundaryKey: PIPELINE_SECTION_CONFIG[id].boundaryKey,
      displayName: PIPELINE_SECTION_CONFIG[id].displayName,
      status: 'pending',
      data: null,
      jobId: null,
      error: null,
    })),
  };
}

export function getNextSectionId(
  approvedSectionIds: readonly PipelineSectionId[],
): PipelineSectionId | null {
  for (const id of PIPELINE_SECTION_ORDER) {
    if (!approvedSectionIds.includes(id)) return id;
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/lib/research/__tests__/pipeline-controller.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing tests for markSectionRunning and markSectionComplete**

```typescript
// Add to pipeline-controller.test.ts
import { markSectionRunning, markSectionComplete, markSectionApproved } from '../pipeline-controller';

describe('markSectionRunning', () => {
  it('sets section to running and pipeline to running', () => {
    const state = createInitialPipelineState('run-1');
    const next = markSectionRunning(state, 'industryResearch', 'job-abc');
    expect(next.status).toBe('running');
    expect(next.currentSectionId).toBe('industryResearch');
    expect(next.sections[0].status).toBe('running');
    expect(next.sections[0].jobId).toBe('job-abc');
  });
});

describe('markSectionComplete', () => {
  it('sets section to complete and pipeline to gated', () => {
    let state = createInitialPipelineState('run-1');
    state = markSectionRunning(state, 'industryResearch', 'job-abc');
    const next = markSectionComplete(state, 'industryResearch', { market: 'data' });
    expect(next.status).toBe('gated');
    expect(next.sections[0].status).toBe('complete');
    expect(next.sections[0].data).toEqual({ market: 'data' });
  });
});

describe('markSectionApproved', () => {
  it('adds section to approvedSectionIds', () => {
    let state = createInitialPipelineState('run-1');
    state = markSectionRunning(state, 'industryResearch', 'job-abc');
    state = markSectionComplete(state, 'industryResearch', { market: 'data' });
    const next = markSectionApproved(state, 'industryResearch');
    expect(next.approvedSectionIds).toContain('industryResearch');
    expect(next.sections[0].status).toBe('approved');
  });

  it('sets pipeline to complete when all 6 approved', () => {
    let state = createInitialPipelineState('run-1');
    for (const id of PIPELINE_SECTION_ORDER) {
      state = markSectionRunning(state, id, `job-${id}`);
      state = markSectionComplete(state, id, { data: id });
      state = markSectionApproved(state, id);
    }
    expect(state.status).toBe('complete');
  });
});
```

- [ ] **Step 6: Implement state transition functions**

```typescript
// Add to pipeline-controller.ts
export function markSectionRunning(
  state: PipelineState,
  sectionId: PipelineSectionId,
  jobId: string,
): PipelineState {
  return {
    ...state,
    status: 'running',
    currentSectionId: sectionId,
    sections: state.sections.map((s) =>
      s.id === sectionId ? { ...s, status: 'running', jobId, error: null } : s,
    ),
  };
}

export function markSectionComplete(
  state: PipelineState,
  sectionId: PipelineSectionId,
  data: Record<string, unknown>,
): PipelineState {
  return {
    ...state,
    status: 'gated',
    sections: state.sections.map((s) =>
      s.id === sectionId ? { ...s, status: 'complete', data } : s,
    ),
  };
}

export function markSectionApproved(
  state: PipelineState,
  sectionId: PipelineSectionId,
): PipelineState {
  // Idempotency guard: don't double-add
  const approvedSectionIds = state.approvedSectionIds.includes(sectionId)
    ? state.approvedSectionIds
    : [...state.approvedSectionIds, sectionId];
  const allApproved = approvedSectionIds.length === PIPELINE_SECTION_ORDER.length;

  return {
    ...state,
    status: allApproved ? 'complete' : 'gated',
    approvedSectionIds,
    sections: state.sections.map((s) =>
      s.id === sectionId ? { ...s, status: 'approved' } : s,
    ),
  };
}
```

- [ ] **Step 7: Run tests**

Run: `npm run test:run -- src/lib/research/__tests__/pipeline-controller.test.ts`
Expected: PASS

- [ ] **Step 8: Write failing test for downstream invalidation**

```typescript
// Add to pipeline-controller.test.ts
import { invalidateDownstream } from '../pipeline-controller';

describe('invalidateDownstream', () => {
  it('marks synthesis and keywords stale when industry is edited', () => {
    let state = createInitialPipelineState('run-1');
    // Approve all 6
    for (const id of PIPELINE_SECTION_ORDER) {
      state = markSectionRunning(state, id, `job-${id}`);
      state = markSectionComplete(state, id, { data: id });
      state = markSectionApproved(state, id);
    }
    const next = invalidateDownstream(state, 'industryResearch');
    // The edited section itself stays approved (not downstream of itself)
    expect(next.sections.find(s => s.id === 'industryResearch')!.status).toBe('approved');
    // strategicSynthesis depends on industryResearch
    expect(next.sections.find(s => s.id === 'strategicSynthesis')!.status).toBe('stale');
    // keywordIntel depends on strategicSynthesis (transitive)
    expect(next.sections.find(s => s.id === 'keywordIntel')!.status).toBe('stale');
    // competitorIntel has no dependency on industry
    expect(next.sections.find(s => s.id === 'competitorIntel')!.status).toBe('approved');
    // Stale sections removed from approvedSectionIds
    expect(next.approvedSectionIds).not.toContain('strategicSynthesis');
    expect(next.approvedSectionIds).not.toContain('keywordIntel');
    // Edited section stays in approvedSectionIds
    expect(next.approvedSectionIds).toContain('industryResearch');
    // Pipeline no longer complete
    expect(next.status).not.toBe('complete');
  });
});
```

- [ ] **Step 9: Implement invalidateDownstream**

```typescript
// Add to pipeline-controller.ts
import { getAffectedResearchSections } from '@/lib/journey/research-sections';

export function invalidateDownstream(
  state: PipelineState,
  editedSectionId: PipelineSectionId,
): PipelineState {
  const affected = getAffectedResearchSections(editedSectionId);
  // Exclude mediaPlan (not in pipeline) and the edited section itself (only downstream gets stale)
  const affectedPipelineSections = affected.filter(
    (id): id is PipelineSectionId => id !== 'mediaPlan' && id !== editedSectionId,
  );

  if (affectedPipelineSections.length === 0) return state;

  const approvedSectionIds = state.approvedSectionIds.filter(
    (id) => !affectedPipelineSections.includes(id),
  );

  return {
    ...state,
    status: approvedSectionIds.length === PIPELINE_SECTION_ORDER.length ? 'complete' : 'gated',
    approvedSectionIds,
    sections: state.sections.map((s) =>
      affectedPipelineSections.includes(s.id)
        ? { ...s, status: 'stale', data: s.data } // keep data visible but mark stale
        : s,
    ),
  };
}
```

- [ ] **Step 10: Run tests**

Run: `npm run test:run -- src/lib/research/__tests__/pipeline-controller.test.ts`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/lib/research/pipeline-controller.ts src/lib/research/__tests__/pipeline-controller.test.ts
git commit -m "feat: pipeline controller state machine with invalidation"
```

---

### Task 3: Context Builders

**Files:**
- Create: `src/lib/research/pipeline-context.ts`
- Test: `src/lib/research/__tests__/pipeline-context.test.ts`
- Reference: `research-worker/src/runners/synthesize.ts` (for expected markdown format)
- Reference: `research-worker/src/runners/keywords.ts` (for `- Top Competitors:` format)

- [ ] **Step 1: Read the synthesis and keyword runners to understand expected context format**

Read these files to understand what markdown structure they parse:
- `research-worker/src/runners/synthesize.ts` — look for how it reads the `context` param
- `research-worker/src/runners/keywords.ts` — look for `Top Competitors` parsing
- `research-worker/src/runners/industry.ts` — look for what context it receives
- `research-worker/src/runners/competitors.ts` — look for context expectations

- [ ] **Step 2: Write failing tests for context builders**

```typescript
// src/lib/research/__tests__/pipeline-context.test.ts
import { describe, it, expect } from 'vitest';
import {
  buildIndustryContext,
  buildCompetitorContext,
  buildIcpContext,
  buildOfferContext,
  buildSynthesisContext,
  buildKeywordContext,
} from '../pipeline-context';

describe('buildIndustryContext', () => {
  it('emits Business context: header with - Key: Value bullets', () => {
    const ctx = buildIndustryContext({
      companyName: 'Acme Corp',
      industry: 'SaaS',
      companyUrl: 'https://acme.com',
    });
    expect(ctx).toContain('Business context:');
    expect(ctx).toContain('- Company Name: Acme Corp');
    expect(ctx).toContain('- Industry: SaaS');
    expect(ctx).toContain('- Website URL: https://acme.com');
  });
});

describe('buildCompetitorContext', () => {
  it('includes business context and industry research dependency', () => {
    const ctx = buildCompetitorContext({
      onboardingData: { companyName: 'Acme Corp', industry: 'SaaS', competitors: ['Rival Co'] },
      industryResearch: { data: { marketSize: '$5B' } },
    });
    expect(ctx).toContain('Business context:');
    expect(ctx).toContain('- Company Name: Acme Corp');
    expect(ctx).toContain('Existing persisted research to reuse:');
    expect(ctx).toContain('## Market Overview');
  });
});

describe('buildIcpContext', () => {
  it('includes business context and two prior section dependencies', () => {
    const ctx = buildIcpContext({
      onboardingData: { companyName: 'Acme Corp' },
      industryResearch: { data: { marketSize: '$5B' } },
      competitorIntel: { data: { competitors: [{ name: 'Rival' }] } },
    });
    expect(ctx).toContain('Business context:');
    expect(ctx).toContain('Existing persisted research to reuse:');
    expect(ctx).toContain('## Market Overview');
    expect(ctx).toContain('## Competitor Intel');
  });
});

describe('buildOfferContext', () => {
  it('includes business context with website URL and three prior sections', () => {
    const ctx = buildOfferContext({
      onboardingData: { companyName: 'Acme Corp', companyUrl: 'https://acme.com' },
      industryResearch: { data: {} },
      competitorIntel: { data: {} },
      icpValidation: { data: {} },
    });
    expect(ctx).toContain('- Website URL: https://acme.com');
    expect(ctx).toContain('## Market Overview');
    expect(ctx).toContain('## Competitor Intel');
    expect(ctx).toContain('## ICP Validation');
  });
});

describe('buildSynthesisContext', () => {
  it('emits Business context: + Existing persisted research with correct ## headings', () => {
    const ctx = buildSynthesisContext({
      onboardingData: { companyName: 'Acme Corp', industry: 'SaaS' },
      industryResearch: { data: { marketSize: '$5B' } },
      competitorIntel: { data: { competitors: ['Foo'] } },
      icpValidation: { data: { persona: 'SMB' } },
      offerAnalysis: { data: { score: 7 } },
    });
    expect(ctx).toContain('Business context:');
    expect(ctx).toContain('- Company Name: Acme Corp');
    expect(ctx).toContain('Existing persisted research to reuse:');
    // Section headings must match what synthesize runner parses
    expect(ctx).toContain('## Market Overview');
    expect(ctx).toContain('## Competitor Intel');
    expect(ctx).toContain('## ICP Validation');
    expect(ctx).toContain('## Offer Analysis');
    expect(ctx).toContain('$5B');
  });
});

describe('buildKeywordContext', () => {
  it('includes - Top Competitors: inside Business context block', () => {
    const ctx = buildKeywordContext({
      onboardingData: { companyName: 'Acme Corp' },
      industryResearch: { data: {} },
      competitorIntel: { data: { competitors: [{ name: 'Hey Digital' }, { name: 'Refine Labs' }] } },
      icpValidation: { data: {} },
      offerAnalysis: { data: {} },
      strategicSynthesis: { data: {} },
    });
    expect(ctx).toContain('- Top Competitors: Hey Digital, Refine Labs');
    // Top Competitors line must appear before the dependencies marker
    const topCompIdx = ctx.indexOf('- Top Competitors:');
    const depsIdx = ctx.indexOf('Existing persisted research to reuse:');
    expect(topCompIdx).toBeLessThan(depsIdx);
    // Must include strategic synthesis section
    expect(ctx).toContain('## Strategic Synthesis');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test:run -- src/lib/research/__tests__/pipeline-context.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement context builders**

Build these after reading the actual runner expectations in Step 1. The implementation must emit the exact markdown format the runners parse. Each builder takes typed inputs and returns a `string`.

Key contract points from the spec:
- Synthesis/keyword runners consume `## Section Name` blocks
- Keyword runner expects `- Top Competitors:` bullet
- Offer analysis benefits from first-party URL bullets
- Industry context needs company name, URL, industry, and any onboarding fields

```typescript
// src/lib/research/pipeline-context.ts
//
// CRITICAL: These builders must emit the exact format the Railway worker runners parse.
// The runners use `extractSynthesisSectionBlocks()` / `extractKeywordSectionBlocks()`
// which look for:
//   1. `Business context:` header with `- Key: Value` bullet lines
//   2. `Existing persisted research to reuse:` separator
//   3. `## Section Name` blocks with JSON body
//
// Section heading names must match the runner lookup keys exactly:
//   - Synthesize runner: sectionBlocks['Market Overview'], ['Competitor Intel'], ['ICP Validation'], ['Offer Analysis']
//   - Keywords runner: sectionBlocks['Industry Research'] ?? sectionBlocks['Market Overview'], etc.
// Using 'Market Overview' satisfies both (keywords falls through to Market Overview if Industry Research not found).
//
// The `- Top Competitors:` line must appear INSIDE the `Business context:` block
// (before the `Existing persisted research to reuse:` marker) — the keyword runner's
// `extractKeywordCompetitorNames()` regex looks for it there.

interface OnboardingData {
  companyName?: string;
  companyUrl?: string;
  industry?: string;
  businessModel?: string;
  productDescription?: string;
  goals?: string;
  competitors?: string[];
  [key: string]: unknown;
}

// Known keys that map to specific bullet labels
const KNOWN_FIELD_LABELS: Record<string, string> = {
  companyName: 'Company Name',
  companyUrl: 'Website URL',
  industry: 'Industry',
  businessModel: 'Business Model',
  productDescription: 'Product Description',
  goals: 'Goals',
};

function buildBusinessContextBlock(
  onboardingData: OnboardingData,
  extraLines?: string[],
): string {
  const lines = ['Business context:'];
  // Emit known fields first in stable order
  for (const [key, label] of Object.entries(KNOWN_FIELD_LABELS)) {
    const val = onboardingData[key];
    if (val && typeof val === 'string') lines.push(`- ${label}: ${val}`);
  }
  // Emit extra lines (e.g. Top Competitors) in the business context block
  if (extraLines) lines.push(...extraLines);
  // Emit remaining unknown fields
  for (const [key, value] of Object.entries(onboardingData)) {
    if (key in KNOWN_FIELD_LABELS || key === 'competitors' || !value) continue;
    const valStr = typeof value === 'string' ? value : JSON.stringify(value);
    lines.push(`- ${key}: ${valStr}`);
  }
  return lines.join('\n');
}

function buildDependencyBlocks(
  sections: Array<{ heading: string; data: Record<string, unknown> }>,
): string {
  const lines = ['', 'Existing persisted research to reuse:'];
  for (const { heading, data } of sections) {
    lines.push('', `## ${heading}`, JSON.stringify(data, null, 2));
  }
  return lines.join('\n');
}

export function buildIndustryContext(onboardingData: OnboardingData): string {
  // Industry runner receives business context only — no prior sections
  return buildBusinessContextBlock(onboardingData);
}

export function buildCompetitorContext(input: {
  onboardingData: OnboardingData;
  industryResearch: { data: Record<string, unknown> };
}): string {
  const extraLines: string[] = [];
  const comps = input.onboardingData.competitors;
  if (comps && comps.length > 0) {
    extraLines.push(`- Top Competitors: ${comps.join(', ')}`);
  }
  return [
    buildBusinessContextBlock(input.onboardingData, extraLines),
    buildDependencyBlocks([
      { heading: 'Market Overview', data: input.industryResearch.data },
    ]),
  ].join('\n');
}

export function buildIcpContext(input: {
  onboardingData: OnboardingData;
  industryResearch: { data: Record<string, unknown> };
  competitorIntel: { data: Record<string, unknown> };
}): string {
  return [
    buildBusinessContextBlock(input.onboardingData),
    buildDependencyBlocks([
      { heading: 'Market Overview', data: input.industryResearch.data },
      { heading: 'Competitor Intel', data: input.competitorIntel.data },
    ]),
  ].join('\n');
}

export function buildOfferContext(input: {
  onboardingData: OnboardingData;
  industryResearch: { data: Record<string, unknown> };
  competitorIntel: { data: Record<string, unknown> };
  icpValidation: { data: Record<string, unknown> };
}): string {
  return [
    buildBusinessContextBlock(input.onboardingData),
    buildDependencyBlocks([
      { heading: 'Market Overview', data: input.industryResearch.data },
      { heading: 'Competitor Intel', data: input.competitorIntel.data },
      { heading: 'ICP Validation', data: input.icpValidation.data },
    ]),
  ].join('\n');
}

export function buildSynthesisContext(input: {
  onboardingData: OnboardingData;
  industryResearch: { data: Record<string, unknown> };
  competitorIntel: { data: Record<string, unknown> };
  icpValidation: { data: Record<string, unknown> };
  offerAnalysis: { data: Record<string, unknown> };
}): string {
  return [
    buildBusinessContextBlock(input.onboardingData),
    buildDependencyBlocks([
      { heading: 'Market Overview', data: input.industryResearch.data },
      { heading: 'Competitor Intel', data: input.competitorIntel.data },
      { heading: 'ICP Validation', data: input.icpValidation.data },
      { heading: 'Offer Analysis', data: input.offerAnalysis.data },
    ]),
  ].join('\n');
}

export function buildKeywordContext(input: {
  onboardingData: OnboardingData;
  industryResearch: { data: Record<string, unknown> };
  competitorIntel: { data: Record<string, unknown> };
  icpValidation: { data: Record<string, unknown> };
  offerAnalysis: { data: Record<string, unknown> };
  strategicSynthesis: { data: Record<string, unknown> };
}): string {
  // Extract competitor names for `- Top Competitors:` line inside Business context block
  const competitors = (input.competitorIntel.data as { competitors?: Array<{ name?: string }> })
    ?.competitors?.map((c) => c.name).filter(Boolean) ?? [];
  const extraLines: string[] = [];
  if (competitors.length > 0) {
    extraLines.push(`- Top Competitors: ${competitors.join(', ')}`);
  }

  return [
    buildBusinessContextBlock(input.onboardingData, extraLines),
    buildDependencyBlocks([
      { heading: 'Market Overview', data: input.industryResearch.data },
      { heading: 'Competitor Intel', data: input.competitorIntel.data },
      { heading: 'ICP Validation', data: input.icpValidation.data },
      { heading: 'Offer Analysis', data: input.offerAnalysis.data },
      { heading: 'Strategic Synthesis', data: input.strategicSynthesis.data },
    ]),
  ].join('\n');
}
```

**Important:** The exact format of these builders MUST be validated against the actual runner parsing code in Step 1. The code above matches the format confirmed from test fixtures in `research-worker/src/__tests__/{synthesize,keywords,competitors,offer,industry}.test.ts`.

- [ ] **Step 5: Run tests**

Run: `npm run test:run -- src/lib/research/__tests__/pipeline-context.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/research/pipeline-context.ts src/lib/research/__tests__/pipeline-context.test.ts
git commit -m "feat: context builders for pipeline section dispatch"
```

---

## Chunk 2: API Routes

### Task 4: Pipeline State Persistence Helpers

**Files:**
- Create: `supabase/migrations/20260312_add_journey_session_metadata_merge_function.sql`
- Modify: `src/lib/journey/session-state.server.ts`

- [ ] **Step 1: Add migration for atomic metadata writes**

This RPC is a hard prerequisite. Do not treat it as an optional note during implementation.

```sql
-- supabase/migrations/20260312_add_journey_session_metadata_merge_function.sql
create or replace function public.merge_journey_session_metadata_keys(
  p_user_id text,
  p_keys jsonb
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.journey_sessions (
    user_id,
    metadata,
    updated_at
  )
  values (
    p_user_id,
    coalesce(p_keys, '{}'::jsonb),
    now()
  )
  on conflict (user_id) do update
  set metadata = coalesce(public.journey_sessions.metadata, '{}'::jsonb) || coalesce(p_keys, '{}'::jsonb),
      updated_at = now();
end;
$$;
```

- [ ] **Step 2: Add readPipelineState and persistPipelineState to session-state.server.ts**

These helpers read/write `metadata.researchPipeline` on the `journey_sessions` row.

```typescript
// Add to session-state.server.ts

import type { PipelineState } from '@/lib/research/pipeline-types';

export async function readPipelineState(userId: string): Promise<PipelineState | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('journey_sessions')
    .select('metadata')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data?.metadata) return null;
  const metadata = data.metadata as Record<string, unknown>;
  return (metadata.researchPipeline as PipelineState) ?? null;
}

export async function persistPipelineState(
  userId: string,
  pipelineState: PipelineState,
  extraMetadata: Record<string, unknown> = {},
): Promise<void> {
  const supabase = createAdminClient();

  // Single atomic metadata write. This avoids the partial-failure path where the run
  // starts successfully but onboardingData is missing for downstream context building.
  await supabase.rpc('merge_journey_session_metadata_keys', {
    p_user_id: userId,
    p_keys: {
      researchPipeline: pipelineState,
      activeJourneyRunId: pipelineState.runId,
      lastUpdated: new Date().toISOString(),
      ...extraMetadata,
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260312_add_journey_session_metadata_merge_function.sql src/lib/journey/session-state.server.ts
git commit -m "feat: add atomic metadata persistence for research pipeline"
```

---

### Task 5: POST /api/research/pipeline/start

**Files:**
- Create: `src/app/api/research/pipeline/start/route.ts`
- Reference: `src/lib/ai/tools/research/dispatch.ts` (`dispatchResearchForUser`)
- Reference: `src/lib/journey/session-state.server.ts` (`persistPipelineState`)

- [ ] **Step 1: Create the start route**

```typescript
// src/app/api/research/pipeline/start/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createInitialPipelineState, markSectionRunning } from '@/lib/research/pipeline-controller';
import { persistPipelineState } from '@/lib/journey/session-state.server';
import { dispatchResearchForUser } from '@/lib/ai/tools/research/dispatch';
import { buildIndustryContext } from '@/lib/research/pipeline-context';
import { PIPELINE_SECTION_CONFIG } from '@/lib/research/pipeline-types';

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { onboardingData } = await request.json();
  if (!onboardingData) {
    return NextResponse.json({ error: 'onboardingData required' }, { status: 400 });
  }

  const runId = crypto.randomUUID();
  let state = createInitialPipelineState(runId);

  // Dispatch section 0: industryResearch
  const firstSection = state.sections[0];
  const config = PIPELINE_SECTION_CONFIG[firstSection.id];
  const context = buildIndustryContext(onboardingData);

  const result = await dispatchResearchForUser(
    config.toolName,
    config.boundaryKey,
    context,
    userId,
    { activeRunId: runId },
  );

  if (result.status === 'error') {
    state = { ...state, status: 'error' };
    await persistPipelineState(userId, state);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  state = markSectionRunning(state, firstSection.id, result.jobId ?? runId);
  await persistPipelineState(userId, state, { onboardingData });

  return NextResponse.json({
    status: 'started',
    runId,
    section: firstSection.id,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/research/pipeline/start/route.ts
git commit -m "feat: POST /api/research/pipeline/start route"
```

---

### Task 6: POST /api/research/pipeline/advance

**Files:**
- Create: `src/app/api/research/pipeline/advance/route.ts`
- Reference: `src/lib/research/pipeline-controller.ts`
- Reference: `src/lib/research/pipeline-context.ts`

- [ ] **Step 1: Create the advance route**

This route:
1. Verifies auth + run ownership
2. Reads current pipeline state from metadata
3. Verifies current section is complete (not error/stale)
4. Marks current section approved
5. Dispatches next section (building context from prior results in Supabase)
6. Persists updated state

```typescript
// src/app/api/research/pipeline/advance/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { readPipelineState, persistPipelineState } from '@/lib/journey/session-state.server';
import {
  markSectionApproved,
  markSectionRunning,
  getNextSectionId,
} from '@/lib/research/pipeline-controller';
import { dispatchResearchForUser } from '@/lib/ai/tools/research/dispatch';
import { PIPELINE_SECTION_CONFIG, type PipelineSectionId } from '@/lib/research/pipeline-types';
import {
  buildIndustryContext,
  buildCompetitorContext,
  buildIcpContext,
  buildOfferContext,
  buildSynthesisContext,
  buildKeywordContext,
} from '@/lib/research/pipeline-context';

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { runId } = await request.json();
  if (!runId) {
    return NextResponse.json({ error: 'runId required' }, { status: 400 });
  }

  // Read current pipeline state
  const pipelineState = await readPipelineState(userId);
  if (!pipelineState || pipelineState.runId !== runId) {
    return NextResponse.json({ error: 'Run not found or mismatch' }, { status: 404 });
  }

  if (!pipelineState.currentSectionId) {
    return NextResponse.json({ error: 'No active section' }, { status: 409 });
  }

  // Verify current section is complete
  const currentSection = pipelineState.sections.find(
    (s) => s.id === pipelineState.currentSectionId,
  );
  if (!currentSection || currentSection.status !== 'complete') {
    return NextResponse.json(
      { error: `Section ${pipelineState.currentSectionId} is ${currentSection?.status}, not complete` },
      { status: 409 },
    );
  }

  // Approve current section
  let state = markSectionApproved(pipelineState, pipelineState.currentSectionId);

  // Get next section
  const nextId = getNextSectionId(state.approvedSectionIds);
  if (!nextId) {
    state = { ...state, status: 'complete', currentSectionId: null };
    await persistPipelineState(userId, state);
    return NextResponse.json({ status: 'complete', runId });
  }

  // Read research results from Supabase for context building
  const supabase = createAdminClient();
  const { data: sessionData } = await supabase
    .from('journey_sessions')
    .select('metadata, research_results')
    .eq('user_id', userId)
    .single();

  const researchResults = (sessionData?.research_results as Record<string, unknown>) ?? {};
  const metadata = (sessionData?.metadata as Record<string, unknown>) ?? {};
  const onboardingData = (metadata.onboardingData as Record<string, unknown>) ?? {};

  // Build context for next section
  const config = PIPELINE_SECTION_CONFIG[nextId];
  const context = buildContextForSection(nextId, onboardingData, researchResults);

  // Dispatch
  const result = await dispatchResearchForUser(
    config.toolName,
    config.boundaryKey,
    context,
    userId,
    { activeRunId: runId },
  );

  if (result.status === 'error') {
    state = {
      ...state,
      status: 'error',
      sections: state.sections.map((s) =>
        s.id === nextId ? { ...s, status: 'error', error: result.error ?? 'Dispatch failed' } : s,
      ),
    };
    await persistPipelineState(userId, state);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  state = markSectionRunning(state, nextId, result.jobId ?? runId);
  await persistPipelineState(userId, state);

  return NextResponse.json({ status: 'advanced', runId, section: nextId });
}

// Helper: route to correct context builder based on section
function buildContextForSection(
  sectionId: PipelineSectionId,
  onboardingData: Record<string, unknown>,
  researchResults: Record<string, unknown>,
): string {
  const getResult = (key: string) =>
    (researchResults[key] as { data?: Record<string, unknown> }) ?? { data: {} };

  switch (sectionId) {
    case 'industryResearch':
      return buildIndustryContext(onboardingData);
    case 'competitorIntel':
      return buildCompetitorContext({ onboardingData, industryResearch: getResult('industryResearch') });
    case 'icpValidation':
      return buildIcpContext({
        onboardingData,
        industryResearch: getResult('industryResearch'),
        competitorIntel: getResult('competitorIntel'),
      });
    case 'offerAnalysis':
      return buildOfferContext({
        onboardingData,
        industryResearch: getResult('industryResearch'),
        competitorIntel: getResult('competitorIntel'),
        icpValidation: getResult('icpValidation'),
      });
    case 'strategicSynthesis':
      return buildSynthesisContext({
        onboardingData,
        industryResearch: getResult('industryResearch'),
        competitorIntel: getResult('competitorIntel'),
        icpValidation: getResult('icpValidation'),
        offerAnalysis: getResult('offerAnalysis'),
      });
    case 'keywordIntel':
      return buildKeywordContext({
        onboardingData,
        industryResearch: getResult('industryResearch'),
        competitorIntel: getResult('competitorIntel'),
        icpValidation: getResult('icpValidation'),
        offerAnalysis: getResult('offerAnalysis'),
        strategicSynthesis: getResult('strategicSynthesis'),
      });
    default: {
      const _exhaustive: never = sectionId as never;
      throw new Error(`Unknown pipeline section: ${sectionId}`);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/research/pipeline/advance/route.ts
git commit -m "feat: POST /api/research/pipeline/advance route"
```

---

### Task 7: PATCH /api/research/section (Direct Edit)

**Files:**
- Create: `src/app/api/research/section/route.ts`

- [ ] **Step 1: Create the section edit route**

```typescript
// src/app/api/research/section/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { readPipelineState, persistPipelineState } from '@/lib/journey/session-state.server';
import { invalidateDownstream } from '@/lib/research/pipeline-controller';
import type { PipelineSectionId } from '@/lib/research/pipeline-types';

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { runId, sectionId, updates } = await request.json();
  if (!runId || !sectionId || !updates) {
    return NextResponse.json({ error: 'runId, sectionId, updates required' }, { status: 400 });
  }

  // Verify run ownership
  const pipelineState = await readPipelineState(userId);
  if (!pipelineState || pipelineState.runId !== runId) {
    return NextResponse.json({ error: 'Run not found or mismatch' }, { status: 404 });
  }

  // Read existing section result from Supabase
  const supabase = createAdminClient();
  const { data: sessionData } = await supabase
    .from('journey_sessions')
    .select('research_results')
    .eq('user_id', userId)
    .single();

  const researchResults = (sessionData?.research_results as Record<string, unknown>) ?? {};
  const existingResult = (researchResults[sectionId] as Record<string, unknown>) ?? {};
  const existingData = (existingResult.data as Record<string, unknown>) ?? {};

  // Deep merge updates into existing data
  const mergedData = { ...existingData, ...updates };
  const mergedResult = { ...existingResult, data: mergedData };

  // Write via RPC
  await supabase.rpc('merge_journey_session_research_result', {
    p_user_id: userId,
    p_section: sectionId,
    p_result: mergedResult,
  });

  // Invalidate downstream sections
  let state = invalidateDownstream(pipelineState, sectionId as PipelineSectionId);
  await persistPipelineState(userId, state);

  return NextResponse.json({ status: 'updated', sectionId, data: mergedData });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/research/section/route.ts
git commit -m "feat: PATCH /api/research/section for direct edits"
```

---

### Task 8: POST /api/research/chat (Per-Section Chat Agent)

**Files:**
- Create: `src/app/api/research/chat/route.ts`

- [ ] **Step 1: Create the chat route with editSection tool**

```typescript
// src/app/api/research/chat/route.ts
import { auth } from '@clerk/nextjs/server';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText, convertToModelMessages, tool } from 'ai';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { readPipelineState, persistPipelineState } from '@/lib/journey/session-state.server';
import { invalidateDownstream } from '@/lib/research/pipeline-controller';
import type { PipelineSectionId } from '@/lib/research/pipeline-types';
import { PIPELINE_SECTION_CONFIG, PIPELINE_SECTION_ORDER } from '@/lib/research/pipeline-types';

export const maxDuration = 60;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { messages, runId, sectionId } = await request.json();

  // Verify run ownership
  const pipelineState = await readPipelineState(userId);
  if (!pipelineState || pipelineState.runId !== runId) {
    return new Response('Run not found', { status: 404 });
  }

  // Read current section data for context
  const supabase = createAdminClient();
  const { data: sessionData } = await supabase
    .from('journey_sessions')
    .select('research_results, metadata')
    .eq('user_id', userId)
    .single();

  const researchResults = (sessionData?.research_results as Record<string, unknown>) ?? {};
  const sectionResult = researchResults[sectionId] as Record<string, unknown> | undefined;
  const sectionData = sectionResult?.data ?? {};
  const sectionConfig = PIPELINE_SECTION_CONFIG[sectionId as PipelineSectionId];

  const systemPrompt = `You are a research analyst helping refine the "${sectionConfig?.displayName ?? sectionId}" section of a strategic research report.

Current section data:
${JSON.stringify(sectionData, null, 2)}

When the user asks you to change something, call the editSection tool with the updated fields. Only include the fields that need to change — the system will merge them into the existing data.

Keep responses concise. Focus on the specific section being reviewed.`;

  // Sanitize incomplete tool parts before converting — prevents MissingToolResultsError
  // (see learned-patterns.md: "sanitize incomplete tool parts from messages BEFORE calling convertToModelMessages()")
  const sanitizedMessages = messages.filter((m: { role: string; parts?: Array<{ type: string; toolCallId?: string }> }) => {
    if (m.role !== 'assistant' || !m.parts) return true;
    // Remove messages with tool-call parts that lack a matching tool-result
    const toolCallIds = m.parts.filter((p) => p.type === 'tool-invocation').map((p) => p.toolCallId);
    if (toolCallIds.length === 0) return true;
    // Check if all tool calls have results in subsequent messages
    return toolCallIds.every((id) =>
      messages.some((msg: { parts?: Array<{ type: string; toolCallId?: string }> }) =>
        msg.parts?.some((p) => p.type === 'tool-invocation' && p.toolCallId === id && 'result' in p),
      ),
    );
  });

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: systemPrompt,
    messages: await convertToModelMessages(sanitizedMessages),
    tools: {
      editSection: tool({
        description: 'Update the current research section data based on user feedback',
        inputSchema: z.object({
          sectionId: z.enum(PIPELINE_SECTION_ORDER as unknown as [string, ...string[]]),
          updates: z.record(z.unknown()),
          summary: z.string().describe('One-line description of what changed'),
        }),
        execute: async ({ sectionId: editSectionId, updates }) => {
          // Read existing, merge, write
          const existing = (researchResults[editSectionId] as Record<string, unknown>) ?? {};
          const existingData = (existing.data as Record<string, unknown>) ?? {};
          const mergedData = { ...existingData, ...updates };
          const mergedResult = { ...existing, data: mergedData };

          await supabase.rpc('merge_journey_session_research_result', {
            p_user_id: userId,
            p_section: editSectionId,
            p_result: mergedResult,
          });

          // Invalidate downstream
          let state = await readPipelineState(userId);
          if (state) {
            state = invalidateDownstream(state, editSectionId as PipelineSectionId);
            await persistPipelineState(userId, state);
          }

          return { status: 'updated', sectionId: editSectionId, data: mergedData };
        },
      }),
    },
    maxSteps: 3,
  });

  return result.toUIMessageStreamResponse();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/research/chat/route.ts
git commit -m "feat: POST /api/research/chat with editSection tool"
```

---

## Chunk 3: Frontend Pipeline View

### Task 9: Pipeline Page and State Management

**Files:**
- Create: `src/app/research/[runId]/page.tsx`
- Create: `src/components/research/pipeline-view.tsx`
- Reference: `src/lib/journey/research-realtime.ts` (useResearchRealtime)
- Reference: `src/lib/journey/research-job-activity.ts` (useResearchJobActivity)

- [ ] **Step 1: Create the pipeline page**

```typescript
// src/app/research/[runId]/page.tsx
import { PipelineView } from '@/components/research/pipeline-view';

// Next.js 15+: params is a Promise in App Router Server Components
export default async function ResearchPipelinePage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  return <PipelineView runId={runId} />;
}
```

- [ ] **Step 2: Create PipelineView component**

This component:
- Subscribes to `useResearchRealtime` and `useResearchJobActivity` with the `runId`
- Reads `metadata.researchPipeline` for gate/approval state
- Renders 6 section cards in a scrollable right panel
- Renders per-section chat in the left panel when gated
- Handles approve/advance flow

```typescript
// src/components/research/pipeline-view.tsx
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useResearchRealtime } from '@/lib/journey/research-realtime';
import { useResearchJobActivity } from '@/lib/journey/research-job-activity';
import { normalizeResearchSectionId } from '@/lib/journey/research-sections';
import { SectionCard } from './section-card';
import { GateControls } from './gate-controls';
import { PIPELINE_SECTION_ORDER, PIPELINE_SECTION_CONFIG } from '@/lib/research/pipeline-types';
import type { PipelineState, PipelineSectionId } from '@/lib/research/pipeline-types';

interface PipelineViewProps {
  runId: string;
}

export function PipelineView({ runId }: PipelineViewProps) {
  const { user } = useUser();
  const userId = user?.id ?? null;

  const [pipelineState, setPipelineState] = useState<PipelineState | null>(null);
  const [sectionData, setSectionData] = useState<
    Partial<Record<PipelineSectionId, Record<string, unknown>>>
  >({});
  const [activeChatSection, setActiveChatSection] = useState<PipelineSectionId | null>(null);
  const resetSignalRef = useRef(0);

  // Use existing run-scoped polling hook for research result completion detection.
  // This hook emits BOUNDARY section keys such as industryMarket / competitors /
  // crossAnalysis, so normalize them back to canonical PipelineSectionId values
  // before storing section card data.
  useResearchRealtime({
    userId,
    activeRunId: runId,
    onSectionComplete: (section, result) => {
      const canonicalSectionId = normalizeResearchSectionId(section);
      if (!canonicalSectionId || canonicalSectionId === 'mediaPlan') {
        return;
      }
      setSectionData((prev) => ({ ...prev, [canonicalSectionId]: result }));
    },
    resetSignal: resetSignalRef.current,
  });

  // Poll for pipeline metadata (gate/approval state) — separate from research results
  useEffect(() => {
    if (!userId) return;
    const fetchPipelineState = async () => {
      const res = await fetch(`/api/journey/session?runId=${runId}`);
      const data = await res.json();
      const pipeline = data.metadata?.researchPipeline;
      // Verify runId match before applying
      if (pipeline && pipeline.runId === runId) {
        setPipelineState(pipeline);
      }
    };
    fetchPipelineState();
    const interval = setInterval(fetchPipelineState, 2000);
    return () => clearInterval(interval);
  }, [userId, runId]);

  const jobActivity = useResearchJobActivity({
    userId,
    activeRunId: runId,
  });

  const handleApprove = useCallback(async () => {
    const res = await fetch('/api/research/pipeline/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId }),
    });
    const data = await res.json();
    if (data.status === 'advanced' || data.status === 'complete') {
      // State will update via polling
      setActiveChatSection(null);
    }
  }, [runId]);

  if (!pipelineState) {
    return <div className="flex items-center justify-center h-full">Loading pipeline...</div>;
  }

  return (
    <div className="flex h-full">
      {/* Left panel: chat (when gated) */}
      <div className="w-1/3 border-r border-zinc-800 overflow-y-auto">
        {activeChatSection && (
          <GateControls
            runId={runId}
            sectionId={activeChatSection}
            sectionData={sectionData[activeChatSection]}
            onApprove={handleApprove}
          />
        )}
      </div>

      {/* Right panel: section cards */}
      <div className="w-2/3 overflow-y-auto p-6 space-y-4">
        {PIPELINE_SECTION_ORDER.map((id) => {
          const config = PIPELINE_SECTION_CONFIG[id];
          const section = pipelineState.sections.find((s) => s.id === id);
          const data = sectionData[id];
          const activity = jobActivity[config.boundaryKey];
          const isGated = pipelineState.status === 'gated' && pipelineState.currentSectionId === id;

          return (
            <SectionCard
              key={id}
              sectionId={id}
              displayName={config.displayName}
              status={section?.status ?? 'pending'}
              data={data}
              activity={activity}
              isGated={isGated}
              onOpenChat={() => setActiveChatSection(id)}
              onApprove={handleApprove}
            />
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/research/[runId]/page.tsx src/components/research/pipeline-view.tsx
git commit -m "feat: pipeline page and view component"
```

---

### Task 10: Section Card Component

**Files:**
- Create: `src/components/research/section-card.tsx`
- Reference: `src/components/journey/research-inline-card.tsx` (reuse patterns)

- [ ] **Step 1: Create SectionCard component**

This wraps the existing rendering patterns from `ResearchInlineCard` but adds gate-specific UI (approve button, stale badge, copy action).

```typescript
// src/components/research/section-card.tsx
'use client';

import { cn } from '@/lib/utils';
import type { PipelineSectionId, SectionStatus } from '@/lib/research/pipeline-types';
import type { ResearchJobActivity } from '@/lib/journey/research-job-activity';

interface SectionCardProps {
  sectionId: PipelineSectionId;
  displayName: string;
  status: SectionStatus;
  data?: Record<string, unknown>;
  activity?: ResearchJobActivity;
  isGated: boolean;
  onOpenChat: () => void;
  onApprove: () => void;
  onRetry?: () => void;
}

export function SectionCard({
  sectionId,
  displayName,
  status,
  data,
  activity,
  isGated,
  onOpenChat,
  onApprove,
  onRetry,
}: SectionCardProps) {
  const handleCopy = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-all',
        status === 'pending' && 'opacity-40 border-zinc-800',
        (status === 'running' || status === 'queued') && 'border-blue-500/50 bg-blue-500/5',
        status === 'complete' && 'border-zinc-600',
        status === 'approved' && 'border-green-500/30 bg-green-500/5',
        status === 'editing' && 'border-purple-500/50 bg-purple-500/5',
        status === 'stale' && 'border-amber-500/50 bg-amber-500/5',
        status === 'error' && 'border-red-500/50 bg-red-500/5',
        isGated && 'ring-2 ring-blue-500/50',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">{displayName}</h3>
        <div className="flex items-center gap-2">
          {status === 'stale' && (
            <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
              Needs rerun
            </span>
          )}
          {(status === 'complete' || status === 'approved') && data && (
            <button onClick={handleCopy} className="text-xs text-zinc-400 hover:text-white">
              Copy
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {(status === 'running' || status === 'queued') && (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
          {activity?.updates?.at(-1)?.message ?? 'Researching...'}
        </div>
      )}

      {/* Content */}
      {data && (status === 'complete' || status === 'approved' || status === 'stale') && (
        <div className="text-sm text-zinc-300 line-clamp-4">
          {/* Render a preview of the data — reuse existing section renderers later */}
          <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(data, null, 2).slice(0, 500)}</pre>
        </div>
      )}

      {/* Gate controls */}
      {isGated && status === 'complete' && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={onApprove}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-md"
          >
            Looks good
          </button>
          <button
            onClick={onOpenChat}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-md"
          >
            Refine
          </button>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="text-sm text-red-400">
          Research failed.{' '}
          {onRetry && (
            <button onClick={onRetry} className="underline hover:text-red-300">
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/research/section-card.tsx
git commit -m "feat: section card component with gate controls"
```

---

### Task 11: Gate Controls with Chat

**Files:**
- Create: `src/components/research/gate-controls.tsx`

- [ ] **Step 1: Create GateControls component with useChat**

```typescript
// src/components/research/gate-controls.tsx
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useMemo } from 'react';
import type { PipelineSectionId } from '@/lib/research/pipeline-types';
import { PIPELINE_SECTION_CONFIG } from '@/lib/research/pipeline-types';

interface GateControlsProps {
  runId: string;
  sectionId: PipelineSectionId;
  sectionData?: Record<string, unknown>;
  onApprove: () => void;
}

export function GateControls({ runId, sectionId, sectionData, onApprove }: GateControlsProps) {
  const config = PIPELINE_SECTION_CONFIG[sectionId];

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/research/chat',
        body: { runId, sectionId },
      }),
    [runId, sectionId],
  );

  const { messages, input, handleInputChange, handleSubmit, status } = useChat({
    transport,
    id: `research-chat-${sectionId}`,
    experimental_throttle: 50,
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-zinc-800">
        <h3 className="font-semibold text-sm">Refine: {config.displayName}</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`text-sm ${m.role === 'user' ? 'text-white' : 'text-zinc-300'}`}
          >
            {m.parts?.map((part, i) => {
              if (part.type === 'text') return <p key={i}>{part.text}</p>;
              return null;
            })}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-800">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about this section or request changes..."
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white"
            disabled={status !== 'ready'}
          />
          <button
            type="submit"
            disabled={status !== 'ready' || !input.trim()}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md disabled:opacity-50"
          >
            Send
          </button>
        </form>
        <button
          onClick={onApprove}
          className="mt-2 w-full px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-md"
        >
          Looks good
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/research/gate-controls.tsx
git commit -m "feat: gate controls with per-section chat"
```

---

## Chunk 4: Integration and Verification

### Task 12: Build Verification

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No new errors from pipeline files

- [ ] **Step 2: Run all pipeline tests**

Run: `npm run test:run -- src/lib/research/__tests__/`
Expected: All tests pass

- [ ] **Step 3: Run full test suite**

Run: `npm run test:run`
Expected: No regressions

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit any fixes**

If any issues were found in steps 1-4, fix and commit.

---

### Task 13: Manual Integration Test

- [ ] **Step 1: Start dev server**

Run: `npm run dev` (in tmux or background)

- [ ] **Step 2: Start research worker**

Run: `cd research-worker && npm run dev` (in separate terminal)

- [ ] **Step 3: Test the pipeline start endpoint**

```bash
curl -X POST http://localhost:3000/api/research/pipeline/start \
  -H "Content-Type: application/json" \
  -d '{"onboardingData":{"companyName":"Test Corp","industry":"SaaS","companyUrl":"https://test.com"}}'
```

Expected: `{ "status": "started", "runId": "...", "section": "industryResearch" }`

- [ ] **Step 4: Verify worker receives dispatch**

Check research worker terminal for incoming POST to `/run`

- [ ] **Step 5: Advance through all 6 sections sequentially**

For each section (0 through 5), wait for the worker to complete (check Supabase `research_results`), then call advance:

```bash
# After section 0 (industryResearch) completes:
curl -X POST http://localhost:3000/api/research/pipeline/advance \
  -H "Content-Type: application/json" \
  -d '{"runId":"<runId>"}'
# Expected: { "status": "advanced", "section": "competitorIntel" }

# Repeat for sections 1-4... wait for completion, then advance.
# Pay special attention to sections 4 (strategicSynthesis) and 5 (keywordIntel):
# their context builders must emit correct ## headings and - Top Competitors: line.
# Verify in the worker terminal that context is being parsed correctly.

# After section 5 (keywordIntel) completes and is approved:
# Expected: { "status": "complete", "runId": "..." }
```

Expected: All 6 sections dispatch, complete, and approve without errors.

- [ ] **Step 6: Navigate to pipeline view**

Open `http://localhost:3000/research/<runId>` and verify:
- 6 section cards visible
- First card shows loading/complete state
- Gate controls ("Looks good" + "Refine") appear when section is complete
- Click "Looks good" in the browser — verify it calls `/api/research/pipeline/advance` and the next card starts loading

- [ ] **Step 7: Test per-section chat route**

When a section is gated (complete, awaiting approval), click "Refine" and send a message:

```bash
curl -X POST http://localhost:3000/api/research/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Can you add more detail about market trends?"}],"runId":"<runId>","sectionId":"industryResearch"}'
```

Expected: Streamed response arrives. Measure time-to-first-token — target < 1 second.

- [ ] **Step 8: Test direct section edit with downstream invalidation**

```bash
curl -X PATCH http://localhost:3000/api/research/section \
  -H "Content-Type: application/json" \
  -d '{"runId":"<runId>","sectionId":"industryResearch","updates":{"marketSize":"$10B"}}'
```

Expected: `{ "status": "updated", "sectionId": "industryResearch" }`
Verify in the UI: strategicSynthesis and keywordIntel cards now show "Needs rerun" stale badge.

- [ ] **Step 9: Verify error handling**

Simulate a worker error by manually setting a job_status entry in Supabase:
```sql
-- In Supabase SQL editor, update a job_status entry to 'error'
```
Verify: the section card renders the error state with the "Retry" button.

- [ ] **Step 10: Measure performance targets**

| Metric | Target | How to Measure |
|---|---|---|
| Pipeline UI first visible | < 1 second | Browser DevTools: time from start POST response to 6 cards rendered |
| Chat refinement TTFT | < 1 second | Network tab: time from chat POST to first SSE chunk |

Document actual timings as pass/fail evidence.

- [ ] **Step 11: Commit and document results**

```bash
git add -A
git commit -m "feat: sequential research pipeline — Phase 1 complete"
```
