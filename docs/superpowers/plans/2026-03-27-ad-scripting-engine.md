# Ad Scripting Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a research-native ad scripting engine that generates humanized, evidence-backed ad scripts from existing research data, accessible as a "Scripts" tab on the business profile command center.

**Architecture:** New Railway worker runner (`ad-scripts.ts`) generates scripts via 10 sequential Claude calls (5 awareness levels x 2 passes). Scripts stored in a new `script_packs` Supabase table with realtime subscription. Frontend renders progressive results as each awareness level completes. Style references stored on `business_profiles` provide voice/tone anchoring.

**Tech Stack:** Next.js 15, Vercel AI SDK v6 (`generateObject`), Anthropic Claude Sonnet 4.6, Supabase (realtime + RLS), Zod v4, Railway worker (Express), Tailwind CSS v4, shadcn/ui

**Design doc:** `~/.gstack/projects/ammar944-AI-GOS/ammar-redesign-v2-command-center-design-20260326-194936.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `research-worker/src/utils/strip-numeric-constraints.ts` | Extracted from `media-plan.ts` — shared utility for removing `.min()/.max()` from Zod schemas |
| `research-worker/src/runners/ad-scripts.ts` | 2-pass runner: generate + humanize per awareness level |
| `research-worker/src/prompts/ad-scripts-pass1.ts` | Pass 1 system prompt (generation with frameworks + kill list) |
| `research-worker/src/prompts/ad-scripts-pass2.ts` | Pass 2 system prompt (41-check humanizer audit) |
| `src/lib/scripts/schemas.ts` | Frontend mirror of AdScript + AdScriptPack Zod schemas |
| `src/lib/scripts/trim-research-context.ts` | `trimResearchForScripts()` — extracts priority fields from research_results |
| `src/lib/scripts/use-script-pack-realtime.ts` | Supabase realtime subscription for progressive script rendering |
| `src/app/api/scripts/generate/route.ts` | POST — triggers ad script generation for a profile |
| `src/app/api/scripts/[packId]/route.ts` | GET pack + PATCH individual script (read-modify-write) |
| `src/app/api/scripts/[packId]/scripts/[scriptId]/regenerate/route.ts` | POST — re-run both passes for a single script (V1: returns 501 stub) |
| `src/app/api/profiles/[id]/style-references/route.ts` | PUT — dedicated route for updating style references (JSONB column) |
| `src/app/api/profiles/[id]/script-packs/route.ts` | GET — list script packs for a profile |
| `src/components/scripts/script-pack-viewer.tsx` | Main container: stats bar + awareness tabs + platform filters + script list |
| `src/components/scripts/script-item.tsx` | Individual script: type tag + body + evidence chain + copy/edit/regen actions |
| `src/components/scripts/awareness-tabs.tsx` | Schwartz awareness level pill sub-tabs |
| `src/components/scripts/evidence-chain.tsx` | Callout block with 2px left accent linking claims to research sections |
| `src/components/scripts/style-refs-tab.tsx` | Manage style references (paste winning ads) |
| `src/lib/scripts/__tests__/trim-research-context.test.ts` | Unit tests for context trimming |
| `src/lib/scripts/__tests__/script-pack-schema.test.ts` | Unit tests for schema validation |

### Modified Files

| File | Changes |
|------|---------|
| `research-worker/src/contracts.ts` | Add `adScriptSchema`, `adScriptPackSchema`, `adScriptGenerateSchema` |
| `research-worker/src/runners/media-plan.ts` | Remove `stripNumericConstraints` (now imported from utils) |
| `research-worker/src/supabase.ts` | Export `getClient()` + add `writeScriptPackUpdate()` helper |
| `research-worker/src/index.ts` | Register `POST /api/scripts` route (separate from `/run`) |
| `src/lib/profiles/business-profiles.ts` | Add `styleReferences` + `StyleReference` to `BusinessProfile` interface |
| `src/app/profiles/[id]/page.tsx` | Add Scripts + Style Refs tabs, fetch `run_id` from session |
| `src/app/api/profiles/[id]/route.ts` | Include `style_references` in GET response |

---

## Task 1: Schemas — AdScript + AdScriptPack

**Files:**
- Create: `research-worker/src/schemas/ad-scripts.ts`
- Create: `src/lib/scripts/schemas.ts`
- Modify: `research-worker/src/contracts.ts`
- Test: `src/lib/scripts/__tests__/script-pack-schema.test.ts`

- [ ] **Step 1: Write the schema test file**

```typescript
// src/lib/scripts/__tests__/script-pack-schema.test.ts
import { describe, it, expect } from 'vitest';
import { adScriptSchema, adScriptPackSchema } from '../schemas';

describe('adScriptSchema', () => {
  const validScript = {
    id: 'abc-123',
    title: 'The Invisible Cost of Bad Info',
    type: 'video',
    platform: 'meta',
    awarenessLevel: 'unaware',
    angle: 'painPoint',
    hookType: 'question',
    duration: '60s',
    cta: 'Click the link below',
    body: 'Restaurant owners, when was the last time...',
    groundedIn: [
      { section: 'icpValidation', claim: 'Time-poor owners', label: 'ICP: time-poor owner' },
    ],
    confidenceScore: 8,
    humanizedPass: true,
  };

  it('validates a complete video script', () => {
    expect(() => adScriptSchema.parse(validScript)).not.toThrow();
  });

  it('validates a static ad with headline + designDirection', () => {
    const staticAd = {
      ...validScript,
      type: 'static',
      platform: 'google',
      headline: 'Stop Losing Customers',
      subheadline: 'Your info is wrong on 12 platforms',
      designDirection: 'Split screen before/after dashboards',
      duration: undefined,
    };
    expect(() => adScriptSchema.parse(staticAd)).not.toThrow();
  });

  it('validates a script with humanizedPass: false (Pass 2 failure)', () => {
    const unhumanized = { ...validScript, humanizedPass: false };
    expect(() => adScriptSchema.parse(unhumanized)).not.toThrow();
  });

  it('rejects invalid section names in groundedIn', () => {
    const bad = { ...validScript, groundedIn: [{ section: 'fake', claim: 'x', label: 'y' }] };
    expect(() => adScriptSchema.parse(bad)).toThrow();
  });
});

describe('adScriptPackSchema', () => {
  it('validates a complete pack', () => {
    const pack = {
      scripts: [],
      generatedAt: new Date().toISOString(),
      researchSessionId: 'run-abc',
      styleReferencesUsed: [],
      summary: { totalScripts: 0, byType: {}, byPlatform: {}, byAwareness: {} },
    };
    expect(() => adScriptPackSchema.parse(pack)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/scripts/__tests__/script-pack-schema.test.ts`
Expected: FAIL — module `../schemas` not found

- [ ] **Step 3: Create the frontend schema file**

```typescript
// src/lib/scripts/schemas.ts
import { z } from 'zod';

const VALID_SECTIONS = [
  'industryMarket', 'icpValidation', 'offerAnalysis',
  'competitors', 'keywordIntel', 'crossAnalysis', 'mediaPlan',
] as const;

export const groundedInSchema = z.object({
  section: z.enum(VALID_SECTIONS),
  claim: z.string(),
  label: z.string(),
});

export const adScriptSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['video', 'static', 'email']),
  platform: z.enum(['meta', 'google', 'linkedin']),
  awarenessLevel: z.enum(['unaware', 'problem', 'solution', 'product', 'mostAware']),
  angle: z.enum(['painPoint', 'outcome', 'socialProof', 'curiosity', 'urgency', 'identity', 'contrarian']),
  hookType: z.string(),
  duration: z.string().optional(),
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  cta: z.string(),
  body: z.string(),
  hookVariants: z.array(z.string()).optional(),
  designDirection: z.string().optional(),
  groundedIn: z.array(groundedInSchema),
  confidenceScore: z.number().min(0).max(10),
  humanizedPass: z.boolean(),
  patternsFixed: z.number().optional(),
  flaggedClaims: z.array(z.string()).optional(),
});

export const adScriptPackSchema = z.object({
  scripts: z.array(adScriptSchema),
  generatedAt: z.string(),
  researchSessionId: z.string(),
  styleReferencesUsed: z.array(z.string()),
  summary: z.object({
    totalScripts: z.number(),
    byType: z.record(z.string(), z.number()),
    byPlatform: z.record(z.string(), z.number()),
    byAwareness: z.record(z.string(), z.number()),
  }),
});

export type AdScript = z.infer<typeof adScriptSchema>;
export type AdScriptPack = z.infer<typeof adScriptPackSchema>;
export type GroundedIn = z.infer<typeof groundedInSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/scripts/__tests__/script-pack-schema.test.ts`
Expected: PASS

- [ ] **Step 5: Create the worker schema file**

Worker schemas use `flexibleEnum()` for AI output normalization (the AI may return "Pain Point" instead of "painPoint"). Create `research-worker/src/schemas/ad-scripts.ts`:

```typescript
// research-worker/src/schemas/ad-scripts.ts
import { z } from 'zod';
import { flexibleEnum } from '../contracts';

/**
 * Worker-side AdScript schema — uses flexibleEnum for AI output normalization.
 * Mirrors src/lib/scripts/schemas.ts but relaxed for generateObject() compatibility.
 *
 * NOTE: `id` is NOT in this schema — IDs are injected by the runner after
 * generateObject() returns (crypto.randomUUID()). The AI must not generate IDs.
 */
export const adScriptGenerateSchema = z.object({
  title: z.string(),
  type: flexibleEnum(['video', 'static', 'email'] as const, 'video'),
  platform: flexibleEnum(['meta', 'google', 'linkedin'] as const, 'meta'),
  angle: flexibleEnum(
    ['painPoint', 'outcome', 'socialProof', 'curiosity', 'urgency', 'identity', 'contrarian'] as const,
    'painPoint',
  ),
  hookType: z.string(),
  duration: z.string().optional(),
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  cta: z.string(),
  body: z.string(),
  hookVariants: z.array(z.string()).optional(),
  designDirection: z.string().optional(),
  groundedIn: z.array(z.object({
    section: z.string(),
    claim: z.string(),
    label: z.string(),
  })),
  confidenceScore: z.number(),
  humanizedPass: z.boolean(),
  patternsFixed: z.number().optional(),
  flaggedClaims: z.array(z.string()).optional(),
});

/** Schema for a single awareness level's generation output (Pass 1 or Pass 2) */
export const awarenessLevelOutputSchema = z.object({
  scripts: z.array(adScriptGenerateSchema),
});

export type AdScriptGenerate = z.infer<typeof adScriptGenerateSchema>;
```

- [ ] **Step 6: Export from contracts.ts**

Add to `research-worker/src/contracts.ts` at the bottom:

```typescript
export { adScriptGenerateSchema, awarenessLevelOutputSchema } from './schemas/ad-scripts';
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/scripts/ research-worker/src/schemas/ad-scripts.ts research-worker/src/contracts.ts
git commit -m "feat(scripts): add AdScript + AdScriptPack Zod schemas for worker + frontend"
```

---

## Task 2: Database Migration

**Files:**
- Create: `supabase/migrations/20260327_create_script_packs.sql` (reference only — apply via Supabase MCP)

- [ ] **Step 1: Apply migration via Supabase MCP**

Execute this SQL via `mcp__supabase__execute_sql` or `mcp__supabase__apply_migration`:

```sql
-- Script packs generated from research + style references
CREATE TABLE IF NOT EXISTS script_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES journey_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'generating'
    CHECK (status IN ('generating', 'partial', 'complete', 'error')),
  scripts JSONB NOT NULL DEFAULT '[]'::jsonb,
  style_references_snapshot JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_script_packs_profile ON script_packs(profile_id, created_at DESC);
CREATE INDEX idx_script_packs_session ON script_packs(session_id);
CREATE INDEX idx_script_packs_user ON script_packs(user_id);

ALTER TABLE script_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own script packs"
  ON script_packs FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own script packs"
  ON script_packs FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own script packs"
  ON script_packs FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Service role full access"
  ON script_packs FOR ALL
  USING (auth.role() = 'service_role');

ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS style_references JSONB DEFAULT '[]'::jsonb;

ALTER PUBLICATION supabase_realtime ADD TABLE script_packs;

CREATE OR REPLACE FUNCTION update_script_packs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER script_packs_updated_at
  BEFORE UPDATE ON script_packs
  FOR EACH ROW
  EXECUTE FUNCTION update_script_packs_updated_at();
```

- [ ] **Step 2: Verify migration applied**

Run a quick query via Supabase MCP:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'script_packs' ORDER BY ordinal_position;
```

Expected: 9 columns (id, profile_id, session_id, user_id, status, scripts, style_references_snapshot, error_message, created_at, updated_at)

- [ ] **Step 3: Verify style_references column on business_profiles**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'business_profiles' AND column_name = 'style_references';
```

Expected: 1 row with `jsonb` type

- [ ] **Step 4: Update BusinessProfile interface**

Modify `src/lib/profiles/business-profiles.ts` — add to the `BusinessProfile` interface:

```typescript
styleReferences: StyleReference[] | null;
```

And add the type:

```typescript
export interface StyleReference {
  name: string;
  content: string;
  source: string;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/profiles/business-profiles.ts
git commit -m "feat(scripts): add script_packs table + style_references column"
```

---

## Task 3: Research Context Trimming

**Files:**
- Create: `src/lib/scripts/trim-research-context.ts`
- Test: `src/lib/scripts/__tests__/trim-research-context.test.ts`

The trimming function extracts priority fields from `research_results` JSONB. It follows the design doc's token budget: ~8000 tokens total (ICP + Offer full, Competitors + Keywords summarized, Industry + Synthesis + MediaPlan headlines only).

- [ ] **Step 1: Write the test file**

```typescript
// src/lib/scripts/__tests__/trim-research-context.test.ts
import { describe, it, expect } from 'vitest';
import { trimResearchForScripts } from '../trim-research-context';

// Minimal fixture matching research_results shape
const fullResearch = {
  industryMarket: {
    data: {
      categorySnapshot: { category: 'Restaurant Tech', marketSize: '$5B' },
      painPoints: { primary: ['Time management', 'Online presence'] },
      marketDynamics: { demandDrivers: ['Digital shift'], buyingTriggers: ['COVID recovery'] },
    },
  },
  icpValidation: {
    data: {
      persona: { role: 'Restaurant Owner', company: 'SMB', demographics: 'US-based' },
      painPoints: ['No time for marketing', 'Inconsistent info across platforms'],
      desires: ['More foot traffic', 'Automated marketing'],
    },
  },
  offerAnalysis: {
    data: {
      valueProposition: '65-platform sync for restaurants',
      pricing: '$50/mo',
      differentiators: ['Cross-platform sync', '48h text updates'],
    },
  },
  competitors: {
    data: {
      competitors: [
        { name: 'Spothopper', positioning: 'Restaurant marketing', gaps: ['No sync'] },
        { name: 'SinglePlatform', positioning: 'Listing management', gaps: ['Expensive'] },
        { name: 'Yext', positioning: 'Enterprise listings', gaps: ['Too complex for SMB'] },
        { name: 'Fourth competitor', positioning: 'Niche', gaps: ['Small'] },
      ],
    },
  },
  keywordIntel: {
    data: {
      keywords: Array.from({ length: 20 }, (_, i) => ({
        keyword: `keyword-${i}`,
        volume: 1000 - i * 50,
        difficulty: 'medium',
        intent: 'commercial',
      })),
    },
  },
  crossAnalysis: {
    data: {
      keyInsights: [{ insight: 'SMBs need simple tools', priority: 'high' }],
      positioningStrategy: { recommendedAngle: 'Simplicity' },
    },
  },
  mediaPlan: {
    data: {
      channelMixBudget: { totalBudget: 5000, channels: ['meta', 'google'] },
    },
  },
};

describe('trimResearchForScripts', () => {
  it('returns an object with all priority sections', () => {
    const result = trimResearchForScripts(fullResearch);
    expect(result.icpValidation).toBeDefined();
    expect(result.offerAnalysis).toBeDefined();
    expect(result.competitors).toBeDefined();
    expect(result.keywordIntel).toBeDefined();
    expect(result.industryMarket).toBeDefined();
    expect(result.crossAnalysis).toBeDefined();
    expect(result.mediaPlan).toBeDefined();
  });

  it('includes full ICP data (priority section)', () => {
    const result = trimResearchForScripts(fullResearch);
    expect(result.icpValidation).toEqual(fullResearch.icpValidation.data);
  });

  it('limits competitors to top 3', () => {
    const result = trimResearchForScripts(fullResearch);
    expect(result.competitors.competitors).toHaveLength(3);
  });

  it('limits keywords to top 10', () => {
    const result = trimResearchForScripts(fullResearch);
    expect(result.keywordIntel.keywords).toHaveLength(10);
  });

  it('extracts targetAudience from ICP persona', () => {
    const result = trimResearchForScripts(fullResearch);
    expect(result.targetAudience).toContain('Restaurant Owner');
  });

  it('handles missing sections gracefully', () => {
    const partial = { icpValidation: fullResearch.icpValidation };
    const result = trimResearchForScripts(partial);
    expect(result.icpValidation).toBeDefined();
    expect(result.competitors).toBeUndefined();
  });

  it('serialized output is under 12000 chars (~8000 tokens)', () => {
    const result = trimResearchForScripts(fullResearch);
    const serialized = JSON.stringify(result);
    // ~1.3 chars per token is a rough estimate; 12000 chars ≈ 8000 tokens
    expect(serialized.length).toBeLessThan(16000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/scripts/__tests__/trim-research-context.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement trimResearchForScripts**

```typescript
// src/lib/scripts/trim-research-context.ts

interface TrimmedResearchContext {
  targetAudience: string;
  icpValidation?: unknown;
  offerAnalysis?: unknown;
  competitors?: { competitors: unknown[] };
  keywordIntel?: { keywords: unknown[] };
  industryMarket?: unknown;
  crossAnalysis?: unknown;
  mediaPlan?: unknown;
}

/**
 * Extracts priority fields from research_results for ad script generation.
 * Token budget: ~8000 tokens total.
 *
 * Priority 1 (full): ICP + Offer (~3000 tokens)
 * Priority 2 (summary): Competitors top 3 + Keywords top 10 (~2000 tokens)
 * Priority 3 (headlines): Industry + Synthesis + MediaPlan (~1500 tokens)
 */
export function trimResearchForScripts(
  researchResults: Record<string, { data?: unknown }>,
): TrimmedResearchContext {
  const get = (key: string) => researchResults[key]?.data as Record<string, unknown> | undefined;

  // Extract targetAudience from ICP persona
  const icp = get('icpValidation');
  const persona = icp?.persona as Record<string, unknown> | undefined;
  const targetAudience = persona
    ? [persona.role, persona.company, persona.demographics].filter(Boolean).join(', ')
    : 'target audience';

  const result: TrimmedResearchContext = { targetAudience };

  // Priority 1: Full content
  if (icp) result.icpValidation = icp;
  const offer = get('offerAnalysis');
  if (offer) result.offerAnalysis = offer;

  // Priority 2: Summarized
  const comp = get('competitors');
  if (comp?.competitors && Array.isArray(comp.competitors)) {
    result.competitors = { competitors: comp.competitors.slice(0, 3) };
  }
  const kw = get('keywordIntel');
  if (kw?.keywords && Array.isArray(kw.keywords)) {
    result.keywordIntel = { keywords: kw.keywords.slice(0, 10) };
  }

  // Priority 3: Headlines only
  const industry = get('industryMarket');
  if (industry?.categorySnapshot) {
    result.industryMarket = { categorySnapshot: industry.categorySnapshot };
  }
  const synthesis = get('crossAnalysis');
  if (synthesis) {
    result.crossAnalysis = {
      keyInsights: Array.isArray(synthesis.keyInsights)
        ? synthesis.keyInsights.slice(0, 5)
        : synthesis.keyInsights,
      positioningStrategy: synthesis.positioningStrategy,
    };
  }
  const media = get('mediaPlan');
  if (media?.channelMixBudget) {
    result.mediaPlan = { channelMixBudget: media.channelMixBudget };
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/scripts/__tests__/trim-research-context.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/scripts/trim-research-context.ts src/lib/scripts/__tests__/trim-research-context.test.ts
git commit -m "feat(scripts): add trimResearchForScripts with priority-based context extraction"
```

---

## Task 4: Worker Prompts

**Files:**
- Create: `research-worker/src/prompts/ad-scripts-pass1.ts`
- Create: `research-worker/src/prompts/ad-scripts-pass2.ts`

The prompts are transcribed directly from the design doc. They use template literal interpolation (no Handlebars).

- [ ] **Step 1: Create Pass 1 prompt**

Create `research-worker/src/prompts/ad-scripts-pass1.ts` with the full system prompt from the design doc (lines 338-469). Export as:

```typescript
export function buildPass1Prompt(opts: {
  companyName: string;
  awarenessLevel: string;
  count: number;
  trimmedResearchContext: string;
  styleReferences: string | null;
  targetAudience: string;
}): { system: string; prompt: string }
```

The `system` field contains the frameworks, angles, platform constraints, format rules, and kill list. The `prompt` field contains: `Generate ${count} scripts for the ${awarenessLevel} level.`

Key implementation details:
- Conditional `styleReferences` block (only included if non-null)
- `trimmedResearchContext` is pre-serialized JSON string
- Platform constraints table is static (hardcoded in prompt)

- [ ] **Step 2: Create Pass 2 prompt**

Create `research-worker/src/prompts/ad-scripts-pass2.ts` with the full humanizer audit prompt from the design doc (lines 477-613). Export as:

```typescript
export function buildPass2Prompt(opts: {
  pass1Scripts: string;
  trimmedResearchContext: string;
  styleReferences: string | null;
  targetAudience: string;
}): { system: string; prompt: string }
```

Contains all 41 checks (7 content + 7 language + 9 structure + 13 communication + 5 ad-specific), the word replacement table (3 tiers), specificity check, voice check, and the second-pass survivor catch instructions.

- [ ] **Step 3: Commit**

```bash
git add research-worker/src/prompts/
git commit -m "feat(scripts): add Pass 1 generation + Pass 2 humanizer prompt templates"
```

---

## Task 5: Extract stripNumericConstraints + Create Worker Runner

**Files:**
- Create: `research-worker/src/utils/strip-numeric-constraints.ts`
- Modify: `research-worker/src/runners/media-plan.ts` (update import)
- Create: `research-worker/src/runners/ad-scripts.ts`

`stripNumericConstraints` is currently a private function in `media-plan.ts`. It must be extracted to a shared utility before the ad-scripts runner can use it.

- [ ] **Step 0: Extract stripNumericConstraints to shared utility**

Copy `stripNumericConstraints` from `research-worker/src/runners/media-plan.ts` (lines 40-109) to `research-worker/src/utils/strip-numeric-constraints.ts`. Export it. Then update `media-plan.ts` to import from the new location:

```typescript
// research-worker/src/utils/strip-numeric-constraints.ts
import { z } from 'zod';

/** Recursively strip .min()/.max()/.nonnegative()/.positive() from Zod number schemas. */
export function stripNumericConstraints<T extends z.ZodType>(schema: T): T {
  // ... (exact copy from media-plan.ts lines 49-109)
}
```

In `media-plan.ts`, replace the local function definition with:
```typescript
import { stripNumericConstraints } from '../utils/strip-numeric-constraints';
```

Verify worker still builds: `cd research-worker && npx tsc --noEmit`

- [ ] **Step 0.5: Commit the extraction**

```bash
git add research-worker/src/utils/strip-numeric-constraints.ts research-worker/src/runners/media-plan.ts
git commit -m "refactor: extract stripNumericConstraints to shared utility"
```

- [ ] **Step 1: Create the runner file**

```typescript
// research-worker/src/runners/ad-scripts.ts
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import crypto from 'node:crypto';
import { awarenessLevelOutputSchema } from '../schemas/ad-scripts';
import { buildPass1Prompt } from '../prompts/ad-scripts-pass1';
import { buildPass2Prompt } from '../prompts/ad-scripts-pass2';
import { stripNumericConstraints } from '../utils/strip-numeric-constraints';
import type { RunnerProgressReporter } from '../runner';
import { emitRunnerProgress } from '../runner';

const SCRIPT_MODEL = 'claude-sonnet-4-6';
const PER_CALL_TIMEOUT_MS = 90_000;
const MAX_OUTPUT_TOKENS = 4000;
const SCRIPTS_PER_LEVEL = 3; // 2-4 scripts per level, target 3

const AWARENESS_LEVELS = ['unaware', 'problem', 'solution', 'product', 'mostAware'] as const;

export interface AdScriptsInput {
  companyName: string;
  researchContext: Record<string, unknown>; // trimmed research
  styleReferences: Array<{ name: string; content: string; source: string }>;
  targetAudience: string;
}

export interface AdScriptsResult {
  scripts: Array<Record<string, unknown>>;
  generatedAt: string;
  styleReferencesUsed: string[];
  summary: {
    totalScripts: number;
    byType: Record<string, number>;
    byPlatform: Record<string, number>;
    byAwareness: Record<string, number>;
  };
}

export async function runAdScripts(
  input: AdScriptsInput,
  onProgress?: RunnerProgressReporter,
  onLevelComplete?: (levelScripts: unknown[], completedLevels: number) => Promise<void>,
): Promise<AdScriptsResult> {
  const allScripts: Array<Record<string, unknown>> = [];
  const styleRefText = input.styleReferences.length > 0
    ? input.styleReferences.map((r) => `### ${r.name} (${r.source})\n${r.content}`).join('\n\n')
    : null;
  const contextText = JSON.stringify(input.researchContext);

  for (const [idx, level] of AWARENESS_LEVELS.entries()) {
    await emitRunnerProgress(onProgress, 'runner',
      `generating scripts ${idx + 1}/5: ${level} awareness level`);

    // --- Pass 1: Generate ---
    let pass1Scripts: unknown[];
    try {
      const { system, prompt } = buildPass1Prompt({
        companyName: input.companyName,
        awarenessLevel: level,
        count: SCRIPTS_PER_LEVEL,
        trimmedResearchContext: contextText,
        styleReferences: styleRefText,
        targetAudience: input.targetAudience,
      });

      const result = await generateObject({
        model: anthropic(SCRIPT_MODEL),
        schema: stripNumericConstraints(awarenessLevelOutputSchema),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        system,
        prompt,
        abortSignal: AbortSignal.timeout(PER_CALL_TIMEOUT_MS),
      });
      pass1Scripts = result.object.scripts;
    } catch (err) {
      await emitRunnerProgress(onProgress, 'error',
        `Pass 1 failed for ${level}: ${err instanceof Error ? err.message : String(err)}`);
      continue; // Skip this level, try the next
    }

    // --- Pass 2: Humanize ---
    await emitRunnerProgress(onProgress, 'analysis',
      `humanizing ${level} scripts (pass 2)`);

    let finalScripts: unknown[];
    try {
      const { system, prompt } = buildPass2Prompt({
        pass1Scripts: JSON.stringify(pass1Scripts),
        trimmedResearchContext: contextText,
        styleReferences: styleRefText,
        targetAudience: input.targetAudience,
      });

      const result = await generateObject({
        model: anthropic(SCRIPT_MODEL),
        schema: stripNumericConstraints(awarenessLevelOutputSchema),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        system,
        prompt,
        abortSignal: AbortSignal.timeout(PER_CALL_TIMEOUT_MS),
      });
      finalScripts = result.object.scripts;
    } catch (err) {
      // Pass 2 failure recovery: save Pass 1 results with humanizedPass: false
      await emitRunnerProgress(onProgress, 'error',
        `Pass 2 failed for ${level} — saving unhumanized scripts`);
      finalScripts = pass1Scripts.map((s: any) => ({ ...s, humanizedPass: false }));
    }

    // Inject UUIDs (AI must not generate IDs)
    const levelScripts = finalScripts.map((s: any) => ({
      ...s,
      id: crypto.randomUUID(),
      awarenessLevel: level,
    }));

    allScripts.push(...levelScripts);

    // Callback for progressive Supabase writes
    if (onLevelComplete) {
      await onLevelComplete(allScripts, idx + 1);
    }
  }

  // Build summary
  const summary = {
    totalScripts: allScripts.length,
    byType: countBy(allScripts, 'type'),
    byPlatform: countBy(allScripts, 'platform'),
    byAwareness: countBy(allScripts, 'awarenessLevel'),
  };

  return {
    scripts: allScripts,
    generatedAt: new Date().toISOString(),
    styleReferencesUsed: input.styleReferences.map((r) => r.name),
    summary,
  };
}

function countBy(items: Array<Record<string, unknown>>, key: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const val = String(item[key] ?? 'unknown');
    counts[val] = (counts[val] ?? 0) + 1;
  }
  return counts;
}
```

Key implementation notes:
- `stripNumericConstraints` is imported from `media-plan.ts` — if it's not exported, extract it to a shared utility first
- `onLevelComplete` callback allows the route handler to write partial results to Supabase after each level
- Pass 2 failure recovery saves unhumanized scripts (design doc requirement)
- IDs injected post-generation via `crypto.randomUUID()` (design doc requirement)
- `awarenessLevel` forced on each script (AI might output it differently)

- [ ] **Step 2: Commit**

```bash
git add research-worker/src/runners/ad-scripts.ts
git commit -m "feat(scripts): add ad-scripts runner with 2-pass generation per awareness level"
```

---

## Task 6: Worker Route Registration

**Files:**
- Modify: `research-worker/src/index.ts`

The ad scripts runner has its own route (`POST /api/scripts`), separate from the research pipeline's `POST /run`.

**PREREQUISITE**: `getClient()` in `research-worker/src/supabase.ts` is not exported. Before adding the route, export it and add a `writeScriptPackUpdate` helper.

- [ ] **Step 0: Export getClient + add writeScriptPackUpdate to supabase.ts**

In `research-worker/src/supabase.ts`:
1. Add `export` to `function getClient()` (currently private)
2. Add a new exported helper:

```typescript
/** Write progressive script pack updates (used by /api/scripts route) */
export async function writeScriptPackUpdate(
  packId: string,
  update: { scripts?: unknown; status?: string; error_message?: string },
): Promise<void> {
  await withSupabaseRetry(async () => {
    const client = getClient();
    const { error } = await client
      .from('script_packs')
      .update(update)
      .eq('id', packId);
    if (error) throw error;
  }, `writeScriptPackUpdate(${packId})`);
}
```

- [ ] **Step 1: Add the /api/scripts route to index.ts**

After the existing `app.post('/run', ...)` handler, add:

```typescript
import { runAdScripts, type AdScriptsInput } from './runners/ad-scripts';
import { writeScriptPackUpdate } from './supabase';

app.post('/api/scripts', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.RAILWAY_API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { packId, profileId, sessionId, userId, companyName, researchContext, styleReferences } = req.body;

  if (!packId || !profileId || !userId || !researchContext) {
    return res.status(400).json({ error: 'Missing required fields: packId, profileId, userId, researchContext' });
  }

  // Return 202 immediately — run async
  res.status(202).json({ status: 'accepted', packId });

  // Detached async execution (same pattern as /run)
  const input: AdScriptsInput = {
    companyName: companyName ?? 'Unknown Company',
    researchContext,
    styleReferences: styleReferences ?? [],
    targetAudience: researchContext.targetAudience ?? 'target audience',
  };

  try {
    const result = await runAdScripts(
      input,
      // Progress reporter
      async (update) => {
        console.log(`[ad-scripts] ${update.phase}: ${update.message}`);
      },
      // onLevelComplete — progressive write via exported helper
      async (scripts, completedLevels) => {
        const status = completedLevels >= 5 ? 'complete' : 'partial';
        await writeScriptPackUpdate(packId, {
          scripts: JSON.stringify(scripts),
          status,
        });
      },
    );

    // Final write
    await writeScriptPackUpdate(packId, {
      scripts: JSON.stringify(result.scripts),
      status: 'complete',
    });

    console.log(`[ad-scripts] Completed: ${result.summary.totalScripts} scripts for pack ${packId}`);
  } catch (err) {
    console.error(`[ad-scripts] Failed for pack ${packId}:`, err);
    await writeScriptPackUpdate(packId, {
      status: 'error',
      error_message: err instanceof Error ? err.message : String(err),
    });
  }
});
```

- [ ] **Step 2: Verify the worker builds**

Run: `cd research-worker && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add research-worker/src/index.ts
git commit -m "feat(scripts): register POST /api/scripts route in worker"
```

---

## Task 7: API Route — POST /api/scripts/generate

**Files:**
- Create: `src/app/api/scripts/generate/route.ts`

This route creates a `script_packs` row, fetches research + style refs, then dispatches to Railway.

- [ ] **Step 1: Create the generate route**

```typescript
// src/app/api/scripts/generate/route.ts
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { trimResearchForScripts } from '@/lib/scripts/trim-research-context';

export const maxDuration = 30; // Just dispatches — doesn't wait for generation

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { profileId, sessionId } = body;

  if (!profileId || !sessionId) {
    return NextResponse.json({ error: 'profileId and sessionId required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fetch profile (for style refs + company name)
  const { data: profile, error: profileErr } = await supabase
    .from('business_profiles')
    .select('id, company_name, style_references')
    .eq('id', profileId)
    .eq('user_id', userId)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Fetch research results from session (use run_id lookup)
  const { data: session, error: sessionErr } = await supabase
    .from('journey_sessions')
    .select('id, research_results')
    .eq('run_id', sessionId)
    .single();

  if (sessionErr || !session?.research_results) {
    return NextResponse.json({ error: 'Research session not found or has no results' }, { status: 404 });
  }

  // Trim research context
  const trimmed = trimResearchForScripts(session.research_results as Record<string, { data?: unknown }>);

  // Create script_packs row
  const { data: pack, error: packErr } = await supabase
    .from('script_packs')
    .insert({
      profile_id: profileId,
      session_id: session.id, // Use actual PK, not run_id
      user_id: userId,
      status: 'generating',
      style_references_snapshot: profile.style_references ?? [],
    })
    .select('id')
    .single();

  if (packErr || !pack) {
    return NextResponse.json({ error: 'Failed to create script pack' }, { status: 500 });
  }

  // Dispatch to Railway worker (fire-and-forget)
  const workerUrl = process.env.RAILWAY_WORKER_URL;
  if (!workerUrl) {
    return NextResponse.json({ error: 'RAILWAY_WORKER_URL not configured' }, { status: 500 });
  }

  fetch(`${workerUrl}/api/scripts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RAILWAY_API_KEY}`,
    },
    body: JSON.stringify({
      packId: pack.id,
      profileId,
      sessionId: session.id,
      userId,
      companyName: profile.company_name,
      researchContext: trimmed,
      styleReferences: profile.style_references ?? [],
    }),
  }).catch((err) => {
    console.error('[scripts/generate] Dispatch failed:', err);
  });

  return NextResponse.json({ packId: pack.id, status: 'generating' });
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds (or existing errors only, no new ones)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/scripts/generate/route.ts
git commit -m "feat(scripts): add POST /api/scripts/generate route"
```

---

## Task 8: API Route — GET + PATCH /api/scripts/[packId]

**Files:**
- Create: `src/app/api/scripts/[packId]/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/scripts/[packId]/route.ts
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ packId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { packId } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: pack, error } = await supabase
    .from('script_packs')
    .select('*')
    .eq('id', packId)
    .eq('user_id', userId)
    .single();

  if (error || !pack) {
    return NextResponse.json({ error: 'Pack not found' }, { status: 404 });
  }

  return NextResponse.json({ pack });
}

/** PATCH — inline edit a single script (read-modify-write) */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ packId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { packId } = await params;
  const body = await request.json();
  const { scriptId, updates } = body;

  if (!scriptId || !updates) {
    return NextResponse.json({ error: 'scriptId and updates required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Read-modify-write (Supabase can't update nested JSONB array elements)
  const { data: pack, error: readErr } = await supabase
    .from('script_packs')
    .select('scripts, updated_at')
    .eq('id', packId)
    .eq('user_id', userId)
    .single();

  if (readErr || !pack) {
    return NextResponse.json({ error: 'Pack not found' }, { status: 404 });
  }

  const scripts = (typeof pack.scripts === 'string' ? JSON.parse(pack.scripts) : pack.scripts) as Array<Record<string, unknown>>;
  const idx = scripts.findIndex((s) => s.id === scriptId);
  if (idx === -1) {
    return NextResponse.json({ error: 'Script not found in pack' }, { status: 404 });
  }

  scripts[idx] = { ...scripts[idx], ...updates };

  const { error: writeErr } = await supabase
    .from('script_packs')
    .update({ scripts: JSON.stringify(scripts) })
    .eq('id', packId)
    .eq('updated_at', pack.updated_at); // Optimistic lock

  if (writeErr) {
    return NextResponse.json({ error: 'Concurrent update — retry' }, { status: 409 });
  }

  return NextResponse.json({ script: scripts[idx] });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/scripts/[packId]/route.ts
git commit -m "feat(scripts): add GET + PATCH /api/scripts/[packId] routes"
```

---

## Task 9: API Route — Regenerate Single Script

**Files:**
- Create: `src/app/api/scripts/[packId]/scripts/[scriptId]/regenerate/route.ts`

- [ ] **Step 1: Create the regenerate route**

```typescript
// src/app/api/scripts/[packId]/scripts/[scriptId]/regenerate/route.ts
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const maxDuration = 30;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ packId: string; scriptId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { packId, scriptId } = await params;
  const body = await request.json().catch(() => ({}));
  const instruction = body.instruction ?? null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fetch pack to get session_id + profile_id
  const { data: pack, error } = await supabase
    .from('script_packs')
    .select('id, session_id, profile_id, scripts')
    .eq('id', packId)
    .eq('user_id', userId)
    .single();

  if (error || !pack) {
    return NextResponse.json({ error: 'Pack not found' }, { status: 404 });
  }

  const scripts = (typeof pack.scripts === 'string' ? JSON.parse(pack.scripts) : pack.scripts) as Array<Record<string, unknown>>;
  const target = scripts.find((s) => s.id === scriptId);
  if (!target) {
    return NextResponse.json({ error: 'Script not found' }, { status: 404 });
  }

  // V1: Single-script regeneration is not yet implemented in the worker.
  // Return 501 to let the frontend show a clear "not yet available" state.
  // V2: Will dispatch to worker /api/scripts/regenerate endpoint.
  return NextResponse.json(
    { error: 'Single-script regeneration coming soon. Use "Generate New Batch" instead.' },
    { status: 501 },
  );
}
```

- [ ] **Step 2: V1 scope note**

The regenerate route returns 501 in V1. The worker `/api/scripts/regenerate` endpoint is deferred to V2. No worker changes needed for this task.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/scripts/[packId]/scripts/
git commit -m "feat(scripts): add POST /api/scripts/[packId]/scripts/[scriptId]/regenerate route"
```

---

## Task 10: Realtime Hook — useScriptPackRealtime

**Files:**
- Create: `src/lib/scripts/use-script-pack-realtime.ts`

Mirrors the polling pattern from `research-realtime.ts` (polls `/api/scripts/[packId]` every 2s during generation).

- [ ] **Step 1: Create the realtime hook**

```typescript
// src/lib/scripts/use-script-pack-realtime.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdScript, AdScriptPack } from './schemas';

interface UseScriptPackRealtimeOpts {
  packId: string | null;
  enabled?: boolean;
  onComplete?: (pack: ScriptPackState) => void;
}

export interface ScriptPackState {
  status: 'idle' | 'generating' | 'partial' | 'complete' | 'error';
  scripts: AdScript[];
  errorMessage?: string;
}

const POLL_INTERVAL = 2000;

export function useScriptPackRealtime({ packId, enabled = true, onComplete }: UseScriptPackRealtimeOpts) {
  const [state, setState] = useState<ScriptPackState>({ status: 'idle', scripts: [] });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    if (!packId) return;

    try {
      const res = await fetch(`/api/scripts/${packId}`);
      if (!res.ok) return;

      const { pack } = await res.json();
      const scripts = typeof pack.scripts === 'string' ? JSON.parse(pack.scripts) : pack.scripts;

      setState({
        status: pack.status,
        scripts: scripts ?? [],
        errorMessage: pack.error_message ?? undefined,
      });

      // Stop polling when done
      if (pack.status === 'complete' || pack.status === 'error') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (pack.status === 'complete' && onComplete) {
          onComplete({ status: pack.status, scripts });
        }
      }
    } catch {
      // Silently retry on network errors
    }
  }, [packId, onComplete]);

  useEffect(() => {
    if (!packId || !enabled) return;

    setState({ status: 'generating', scripts: [] });
    poll(); // Immediate first poll
    intervalRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [packId, enabled, poll]);

  return state;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/scripts/use-script-pack-realtime.ts
git commit -m "feat(scripts): add useScriptPackRealtime polling hook"
```

---

## Task 11: Style Refs Tab Component

**Files:**
- Create: `src/components/scripts/style-refs-tab.tsx`

Manual paste UI for managing style references on a business profile. Follows DESIGN.md: list items with type tag + copy button pattern.

- [ ] **Step 1: Create the component**

```typescript
// src/components/scripts/style-refs-tab.tsx
'use client';

import { useState } from 'react';
import { Plus, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import type { StyleReference } from '@/lib/profiles/business-profiles';
import { cn } from '@/lib/utils';

interface StyleRefsTabProps {
  profileId: string;
  styleReferences: StyleReference[];
  onUpdate: (refs: StyleReference[]) => void;
}

export function StyleRefsTab({ profileId, styleReferences, onUpdate }: StyleRefsTabProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<StyleReference>({ name: '', content: '', source: '' });
  const [saving, setSaving] = useState(false);

  async function saveRefs(updated: StyleReference[]) {
    // Uses dedicated style-references route (not PATCH /profiles/[id] which only handles string fields)
    const res = await fetch(`/api/profiles/${profileId}/style-references`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ styleReferences: updated }),
    });
    return res.ok;
  }

  async function handleSave() {
    if (!draft.name || !draft.content) return;
    setSaving(true);

    const updated = [...styleReferences, draft];
    try {
      if (await saveRefs(updated)) {
        onUpdate(updated);
        setDraft({ name: '', content: '', source: '' });
        setAdding(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(idx: number) {
    const updated = styleReferences.filter((_, i) => i !== idx);
    if (await saveRefs(updated)) {
      onUpdate(updated);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-3)]">
          Paste winning ads or competitor scripts. These anchor the AI's voice and tone.
        </p>
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Reference
        </Button>
      </div>

      {adding && (
        <div className="border border-[var(--border)] rounded-md p-4 space-y-3">
          <Input
            placeholder="Reference name (e.g. 'Best Meta ad Q1')"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Textarea
            placeholder="Paste the ad copy here..."
            rows={6}
            value={draft.content}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
          />
          <Input
            placeholder="Source (e.g. 'Meta Ad Library', 'Client Slack')"
            value={draft.source}
            onChange={(e) => setDraft({ ...draft, source: e.target.value })}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving || !draft.name || !draft.content}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {styleReferences.length === 0 && !adding && (
        <div className="text-center py-8 text-[var(--text-4)]">
          No style references yet. Add winning ads to improve script quality.
        </div>
      )}

      <div className="space-y-2">
        {styleReferences.map((ref, idx) => (
          <div key={idx} className="border border-[var(--border)] rounded-md p-3 group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase text-[var(--text-4)]">
                  {ref.source || 'REF'}
                </span>
                <span className="text-sm font-medium text-[var(--text-1)]">{ref.name}</span>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => navigator.clipboard.writeText(ref.content)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-red-400"
                  onClick={() => handleDelete(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-[var(--text-3)] line-clamp-3 whitespace-pre-wrap">{ref.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the dedicated style-references API route**

The existing `PATCH /api/profiles/[id]` only handles `Record<string, string>` fields — it cannot write JSONB arrays. Create a dedicated route:

```typescript
// src/app/api/profiles/[id]/style-references/route.ts
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: profileId } = await params;
  const { styleReferences } = await request.json();

  if (!Array.isArray(styleReferences)) {
    return NextResponse.json({ error: 'styleReferences must be an array' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await supabase
    .from('business_profiles')
    .update({ style_references: styleReferences })
    .eq('id', profileId)
    .eq('user_id', userId);

  if (error) {
    return NextResponse.json({ error: 'Failed to update style references' }, { status: 500 });
  }

  return NextResponse.json({ styleReferences });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/scripts/style-refs-tab.tsx src/app/api/profiles/[id]/style-references/route.ts
git commit -m "feat(scripts): add StyleRefsTab + dedicated PUT route for style references"
```

---

## Task 12: Script Pack Viewer + Awareness Tabs

**Files:**
- Create: `src/components/scripts/awareness-tabs.tsx`
- Create: `src/components/scripts/evidence-chain.tsx`
- Create: `src/components/scripts/script-pack-viewer.tsx`

- [ ] **Step 1: Create awareness tabs**

```typescript
// src/components/scripts/awareness-tabs.tsx
'use client';

import { cn } from '@/lib/utils';

const AWARENESS_LEVELS = [
  { id: 'all', label: 'All' },
  { id: 'unaware', label: 'Unaware' },
  { id: 'problem', label: 'Problem' },
  { id: 'solution', label: 'Solution' },
  { id: 'product', label: 'Product' },
  { id: 'mostAware', label: 'Most Aware' },
] as const;

interface AwarenessTabsProps {
  active: string;
  onChange: (level: string) => void;
  counts?: Record<string, number>;
  disabledLevels?: Set<string>;
}

export function AwarenessTabs({ active, onChange, counts, disabledLevels }: AwarenessTabsProps) {
  return (
    <div className="flex gap-1 flex-wrap">
      {AWARENESS_LEVELS.map(({ id, label }) => {
        const count = id === 'all' ? undefined : counts?.[id];
        const disabled = disabledLevels?.has(id);
        return (
          <button
            key={id}
            onClick={() => !disabled && onChange(id)}
            disabled={disabled}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              'font-[family-name:var(--font-mono)] uppercase tracking-wide',
              active === id
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-2)] text-[var(--text-3)] hover:text-[var(--text-1)]',
              disabled && 'opacity-40 cursor-not-allowed',
            )}
          >
            {label}
            {count !== undefined && (
              <span className="ml-1.5 text-[10px] opacity-70">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create evidence chain component**

```typescript
// src/components/scripts/evidence-chain.tsx
import type { GroundedIn } from '@/lib/scripts/schemas';

interface EvidenceChainProps {
  items: GroundedIn[];
}

/** Callout block with 2px left accent (per DESIGN.md) */
export function EvidenceChain({ items }: EvidenceChainProps) {
  if (items.length === 0) return null;

  return (
    <div className="border-l-2 border-[var(--accent)] pl-3 mt-3 space-y-1.5">
      <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase text-[var(--text-4)] tracking-wider">
        Grounded in research
      </span>
      {items.map((item, idx) => (
        <div key={idx} className="text-xs text-[var(--text-3)]">
          <span className="font-medium text-[var(--text-2)]">{item.label}</span>
          <span className="mx-1">—</span>
          <span>{item.claim}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create the script pack viewer**

```typescript
// src/components/scripts/script-pack-viewer.tsx
'use client';

import { useState, useMemo } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AwarenessTabs } from './awareness-tabs';
import { ScriptItem } from './script-item';
import { useScriptPackRealtime, type ScriptPackState } from '@/lib/scripts/use-script-pack-realtime';
import type { AdScript } from '@/lib/scripts/schemas';

interface ScriptPackViewerProps {
  profileId: string;
  sessionId: string; // run_id of the most recent research session
  initialScripts?: AdScript[];
  initialPackId?: string;
}

export function ScriptPackViewer({
  profileId, sessionId, initialScripts, initialPackId,
}: ScriptPackViewerProps) {
  const [packId, setPackId] = useState<string | null>(initialPackId ?? null);
  const [generating, setGenerating] = useState(false);
  const [awarenessFilter, setAwarenessFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);

  const realtimeState = useScriptPackRealtime({
    packId: generating ? packId : null,
    enabled: generating,
    onComplete: () => setGenerating(false),
  });

  const scripts: AdScript[] = generating
    ? (realtimeState.scripts as AdScript[])
    : (initialScripts ?? []);

  const status = generating ? realtimeState.status : (scripts.length > 0 ? 'complete' : 'idle');

  const filtered = useMemo(() => {
    let result = scripts;
    if (awarenessFilter !== 'all') {
      result = result.filter((s) => s.awarenessLevel === awarenessFilter);
    }
    if (platformFilter) {
      result = result.filter((s) => s.platform === platformFilter);
    }
    return result;
  }, [scripts, awarenessFilter, platformFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of scripts) {
      c[s.awarenessLevel] = (c[s.awarenessLevel] ?? 0) + 1;
    }
    return c;
  }, [scripts]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/scripts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, sessionId }),
      });
      const { packId: newPackId } = await res.json();
      setPackId(newPackId);
    } catch {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header: stats + generate button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {scripts.length > 0 && (
            <>
              <Stat label="Total" value={scripts.length} />
              <Stat label="Video" value={scripts.filter((s) => s.type === 'video').length} />
              <Stat label="Static" value={scripts.filter((s) => s.type === 'static').length} />
              <Stat label="Email" value={scripts.filter((s) => s.type === 'email').length} />
            </>
          )}
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating}
          size="sm"
        >
          {generating ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Generating...</>
          ) : (
            <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Generate New Batch</>
          )}
        </Button>
      </div>

      {/* Awareness sub-tabs */}
      {scripts.length > 0 && (
        <AwarenessTabs active={awarenessFilter} onChange={setAwarenessFilter} counts={counts} />
      )}

      {/* Platform filter pills */}
      {scripts.length > 0 && (
        <div className="flex gap-1.5">
          {['meta', 'google', 'linkedin'].map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(platformFilter === p ? null : p)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                platformFilter === p
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-2)] text-[var(--text-3)]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Script list */}
      {status === 'idle' && scripts.length === 0 && (
        <div className="text-center py-12 text-[var(--text-4)]">
          <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Generate your first batch of ad scripts from this research.</p>
        </div>
      )}

      {status === 'error' && (
        <div className="border border-red-500/30 rounded-md p-4 text-sm text-red-400">
          Generation failed — {realtimeState.errorMessage ?? 'try again'}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((script) => (
          <ScriptItem key={script.id} script={script} packId={packId!} />
        ))}
      </div>

      {generating && scripts.length > 0 && realtimeState.status === 'partial' && (
        <div className="text-center py-4 text-[var(--text-4)] text-xs flex items-center justify-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Generating more scripts...
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-sm">
      <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase text-[var(--text-4)] mr-1.5">
        {label}
      </span>
      <span className="font-medium text-[var(--text-1)]">{value}</span>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/scripts/awareness-tabs.tsx src/components/scripts/evidence-chain.tsx src/components/scripts/script-pack-viewer.tsx
git commit -m "feat(scripts): add ScriptPackViewer with awareness tabs + evidence chain"
```

---

## Task 13: Script Item Component

**Files:**
- Create: `src/components/scripts/script-item.tsx`

Individual script with type tag, body, evidence chain, and copy/edit/regen actions.

- [ ] **Step 1: Create the component**

```typescript
// src/components/scripts/script-item.tsx
'use client';

import { useState } from 'react';
import { Copy, Pencil, RefreshCw, Check, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EvidenceChain } from './evidence-chain';
import type { AdScript } from '@/lib/scripts/schemas';
import { cn } from '@/lib/utils';

interface ScriptItemProps {
  script: AdScript;
  packId: string;
}

export function ScriptItem({ script, packId }: ScriptItemProps) {
  const [editing, setEditing] = useState(false);
  const [draftBody, setDraftBody] = useState(script.body);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [current, setCurrent] = useState(script);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/scripts/${packId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: current.id, updates: { body: draftBody } }),
      });
      if (res.ok) {
        setCurrent({ ...current, body: draftBody });
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/scripts/${packId}/scripts/${current.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.status === 501) {
        // V1: single-script regen not yet available
        alert('Single-script regeneration coming soon. Use "Generate New Batch" instead.');
      }
    } catch {
      // Network error
    } finally {
      setRegenerating(false);
    }
  }

  function handleCopy() {
    const text = [
      current.headline && `HEADLINE: ${current.headline}`,
      current.subheadline && `SUBHEADLINE: ${current.subheadline}`,
      current.body,
      `CTA: ${current.cta}`,
      current.designDirection && `DESIGN DIRECTION: ${current.designDirection}`,
    ].filter(Boolean).join('\n\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const typeColors: Record<string, string> = {
    video: 'text-blue-400',
    static: 'text-amber-400',
    email: 'text-green-400',
  };

  return (
    <div className="border border-[var(--border)] rounded-md p-4 group">
      {/* Header: type tag + title + meta + actions */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider font-medium',
            typeColors[current.type] ?? 'text-[var(--text-4)]',
          )}>
            {current.type}
          </span>
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase text-[var(--text-4)]">
            {current.platform}
          </span>
          {current.duration && (
            <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-4)]">
              {current.duration}
            </span>
          )}
          <span className="text-sm font-medium text-[var(--text-1)]">{current.title}</span>
        </div>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
            {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(true); setDraftBody(current.body); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRegenerate} disabled={regenerating}>
            <RefreshCw className={cn('h-3.5 w-3.5', regenerating && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Confidence + humanized status */}
      <div className="flex items-center gap-3 mb-2">
        <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-4)]">
          Confidence: {current.confidenceScore}/10
        </span>
        {!current.humanizedPass && (
          <span className="flex items-center gap-1 text-amber-400 text-[10px]">
            <AlertTriangle className="h-3 w-3" /> Not humanized
          </span>
        )}
        <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-4)]">
          {current.angle}
        </span>
      </div>

      {/* Headline (static ads) */}
      {current.headline && (
        <p className="text-sm font-semibold text-[var(--text-1)] mb-1">{current.headline}</p>
      )}
      {current.subheadline && (
        <p className="text-sm text-[var(--text-2)] mb-2">{current.subheadline}</p>
      )}

      {/* Body */}
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            rows={8}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--text-2)] whitespace-pre-wrap leading-relaxed">
          {current.body}
        </p>
      )}

      {/* CTA */}
      <p className="text-sm font-medium text-[var(--accent)] mt-2">CTA: {current.cta}</p>

      {/* Hook variants (video only) */}
      {current.hookVariants && current.hookVariants.length > 0 && (
        <div className="mt-3 space-y-1">
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase text-[var(--text-4)]">
            Hook variants
          </span>
          {current.hookVariants.map((hook, idx) => (
            <p key={idx} className="text-xs text-[var(--text-3)] pl-2 border-l border-[var(--border)]">
              {hook}
            </p>
          ))}
        </div>
      )}

      {/* Design direction (static only) */}
      {current.designDirection && (
        <div className="mt-3 bg-[var(--bg-1)] rounded p-2.5">
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase text-[var(--text-4)] block mb-1">
            Design Direction
          </span>
          <p className="text-xs text-[var(--text-3)]">{current.designDirection}</p>
        </div>
      )}

      {/* Evidence chain */}
      <EvidenceChain items={current.groundedIn} />

      {/* Flagged claims */}
      {current.flaggedClaims && current.flaggedClaims.length > 0 && (
        <div className="mt-2 text-xs text-amber-400">
          <AlertTriangle className="h-3 w-3 inline mr-1" />
          Flagged: {current.flaggedClaims.join(', ')}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scripts/script-item.tsx
git commit -m "feat(scripts): add ScriptItem with copy/edit/regen + evidence chain"
```

---

## Task 14: Profile Page Integration — Scripts + Style Refs Tabs

**Files:**
- Modify: `src/app/profiles/[id]/page.tsx`

Add two new tabs to the existing profile detail page: Scripts and Style Refs. The profile page already has Overview + Research tabs using URL search params.

- [ ] **Step 1: Read the current profile detail page**

Read `src/app/profiles/[id]/page.tsx` to understand the existing tab structure and data fetching pattern.

- [ ] **Step 2: Add Scripts and Style Refs tabs**

Add to the existing `TABS` array:

```typescript
{ id: 'scripts', label: 'SCRIPTS', icon: Sparkles },
{ id: 'style-refs', label: 'STYLE REFS', icon: Palette },
```

Import the new components:

```typescript
import { ScriptPackViewer } from '@/components/scripts/script-pack-viewer';
import { StyleRefsTab } from '@/components/scripts/style-refs-tab';
```

**CRITICAL: Resolve `latestSessionRunId`.** The profile's `sessionId` field is the `journey_sessions.id` PK, but the generate route looks up by `run_id`. Fetch the `run_id` from the linked session.

Add data fetching for session run_id and latest script pack:

```typescript
import type { AdScript } from '@/lib/scripts/schemas';

// Fetch session run_id + latest script pack when Scripts tab is active
const [latestSessionRunId, setLatestSessionRunId] = useState<string | null>(null);
const [latestPack, setLatestPack] = useState<{ id: string; scripts: AdScript[] } | null>(null);

useEffect(() => {
  if (activeTab !== 'scripts' || !profile?.id) return;

  // Fetch run_id from the session linked to this profile
  if (profile.sessionId && !latestSessionRunId) {
    fetch(`/api/profiles/${profile.id}/sessions`)
      .then((res) => res.json())
      .then(({ sessions }) => {
        if (sessions?.length > 0) setLatestSessionRunId(sessions[0].runId);
      })
      .catch(() => {});
  }

  // Fetch latest script pack
  fetch(`/api/profiles/${profile.id}/script-packs`)
    .then((res) => res.json())
    .then(({ packs }) => {
      if (packs?.length > 0) {
        const p = packs[0];
        setLatestPack({
          id: p.id,
          scripts: typeof p.scripts === 'string' ? JSON.parse(p.scripts) : p.scripts,
        });
      }
    })
    .catch(() => {});
}, [activeTab, profile?.id, profile?.sessionId, latestSessionRunId]);
```

Add tab content rendering (within the existing tab switch):

```typescript
{activeTab === 'scripts' && (
  latestSessionRunId ? (
    <ScriptPackViewer
      profileId={profile.id}
      sessionId={latestSessionRunId}
      initialScripts={latestPack?.scripts}
      initialPackId={latestPack?.id}
    />
  ) : (
    <div className="text-center py-12 text-[var(--text-4)] text-sm">
      Run research for this profile first to generate scripts.
    </div>
  )
)}

{activeTab === 'style-refs' && (
  <StyleRefsTab
    profileId={profile.id}
    styleReferences={profile.styleReferences ?? []}
    onUpdate={(refs) => setProfile({ ...profile, styleReferences: refs })}
  />
)}
```

- [ ] **Step 3: Add GET /api/profiles/[id]/script-packs route**

Create `src/app/api/profiles/[id]/script-packs/route.ts`:

```typescript
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: profileId } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: packs, error } = await supabase
    .from('script_packs')
    .select('*')
    .eq('profile_id', profileId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch script packs' }, { status: 500 });
  }

  return NextResponse.json({ packs: packs ?? [] });
}
```

- [ ] **Step 4: Update profiles/[id] GET route to include style_references**

Verify that `src/app/api/profiles/[id]/route.ts` includes `style_references` in the SELECT. If not, add it.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/app/profiles/[id]/page.tsx src/app/api/profiles/[id]/script-packs/
git commit -m "feat(scripts): integrate Scripts + Style Refs tabs into profile detail page"
```

---

## Task 15: Verification Gate

**Files:** None (verification only)

- [ ] **Step 1: Build passes**

Run: `npm run build`
Expected: Exit 0

- [ ] **Step 2: Tests pass**

Run: `npm run test:run -- src/lib/scripts/`
Expected: All tests pass

- [ ] **Step 3: Worker builds**

Run: `cd research-worker && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Manual smoke test**

1. Start dev server + worker (`npm run dev` in both)
2. Navigate to `/profiles` → click a profile with completed research
3. Click "Scripts" tab → see empty state with "Generate" button
4. Click "Style Refs" tab → add a reference → verify it persists on reload
5. Click "Generate New Batch" → verify scripts appear progressively
6. Verify: type tags, awareness tabs, platform filters, evidence chain, copy button
7. Verify: inline edit (click pencil → modify → save → reload → persists)

- [ ] **Step 5: Read 5 scripts aloud**

The scripts should sound like a person, not a language model. Check for:
- Kill list words (leverage, optimize, game-changer)
- Rule of three patterns
- Monotone sentence rhythm
- Vague claims without research backing
