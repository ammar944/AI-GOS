# Per-Section Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add actionable intelligence cards to each research section and a readiness scorecard to synthesis.

**Architecture:** Intelligence prompts live in a new skill file (`intelligence-skill.ts`). Each runner appends its skill fragment to the system prompt and outputs 3 extra items in the same API call. Keywords intelligence is frontend-only (reuses existing `competitorGaps`/`topOpportunities`). Synthesis gains a readiness scorecard + top actions. 6 new card components, card taxonomy updates, and a `summarizeForSynthesis` update.

**Tech Stack:** Anthropic SDK, Zod, React, Tailwind CSS, Vercel AI SDK `generateObject`

**Spec:** `docs/superpowers/specs/2026-03-27-per-section-intelligence-design.md`

---

## File Map

### Worker (research-worker/)

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/skills/intelligence-skill.ts` | 5 exported prompt fragment constants |
| Modify | `src/contracts.ts` | Add `marketOpportunities`, `audienceRefinements`, `positioningMoves` to schemas |
| Modify | `src/runners/industry.ts` | Import + append `INDUSTRY_INTELLIGENCE_SKILL` to system prompt |
| Modify | `src/runners/icp.ts` | Import + append `ICP_INTELLIGENCE_SKILL` to system prompt |
| Modify | `src/runners/competitors.ts` | Import + append `COMPETITORS_INTELLIGENCE_SKILL` to all 3 tier prompts |
| Modify | `src/runners/synthesize.ts` | Extend inline schema + append `SYNTHESIS_INTELLIGENCE_SKILL` |

### Frontend (src/)

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `components/workspace/cards/opportunity-card.tsx` | Industry intelligence table |
| Create | `components/workspace/cards/refinement-card.tsx` | ICP intelligence stacked cards |
| Create | `components/workspace/cards/positioning-move-card.tsx` | Competitors intelligence table |
| Create | `components/workspace/cards/keyword-gap-card.tsx` | Keywords intelligence stacked cards |
| Create | `components/workspace/cards/readiness-scorecard.tsx` | Synthesis hero scorecard |
| Create | `components/workspace/cards/priority-actions.tsx` | Synthesis top actions list |
| Modify | `lib/workspace/card-taxonomy.ts` | Prepend intelligence cards in 5 parse functions |
| Modify | `components/research/card-renderer.tsx` | Add 6 cases to `CardContentSwitch` |
| Modify | `app/api/journey/dispatch/route.ts` | Update `summarizeForSynthesis` to include intelligence fields |

---

## Task 1: Create Intelligence Skill File

**Files:**
- Create: `research-worker/src/skills/intelligence-skill.ts`

- [ ] **Step 1: Create the skill file with all 5 prompt fragments**

```typescript
// research-worker/src/skills/intelligence-skill.ts

export const INDUSTRY_INTELLIGENCE_SKILL = `
## Intelligence: Market Opportunities to Exploit

After completing the market research above, generate exactly 3 market opportunities a paid media buyer could exploit right now.

For each opportunity:
- "opportunity": 1 sentence describing the gap or opening
- "size": "small" | "medium" | "large" (revenue potential)
- "timing": "now" | "3-6 months" | "6-12 months" (urgency window)
- "difficulty": "low" | "medium" | "high" (execution difficulty)
- "evidence": 1 sentence citing a specific finding from the research

Add a "marketOpportunities" array to your JSON output with these 3 objects.
Keep all strings under 120 characters. Focus on timing-sensitive gaps where paid media can move fast.
`;

export const ICP_INTELLIGENCE_SKILL = `
## Intelligence: Audience Refinements to Test

After completing the ICP validation above, generate exactly 3 audience refinements that could improve paid media performance.

For each refinement:
- "refinement": 1 sentence describing what to change about targeting or messaging
- "segment": which audience slice this applies to
- "expectedLift": "low" | "moderate" | "high"
- "testMethod": 1 sentence describing how to validate (e.g. "Split test ad copy focusing on X pain point")
- "risk": 1 sentence describing what happens if wrong

Add an "audienceRefinements" array to your JSON output with these 3 objects.
Use buyer language from the ICP validation. Focus on refinements testable in the first 30 days.
`;

export const COMPETITORS_INTELLIGENCE_SKILL = `
## Intelligence: Positioning Moves to Make

After completing the competitive analysis above, generate exactly 3 positioning moves for paid media.

For each move:
- "move": 1 sentence describing the positioning action
- "targetCompetitor": name of the specific competitor you're countering
- "risk": "low" | "medium" | "high"
- "reward": "low" | "medium" | "high"
- "playbook": 1 sentence execution hint for ad creative or messaging

Add a "positioningMoves" array to your JSON output with these 3 objects.
Each must name a real competitor from the analysis and include a concrete ad creative hint.
`;

export const COMPETITORS_INTELLIGENCE_SKILL_COMPACT = `
## Intelligence: Positioning Moves

Generate 1-2 positioning moves (same fields as full spec: move, targetCompetitor, risk, reward, playbook).
Add a "positioningMoves" array. Keep all strings under 80 chars.
The 18-word ceiling from the rescue rules does NOT apply to positioningMoves — playbook may be up to 80 chars.
`;

export const SYNTHESIS_INTELLIGENCE_SKILL = `
## Intelligence: Readiness Scorecard & Top Actions

After completing the synthesis above, add two new fields to your JSON output:

### readinessScorecard
Score the client's media launch readiness across 5 dimensions. Each dimension 1-10.
- "overallScore": weighted average of all dimensions (number, 1-10)
- "verdict": "ready" (>=8) | "fix-gaps-first" (5-7) | "needs-work" (<5)
- "verdictLabel": human-readable version ("Ready to launch" / "Fix gaps first" / "Needs significant work")
- "dimensions": array of 5 objects, each with "name", "score" (number), "summary" (1 sentence)
  - "Market Opportunity" — from industry research
  - "Audience Clarity" — from ICP validation
  - "Competitive Position" — from competitor intel
  - "Offer Strength" — from offer analysis
  - "Keyword Coverage" — from keyword intel

If a section's data is absent or incomplete, score that dimension 0 with summary "Insufficient data".
Be honest — do not inflate scores. A score of 5 means "average, nothing special."

### topActions
Select the 5-7 highest-impact actions across ALL research sections.
- "actions": array of objects with "action" (1 sentence), "source" ("industry" | "icp" | "competitors" | "offer" | "keywords"), "priority" ("high" | "medium" | "low")
Rank by how much each action would move the needle for a paid media launch.
`;
```

- [ ] **Step 2: Verify file compiles**

Run: `cd research-worker && npx tsc --noEmit src/skills/intelligence-skill.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add research-worker/src/skills/intelligence-skill.ts
git commit -m "feat: add intelligence skill prompt fragments for per-section intelligence"
```

---

## Task 2: Extend Worker Schemas (contracts.ts)

**Files:**
- Modify: `research-worker/src/contracts.ts:46-78` (industryResearchDataSchema)
- Modify: `research-worker/src/contracts.ts:115-171` (competitorIntelDataSchema)
- Modify: `research-worker/src/contracts.ts:173-197` (icpValidationDataSchema)

- [ ] **Step 1: Add `marketOpportunities` to industry schema**

In `contracts.ts`, after the `messagingOpportunities` field in `industryResearchDataSchema` (around line 77), add:

```typescript
  marketOpportunities: z.array(z.object({
    opportunity: nonEmptyStringSchema,
    size: flexibleEnum(['small', 'medium', 'large'] as const, 'medium'),
    timing: flexibleEnum(['now', '3-6 months', '6-12 months'] as const, 'now'),
    difficulty: flexibleEnum(['low', 'medium', 'high'] as const, 'medium'),
    evidence: nonEmptyStringSchema,
  })).default([]),
```

- [ ] **Step 2: Add `audienceRefinements` to ICP schema**

In `contracts.ts`, after the `finalVerdict` field in `icpValidationDataSchema` (around line 196), add:

```typescript
  audienceRefinements: z.array(z.object({
    refinement: nonEmptyStringSchema,
    segment: nonEmptyStringSchema,
    expectedLift: flexibleEnum(['low', 'moderate', 'high'] as const, 'moderate'),
    testMethod: nonEmptyStringSchema,
    risk: nonEmptyStringSchema,
  })).default([]),
```

- [ ] **Step 3: Add `positioningMoves` to competitors schema**

In `contracts.ts`, after the `overallLandscape` field in `competitorIntelDataSchema` (around line 170), add:

```typescript
  positioningMoves: z.array(z.object({
    move: nonEmptyStringSchema,
    targetCompetitor: nonEmptyStringSchema,
    risk: flexibleEnum(['low', 'medium', 'high'] as const, 'medium'),
    reward: flexibleEnum(['low', 'medium', 'high'] as const, 'medium'),
    playbook: nonEmptyStringSchema,
  })).default([]),
```

- [ ] **Step 4: Verify contracts compile**

Run: `cd research-worker && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add research-worker/src/contracts.ts
git commit -m "feat: add intelligence fields to industry, ICP, and competitor schemas"
```

---

## Task 3: Wire Intelligence Skill into Industry Runner

**Files:**
- Modify: `research-worker/src/runners/industry.ts`

- [ ] **Step 1: Import the skill**

At the top of `industry.ts`, add:

```typescript
import { INDUSTRY_INTELLIGENCE_SKILL } from '../skills/intelligence-skill';
```

- [ ] **Step 2: Bump primary token ceiling from 4500 to 5000**

Find `INDUSTRY_PRIMARY_MAX_TOKENS` (around line 21). Change from `4500` to `5000`. The extra 500 tokens give headroom for the 3 intelligence items (~150 tokens) without risking truncated JSON.

- [ ] **Step 3: Append skill to primary system prompt**

Find `INDUSTRY_PRIMARY_SYSTEM_PROMPT` (around line 28). At the END of the template literal (before the closing backtick), append:

```typescript
${INDUSTRY_INTELLIGENCE_SKILL}
```

- [ ] **Step 4: Append skill to repair prompt**

Find the repair system prompt (around line 111). Append the same skill at the end.

- [ ] **Step 5: Verify runner compiles**

Run: `cd research-worker && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add research-worker/src/runners/industry.ts
git commit -m "feat: wire INDUSTRY_INTELLIGENCE_SKILL into industry runner, bump token ceiling"
```

---

## Task 4: Wire Intelligence Skill into ICP Runner

**Files:**
- Modify: `research-worker/src/runners/icp.ts`

- [ ] **Step 1: Import the skill**

```typescript
import { ICP_INTELLIGENCE_SKILL } from '../skills/intelligence-skill';
```

- [ ] **Step 2: Append skill to system prompt**

Find `ICP_SYSTEM_PROMPT` (around line 18). Append `${ICP_INTELLIGENCE_SKILL}` at the end.

- [ ] **Step 3: Verify + commit**

Run: `cd research-worker && npx tsc --noEmit`

```bash
git add research-worker/src/runners/icp.ts
git commit -m "feat: wire ICP_INTELLIGENCE_SKILL into ICP runner"
```

---

## Task 5: Wire Intelligence Skill into Competitors Runner

**Files:**
- Modify: `research-worker/src/runners/competitors.ts`

- [ ] **Step 1: Import both skill variants**

```typescript
import { COMPETITORS_INTELLIGENCE_SKILL, COMPETITORS_INTELLIGENCE_SKILL_COMPACT } from '../skills/intelligence-skill';
```

- [ ] **Step 2: Append full skill to PRIMARY_SYSTEM_PROMPT**

Find `PRIMARY_SYSTEM_PROMPT` (around line 139). Append `${COMPETITORS_INTELLIGENCE_SKILL}` at the end.

- [ ] **Step 3: Append compact skill to REPAIR_SYSTEM_PROMPT**

Find `REPAIR_SYSTEM_PROMPT` (around line 202). Append `${COMPETITORS_INTELLIGENCE_SKILL_COMPACT}` at the end.

- [ ] **Step 4: Append compact skill to RESCUE_SYSTEM_PROMPT**

Find `RESCUE_SYSTEM_PROMPT` (around line 229). Append `${COMPETITORS_INTELLIGENCE_SKILL_COMPACT}` at the end.

- [ ] **Step 5: Verify + commit**

Run: `cd research-worker && npx tsc --noEmit`

```bash
git add research-worker/src/runners/competitors.ts
git commit -m "feat: wire COMPETITORS_INTELLIGENCE_SKILL into competitors runner (all 3 tiers)"
```

---

## Task 6: Extend Synthesis Runner Schema + Skill

**Files:**
- Modify: `research-worker/src/runners/synthesize.ts:24-72` (inline schema)
- Modify: `research-worker/src/runners/synthesize.ts:74-97` (system prompt)

- [ ] **Step 1: Import the skill**

```typescript
import { SYNTHESIS_INTELLIGENCE_SKILL } from '../skills/intelligence-skill';
```

- [ ] **Step 2: Add readinessScorecard to synthesisGenerateSchema**

After the `strategicNarrative: z.string()` line (around line 71), add:

```typescript
  readinessScorecard: z.object({
    overallScore: z.number(),
    verdict: z.string(),
    verdictLabel: z.string(),
    dimensions: z.array(z.object({
      name: z.string(),
      score: z.number(),
      summary: z.string(),
    })),
  }).optional(),
  topActions: z.object({
    actions: z.array(z.object({
      action: z.string(),
      source: z.string(),
      priority: z.string(),
    })),
  }).optional(),
```

**IMPORTANT**: No `.min()/.max()/.int()` on any number field. The Anthropic API rejects those in JSON Schema output_config.

- [ ] **Step 3: Append skill to SYNTHESIS_SYSTEM prompt**

Find `SYNTHESIS_SYSTEM` (line 74). At the end of the template literal, append:

```typescript
${SYNTHESIS_INTELLIGENCE_SKILL}
```

- [ ] **Step 4: Verify + commit**

Run: `cd research-worker && npx tsc --noEmit`

```bash
git add research-worker/src/runners/synthesize.ts
git commit -m "feat: add readiness scorecard + top actions to synthesis runner"
```

---

## Task 7: Create Frontend Card Components (Batch 1 — Tables)

**Files:**
- Create: `src/components/workspace/cards/opportunity-card.tsx`
- Create: `src/components/workspace/cards/positioning-move-card.tsx`

- [ ] **Step 1: Create opportunity-card.tsx**

Follow the ICE table pattern from `ice-table.tsx`. Table with sortable columns.

```typescript
// src/components/workspace/cards/opportunity-card.tsx
'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface Opportunity {
  opportunity: string;
  size: string;
  timing: string;
  difficulty: string;
  evidence: string;
}

interface OpportunityCardProps {
  opportunities: Opportunity[];
}

const SIZE_ORDER = { large: 3, medium: 2, small: 1 };
const BADGE_COLORS: Record<string, string> = {
  large: 'var(--accent-green, #22c55e)',
  medium: 'var(--accent-blue, #3b82f6)',
  small: 'var(--text-quaternary)',
  now: 'var(--accent-green, #22c55e)',
  '3-6 months': 'var(--accent-blue, #3b82f6)',
  '6-12 months': 'var(--text-quaternary)',
  low: 'var(--accent-green, #22c55e)',
  high: 'var(--accent-red, #ef4444)',
};

function Badge({ value }: { value: string }) {
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider"
      style={{ color: BADGE_COLORS[value] ?? 'var(--text-tertiary)', background: 'rgba(255,255,255,0.04)' }}
    >
      {value}
    </span>
  );
}

export function OpportunityCard({ opportunities }: OpportunityCardProps) {
  const sorted = useMemo(
    () => [...opportunities].sort((a, b) => (SIZE_ORDER[b.size as keyof typeof SIZE_ORDER] ?? 0) - (SIZE_ORDER[a.size as keyof typeof SIZE_ORDER] ?? 0)),
    [opportunities],
  );

  if (!sorted.length) return null;

  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <th className="px-2.5 py-1.5 text-left font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Opportunity</th>
          <th className="px-2.5 py-1.5 text-center font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Size</th>
          <th className="px-2.5 py-1.5 text-center font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Timing</th>
          <th className="px-2.5 py-1.5 text-center font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Difficulty</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((opp, i) => (
          <tr key={i} className="transition-colors" style={{ background: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <td className="px-2.5 py-2" style={{ color: 'var(--text-primary)' }}>
              <div className="font-medium">{opp.opportunity}</div>
              <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{opp.evidence}</div>
            </td>
            <td className="px-2.5 py-2 text-center"><Badge value={opp.size} /></td>
            <td className="px-2.5 py-2 text-center"><Badge value={opp.timing} /></td>
            <td className="px-2.5 py-2 text-center"><Badge value={opp.difficulty} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Create positioning-move-card.tsx**

Same table pattern but with risk/reward badges.

```typescript
// src/components/workspace/cards/positioning-move-card.tsx
'use client';

import { useMemo } from 'react';

interface PositioningMove {
  move: string;
  targetCompetitor: string;
  risk: string;
  reward: string;
  playbook: string;
}

interface PositioningMoveCardProps {
  moves: PositioningMove[];
}

const REWARD_ORDER = { high: 3, medium: 2, low: 1 };

function Badge({ value, type }: { value: string; type: 'risk' | 'reward' }) {
  const color = type === 'risk'
    ? (value === 'low' ? 'var(--accent-green, #22c55e)' : value === 'high' ? 'var(--accent-red, #ef4444)' : 'var(--text-secondary)')
    : (value === 'high' ? 'var(--accent-green, #22c55e)' : value === 'low' ? 'var(--text-quaternary)' : 'var(--text-secondary)');
  return (
    <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider"
      style={{ color, background: 'rgba(255,255,255,0.04)' }}
    >
      {value}
    </span>
  );
}

export function PositioningMoveCard({ moves }: PositioningMoveCardProps) {
  const sorted = useMemo(
    () => [...moves].sort((a, b) => (REWARD_ORDER[b.reward as keyof typeof REWARD_ORDER] ?? 0) - (REWARD_ORDER[a.reward as keyof typeof REWARD_ORDER] ?? 0)),
    [moves],
  );
  if (!sorted.length) return null;

  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <th className="px-2.5 py-1.5 text-left font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Move</th>
          <th className="px-2.5 py-1.5 text-left font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>vs.</th>
          <th className="px-2.5 py-1.5 text-center font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Risk</th>
          <th className="px-2.5 py-1.5 text-center font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Reward</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((m, i) => (
          <tr key={i} className="transition-colors" style={{ background: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <td className="px-2.5 py-2" style={{ color: 'var(--text-primary)' }}>
              <div className="font-medium">{m.move}</div>
              <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{m.playbook}</div>
            </td>
            <td className="px-2.5 py-2 text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>{m.targetCompetitor}</td>
            <td className="px-2.5 py-2 text-center"><Badge value={m.risk} type="risk" /></td>
            <td className="px-2.5 py-2 text-center"><Badge value={m.reward} type="reward" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No errors (components unused yet — tree-shaking will exclude them)

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/cards/opportunity-card.tsx src/components/workspace/cards/positioning-move-card.tsx
git commit -m "feat: add OpportunityCard and PositioningMoveCard components"
```

---

## Task 8: Create Frontend Card Components (Batch 2 — Stacked Cards)

**Files:**
- Create: `src/components/workspace/cards/refinement-card.tsx`
- Create: `src/components/workspace/cards/keyword-gap-card.tsx`

- [ ] **Step 1: Create refinement-card.tsx**

Stacked card layout — each refinement is a small card within the parent.

```typescript
// src/components/workspace/cards/refinement-card.tsx
'use client';

import { useMemo } from 'react';

interface Refinement {
  refinement: string;
  segment: string;
  expectedLift: string;
  testMethod: string;
  risk: string;
}

interface RefinementCardProps {
  refinements: Refinement[];
}

const LIFT_ORDER = { high: 3, moderate: 2, low: 1 };

function LiftBadge({ value }: { value: string }) {
  const color = value === 'high' ? 'var(--accent-green, #22c55e)' : value === 'moderate' ? 'var(--accent-blue, #3b82f6)' : 'var(--text-quaternary)';
  return (
    <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider"
      style={{ color, background: 'rgba(255,255,255,0.04)' }}
    >
      {value} lift
    </span>
  );
}

export function RefinementCard({ refinements }: RefinementCardProps) {
  const sorted = useMemo(
    () => [...refinements].sort((a, b) => (LIFT_ORDER[b.expectedLift as keyof typeof LIFT_ORDER] ?? 0) - (LIFT_ORDER[a.expectedLift as keyof typeof LIFT_ORDER] ?? 0)),
    [refinements],
  );
  if (!sorted.length) return null;

  return (
    <div className="space-y-3">
      {sorted.map((r, i) => (
        <div key={i} className="rounded-[var(--radius-md)] border border-[var(--border-glass)] p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{r.refinement}</div>
              <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{r.segment}</div>
            </div>
            <LiftBadge value={r.expectedLift} />
          </div>
          <div className="mt-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Test: </span>
            {r.testMethod}
          </div>
          <div className="mt-1 text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Risk: </span>
            {r.risk}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create keyword-gap-card.tsx**

Stacked card showing gap clusters derived from existing keyword data.

```typescript
// src/components/workspace/cards/keyword-gap-card.tsx
'use client';

interface KeywordGap {
  gapCluster: string;
  estimatedVolume: number;
  competition: string;
  suggestedKeywords: string[];
  priority: string;
}

interface KeywordGapCardProps {
  gaps: KeywordGap[];
}

function PriorityBadge({ value }: { value: string }) {
  const color = value === 'high' ? 'var(--accent-red, #ef4444)' : value === 'medium' ? 'var(--accent-blue, #3b82f6)' : 'var(--text-quaternary)';
  return (
    <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider"
      style={{ color, background: 'rgba(255,255,255,0.04)' }}
    >
      {value}
    </span>
  );
}

export function KeywordGapCard({ gaps }: KeywordGapCardProps) {
  if (!gaps.length) return null;

  return (
    <div className="space-y-3">
      {gaps.map((g, i) => (
        <div key={i} className="rounded-[var(--radius-md)] border border-[var(--border-glass)] p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{g.gapCluster}</div>
            <div className="flex items-center gap-1.5">
              <PriorityBadge value={g.priority} />
              <PriorityBadge value={g.competition} />
            </div>
          </div>
          {g.estimatedVolume > 0 && (
            <div className="mt-1 text-[11px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
              ~{g.estimatedVolume.toLocaleString()} monthly volume
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {g.suggestedKeywords.map((kw, j) => (
              <span key={j} className="rounded px-1.5 py-0.5 text-[11px]"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify + commit**

Run: `npm run build`

```bash
git add src/components/workspace/cards/refinement-card.tsx src/components/workspace/cards/keyword-gap-card.tsx
git commit -m "feat: add RefinementCard and KeywordGapCard components"
```

---

## Task 9: Create Synthesis Card Components

**Files:**
- Create: `src/components/workspace/cards/readiness-scorecard.tsx`
- Create: `src/components/workspace/cards/priority-actions.tsx`

- [ ] **Step 1: Create readiness-scorecard.tsx**

Hero card with overall score + 5 dimension bars.

```typescript
// src/components/workspace/cards/readiness-scorecard.tsx
'use client';

import { cn } from '@/lib/utils';

interface Dimension {
  name: string;
  score: number;
  summary: string;
}

interface ReadinessScorecardProps {
  overallScore: number;
  verdict: string;
  verdictLabel: string;
  dimensions: Dimension[];
}

function scoreColor(score: number): string {
  if (score >= 8) return 'var(--accent-green, #22c55e)';
  if (score >= 5) return 'var(--accent-blue, #3b82f6)';
  return 'var(--accent-red, #ef4444)';
}

export function ReadinessScorecard({ overallScore, verdictLabel, dimensions }: ReadinessScorecardProps) {
  const color = scoreColor(overallScore);

  return (
    <div>
      {/* Hero score */}
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-4xl font-mono font-bold tabular-nums" style={{ color }}>
          {overallScore.toFixed(1)}
        </span>
        <span className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
          / 10 — {verdictLabel}
        </span>
      </div>

      {/* Dimension bars */}
      <div className="space-y-2.5">
        {dimensions.map((dim) => {
          const barColor = scoreColor(dim.score);
          const pct = Math.max(0, Math.min(100, (dim.score / 10) * 100));
          return (
            <div key={dim.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>{dim.name}</span>
                <span className="text-[12px] font-mono tabular-nums" style={{ color: barColor }}>{dim.score}/10</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
              </div>
              <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{dim.summary}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create priority-actions.tsx**

Numbered list with priority badges and source pills.

```typescript
// src/components/workspace/cards/priority-actions.tsx
'use client';

interface Action {
  action: string;
  source: string;
  priority: string;
}

interface PriorityActionsProps {
  actions: Action[];
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'var(--accent-red, #ef4444)',
  medium: 'var(--accent-blue, #3b82f6)',
  low: 'var(--text-quaternary)',
};

const SOURCE_LABELS: Record<string, string> = {
  industry: 'Market',
  icp: 'Audience',
  competitors: 'Competitors',
  offer: 'Offer',
  keywords: 'Keywords',
};

export function PriorityActions({ actions }: PriorityActionsProps) {
  if (!actions.length) return null;

  const sorted = [...actions].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.priority as keyof typeof order] ?? 1) - (order[b.priority as keyof typeof order] ?? 1);
  });

  return (
    <ol className="space-y-2">
      {sorted.map((a, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}
          >
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider"
                style={{ color: PRIORITY_COLORS[a.priority] ?? 'var(--text-tertiary)', background: 'rgba(255,255,255,0.04)' }}
              >
                {a.priority}
              </span>
              <span className="rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider"
                style={{ color: 'var(--text-quaternary)', background: 'rgba(255,255,255,0.03)' }}
              >
                {SOURCE_LABELS[a.source] ?? a.source}
              </span>
            </div>
            <div className="mt-1 text-[13px]" style={{ color: 'var(--text-primary)' }}>{a.action}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 3: Verify + commit**

Run: `npm run build`

```bash
git add src/components/workspace/cards/readiness-scorecard.tsx src/components/workspace/cards/priority-actions.tsx
git commit -m "feat: add ReadinessScorecard and PriorityActions components"
```

---

## Task 10: Wire Cards into Card Taxonomy + Card Renderer

**Files:**
- Modify: `src/lib/workspace/card-taxonomy.ts:53-136` (parseIndustryMarket)
- Modify: `src/lib/workspace/card-taxonomy.ts:140-end` (parseCompetitorIntel)
- Modify: `src/lib/workspace/card-taxonomy.ts` (parseIcpValidation, parseKeywordIntel, parseCrossAnalysis)
- Modify: `src/components/research/card-renderer.tsx`

- [ ] **Step 1: Prepend opportunity card in parseIndustryMarket**

In `card-taxonomy.ts`, inside `parseIndustryMarket()`, BEFORE the existing `categorySnapshot` parsing (line 58), add:

```typescript
  // Intelligence: Market Opportunities
  const opportunities = asRecordArray(data.marketOpportunities);
  if (opportunities.length > 0) {
    cards.push(makeCard(section, 'opportunity-card', 'Opportunities to Exploit', {
      opportunities: opportunities.map((o) => ({
        opportunity: asString(o.opportunity) ?? '',
        size: asString(o.size) ?? 'medium',
        timing: asString(o.timing) ?? 'now',
        difficulty: asString(o.difficulty) ?? 'medium',
        evidence: asString(o.evidence) ?? '',
      })).filter((o) => o.opportunity),
    }));
  }
```

- [ ] **Step 2: Prepend refinement card in parseIcpValidation**

Find `parseICPValidation()`. At the start of the function (right after `const cards` and `const section`), add:

```typescript
  // Intelligence: Audience Refinements
  const refinements = asRecordArray(data.audienceRefinements);
  if (refinements.length > 0) {
    cards.push(makeCard(section, 'refinement-card', 'Audience Refinements to Test', {
      refinements: refinements.map((r) => ({
        refinement: asString(r.refinement) ?? '',
        segment: asString(r.segment) ?? '',
        expectedLift: asString(r.expectedLift) ?? 'moderate',
        testMethod: asString(r.testMethod) ?? '',
        risk: asString(r.risk) ?? '',
      })).filter((r) => r.refinement),
    }));
  }
```

- [ ] **Step 3: Prepend positioning move card in parseCompetitorIntel**

Find `parseCompetitorIntel()`. At the start (line 141, after `const cards` and `const section`), add:

```typescript
  // Intelligence: Positioning Moves
  const moves = asRecordArray(data.positioningMoves);
  if (moves.length > 0) {
    cards.push(makeCard(section, 'positioning-move-card', 'Positioning Moves to Make', {
      moves: moves.map((m) => ({
        move: asString(m.move) ?? '',
        targetCompetitor: asString(m.targetCompetitor) ?? '',
        risk: asString(m.risk) ?? 'medium',
        reward: asString(m.reward) ?? 'medium',
        playbook: asString(m.playbook) ?? '',
      })).filter((m) => m.move),
    }));
  }
```

- [ ] **Step 4: Prepend keyword gap card in parseKeywordIntel**

Replace the existing `parseKeywordIntel` function (lines 486-491) with:

```typescript
function parseKeywordIntel(data: Record<string, unknown>): CardState[] {
  if (Object.keys(data).length === 0) return [];
  const cards: CardState[] = [];

  // Intelligence: Keyword Gaps (derived from existing competitorGaps + topOpportunities)
  const competitorGaps = asRecordArray(data.competitorGaps);
  const topOpportunities = asRecordArray(data.topOpportunities);

  if (competitorGaps.length > 0 || topOpportunities.length > 0) {
    const gaps: Array<{gapCluster: string; estimatedVolume: number; competition: string; suggestedKeywords: string[]; priority: string}> = [];

    // Group competitor gaps by competitor name
    const byCompetitor = new Map<string, typeof competitorGaps>();
    for (const g of competitorGaps) {
      const name = asString(g.competitorName) ?? 'Unknown';
      if (!byCompetitor.has(name)) byCompetitor.set(name, []);
      byCompetitor.get(name)!.push(g);
    }
    for (const [competitor, items] of byCompetitor) {
      gaps.push({
        gapCluster: `${competitor} competitor terms`,
        estimatedVolume: items.reduce((sum, g) => sum + (typeof g.searchVolume === 'number' ? g.searchVolume : 0), 0),
        competition: 'medium',
        suggestedKeywords: items.slice(0, 5).map((g) => asString(g.keyword) ?? '').filter(Boolean),
        priority: 'high',
      });
    }

    // Top opportunities as a cluster
    if (topOpportunities.length > 0) {
      const highPriority = topOpportunities.filter((o) => (typeof o.priorityScore === 'number' ? o.priorityScore : 0) >= 60);
      if (highPriority.length > 0) {
        gaps.push({
          gapCluster: 'High-intent opportunities',
          estimatedVolume: highPriority.reduce((sum, o) => sum + (typeof o.searchVolume === 'number' ? o.searchVolume : 0), 0),
          competition: asString(highPriority[0]?.difficulty) ?? 'medium',
          suggestedKeywords: highPriority.slice(0, 5).map((o) => asString(o.keyword) ?? '').filter(Boolean),
          priority: 'high',
        });
      }
    }

    if (gaps.length > 0) {
      cards.push(makeCard('keywordIntel', 'keyword-gap-card', 'Keyword Gaps to Fill', { gaps: gaps.slice(0, 3) }));
    }
  }

  // Existing passthrough
  cards.push(makeCard('keywordIntel', 'keyword-grid', 'Keyword Intelligence', { rawData: data }));
  return cards;
}
```

- [ ] **Step 5: Prepend scorecard + actions in parseCrossAnalysis**

Find `parseCrossAnalysis()` (line 496). At the start, BEFORE the existing positioning strategy parsing, add:

```typescript
  // Intelligence: Readiness Scorecard
  const scorecard = asRecord(data.readinessScorecard);
  if (scorecard) {
    const dims = asRecordArray(scorecard.dimensions);
    if (dims.length > 0) {
      cards.push(makeCard(section, 'readiness-scorecard', 'Media Launch Readiness', {
        overallScore: asNumber(scorecard.overallScore) ?? 0,
        verdict: asString(scorecard.verdict) ?? 'needs-work',
        verdictLabel: asString(scorecard.verdictLabel) ?? 'Needs assessment',
        dimensions: dims.map((d) => ({
          name: asString(d.name) ?? '',
          score: asNumber(d.score) ?? 0,
          summary: asString(d.summary) ?? '',
        })).filter((d) => d.name),
      }));
    }
  }

  // Intelligence: Top Actions
  const topActions = asRecord(data.topActions);
  if (topActions) {
    const actions = asRecordArray(topActions.actions);
    if (actions.length > 0) {
      cards.push(makeCard(section, 'priority-actions', 'Top Actions', {
        actions: actions.map((a) => ({
          action: asString(a.action) ?? '',
          source: asString(a.source) ?? '',
          priority: asString(a.priority) ?? 'medium',
        })).filter((a) => a.action),
      }));
    }
  }
```

- [ ] **Step 6: Add 6 new cases to CardContentSwitch in card-renderer.tsx**

In `src/components/research/card-renderer.tsx`, add imports at the top:

```typescript
import { OpportunityCard } from '@/components/workspace/cards/opportunity-card';
import { RefinementCard } from '@/components/workspace/cards/refinement-card';
import { PositioningMoveCard } from '@/components/workspace/cards/positioning-move-card';
import { KeywordGapCard } from '@/components/workspace/cards/keyword-gap-card';
import { ReadinessScorecard } from '@/components/workspace/cards/readiness-scorecard';
import { PriorityActions } from '@/components/workspace/cards/priority-actions';
```

Then add these cases to the `switch` statement, before the `default` case:

```typescript
    case 'opportunity-card':
      return <OpportunityCard opportunities={card.content.opportunities as Array<{opportunity: string; size: string; timing: string; difficulty: string; evidence: string}>} />;
    case 'refinement-card':
      return <RefinementCard refinements={card.content.refinements as Array<{refinement: string; segment: string; expectedLift: string; testMethod: string; risk: string}>} />;
    case 'positioning-move-card':
      return <PositioningMoveCard moves={card.content.moves as Array<{move: string; targetCompetitor: string; risk: string; reward: string; playbook: string}>} />;
    case 'keyword-gap-card':
      return <KeywordGapCard gaps={card.content.gaps as Array<{gapCluster: string; estimatedVolume: number; competition: string; suggestedKeywords: string[]; priority: string}>} />;
    case 'readiness-scorecard':
      return <ReadinessScorecard overallScore={card.content.overallScore as number} verdict={card.content.verdict as string} verdictLabel={card.content.verdictLabel as string} dimensions={card.content.dimensions as Array<{name: string; score: number; summary: string}>} />;
    case 'priority-actions':
      return <PriorityActions actions={card.content.actions as Array<{action: string; source: string; priority: string}>} />;
```

Also add `'readiness-scorecard'` to the `HERO_CARD_TYPES` set:

```typescript
const HERO_CARD_TYPES = new Set(['stat-grid', 'strategy-card', 'competitor-card', 'pricing-card', 'readiness-scorecard']);
```

- [ ] **Step 7: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 8: Commit**

```bash
git add src/lib/workspace/card-taxonomy.ts src/components/research/card-renderer.tsx
git commit -m "feat: wire 6 intelligence cards into card taxonomy and renderer"
```

---

## Task 11: Update summarizeForSynthesis

**Files:**
- Modify: `src/app/api/journey/dispatch/route.ts:16-52`

- [ ] **Step 1: Update summarizeForSynthesis to include intelligence fields**

In `src/app/api/journey/dispatch/route.ts`, update the `summarizeForSynthesis` function:

```typescript
function summarizeForSynthesis(key: string, payload: unknown): string {
  const d = payload as Record<string, unknown>;
  try {
    switch (key) {
      case 'industryMarket':
        // NOTE: categorySnapshot and trendSignals are the actual top-level fields
        // (not marketSize/trends which don't exist at top level)
        return JSON.stringify(
          {
            categorySnapshot: d.categorySnapshot,
            trendSignals: d.trendSignals,
            messagingOpportunities: (d.messagingOpportunities as Record<string, unknown>)?.summaryRecommendations,
            marketOpportunities: d.marketOpportunities,
          },
          null, 1,
        );
      case 'icpValidation':
        // NOTE: validatedPersona and triggers are the actual top-level fields
        // (not segments/buyingTriggers which don't exist at top level)
        return JSON.stringify(
          {
            validatedPersona: d.validatedPersona,
            triggers: d.triggers,
            finalVerdict: d.finalVerdict,
            audienceRefinements: d.audienceRefinements,
          },
          null, 1,
        );
      case 'offerAnalysis':
        return JSON.stringify({
          overallScore: (d.offerStrength as Record<string, unknown>)?.overallScore,
          status: (d.recommendation as Record<string, unknown>)?.status,
          pricingPosition: (d.pricingAnalysis as Record<string, unknown>)?.pricingPosition,
          redFlags: d.redFlags,
        }, null, 1);
      case 'competitors': {
        const comps = Array.isArray(d.competitors) ? d.competitors.slice(0, 3) : [];
        const compSummary = comps.map((c: Record<string, unknown>) => ({
          name: c.name, positioning: c.positioning, weaknesses: c.weaknesses,
        }));
        return JSON.stringify({
          competitors: compSummary,
          positioningMoves: d.positioningMoves,
        }, null, 1);
      }
      default:
        return JSON.stringify(payload, null, 1);
    }
  } catch {
    return JSON.stringify(payload, null, 1);
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/journey/dispatch/route.ts
git commit -m "feat: update summarizeForSynthesis to pass intelligence fields to synthesis"
```

---

## Task 12: End-to-End Verification

**Files:** None (verification only)

- [ ] **Step 1: Verify worker compiles**

Run: `cd research-worker && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Verify frontend builds**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Run existing tests**

Run: `npm run test:run`
Expected: All existing tests pass (no regressions)

- [ ] **Step 4: Run a full research generation**

Start the dev server + research worker. Enter a company URL. Let all 7 sections run to completion. Verify:

1. Industry section shows "Opportunities to Exploit" as the first card
2. ICP section shows "Audience Refinements to Test" as the first card
3. Competitors section shows "Positioning Moves to Make" as the first card
4. Keywords section shows "Keyword Gaps to Fill" as the first card (derived from existing data)
5. Strategic Synthesis shows "Media Launch Readiness" scorecard as the first card
6. Strategic Synthesis shows "Top Actions" as the second card
7. All existing cards still render correctly below the intelligence cards
8. Generation time increase is <=10 seconds vs. baseline

- [ ] **Step 5: Screenshot each section's intelligence card for verification**

Take screenshots of all 6 new cards rendering with real data.

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: e2e verification fixes for per-section intelligence"
```
