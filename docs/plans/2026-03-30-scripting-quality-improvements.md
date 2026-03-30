# Ad Scripting Engine Quality Improvements

**Branch:** redesign/v2-command-center
**Date:** 2026-03-30
**Baseline:** 12 scripts graded at C average (39/70)
**Target:** B average (48+/70)
**Eng Review:** All architecture decisions resolved via /plan-eng-review

---

## Implementation Order

```
Phase 1: Prompt fixes (no code architecture changes)
  Task 1: Em dash kill list + sentence rhythm → Pass 1 + Pass 2 prompts
  Task 2: ICP monologue extraction → trim function + Pass 1 prompt

Phase 2: Runner intelligence
  Task 3: Intelligence fields in trim → trim-research-context.ts
  Task 4: Previous angles context → ad-scripts.ts runner + Pass 1 prompt
  Task 5: Import refs via loader → ad-scripts.ts + loader imports

Phase 3: Proof inventory
  Task 6: Supabase migration → proof_points JSONB on business_profiles
  Task 7: Assets tab UI → rename Style Refs, add proof points input
  Task 8: Wire proof to scripts → generate route + worker + Pass 1 prompt

Phase 4: Batch validator
  Task 9: Pass 3 batch diversity → ad-scripts.ts + new validator function
  Task 10: Diversity flags in UI → script-pack-viewer.tsx

Phase 5: Tests + Eval
  Task 11: Unit tests for trim + angle context
  Task 12: Generate + grade eval (before/after comparison)
```

---

## Task Details

### Task 1: Em Dash Kill List + Sentence Rhythm

**Files:**
- `research-worker/src/prompts/ad-scripts-pass1.ts`
- `research-worker/src/prompts/ad-scripts-pass2.ts`

**Changes:**

Pass 1 — add to kill list (structures to never use section):
```
6. **Em dashes**: Never use em dashes (—). Use commas, periods, or start a new
   sentence. One em dash per 1000 words maximum. Zero is better.
7. **Sentence length uniformity**: Every script MUST contain at least one sentence
   under 5 words AND at least one sentence over 25 words. Vary deliberately.
   Three-word punch after a twenty-word build. Single-word paragraph when something
   lands. "Wild." is a sentence.
```

Pass 2 — add new checks:
```
S10: Em dash audit — Count em dashes. If >0, replace every one with a comma,
     period, or new sentence. Zero em dashes is the target. This is the single
     most visible AI fingerprint.
S11: Sentence rhythm check — Measure sentence word counts. If all sentences are
     within 5 words of each other, rewrite to vary. Insert one ≤4 word sentence
     and one ≥25 word sentence per script minimum.
```

**Acceptance:** Run generation, count em dashes across batch. Target: 0.

---

### Task 2: ICP Monologue Extraction

**Files:**
- `src/lib/scripts/trim-research-context.ts`
- `research-worker/src/prompts/ad-scripts-pass1.ts`

**Changes to trim function:**

Extract ICP triggers into a "monologue" field:
```typescript
// After targetAudience extraction, add:
const triggers = icpValidation?.triggers ?? [];
const monologue = triggers
  .slice(0, 5)
  .map((t: { trigger: string }) => t.trigger)
  .filter(Boolean);

return {
  ...existing,
  targetAudienceMonologue: monologue.length > 0
    ? monologue
    : undefined,
};
```

**Changes to Pass 1 prompt:**

Add section after research context injection:
```
## THE CONVERSATION ALREADY IN THEIR HEAD (Collier Framework)
Your prospect is already having this internal conversation. Enter it, don't start a new one:
${monologue.map(t => `- "${t}"`).join('\n')}

Use these triggers as raw material for hooks and opening lines. The best hook
mirrors what the founder is already thinking at 11pm on a Sunday.
```

**Acceptance:** Generated scripts reference specific trigger language from ICP research.

---

### Task 3: Intelligence Fields in Trim

**File:** `src/lib/scripts/trim-research-context.ts`

**Changes:**

Add to the return object:
```typescript
// Priority 2 additions (after existing competitors/keywords extraction)
positioningMoves: competitors?.positioningMoves?.slice(0, 3) ?? [],
audienceRefinements: icpValidation?.audienceRefinements?.slice(0, 3) ?? [],
marketOpportunities: industryMarket?.marketOpportunities?.slice(0, 3) ?? [],
topActions: crossAnalysis?.readinessScorecard?.topActions?.slice(0, 5) ?? [],
```

Each field is capped at 3-5 items to stay within token budget.

**Acceptance:** Worker receives non-empty intelligence fields when research has them.

---

### Task 4: Previous Angles Context

**File:** `research-worker/src/runners/ad-scripts.ts`

**Changes:**

After each level completes, extract used angles and hooks:
```typescript
const usedAnglesAndHooks: { angle: string; hook: string }[] = [];

for (const [idx, level] of AWARENESS_LEVELS.entries()) {
  const { system, prompt } = buildPass1Prompt({
    ...existingOpts,
    usedAnglesAndHooks, // NEW PARAM
  });

  // ... generate scripts ...

  // After Pass 2 completes for this level:
  for (const script of levelScripts) {
    usedAnglesAndHooks.push({
      angle: script.angle,
      hook: script.headline || script.body.split('.')[0] || '',
    });
  }
}
```

**Changes to Pass 1 prompt (buildPass1Prompt):**

Accept `usedAnglesAndHooks` param. If non-empty, inject:
```
## ANGLES AND HOOKS ALREADY USED — DO NOT REPEAT
The following angles and opening lines have been used in previous awareness levels.
Choose DIFFERENT angles. Write hooks that sound NOTHING like these:

${usedAnglesAndHooks.map(a => `- [${a.angle}]: "${a.hook}"`).join('\n')}

Minimum 2 of the 3 scripts in this level must use angles NOT in the list above.
```

**Acceptance:** No two levels share the same primary angle. Hooks are linguistically distinct.

---

### Task 5: Import Refs via Loader

**Files:**
- `research-worker/src/runners/ad-scripts.ts`
- `research-worker/src/prompts/ad-scripts-pass1.ts`

**Changes to runner:**
```typescript
import { loadBlockRefs } from '../skills/loader';

// In runAdScripts(), before the level loop:
const platformSpecs = loadBlockRefs('creativeSystem'); // loads platform-specs.md + ad-copy-templates.md
```

Pass `platformSpecs` string to `buildPass1Prompt()`.

**Changes to Pass 1 prompt:**

Replace hardcoded platform limits section with:
```
## PLATFORM SPECIFICATIONS (from platform-specs.md)
${platformSpecs}
```

Replace hardcoded framework section with imported ad-copy-templates.md content, while keeping the 6 DR-specific frameworks (Schwartz, Hopkins, etc.) as an addendum:
```
## COPYWRITING FRAMEWORKS REFERENCE
${adCopyTemplates}

## DIRECT RESPONSE FRAMEWORKS (scripting-specific)
[keep existing Schwartz, Hopkins, Ogilvy, Caples, Sugarman, Collier inline]
```

**Acceptance:** Platform specs match platform-specs.md. No hardcoded char limits in prompt.

---

### Task 6: Supabase Migration — Proof Points

**Migration SQL:**
```sql
ALTER TABLE business_profiles
ADD COLUMN IF NOT EXISTS proof_points JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN business_profiles.proof_points IS
  'User-verified proof points: case studies, testimonials, metrics, credentials';
```

Apply via Supabase MCP or dashboard.

**Acceptance:** Column exists, default is empty array.

---

### Task 7: Assets Tab UI

**Files:**
- `src/app/profiles/[id]/page.tsx` — rename tab from "STYLE REFS" to "ASSETS"
- `src/components/scripts/style-refs-tab.tsx` — rename to `assets-tab.tsx`, add proof points section

**Changes:**

Rename the tab label. Add a "Proof Points" section below the existing style references section in the same component. Proof point form fields:
- Type dropdown: Case Study, Testimonial, Metric, Credential
- Headline (short version, e.g., "3 demos → 22 in 90 days")
- Detail (full text)
- Client name (optional)
- Verified checkbox

Use the same `persist()` pattern as style references — PUT to a new endpoint or expanded existing endpoint.

**Acceptance:** User can add, edit, delete proof points. They persist across page refreshes.

---

### Task 8: Wire Proof to Scripts

**Files:**
- `src/app/api/scripts/generate/route.ts` — fetch proof_points from profile, pass to worker
- `research-worker/src/index.ts` — receive proofPoints in request body
- `research-worker/src/runners/ad-scripts.ts` — pass to prompt builder
- `research-worker/src/prompts/ad-scripts-pass1.ts` — inject proof section

**Changes to Pass 1 prompt:**

```
## AVAILABLE PROOF (use these — do not fabricate)
${proofPoints.length > 0
  ? proofPoints.map(p => `[${p.type}] ${p.headline}: ${p.detail}${p.clientName ? ` — ${p.clientName}` : ''}`).join('\n')
  : 'NO VERIFIED PROOF AVAILABLE. Do not fabricate case studies, testimonials, or specific client outcomes. Use research-grounded claims only. Flag any claim that would benefit from proof in the flaggedClaims output.'}
```

**Acceptance:** When proof points exist, scripts cite them. When absent, scripts avoid fabricated proof and flag the gap.

---

### Task 9: Pass 3 Batch Diversity Validator

**File:** `research-worker/src/runners/ad-scripts.ts`

**New function:**
```typescript
async function validateBatchDiversity(
  scripts: AdScript[]
): Promise<{ diversityScore: number; flags: string[] }> {
  const result = await generateObject({
    model: anthropic(SCRIPT_MODEL),
    schema: batchDiversitySchema,
    maxOutputTokens: 1000,
    system: `You are a creative director reviewing a batch of ${scripts.length} ad scripts for diversity and quality distribution.`,
    prompt: `Review these scripts for:
1. ANGLE DIVERSITY: Are there 2+ scripts using the exact same angle? Flag pairs.
2. HOOK DIVERSITY: Do any hooks sound similar? Flag pairs with the similar language.
3. FORMAT COVERAGE: Are video, static, and email all represented?
4. PLATFORM COVERAGE: Are meta, google, and linkedin all represented?
5. CTA VARIETY: Are CTAs varied or all "Book a call"?

Scripts:
${scripts.map((s, i) => `[${i+1}] ${s.type}|${s.platform}|${s.awarenessLevel}|${s.angle}\nHook: ${s.headline || s.body.split('.')[0]}\nCTA: ${s.cta}`).join('\n\n')}`,
    abortSignal: AbortSignal.timeout(60_000),
  });
  return result.object;
}
```

**Schema:**
```typescript
const batchDiversitySchema = z.object({
  diversityScore: z.number(),
  flags: z.array(z.string()),
});
```

Call after all levels complete, before the final `writeScriptPackUpdate`:
```typescript
const diversity = await validateBatchDiversity(allScripts);
// Write diversity flags to pack metadata
await writeScriptPackUpdate(packId, {
  scripts: JSON.stringify(allScripts),
  status: 'complete',
  diversity_score: diversity.diversityScore,
  diversity_flags: JSON.stringify(diversity.flags),
});
```

**Acceptance:** Pack has diversity_score and diversity_flags populated after generation.

---

### Task 10: Diversity Flags in UI

**File:** `src/components/scripts/script-pack-viewer.tsx`

After scripts load, if the pack has diversity flags, show them:
```tsx
{diversityFlags.length > 0 && (
  <div className="rounded-lg border border-[var(--accent-amber)]/20 bg-[var(--accent-amber)]/5 px-4 py-3">
    <p className="text-[11px] uppercase tracking-[0.06em] font-mono font-medium text-[var(--accent-amber)] mb-2">
      Batch Review Notes
    </p>
    {diversityFlags.map((flag, i) => (
      <p key={i} className="text-xs text-[var(--text-secondary)]">{flag}</p>
    ))}
  </div>
)}
```

**Acceptance:** Flags visible in UI when present.

---

### Task 11: Unit Tests

**File:** `research-worker/src/__tests__/trim-research-scripts.test.ts` (new)

Tests:
1. `trimResearchForScripts` extracts intelligence fields when present
2. `trimResearchForScripts` handles missing intelligence fields gracefully (returns undefined, not error)
3. ICP monologue extraction returns triggers as array
4. ICP monologue extraction handles empty/missing triggers
5. Proof points are passed through the generate route to the worker request body

**File:** `research-worker/src/__tests__/ad-scripts-angles.test.ts` (new)

Tests:
1. `usedAnglesAndHooks` accumulates correctly across levels
2. Prompt builder injects angle context when usedAnglesAndHooks is non-empty
3. Prompt builder omits angle context when usedAnglesAndHooks is empty

---

### Task 12: Generate + Grade Eval

Manual eval protocol:
1. Generate baseline batch (before changes) for SaaSLaunch profile
2. Save raw scripts to `research-worker/src/eval/baseline-scripts.json`
3. Run `/grade-scripts` on baseline, record scores
4. Apply all changes
5. Generate new batch for same profile
6. Save to `research-worker/src/eval/improved-scripts.json`
7. Run `/grade-scripts` on improved batch, compare

**Target deltas:**
- Em dash count: from ~25 across batch → 0
- Angle duplication: from 4 duplicates → 0
- Proof dimension: from 3/10 avg → 5+/10 (with proof points added)
- Overall average: from 39/70 → 48+/70

---

## NOT in scope

- Auto-regeneration on Pass 3 failures (deferred — flag-only for now)
- Confidence score rubric definition (deferred — model still uses its own judgment)
- Style reference matching validation in Pass 2 (existing gap, not addressed)
- Awareness level drift detection in Pass 2 (identified gap, deferred)
- Reading level / Flesch-Kincaid check (nice to have, not critical)

## What already exists

| Asset | Location | Status |
|---|---|---|
| Platform specs reference | `research-worker/src/skills/refs/platform-specs.md` | Exists, will import |
| Ad copy templates reference | `research-worker/src/skills/refs/ad-copy-templates.md` | Exists, will import |
| Ref file loader | `research-worker/src/skills/loader.ts` | Exists, will reuse |
| Intelligence skill outputs | Research runners write to research_results | Exists, will extract |
| Style refs tab UI | `src/components/scripts/style-refs-tab.tsx` | Exists, will expand |
| Script regeneration endpoint | `POST /api/scripts/{packId}/scripts/{scriptId}/regenerate` | Exists, unchanged |

## Failure Modes

| Codepath | Failure | Test? | Error Handling? | User Impact |
|---|---|---|---|---|
| Intelligence fields missing | Older research has no intelligence data | Will test | Graceful (undefined) | Scripts work, just less strategic |
| Proof points empty | No proof entered | Will test | Explicit "NO PROOF" prompt | Scripts flag the gap, don't fabricate |
| Pass 3 timeout | Batch validator times out | No test | Falls back to no-flags | Scripts delivered, no diversity check |
| Loader missing ref file | platform-specs.md deleted | Existing handler | console.warn, empty string | Prompts lose platform limits — CRITICAL |

**Critical gap:** If `platform-specs.md` is deleted, the prompt loses all platform constraints silently. The loader returns empty string and the model generates copy with no character limits. Add a startup validation check that logs an error if critical refs are missing.

## Worktree Parallelization Strategy

| Step | Modules touched | Depends on |
|---|---|---|
| Phase 1 (prompts) | research-worker/src/prompts/ | — |
| Phase 2 (runner + trim) | research-worker/src/runners/, src/lib/scripts/ | — |
| Phase 3 (proof UI) | src/components/scripts/, src/app/profiles/, src/app/api/ | Phase 2 (trim changes) |
| Phase 4 (batch validator) | research-worker/src/runners/ | Phase 2 (runner changes) |

**Lanes:**
- Lane A: Phase 1 (prompts only, no code deps)
- Lane B: Phase 2 (runner + trim)
- After A+B merge: Phase 3 + Phase 4 sequentially (both touch runner)

**Execution:** Launch A + B in parallel worktrees. Merge both. Then C (Phase 3 + 4 sequential).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 4 architecture decisions resolved, 0 critical gaps, full scope accepted |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

**VERDICT:** ENG REVIEW CLEARED — ready to implement.
