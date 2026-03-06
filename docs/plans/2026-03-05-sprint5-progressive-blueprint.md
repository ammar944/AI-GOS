# Sprint 5: Progressive Blueprint Disclosure

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 30-60K token full blueprint JSON dump in the chat agent system prompt with a 500-token index + on-demand query tools. Model loads only what it needs, when it needs it.

**Architecture:** Three-tier disclosure: (1) Blueprint index tool — 500 token summary of all sections with status/source count. (2) queryBlueprint — load a specific section as condensed 1-2K summary. (3) deepDive — full raw data for a single section. Remove full blueprint JSON from system prompt entirely.

**Tech Stack:** Vercel AI SDK v6, Next.js App Router, Groq Llama 3.3 70B (chat model), Zod

**Depends on:** Sprint 1 (needs tool-result pattern established)

---

## Current State Audit

### The Problem

`src/app/api/chat/agent/route.ts` lines 25-178: `buildSystemPrompt(blueprint)` serializes the entire blueprint via `JSON.stringify(blueprint, null, 2)` and embeds it directly in the system prompt as a markdown code block. This costs 30-60K tokens on every single request — before the user even sends a word.

The fallback path (`buildFallbackSummary()` triggered at >300K chars / ~75K tokens) truncates each section to 8K chars. This is still 40K+ tokens of redundant context on every turn.

### Token Budget Reality

| Component | Current tokens | Target tokens |
|-----------|---------------|---------------|
| System prompt (blueprint JSON) | 30,000–60,000 | 0 |
| System prompt (index) | 0 | ~500 |
| Per queryBlueprint call | 0 | ~1,500 |
| Per deepDive call | 0 | ~5,000 (rare) |
| Net reduction | — | 80–95% |

### Existing Tool Inventory (`src/lib/ai/chat-tools/`)

| File | What it does | Changes needed |
|------|-------------|----------------|
| `search-blueprint.ts` | Keyword + fuzzy search across blueprint | None — already queries on-demand |
| `edit-blueprint.ts` | Propose field edits with approval | None — reads blueprint from closure |
| `explain-blueprint.ts` | Returns full section data for "why" questions | Superseded by `queryBlueprint`; keep for now |
| `deep-research.ts` | Multi-angle web research | None |
| `web-research.ts` | Single-query web search | None |
| `generate-section.ts` | Full section rewrite with approval | None — reads blueprint from closure |
| `compare-competitors.ts` | Competitive table from blueprint | None — reads blueprint from closure |
| `analyze-metrics.ts` | Score section across 5 dimensions | None — reads blueprint from closure |
| `create-visualization.ts` | Chart generation from blueprint data | None — reads blueprint from closure |
| `index.ts` | Factory: `createChatTools(blueprintId, blueprint)` | Add `queryBlueprint`, `deepDive` |
| `utils.ts` | Shared helpers, `SECTION_LABELS`, `summarizeBlueprint` | Used by new tools |
| `types.ts` | `BlueprintSection` enum and all tool result types | Add new result types |

### Key Constraint

The blueprint arrives in the request body on every POST. All tools receive it as a closure parameter in `createChatTools()`. No Supabase fetch is needed for tool execution — blueprint is already in memory. `queryBlueprint` and `deepDive` are pure in-memory operations: zero latency, zero API calls.

---

## Task Breakdown

### Task 1 — Create `blueprint-index.ts`

**New file:** `src/lib/ai/chat-tools/blueprint-index.ts`

**Purpose:** Pure function that takes the blueprint and returns a compact index (~500 tokens). This replaces the JSON dump in the system prompt. Also produces the `BlueprintIndex` type used by `queryBlueprint` and `deepDive`.

**Types:**

```typescript
export interface SectionSummary {
  key: string;            // e.g. "industryMarketOverview"
  label: string;          // e.g. "Industry & Market"
  status: 'complete' | 'partial' | 'empty';
  fieldCount: number;     // number of non-null leaf fields
  sourceCount: number;    // number of top-level keys in the section
  tokenEstimate: number;  // rough token count (chars / 4)
}

export interface BlueprintIndex {
  sections: SectionSummary[];
  totalSections: number;
  completedSections: number;
  partialSections: number;
  emptySections: number;
  lastUpdated: string;    // ISO timestamp — use Date.now() if not in blueprint
}
```

**Implementation notes:**

- `fieldCount`: recursively count all leaf values (strings, numbers, booleans) that are non-null and non-empty-string
- `sourceCount`: `Object.keys(sectionData).length` for top-level keys
- `tokenEstimate`: `Math.ceil(JSON.stringify(sectionData).length / 4)`
- `status`:
  - `'empty'` if section missing or `fieldCount === 0`
  - `'partial'` if `fieldCount < 10` (heuristic — has some data but not complete)
  - `'complete'` if `fieldCount >= 10`
- Serialize the output compactly with `JSON.stringify(index)` for system prompt injection — must stay under 600 tokens (~2400 chars)

**Full implementation:**

```typescript
// src/lib/ai/chat-tools/blueprint-index.ts

import { SECTION_LABELS } from './utils';

export interface SectionSummary {
  key: string;
  label: string;
  status: 'complete' | 'partial' | 'empty';
  fieldCount: number;
  sourceCount: number;
  tokenEstimate: number;
}

export interface BlueprintIndex {
  sections: SectionSummary[];
  totalSections: number;
  completedSections: number;
  partialSections: number;
  emptySections: number;
  lastUpdated: string;
}

/**
 * Recursively count all non-null, non-empty leaf values in an object.
 */
function countLeafFields(obj: unknown): number {
  if (obj === null || obj === undefined) return 0;
  if (typeof obj === 'string') return obj.trim().length > 0 ? 1 : 0;
  if (typeof obj === 'number' || typeof obj === 'boolean') return 1;
  if (Array.isArray(obj)) {
    return obj.reduce((sum, item) => sum + countLeafFields(item), 0);
  }
  if (typeof obj === 'object') {
    return Object.values(obj as Record<string, unknown>).reduce(
      (sum, val) => sum + countLeafFields(val),
      0
    );
  }
  return 0;
}

/**
 * Build a compact index of all blueprint sections.
 * Output is ~500 tokens — safe to embed directly in system prompt.
 */
export function buildBlueprintIndex(blueprint: Record<string, unknown>): BlueprintIndex {
  const knownSections = Object.keys(SECTION_LABELS);
  const sections: SectionSummary[] = [];

  for (const key of knownSections) {
    const sectionData = blueprint[key];
    const label = SECTION_LABELS[key] || key;

    if (!sectionData || typeof sectionData !== 'object') {
      sections.push({
        key,
        label,
        status: 'empty',
        fieldCount: 0,
        sourceCount: 0,
        tokenEstimate: 0,
      });
      continue;
    }

    const fieldCount = countLeafFields(sectionData);
    const sourceCount = Object.keys(sectionData as Record<string, unknown>).length;
    const tokenEstimate = Math.ceil(JSON.stringify(sectionData).length / 4);

    let status: 'complete' | 'partial' | 'empty';
    if (fieldCount === 0) {
      status = 'empty';
    } else if (fieldCount < 10) {
      status = 'partial';
    } else {
      status = 'complete';
    }

    sections.push({ key, label, status, fieldCount, sourceCount, tokenEstimate });
  }

  const completedSections = sections.filter(s => s.status === 'complete').length;
  const partialSections = sections.filter(s => s.status === 'partial').length;
  const emptySections = sections.filter(s => s.status === 'empty').length;

  return {
    sections,
    totalSections: sections.length,
    completedSections,
    partialSections,
    emptySections,
    lastUpdated: new Date().toISOString(),
  };
}
```

**Test file:** `src/lib/ai/chat-tools/__tests__/blueprint-index.test.ts`

```typescript
// src/lib/ai/chat-tools/__tests__/blueprint-index.test.ts

import { describe, it, expect } from 'vitest';
import { buildBlueprintIndex } from '../blueprint-index';

const makeSection = (fields: Record<string, unknown>) => fields;

const fullBlueprint = {
  industryMarketOverview: makeSection({
    categorySnapshot: { category: 'AI Software', marketSize: '$5B' },
    painPoints: { primary: ['pain1', 'pain2', 'pain3'], secondary: ['s1', 's2'] },
    psychologicalDrivers: ['driver1', 'driver2'],
    demandSignals: 'High demand',
    buyingTriggers: ['trigger1'],
    messagingOpportunities: { opportunities: ['opp1', 'opp2', 'opp3'] },
  }),
  icpAnalysisValidation: makeSection({
    finalVerdict: { status: 'proceed', reasoning: 'Strong ICP signal' },
    psychographics: { goals: ['g1'], fears: ['f1'], dayInLife: 'busy exec' },
    painSolutionFit: 'Strong',
    riskAssessment: 'Low',
    reachabilityScore: 8,
  }),
  offerAnalysisViability: makeSection({
    offerStrength: { overallScore: 8.5, painRelevance: 9, urgency: 7 },
    recommendation: { status: 'go' },
    redFlags: [],
  }),
  competitorAnalysis: makeSection({
    competitors: [
      { name: 'CompA', positioning: 'cheap', strengths: ['s1'], weaknesses: ['w1'] },
      { name: 'CompB', positioning: 'premium' },
    ],
    gapsAndOpportunities: { messagingOpportunities: ['gap1', 'gap2'] },
  }),
  crossAnalysisSynthesis: makeSection({
    recommendedPositioning: 'Market leader for SMBs',
    primaryMessagingAngles: ['angle1', 'angle2'],
    adHooks: ['hook1', 'hook2', 'hook3'],
    platformRecommendations: ['Google', 'Meta'],
    nextSteps: ['step1', 'step2'],
  }),
};

describe('buildBlueprintIndex', () => {
  it('returns an index with all 5 known sections', () => {
    const index = buildBlueprintIndex(fullBlueprint);
    expect(index.sections).toHaveLength(5);
    expect(index.totalSections).toBe(5);
  });

  it('marks sections with >=10 leaf fields as complete', () => {
    const index = buildBlueprintIndex(fullBlueprint);
    const industry = index.sections.find(s => s.key === 'industryMarketOverview');
    expect(industry?.status).toBe('complete');
  });

  it('marks missing sections as empty', () => {
    const index = buildBlueprintIndex({});
    expect(index.sections.every(s => s.status === 'empty')).toBe(true);
    expect(index.emptySections).toBe(5);
    expect(index.completedSections).toBe(0);
  });

  it('marks sections with <10 leaf fields as partial', () => {
    const partialBlueprint = {
      industryMarketOverview: { categorySnapshot: { category: 'AI' } }, // 1 leaf
    };
    const index = buildBlueprintIndex(partialBlueprint);
    const industry = index.sections.find(s => s.key === 'industryMarketOverview');
    expect(industry?.status).toBe('partial');
  });

  it('computes correct fieldCount for nested structures', () => {
    const index = buildBlueprintIndex({
      industryMarketOverview: {
        painPoints: { primary: ['a', 'b', 'c'] }, // 3 leaves
        category: 'SaaS',                          // 1 leaf
      },
    });
    const industry = index.sections.find(s => s.key === 'industryMarketOverview');
    expect(industry?.fieldCount).toBe(4);
  });

  it('serializes to under 2400 chars (600 tokens)', () => {
    const index = buildBlueprintIndex(fullBlueprint);
    const serialized = JSON.stringify(index);
    expect(serialized.length).toBeLessThan(2400);
  });

  it('includes correct counts for completed/partial/empty', () => {
    const index = buildBlueprintIndex(fullBlueprint);
    expect(index.completedSections + index.partialSections + index.emptySections).toBe(5);
  });

  it('includes a lastUpdated ISO string', () => {
    const index = buildBlueprintIndex(fullBlueprint);
    expect(() => new Date(index.lastUpdated)).not.toThrow();
    expect(index.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
```

**TDD sequence:**
1. Create `__tests__/blueprint-index.test.ts` with failing tests
2. Run `npm run test:run -- src/lib/ai/chat-tools/__tests__/blueprint-index.test.ts` — all fail (module not found)
3. Create `blueprint-index.ts` with the implementation
4. Run tests again — all pass
5. Commit: `feat(chat): add buildBlueprintIndex for 500-token blueprint summary`

---

### Task 2 — Create `query-blueprint.ts`

**New file:** `src/lib/ai/chat-tools/query-blueprint.ts`

**Purpose:** Tool that extracts a specific blueprint section and condenses it to a 1-2K token structured summary. Pure in-memory — no AI call needed. The condensation is deterministic extraction of key data points, not summarization via LLM.

**Why no LLM for condensation:** Latency is the bottleneck. A Haiku call adds 1-2s per query. In-memory extraction is instant. The model can always escalate to `deepDive` if it needs the full section.

**Input schema:**

```typescript
z.object({
  section: z.enum([
    'industryMarketOverview',
    'icpAnalysisValidation',
    'offerAnalysisViability',
    'competitorAnalysis',
    'crossAnalysisSynthesis',
  ]).describe('The blueprint section to load'),
  aspect: z.string().optional().describe(
    'Optional: specific aspect to focus on within the section ' +
    '(e.g., "pain points", "offer scores", "ad hooks", "competitor weaknesses")'
  ),
})
```

**Output:** Structured condensed summary — each section has its own extraction logic to return only the most decision-relevant fields. Max ~6000 chars (~1500 tokens) per call.

**Section-specific condensation logic:**

- `industryMarketOverview`: category, market size, top-3 pain points (primary + secondary), psychological drivers, messaging opportunities, buying triggers
- `icpAnalysisValidation`: final verdict + reasoning, top-3 psychographic goals/fears, pain-solution fit, reachability score, risk level
- `offerAnalysisViability`: overall score, all 6 dimension scores, recommendation status, top-3 red flags
- `competitorAnalysis`: all competitor names + positioning + top-2 weaknesses + ad hooks they run, top-3 messaging gaps
- `crossAnalysisSynthesis`: recommended positioning, all messaging angles, all ad hooks, platform recommendations, next steps

**Full implementation:**

```typescript
// src/lib/ai/chat-tools/query-blueprint.ts

import { z } from 'zod';
import { tool } from 'ai';
import { SECTION_LABELS } from './utils';

const SECTION_KEYS = [
  'industryMarketOverview',
  'icpAnalysisValidation',
  'offerAnalysisViability',
  'competitorAnalysis',
  'crossAnalysisSynthesis',
] as const;

type SectionKey = typeof SECTION_KEYS[number];

/**
 * Condense industryMarketOverview to key decision points.
 */
function condenseIndustryMarket(data: Record<string, unknown>): Record<string, unknown> {
  const painPoints = data.painPoints as { primary?: string[]; secondary?: string[] } | undefined;
  const categorySnapshot = data.categorySnapshot as Record<string, unknown> | undefined;
  const messagingOps = data.messagingOpportunities as { opportunities?: string[] } | undefined;

  return {
    category: categorySnapshot?.category,
    marketSize: categorySnapshot?.marketSize,
    primaryPainPoints: painPoints?.primary?.slice(0, 5),
    secondaryPainPoints: painPoints?.secondary?.slice(0, 3),
    psychologicalDrivers: (data.psychologicalDrivers as string[] | undefined)?.slice(0, 3),
    buyingTriggers: (data.buyingTriggers as string[] | undefined)?.slice(0, 3),
    demandSignals: data.demandSignals,
    messagingOpportunities: messagingOps?.opportunities?.slice(0, 5),
  };
}

/**
 * Condense icpAnalysisValidation to key decision points.
 */
function condenseICP(data: Record<string, unknown>): Record<string, unknown> {
  const verdict = data.finalVerdict as Record<string, unknown> | undefined;
  const psychographics = data.psychographics as Record<string, unknown> | undefined;

  return {
    verdictStatus: verdict?.status,
    verdictReasoning: verdict?.reasoning,
    icpDescription: data.icpDescription,
    goals: (psychographics?.goals as string[] | undefined)?.slice(0, 3),
    fears: (psychographics?.fears as string[] | undefined)?.slice(0, 3),
    dayInLife: psychographics?.dayInLife,
    painSolutionFit: data.painSolutionFit,
    riskAssessment: data.riskAssessment,
    reachabilityScore: data.reachabilityScore,
    targetingRecommendations: (data.targetingRecommendations as string[] | undefined)?.slice(0, 3),
  };
}

/**
 * Condense offerAnalysisViability to key decision points.
 */
function condenseOffer(data: Record<string, unknown>): Record<string, unknown> {
  const strength = data.offerStrength as Record<string, unknown> | undefined;
  const recommendation = data.recommendation as Record<string, unknown> | undefined;

  return {
    overallScore: strength?.overallScore,
    dimensionScores: strength ? {
      painRelevance: strength.painRelevance,
      urgency: strength.urgency,
      differentiation: strength.differentiation,
      tangibility: strength.tangibility,
      proof: strength.proof,
      pricingLogic: strength.pricingLogic,
    } : undefined,
    recommendationStatus: recommendation?.status,
    recommendationReasoning: recommendation?.reasoning,
    redFlags: (data.redFlags as string[] | undefined)?.slice(0, 5),
    strengths: (data.strengths as string[] | undefined)?.slice(0, 3),
  };
}

/**
 * Condense competitorAnalysis to key decision points.
 */
function condenseCompetitors(data: Record<string, unknown>): Record<string, unknown> {
  const competitors = data.competitors as Array<Record<string, unknown>> | undefined;
  const gaps = data.gapsAndOpportunities as Record<string, unknown> | undefined;

  return {
    competitors: competitors?.map(c => ({
      name: c.name,
      positioning: c.positioning,
      topWeaknesses: (c.weaknesses as string[] | undefined)?.slice(0, 2),
      adHooks: (c.adHooks as string[] | undefined)?.slice(0, 2),
      creativeFormats: (c.creativeFormats as string[] | undefined)?.slice(0, 2),
    })),
    messagingGaps: (gaps?.messagingOpportunities as string[] | undefined)?.slice(0, 5),
    positioningGaps: (gaps?.positioningGaps as string[] | undefined)?.slice(0, 3),
  };
}

/**
 * Condense crossAnalysisSynthesis to key decision points.
 */
function condenseSynthesis(data: Record<string, unknown>): Record<string, unknown> {
  const messagingFramework = data.messagingFramework as Record<string, unknown> | undefined;

  return {
    recommendedPositioning: data.recommendedPositioning,
    primaryMessagingAngles: data.primaryMessagingAngles,
    adHooks: messagingFramework?.adHooks ?? data.adHooks,
    advertisingAngles: messagingFramework?.advertisingAngles ?? data.advertisingAngles,
    proofPoints: (messagingFramework?.proofPoints as string[] | undefined)?.slice(0, 5),
    objectionHandlers: (messagingFramework?.objectionHandlers as string[] | undefined)?.slice(0, 3),
    platformRecommendations: data.platformRecommendations,
    nextSteps: (data.nextSteps as string[] | undefined)?.slice(0, 5),
    keyInsights: (data.keyInsights as string[] | undefined)?.slice(0, 3),
  };
}

const CONDENSERS: Record<SectionKey, (data: Record<string, unknown>) => Record<string, unknown>> = {
  industryMarketOverview: condenseIndustryMarket,
  icpAnalysisValidation: condenseICP,
  offerAnalysisViability: condenseOffer,
  competitorAnalysis: condenseCompetitors,
  crossAnalysisSynthesis: condenseSynthesis,
};

export function createQueryBlueprintTool(blueprint: Record<string, unknown>) {
  return tool({
    description:
      'Load a condensed summary of a specific blueprint section (1-2K tokens). ' +
      'Use this as your PRIMARY way to access blueprint data — call it before answering ' +
      'any question about a section. Much more token-efficient than deepDive. ' +
      'Use the optional aspect parameter to focus the response on what you need.',
    inputSchema: z.object({
      section: z
        .enum(SECTION_KEYS)
        .describe('The blueprint section to load'),
      aspect: z
        .string()
        .optional()
        .describe(
          'Optional: specific aspect to focus on (e.g., "pain points", "offer scores", ' +
          '"ad hooks", "competitor weaknesses", "positioning")'
        ),
    }),
    execute: async ({ section, aspect }) => {
      const sectionData = blueprint[section];
      const label = SECTION_LABELS[section] || section;

      if (!sectionData || typeof sectionData !== 'object') {
        return {
          section,
          label,
          status: 'empty',
          summary: null,
          error: `Section "${section}" has no data in this blueprint.`,
        };
      }

      const condenser = CONDENSERS[section];
      const condensed = condenser(sectionData as Record<string, unknown>);

      // Remove undefined/null values to keep output tight
      const cleaned = Object.fromEntries(
        Object.entries(condensed).filter(([, v]) => v !== undefined && v !== null)
      );

      return {
        section,
        label,
        status: 'loaded',
        aspect: aspect || 'all',
        summary: cleaned,
        tokenEstimate: Math.ceil(JSON.stringify(cleaned).length / 4),
        note: 'This is a condensed summary. Use deepDive if you need complete raw data.',
      };
    },
  });
}
```

**Test file:** `src/lib/ai/chat-tools/__tests__/query-blueprint.test.ts`

```typescript
// src/lib/ai/chat-tools/__tests__/query-blueprint.test.ts

import { describe, it, expect } from 'vitest';
import { createQueryBlueprintTool } from '../query-blueprint';

const fullBlueprint = {
  industryMarketOverview: {
    categorySnapshot: { category: 'AI Software', marketSize: '$5B' },
    painPoints: {
      primary: ['pain1', 'pain2', 'pain3', 'pain4', 'pain5', 'pain6'],
      secondary: ['s1', 's2', 's3', 's4'],
    },
    psychologicalDrivers: ['driver1', 'driver2', 'driver3'],
    demandSignals: 'High demand',
    buyingTriggers: ['trigger1', 'trigger2'],
    messagingOpportunities: { opportunities: ['opp1', 'opp2', 'opp3', 'opp4', 'opp5', 'opp6'] },
  },
  offerAnalysisViability: {
    offerStrength: {
      overallScore: 8.5,
      painRelevance: 9,
      urgency: 7,
      differentiation: 8,
      tangibility: 9,
      proof: 7,
      pricingLogic: 8,
    },
    recommendation: { status: 'go', reasoning: 'Strong offer' },
    redFlags: ['flag1', 'flag2', 'flag3', 'flag4', 'flag5', 'flag6'],
    strengths: ['s1', 's2', 's3', 's4'],
  },
  competitorAnalysis: {
    competitors: [
      {
        name: 'CompA',
        positioning: 'cheap volume',
        weaknesses: ['w1', 'w2', 'w3'],
        adHooks: ['hook1', 'hook2', 'hook3'],
        creativeFormats: ['video', 'image', 'carousel'],
      },
    ],
    gapsAndOpportunities: {
      messagingOpportunities: ['gap1', 'gap2', 'gap3', 'gap4', 'gap5', 'gap6'],
    },
  },
};

describe('createQueryBlueprintTool', () => {
  it('returns condensed industry market section', async () => {
    const queryBlueprint = createQueryBlueprintTool(fullBlueprint);
    const result = await queryBlueprint.execute({ section: 'industryMarketOverview' }, {} as never);
    expect(result.status).toBe('loaded');
    expect(result.summary).toBeDefined();
    // Primary pain points capped at 5
    expect((result.summary as Record<string, unknown>).primaryPainPoints).toHaveLength(5);
    // Messaging opportunities capped at 5
    expect((result.summary as Record<string, unknown>).messagingOpportunities).toHaveLength(5);
  });

  it('returns condensed offer section with all 6 dimension scores', async () => {
    const queryBlueprint = createQueryBlueprintTool(fullBlueprint);
    const result = await queryBlueprint.execute({ section: 'offerAnalysisViability' }, {} as never);
    expect(result.status).toBe('loaded');
    const summary = result.summary as Record<string, unknown>;
    expect(summary.overallScore).toBe(8.5);
    expect(summary.dimensionScores).toBeDefined();
    // Red flags capped at 5
    expect((summary.redFlags as string[]).length).toBeLessThanOrEqual(5);
    // Strengths capped at 3
    expect((summary.strengths as string[]).length).toBeLessThanOrEqual(3);
  });

  it('returns condensed competitor analysis', async () => {
    const queryBlueprint = createQueryBlueprintTool(fullBlueprint);
    const result = await queryBlueprint.execute({ section: 'competitorAnalysis' }, {} as never);
    expect(result.status).toBe('loaded');
    const summary = result.summary as Record<string, unknown>;
    const competitors = summary.competitors as Array<Record<string, unknown>>;
    expect(competitors).toHaveLength(1);
    // Weaknesses capped at 2 per competitor
    expect((competitors[0].topWeaknesses as string[]).length).toBeLessThanOrEqual(2);
    // Ad hooks capped at 2 per competitor
    expect((competitors[0].adHooks as string[]).length).toBeLessThanOrEqual(2);
    // Messaging gaps capped at 5
    expect((summary.messagingGaps as string[]).length).toBeLessThanOrEqual(5);
  });

  it('returns error for missing section', async () => {
    const queryBlueprint = createQueryBlueprintTool({});
    const result = await queryBlueprint.execute(
      { section: 'industryMarketOverview' },
      {} as never
    );
    expect(result.status).toBe('empty');
    expect(result.error).toBeDefined();
    expect(result.summary).toBeNull();
  });

  it('output stays under 6000 chars (1500 tokens)', async () => {
    const queryBlueprint = createQueryBlueprintTool(fullBlueprint);
    const result = await queryBlueprint.execute(
      { section: 'competitorAnalysis' },
      {} as never
    );
    expect(JSON.stringify(result).length).toBeLessThan(6000);
  });

  it('accepts optional aspect parameter without error', async () => {
    const queryBlueprint = createQueryBlueprintTool(fullBlueprint);
    const result = await queryBlueprint.execute(
      { section: 'industryMarketOverview', aspect: 'pain points' },
      {} as never
    );
    expect(result.status).toBe('loaded');
    expect(result.aspect).toBe('pain points');
  });
});
```

**TDD sequence:**
1. Create `__tests__/query-blueprint.test.ts` with failing tests
2. Run tests — fail (module not found)
3. Create `query-blueprint.ts` with implementation
4. Run tests — all pass
5. Commit: `feat(chat): add queryBlueprint tool for on-demand section loading`

---

### Task 3 — Create `deep-dive.ts`

**New file:** `src/lib/ai/chat-tools/deep-dive.ts`

**Purpose:** Escape hatch for full raw section data. Returns the complete uncompressed section JSON. Should be called rarely — only when the model needs granular field-level detail that `queryBlueprint` doesn't surface.

**Use case examples:**
- "Give me every single ad hook with the exact emotional angle for each"
- "I need the complete competitor profile for CompA including all review data"
- "Show me all dimension scores across all sections for a full audit"

**Guard in system prompt:** "Use `deepDive` only when `queryBlueprint` doesn't provide enough detail for the specific task. `deepDive` loads the complete raw section (~5K-15K tokens) — use it sparingly."

**Full implementation:**

```typescript
// src/lib/ai/chat-tools/deep-dive.ts

import { z } from 'zod';
import { tool } from 'ai';
import { SECTION_LABELS } from './utils';

const SECTION_KEYS = [
  'industryMarketOverview',
  'icpAnalysisValidation',
  'offerAnalysisViability',
  'competitorAnalysis',
  'crossAnalysisSynthesis',
] as const;

export function createDeepDiveTool(blueprint: Record<string, unknown>) {
  return tool({
    description:
      'Load the complete raw data for a specific blueprint section. ' +
      'ONLY use this when queryBlueprint does not provide enough detail. ' +
      'This returns the full uncompressed section (~5K-15K tokens) — use sparingly. ' +
      'Prefer queryBlueprint for most tasks.',
    inputSchema: z.object({
      section: z
        .enum(SECTION_KEYS)
        .describe('The blueprint section to load in full'),
      field: z
        .string()
        .optional()
        .describe(
          'Optional: dot-notation path to a specific field within the section. ' +
          'Use this to narrow the response (e.g., "competitors[0]", "messagingFramework.adHooks")'
        ),
    }),
    execute: async ({ section, field }) => {
      const sectionData = blueprint[section];
      const label = SECTION_LABELS[section] || section;

      if (!sectionData || typeof sectionData !== 'object') {
        return {
          section,
          label,
          status: 'empty',
          data: null,
          error: `Section "${section}" has no data in this blueprint.`,
        };
      }

      // If a specific field was requested, navigate to it
      if (field) {
        const parts = field.split('.').flatMap(part => {
          const match = part.match(/^(.+)\[(\d+)\]$/);
          if (match) return [match[1], parseInt(match[2], 10)];
          return [part];
        });

        let current: unknown = sectionData;
        for (const part of parts) {
          if (current === null || current === undefined) break;
          if (typeof part === 'number') {
            if (!Array.isArray(current)) {
              current = undefined;
              break;
            }
            current = current[part];
          } else {
            if (typeof current !== 'object') {
              current = undefined;
              break;
            }
            current = (current as Record<string, unknown>)[part];
          }
        }

        if (current === undefined) {
          return {
            section,
            label,
            field,
            status: 'field-not-found',
            data: null,
            error: `Field "${field}" not found in section "${section}".`,
          };
        }

        return {
          section,
          label,
          field,
          status: 'loaded',
          data: current,
          tokenEstimate: Math.ceil(JSON.stringify(current).length / 4),
        };
      }

      // Return the full section
      const rawJson = JSON.stringify(sectionData, null, 2);
      return {
        section,
        label,
        status: 'loaded',
        data: sectionData,
        tokenEstimate: Math.ceil(rawJson.length / 4),
        warning: rawJson.length > 20000
          ? 'Large section loaded. Consider using queryBlueprint for most queries.'
          : undefined,
      };
    },
  });
}
```

**Test file:** `src/lib/ai/chat-tools/__tests__/deep-dive.test.ts`

```typescript
// src/lib/ai/chat-tools/__tests__/deep-dive.test.ts

import { describe, it, expect } from 'vitest';
import { createDeepDiveTool } from '../deep-dive';

const blueprint = {
  crossAnalysisSynthesis: {
    recommendedPositioning: 'Market leader for SMBs',
    messagingFramework: {
      adHooks: ['hook1 — pattern interrupt', 'hook2 — fear', 'hook3 — social proof'],
      advertisingAngles: [
        { angle: 'fear of loss', targetEmotion: 'anxiety', format: 'short-form video' },
        { angle: 'social proof', targetEmotion: 'trust', format: 'image' },
      ],
    },
    nextSteps: ['step1', 'step2'],
  },
  competitorAnalysis: {
    competitors: [
      { name: 'CompA', positioning: 'cheap', weaknesses: ['w1', 'w2'] },
      { name: 'CompB', positioning: 'premium', weaknesses: ['w3'] },
    ],
  },
};

describe('createDeepDiveTool', () => {
  it('returns full section data when no field specified', async () => {
    const deepDive = createDeepDiveTool(blueprint);
    const result = await deepDive.execute({ section: 'crossAnalysisSynthesis' }, {} as never);
    expect(result.status).toBe('loaded');
    expect(result.data).toEqual(blueprint.crossAnalysisSynthesis);
    expect(result.tokenEstimate).toBeGreaterThan(0);
  });

  it('returns specific field data with dot-notation path', async () => {
    const deepDive = createDeepDiveTool(blueprint);
    const result = await deepDive.execute(
      { section: 'crossAnalysisSynthesis', field: 'messagingFramework.adHooks' },
      {} as never
    );
    expect(result.status).toBe('loaded');
    expect(result.data).toEqual(['hook1 — pattern interrupt', 'hook2 — fear', 'hook3 — social proof']);
  });

  it('returns specific array element with index notation', async () => {
    const deepDive = createDeepDiveTool(blueprint);
    const result = await deepDive.execute(
      { section: 'competitorAnalysis', field: 'competitors[0]' },
      {} as never
    );
    expect(result.status).toBe('loaded');
    expect((result.data as Record<string, unknown>).name).toBe('CompA');
  });

  it('returns error for missing section', async () => {
    const deepDive = createDeepDiveTool({});
    const result = await deepDive.execute({ section: 'crossAnalysisSynthesis' }, {} as never);
    expect(result.status).toBe('empty');
    expect(result.error).toBeDefined();
    expect(result.data).toBeNull();
  });

  it('returns field-not-found for invalid path', async () => {
    const deepDive = createDeepDiveTool(blueprint);
    const result = await deepDive.execute(
      { section: 'crossAnalysisSynthesis', field: 'nonExistentField.deep' },
      {} as never
    );
    expect(result.status).toBe('field-not-found');
    expect(result.data).toBeNull();
  });

  it('includes tokenEstimate in response', async () => {
    const deepDive = createDeepDiveTool(blueprint);
    const result = await deepDive.execute({ section: 'competitorAnalysis' }, {} as never);
    expect(result.tokenEstimate).toBeGreaterThan(0);
    expect(typeof result.tokenEstimate).toBe('number');
  });
});
```

**TDD sequence:**
1. Create `__tests__/deep-dive.test.ts` with failing tests
2. Run tests — fail (module not found)
3. Create `deep-dive.ts` with implementation
4. Run tests — all pass
5. Commit: `feat(chat): add deepDive tool for full section data access`

---

### Task 4 — Refactor `buildSystemPrompt` and remove `buildFallbackSummary`

**Modify:** `src/app/api/chat/agent/route.ts`

**What changes:**
1. Delete `buildFallbackSummary()` function (lines 184-194) — entirely
2. Replace `buildSystemPrompt(blueprint)` signature with `buildSystemPrompt(index: BlueprintIndex)` — takes the pre-computed index, not the full blueprint
3. Remove the `${blueprintJson}` code block from the system prompt
4. Add the index as compact JSON + new instructions for progressive disclosure
5. Update call site: compute index first, pass to prompt builder

**New imports at top of `route.ts`:**

```typescript
import { buildBlueprintIndex } from '@/lib/ai/chat-tools/blueprint-index';
import type { BlueprintIndex } from '@/lib/ai/chat-tools/blueprint-index';
```

**New `buildSystemPrompt` signature and body:**

The function keeps all persona text, section descriptions, tool usage rules, and communication guidelines. Only the blueprint data section changes: the 30-60K token JSON block is replaced by a compact index + new query instructions.

```typescript
function buildSystemPrompt(index: BlueprintIndex): string {
  return `You are a senior paid media strategist and direct response copywriter embedded inside a Strategic Blueprint tool. You've spent years in the trenches running campaigns, writing copy that converts cold traffic, and building go-to-market strategies for growth-stage companies.

Your background: You think in terms of awareness levels (Schwartz), you write hooks that stop the scroll (Halbert), you back claims with proof (Ogilvy), and you understand the psychology of why people buy (Sugarman). You know the difference between a hook that sounds clever and one that actually converts.

## What This Blueprint Is

This is a paid media strategy document. It was generated by researching the user's market, validating their ICP, stress-testing their offer, analyzing competitors (including real ad creatives), and synthesizing everything into positioning, messaging angles, and ad hooks. The user is here to refine it, understand it, or push it further.

## Blueprint Sections

1. **industryMarketOverview** — Market landscape, pain points (primary/secondary), psychological drivers, demand signals, buying triggers, messaging opportunities
2. **icpAnalysisValidation** — ICP viability for paid targeting, psychographics (goals, fears, day-in-the-life), pain-solution fit, risk assessment, reachability scores
3. **offerAnalysisViability** — Offer strength scored across 6 dimensions (pain relevance, urgency, differentiation, tangibility, proof, pricing logic), red flags, go/no-go recommendation
4. **competitorAnalysis** — Competitor profiles with positioning, strengths/weaknesses from real reviews, ad hooks they're running, creative formats, funnel patterns, gaps to exploit
5. **crossAnalysisSynthesis** — The strategy layer. Key insights, recommended positioning, messaging framework (core message, ad hooks with pattern interrupt techniques, advertising angles with target emotions, proof points, objection handlers), platform recommendations, next steps

## Blueprint Index

\`\`\`json
${JSON.stringify(index)}
\`\`\`

## How to Access Blueprint Data

You do NOT have the full blueprint in your context. Use tools to load what you need:

- **queryBlueprint(section)** — Load a condensed 1-2K token summary of any section. Use this first for any question about blueprint content. Fast, zero-latency, in-memory.
- **deepDive(section, field?)** — Load the complete raw section data (~5-15K tokens). Use ONLY when queryBlueprint doesn't have enough detail. Expensive in tokens — use sparingly.
- **searchBlueprint(query)** — Keyword search across all sections. Best for finding specific phrases, field paths, or values when you don't know which section they're in.

**Rules:**
1. NEVER assume you know what's in a section without calling queryBlueprint first.
2. Call queryBlueprint at the START of any response that references section data.
3. Use deepDive only when you explicitly need raw/complete data for granular analysis.
4. One queryBlueprint call per section per response — don't call it twice for the same section.

## How You Respond

You are a conversational strategist. Your default behavior: call queryBlueprint to load the relevant section, then answer using that data + your marketing expertise.

**Only use tools when the user's request references blueprint data:**
- Section content, scores, pain points, competitors, hooks, positioning → queryBlueprint first
- Specific field edits → editBlueprint (reads from blueprint closure directly)
- Full section rewrite → generateSection
- Live market data → webResearch or deepResearch
- Deep competitive analysis → deepResearch

**Do NOT call tools when:**
- User greets you or makes small talk
- User asks a follow-up to something you just discussed
- User asks about general marketing strategy or concepts
- Question can be answered from conversation history

## When to Use Each Tool

- **queryBlueprint** — Primary data access. Call it first when answering any question about blueprint content.
- **deepDive** — Escape hatch for complete raw data. Only when queryBlueprint isn't sufficient.
- **searchBlueprint** — Keyword-based lookup. When you need to find a specific phrase or field path.
- **editBlueprint** — ONLY when user explicitly asks to change/update/modify something. NEVER propose edits unprompted.
- **explainBlueprint** — For "why" questions requiring structured section data. (queryBlueprint is usually sufficient; use explainBlueprint when you specifically need the structured explain format.)
- **webResearch** — When user asks about current/live data not in the blueprint.
- **deepResearch** — Complex multi-angle research questions.
- **generateSection** — When user explicitly asks to rewrite or overhaul an entire section.
- **compareCompetitors** — When user asks for a structured competitor comparison table.
- **analyzeMetrics** — When user asks to score or evaluate a section.
- **createVisualization** — When user asks to visualize or chart blueprint data.

## When NOT to Use Tools

Do NOT use any tool when the user:
- Makes a comment or observation ("the hook feels weak") — discuss conversationally
- Greets you or makes small talk
- Asks a follow-up to something you just discussed
- Asks about strategy concepts or best practices
- Sends just "/edit" without specifying what to change

## Edit Discipline

Make **one edit per user request**. Do not chain multiple edits. If you find the same value in multiple places:
- Edit only the most relevant field the user clearly meant.
- After the edit is applied, tell the user what was changed and ask if they want the same change applied elsewhere.
- Never assume "change X to Y" means "find every occurrence of X and change all of them."

If the user explicitly asks for a bulk change, you may make multiple edits — but still one at a time, confirming each.

## Array Editing Rules

Many blueprint fields are **arrays**. When editing arrays:
- **To change one item**, use the array index: painPoints.primary[0], competitors[2].positioning
- **Never replace an entire array with a single string.**
- **Never join array items into one string.** Each item must remain a separate element.
- When the user says "change X to Y" about a list item, find the specific index and edit that index only.

## How You Communicate

- **Direct and concise.** No preamble, no "Great question!" filler.
- **Opinionated when it matters.** If a hook is weak, say so. If positioning has a gap, call it out.
- **Ground everything in the data.** Reference specific scores, pain points, competitor weaknesses.
- **Think in terms of the ad.** Headlines, hooks, body copy. Not abstract "messaging themes."
- **No emoji walls.**
- **Use markdown** for structure when it helps readability.
- **When editing the blueprint**, briefly explain what you're changing and why it makes the strategy stronger.
- **When you don't know something**, say so and suggest using web research to get current data.

## Slash Commands

- **/research [topic]** — Use deepResearch for complex multi-angle questions, webResearch for simple factual lookups.
- **/edit [instruction]** — editBlueprint for small field changes, generateSection for full rewrites. If just "/edit" with no instruction, ask what to change.
- **/compare [subject]** — compareCompetitors for structured table.
- **/analyze [metric or section]** — analyzeMetrics to score the section.
- **/visualize [topic]** — createVisualization for charts.

## Thinking Process

For complex questions, use thinking tags:

<think>
[Internal reasoning, analysis steps, tradeoffs]
</think>

Then provide your final response. Use thinking blocks selectively — simple questions don't need them.`;
}
```

**Updated call site in `POST` handler (replaces line 214):**

```typescript
// Before:
const systemPrompt = buildSystemPrompt(body.blueprint);

// After:
const blueprintIndex = buildBlueprintIndex(body.blueprint);
const systemPrompt = buildSystemPrompt(blueprintIndex);
```

**Verification check:** The system prompt no longer contains a `` ```json `` block with `blueprintJson`. Token count drops from 30-60K to ~2K for the full prompt. Run `npm run build` to confirm TypeScript is happy with the new signature.

**TDD sequence:**
1. Add imports for `buildBlueprintIndex` and `BlueprintIndex`
2. Delete `buildFallbackSummary()` (lines 184-194)
3. Replace `buildSystemPrompt` signature and body
4. Update call site in `POST`
5. `npm run build` — must exit 0
6. `npm run test:run` — all existing tests must still pass
7. Commit: `feat(chat): replace 30-60K token blueprint JSON dump with 500-token index`

---

### Task 5 — Update tool factory in `index.ts`

**Modify:** `src/lib/ai/chat-tools/index.ts`

**Changes:**
- Import `createQueryBlueprintTool` from `./query-blueprint`
- Import `createDeepDiveTool` from `./deep-dive`
- Export both from the barrel
- Re-export `buildBlueprintIndex` and `BlueprintIndex` from `./blueprint-index`
- Add both tools to the `createChatTools()` return object

**Full updated file:**

```typescript
// Chat Tools - barrel export and factory function

export { createSearchBlueprintTool } from './search-blueprint';
export { createEditBlueprintTool } from './edit-blueprint';
export { createExplainBlueprintTool } from './explain-blueprint';
export { createWebResearchTool } from './web-research';
export { createDeepResearchTool } from './deep-research';
export { createGenerateSectionTool } from './generate-section';
export { createCompareCompetitorsTool } from './compare-competitors';
export { createAnalyzeMetricsTool } from './analyze-metrics';
export { createVisualizationTool } from './create-visualization';
export { createQueryBlueprintTool } from './query-blueprint';
export { createDeepDiveTool } from './deep-dive';
export { buildBlueprintIndex } from './blueprint-index';
export type { BlueprintIndex, SectionSummary } from './blueprint-index';
export {
  getValueAtPath,
  generateDiffPreview,
  calculateConfidence,
  buildSourceQuality,
  summarizeBlueprint,
  applyEdits,
  applySingleEdit,
  SECTION_LABELS,
} from './utils';

import { createSearchBlueprintTool } from './search-blueprint';
import { createEditBlueprintTool } from './edit-blueprint';
import { createExplainBlueprintTool } from './explain-blueprint';
import { createWebResearchTool } from './web-research';
import { createDeepResearchTool } from './deep-research';
import { createGenerateSectionTool } from './generate-section';
import { createCompareCompetitorsTool } from './compare-competitors';
import { createAnalyzeMetricsTool } from './analyze-metrics';
import { createVisualizationTool } from './create-visualization';
import { createQueryBlueprintTool } from './query-blueprint';
import { createDeepDiveTool } from './deep-dive';

/**
 * Create all chat tools for a given blueprint context.
 * Returns a tools object suitable for streamText().
 *
 * Tool count: 11 (was 9 — added queryBlueprint + deepDive for progressive disclosure)
 */
export function createChatTools(blueprintId: string, blueprint: Record<string, unknown>) {
  return {
    searchBlueprint: createSearchBlueprintTool(blueprint),
    editBlueprint: createEditBlueprintTool(blueprint),
    explainBlueprint: createExplainBlueprintTool(blueprint),
    webResearch: createWebResearchTool(),
    deepResearch: createDeepResearchTool(),
    generateSection: createGenerateSectionTool(blueprint),
    compareCompetitors: createCompareCompetitorsTool(blueprint),
    analyzeMetrics: createAnalyzeMetricsTool(blueprint),
    createVisualization: createVisualizationTool(blueprint),
    queryBlueprint: createQueryBlueprintTool(blueprint),
    deepDive: createDeepDiveTool(blueprint),
  };
}

export type ChatTools = ReturnType<typeof createChatTools>;
```

**Note on `blueprintId`:** The factory still accepts `blueprintId` for backward compatibility. It is passed from `route.ts` and remains unused by the new tools since they work from the blueprint closure. Do not remove it.

**TDD sequence:**
1. Make changes to `index.ts`
2. `npm run build` — must exit 0
3. Commit: `feat(chat): add queryBlueprint and deepDive to createChatTools factory`

---

### Task 6 — Add result types for new tools to `types.ts`

**Modify:** `src/lib/ai/chat-tools/types.ts`

**Append to the end of the file:**

```typescript
// ---------------------------------------------------------------------------
// Sprint 5: Progressive disclosure tool result types
// ---------------------------------------------------------------------------

export interface QueryBlueprintResult {
  section: string;
  label: string;
  status: 'loaded' | 'empty';
  aspect?: string;
  summary: Record<string, unknown> | null;
  tokenEstimate?: number;
  error?: string;
  note?: string;
}

export interface DeepDiveResult {
  section: string;
  label: string;
  field?: string;
  status: 'loaded' | 'empty' | 'field-not-found';
  data: unknown;
  tokenEstimate?: number;
  error?: string;
  warning?: string;
}
```

**TDD sequence:** No dedicated test needed — pure type additions. `npm run build` confirms TypeScript compiles cleanly.

---

### Task 7 — Integration smoke test (manual verification)

After all code changes are committed and `npm run build` passes, verify end-to-end behavior in a running dev environment:

**Test 1: System prompt token check**

Temporarily add a log line in the `POST` handler:

```typescript
console.log('[DEBUG] System prompt length:', systemPrompt.length, 'chars (~',
  Math.ceil(systemPrompt.length / 4), 'tokens)');
```

Expected: ~8,000-10,000 chars (~2,000-2,500 tokens) vs old ~200,000+ chars. Remove the log before committing.

**Test 2: queryBlueprint exercised on first question**

Start the dev server. Open the chat agent with a populated blueprint. Send:
```
What are the primary pain points in this blueprint?
```
Verify in server logs that the model calls `queryBlueprint` with `section: "industryMarketOverview"` before answering. The tool result should appear in the streaming response.

**Test 3: deepDive exercised for detailed request**

Send:
```
Give me the complete raw messaging framework including every ad hook with its full emotional angle description.
```
Verify the model calls `deepDive` with `section: "crossAnalysisSynthesis"` and optionally `field: "messagingFramework"`.

**Test 4: editBlueprint still works**

Send:
```
Change the recommended positioning to "The only AI tool built for compliance-heavy SMBs"
```
Verify the edit flow still works: model calls `editBlueprint`, the approval dialog appears, user approves, change is applied to local blueprint state.

**Test 5: No regression on other tools**

Send:
```
/visualize offer scores as a bar chart
```
Verify `createVisualization` is called and the chart renders correctly.

---

## Acceptance Criteria

All criteria must pass before marking Sprint 5 complete:

1. **System prompt token reduction**: `buildSystemPrompt` no longer calls `JSON.stringify(blueprint)`. The prompt contains only the compact index JSON (~500 tokens of data), not the full blueprint.

2. **`buildFallbackSummary` is deleted**: The dead code path is removed entirely. No fallback exists because it is no longer needed.

3. **`queryBlueprint` tool registered**: `createChatTools()` returns a `queryBlueprint` key with the correct Vercel AI SDK tool definition including `inputSchema` and `execute`.

4. **`deepDive` tool registered**: `createChatTools()` returns a `deepDive` key with the correct tool definition including field-path navigation.

5. **All new tests pass**: `npm run test:run -- src/lib/ai/chat-tools/__tests__/` exits 0. Three new test files (`blueprint-index`, `query-blueprint`, `deep-dive`) all pass.

6. **Build passes**: `npm run build` exits 0 with no TypeScript errors introduced by this sprint.

7. **Model queries on-demand**: In a real conversation, the model calls `queryBlueprint` when asked about section data rather than hallucinating from a stale context. Confirmed via server logs.

8. **editBlueprint not broken**: The edit flow — propose, approve, apply — still works end-to-end. The tool reads from the blueprint closure which is unchanged by this sprint.

9. **No new test failures**: `npm run test:run` does not produce failures beyond the pre-existing ones (openrouter tests, chat blueprint tests).

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Model forgets to call queryBlueprint | Medium | System prompt rule: "NEVER assume you know section contents without calling queryBlueprint first." Add to rule set. |
| More tool calls = slower perceived responses | High (but acceptable) | queryBlueprint is pure in-memory, sub-millisecond. Net user experience is same or faster due to reduced prompt processing time. |
| Llama 3.3 tool-calling regression with 11 tools | Low | Groq Llama 3.3 70B handles multi-tool well. searchBlueprint was already working with the same pattern. Tool count increase is minor. |
| editBlueprint breaks without blueprint in context | None | editBlueprint reads from the blueprint closure passed to `createChatTools()`, not from the system prompt. Completely unchanged. |
| Token savings less than expected on small blueprints | Low | Even a 10K-token blueprint saves 90%+. The index is always ~500 tokens regardless of blueprint size. |
| explainBlueprint now redundant with queryBlueprint | True but harmless | Keep it registered for now. It provides a structured "why" explanation format that some conversations benefit from. Deprecate in Sprint 6 if usage data shows it's unused. |
| `deepDive` overused by model | Low | Tool description explicitly says "ONLY use this when queryBlueprint does not provide enough detail." System prompt reinforces this. Monitor in production. |

---

## File Change Summary

| File | Action | Approx lines |
|------|--------|-------------|
| `src/lib/ai/chat-tools/blueprint-index.ts` | Create | ~80 new |
| `src/lib/ai/chat-tools/query-blueprint.ts` | Create | ~130 new |
| `src/lib/ai/chat-tools/deep-dive.ts` | Create | ~90 new |
| `src/lib/ai/chat-tools/__tests__/blueprint-index.test.ts` | Create | ~80 new |
| `src/lib/ai/chat-tools/__tests__/query-blueprint.test.ts` | Create | ~80 new |
| `src/lib/ai/chat-tools/__tests__/deep-dive.test.ts` | Create | ~60 new |
| `src/lib/ai/chat-tools/index.ts` | Modify | +8 lines |
| `src/lib/ai/chat-tools/types.ts` | Modify | +20 lines |
| `src/app/api/chat/agent/route.ts` | Modify | -170 lines, +50 lines |

**New production code:** ~300 lines
**Lines deleted:** ~170 (`buildSystemPrompt` JSON block + `buildFallbackSummary`)
**Net delta:** +130 lines

---

## Commit Sequence

```
feat(chat): add buildBlueprintIndex for 500-token blueprint summary
feat(chat): add queryBlueprint tool for on-demand section loading
feat(chat): add deepDive tool for full section data access
feat(chat): replace 30-60K token blueprint JSON dump with 500-token index
feat(chat): add queryBlueprint and deepDive to createChatTools factory
feat(chat): add QueryBlueprintResult and DeepDiveResult types
```

Each commit requires `npm run build` and `npm run test:run` green before proceeding to the next.
