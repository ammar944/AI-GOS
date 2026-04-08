# Current Marketing Activities — Design Spec

**Date:** 2026-04-08
**Author:** Ammar (via superpowers:brainstorming)
**Status:** Approved, pending implementation plan

## Problem

Users complete onboarding on `/journey` and kick off the research pipeline, but the pipeline has no visibility into what the client is **already doing** for marketing. As a result, the output regularly restates the client's existing strategy as a "new" recommendation:

- A client already spending $8k/mo on Meta with a working 1% LAL audience and UGC testimonial hooks gets back a media plan that says "test Meta with LAL audiences and UGC creatives."
- A client already running LinkedIn sponsored content gets LinkedIn listed as a primary recommendation without any acknowledgement of the existing setup.

Media buyers call this output lazy and correctly so — it's producing zero incremental insight because it can't see what's already in market.

## Goal

Give the research pipeline a single signal — "here is what the client is currently running" — so the media plan runner, synthesis runner, and offer runner can produce recommendations that **avoid duplicating** existing strategy and instead propose **new angles, untested channels, or structural changes** to what's already failing.

Non-goals:
- Not capturing ad account credentials or performance data automatically.
- Not building a structured channel/spend tracker. A freeform textarea is sufficient.
- Not touching the keyword runner (free-form text doesn't parse into negative keywords cleanly).

## Constraints

- **Must remain optional.** Existing users without this field must get working research. Empty/absent field → no behavioral change in any runner.
- **Must appear in the profile edit view.** Users need to update it after initial onboarding as their marketing mix changes.
- **Must not require a schema migration.** `business_profiles.all_fields` JSONB already handles arbitrary keys.
- **Must not touch `src/lib/ai/context-builder.ts`.** That file services the old pre-journey generator, which the journey flow does not use.
- **Must follow the existing field-catalog pattern.** No new abstractions; no field-specific plumbing.

## Approach (chosen)

**Approach A — Plain optional field + anti-duplication instructions in 3 runner prompts.**

Add `currentMarketingActivities` as a standard optional enrichment field in `src/lib/journey/field-catalog.ts`. The existing journey flow already iterates accepted fields and emits `"${label}: ${value}"` lines into the research context string, so the field auto-flows into every runner with zero changes to the dispatch route or context builder. The "do not duplicate existing strategy" guardrail goes into the three runner prompts that actually make strategic recommendations: synthesize, media-plan, and offer.

Approaches B (centralized guardrail block in the context builder) and C (fully structured channels/spend schema) were considered and rejected — B introduces the first field-specific special case to a flow that currently has zero, and C is massively out of scope for a single-field fix.

## Field definition

| Attribute | Value |
|---|---|
| Key | `currentMarketingActivities` |
| Label | `Current Marketing Activities` |
| Category | `section-followup` (optional, non-blocking) |
| Section | `crossAnalysis` |
| Collection mode | `manual` |
| `prefillVisible` | `false` (no scrape source) |
| Rows | 4 (multi-line textarea) |

**Placeholder:**

```
Meta $8k/mo — LAL 1% + interest stacks, UGC testimonial hooks, 2.1x ROAS (working).
LinkedIn $3k/mo — job-title + static images, flat (cutting soon).
Google Search: not running yet.
```

**Helper text:**

> Channels you're already running, rough budget split, creative styles, what's working, what's not. Helps us avoid recommending strategies you already have in market. Skip any part.

## Registration points

All in `src/lib/journey/field-catalog.ts`:

1. Append new entry to `JOURNEY_FIELDS` array (after the existing `crossAnalysis`-sectioned `brandPositioning` entry, around line 68).
2. Append new entry to `JOURNEY_ENRICHMENT_FIELD_METAS` with `placeholder`, `helper`, `rows: 4`.
3. Add `'currentMarketingActivities'` to `JOURNEY_FIELD_GROUPS` → `goals-strategy` group's `fieldKeys`.
4. Add `'currentMarketingActivities'` to `PROFILE_FIELD_GROUPS` → `goals-strategy` group's `fieldKeys`.
5. Add `'currentMarketingActivities'` to `PROFILE_MULTILINE_KEYS` Set.

**Must NOT add to:** `JOURNEY_REQUIRED_FIELD_KEYS`, `JOURNEY_PRICING_GROUP_KEYS`, `JOURNEY_MANUAL_BLOCKER_FIELDS`. The field is strictly optional.

**Must NOT add a `FIELD_MAP` entry in `src/lib/profiles/business-profiles.ts`.** The generic `all_fields` JSONB merge path at `business-profiles.ts:120` and `:285` already handles arbitrary keys — no dedicated column needed.

## Data flow

```
User fills field on /journey onboarding review
           │
           ▼
  unified-field-review.tsx (renders whatever is in
  JOURNEY_FIELD_GROUPS — no component changes needed)
           │
           ▼
  handleStartFromUnifiedReview in src/app/journey/page.tsx
  → buildJourneyResearchContext(acceptedJourneyFields)
  → emits "Current Marketing Activities: <value>" line
           │
           ▼
  PATCH /api/journey/session (existing — persists the
  field to journey_sessions.metadata unchanged)
           │
           ▼
  dispatchWithIdentity → /api/journey/dispatch (unchanged
  — passes context verbatim, then appends upstream research
  for downstream sections)
           │
           ▼
  Railway worker /run → runners/{offer, synthesize, media-plan}.ts
  (each runner's system prompt gains an anti-duplication
  instruction that keys off the "Current Marketing Activities:"
  label in the context string)
           │
           ▼
  Profile save via POST /api/profiles → saveBusinessProfile
  writes the field into business_profiles.all_fields JSONB
  (generic merge path handles unknown keys)
```

### Small targeted refactor

The context-string-building loop is currently duplicated in two places in `src/app/journey/page.tsx`:

- `handleStartFromReview` (~line 1477–1493)
- `handleStartFromUnifiedReview` (~line 1566–1581)

Both iterate an `orderedFieldKeys` list and push `"${label}: ${value}"` into a `lines` array. Extract this into a small pure helper:

**New file:** `src/lib/journey/context-string.ts`

```ts
import { JOURNEY_FIELD_LABELS } from './field-catalog';

/**
 * Build the research context string passed to the Railway worker runners.
 * Emits one labeled line per non-empty field. Empty/absent fields are omitted.
 * Order: caller provides the ordering via the keys of `fields`.
 */
export function buildJourneyResearchContext(
  fields: Record<string, string | undefined>,
  orderedKeys?: readonly string[],
): string {
  const keys = orderedKeys ?? Object.keys(fields);
  const lines: string[] = ["Here's what I found about the company:"];
  for (const key of keys) {
    const value = fields[key]?.trim();
    if (!value) continue;
    lines.push(`${JOURNEY_FIELD_LABELS[key] ?? key}: ${value}`);
  }
  lines.push('', 'Please use this context and begin the research journey.');
  return lines.join('\n');
}
```

Both call sites in `src/app/journey/page.tsx` are updated to call this helper. This is a scoped improvement that serves the current goal (the new field must flow through both paths identically) — not drive-by refactoring.

## Runner prompt updates

### `research-worker/src/runners/synthesize.ts`

Insert the following block into `SYNTHESIS_SYSTEM` (line 93) after the existing `RULES:` list and before `BUDGET ALLOCATION`:

```
CURRENT MARKETING ACTIVITIES (anti-duplication rule):
- The context may contain a "Current Marketing Activities:" line describing
  channels, budgets, and creatives the client is ALREADY running.
- If present, your recommendations MUST NOT restate these as "new" strategy.
- Your platformRecommendations, messagingAngles, and positioningStrategy must
  propose NEW angles, UNTESTED channels, or CONTRARIAN moves relative to what's
  already in market.
- If the client is already running a channel successfully, you may keep it as
  a "primary" platform but your rationale MUST explicitly reference what they're
  doing today and describe the INCREMENTAL change (new audience, new creative
  system, new bidding strategy) — not repeat their existing playbook.
- If a channel is already running but failing, recommend a structural fix or
  cutting it — do not silently re-recommend it.
- If the field is empty or absent, ignore this rule and proceed normally.
```

Also export the `SYNTHESIS_SYSTEM` constant so the prompt-inclusion test can assert on it.

### `research-worker/src/runners/media-plan.ts`

Add a new top-level constant beside `ANTI_HALLUCINATION` (line 45):

```ts
const CURRENT_ACTIVITIES_GUARDRAIL = `

CURRENT MARKETING ACTIVITIES (anti-duplication rule):
- The context may contain a "Current Marketing Activities:" line describing
  channels, budgets, and creatives the client is ALREADY running.
- For Channel Mix & Budget: do not propose a budget allocation that mirrors
  the current one. If 60% of current spend is on Meta, your recommendation
  should either (a) cut Meta to open room for untested channels or (b)
  restructure the Meta spend into a materially different audience/creative
  mix, with explicit rationale.
- For Audience & Campaign: do not re-propose audience layers the client
  confirms they're already running. New lookalike seeds, new interest
  stacks, new exclusions — yes. Same targeting — no.
- For Creative System: do not recommend a creative format (UGC, static,
  carousel, VSL) the client explicitly says is already working or already
  tested. Pick a different format or a different angle on the same format.
- For Rollout Roadmap: phase 1 should not be "launch [channel they're
  already running]" — phase 1 is the INCREMENTAL change.
- If the field is empty or absent, ignore this rule.`;
```

Inject into `systemParts` at the existing generation site (around line 132) alongside `ANTI_HALLUCINATION`:

```ts
const systemParts = [
  block.skill,
  refs ? `\n\n## Reference Data\n\n${refs}` : '',
  industryTemplate ? `\n\n## Industry Template (${industry})\n\n${industryTemplate}` : '',
  ANTI_HALLUCINATION,
  CURRENT_ACTIVITIES_GUARDRAIL,  // ← new
];
```

The guardrail applies uniformly to all 6 blocks via the shared `systemParts` array. Export `CURRENT_ACTIVITIES_GUARDRAIL` for the prompt-inclusion test.

### `research-worker/src/runners/offer.ts`

**Precondition:** this runner was not read during brainstorming. The implementation plan must open it first and identify where the system prompt is assembled (top-level constant, inlined string, or dynamically built per-call). The change below is the text to inject; the exact insertion point is a small unknown that does not affect the design.

Locate the system prompt assembly and append the following shorter block, then export whatever constant (or builder function) now holds the guardrail text so the prompt-inclusion test can assert on it:

```
CURRENT MARKETING ACTIVITIES (context for offer analysis):
- The context may contain a "Current Marketing Activities:" line.
- If the client is running paid traffic with poor performance, your offer
  analysis should consider whether the offer structure itself is the blocker
  (weak guarantee, unclear value prop, wrong funnel) rather than attributing
  the failure to targeting or creative.
- Do not recommend a funnel type the client confirms is already in use
  unless you explicitly reference the existing implementation and recommend
  a specific structural change.
```

Export the system prompt constant for the prompt-inclusion test.

## Schemas / contracts

**None.** The field is untyped free text. No Zod contract changes. No database schema migration. No `FIELD_MAP` entry. Persistence via the existing `all_fields` JSONB merge path in `saveBusinessProfile` and `updateProfile`.

## Tests

TDD — failing tests first.

### `src/lib/journey/__tests__/field-catalog.test.ts` (extend existing)

Four new cases:

1. `getJourneyFieldDefinition('currentMarketingActivities')` returns a definition with `category: 'section-followup'`, `section: 'crossAnalysis'`, `collectionMode: 'manual'`, `prefillVisible` falsy.
2. `JOURNEY_FIELD_GROUPS` and `PROFILE_FIELD_GROUPS` both include `'currentMarketingActivities'` in their `goals-strategy` group's `fieldKeys`.
3. `PROFILE_MULTILINE_KEYS.has('currentMarketingActivities')` is `true`.
4. `JOURNEY_REQUIRED_FIELD_KEYS.has('currentMarketingActivities')` is `false` — the field must remain optional.

### `src/lib/journey/__tests__/context-string.test.ts` (new file)

Three cases for `buildJourneyResearchContext`:

1. Includes `"Current Marketing Activities: Meta $8k/mo with LAL 1% + UGC, 2.1x ROAS."` when the field is set.
2. Omits the line entirely when the field is empty string, undefined, or absent (optional field contract).
3. Never produces the substring `"undefined"` in the output, and always returns a non-empty string.

### `research-worker/src/runners/__tests__/guardrail-prompts.test.ts` (new file — consolidates 3 prompt-inclusion tests)

- `synthesize.SYNTHESIS_SYSTEM` contains `'CURRENT MARKETING ACTIVITIES'`, `'anti-duplication'`, and `'MUST NOT restate'`.
- `media-plan.CURRENT_ACTIVITIES_GUARDRAIL` contains `'CURRENT MARKETING ACTIVITIES'`, `'do not propose a budget allocation that mirrors'`, and `'Creative System'`.
- `offer`'s exported system prompt constant contains `'CURRENT MARKETING ACTIVITIES'` and `'funnel type the client confirms is already in use'`.

### Tests explicitly out of scope

A live-API integration test that runs the real research pipeline with "currently running Meta LAL" in the context and asserts the output doesn't recommend Meta LAL as a "new" strategy. Rejected because:

- Live Anthropic calls are forbidden by `.claude/rules/learned-patterns.md` and the `feedback_no_api_testing_loops` memory.
- Mocking Anthropic gives false confidence — it tests that the mock works, not that the prompt works.
- The behavioral guarantee (output doesn't restate existing strategy) is enforced by prompt text + manual QA in the verification plan.

## Verification plan

### Automated

1. `npm run build` exits 0.
2. `npm run test:run -- src/lib/journey/__tests__/field-catalog.test.ts` passes.
3. `npm run test:run -- src/lib/journey/__tests__/context-string.test.ts` passes.
4. Worker test runner for `research-worker/src/runners/__tests__/guardrail-prompts.test.ts` passes.
5. `npm run lint` clean.

### Manual UI trace

- `/profiles` list page: inline-edit form renders the new textarea with 4 rows, placeholder, and helper text in the Goals & Strategy section.
- `/profiles/<id>` detail page: the new field appears in the Goals & Strategy group when populated.
- Edit the field, save, refetch — value persists through `updateProfile` → `all_fields` JSONB.

### Manual end-to-end research trace (Fellow.ai regression target)

Single real pipeline run on Fellow.ai with `currentMarketingActivities` set to:

> Currently running Meta ads with 1% LAL audiences, testing UGC creatives, 2.3x ROAS. LinkedIn sponsored content for decision-makers, flat CPL. Google Search brand-only.

Pass criterion: the media plan output does NOT list "Meta with LAL + UGC" as a new primary recommendation. Either (a) the rationale explicitly references the existing setup and proposes an incremental change, or (b) the recommendation is for a different channel or audience layer.

Fail criterion: the output repeats "Meta LAL audiences" or "UGC testimonial creatives" as a top-line recommendation without acknowledging the existing implementation. If this happens, iterate on the guardrail prompt phrasing — the field shape is not the issue.

### Data flow checklist (for the execution verification report)

```
1. UI         : unified-field-review renders currentMarketingActivities       ✓
2. Submit     : handleStartFromUnifiedReview includes it in acceptedJourneyFields ✓
3. Context    : buildJourneyResearchContext emits "Current Marketing Activities: …" line ✓
4. Persist    : POST /api/profiles saves to business_profiles.all_fields JSONB ✓
5. Dispatch   : /api/journey/dispatch passes context verbatim to worker       ✓
6. Worker     : synthesize / media-plan / offer runners receive the line      ✓
7. Output     : media plan output does not duplicate Meta/LAL/UGC as "new"    ✓
```

## Files touched

| File | Change |
|---|---|
| `src/lib/journey/field-catalog.ts` | Add `currentMarketingActivities` to `JOURNEY_FIELDS`, `JOURNEY_ENRICHMENT_FIELD_METAS`, `JOURNEY_FIELD_GROUPS.goals-strategy`, `PROFILE_FIELD_GROUPS.goals-strategy`, `PROFILE_MULTILINE_KEYS` |
| `src/lib/journey/context-string.ts` | **New file** — `buildJourneyResearchContext` helper |
| `src/app/journey/page.tsx` | Replace two inline context-building loops with `buildJourneyResearchContext` |
| `research-worker/src/runners/synthesize.ts` | Add guardrail paragraph to `SYNTHESIS_SYSTEM`; export constant |
| `research-worker/src/runners/media-plan.ts` | Add `CURRENT_ACTIVITIES_GUARDRAIL` constant; inject into `systemParts`; export constant |
| `research-worker/src/runners/offer.ts` | Add shorter guardrail to system prompt; export constant |
| `src/lib/journey/__tests__/field-catalog.test.ts` | Extend with 4 new cases |
| `src/lib/journey/__tests__/context-string.test.ts` | **New file** — 3 cases for the helper |
| `research-worker/src/runners/__tests__/guardrail-prompts.test.ts` | **New file** — 3 prompt-inclusion assertions |

## Files explicitly NOT touched

- `src/lib/ai/context-builder.ts` — services the old pre-journey generator, not used by journey.
- `src/lib/media-plan/pipeline.ts` and related — separate old media plan pipeline, distinct from the research-worker `media-plan.ts` runner.
- Any Zod contract — field is untyped free text.
- Database schema — `business_profiles.all_fields` JSONB already handles the new key.
- API routes — `/api/journey/session`, `/api/journey/dispatch`, `/api/profiles`, `/api/profiles/[id]` all work unchanged.
- `FIELD_MAP` in `src/lib/profiles/business-profiles.ts` — no dedicated column.
- `research-worker/src/runners/keywords.ts` — free-form text doesn't parse into negative keywords; skipped per brainstorming decision.

## Open questions / risks

- **Prompt phrasing is unvalidated.** The three guardrail paragraphs are written with deliberately directive language ("MUST NOT", "explicitly reference") because media buyers called the current output lazy. If the real research trace in § Verification shows the AI ignoring the guardrail, the phrasing needs iteration — the field shape and registration are sound and will not need changes.
- **Label stability is a prompt dependency.** The runner prompts key off the literal string `"Current Marketing Activities:"`. If the label in the field catalog is ever changed, the runner prompts will silently stop matching. Mitigated by: (a) the label is stable because it's user-facing copy, (b) the guardrail tells the model to look for the concept even if the label drifts slightly.
- **Users may leave the field empty.** Expected and supported — all runners have explicit "if the field is empty, ignore this rule" carve-outs. Empty field → zero behavioral change vs today.
- **`offer.ts` structure is unread.** Implementation step 1 must open `research-worker/src/runners/offer.ts` and confirm where the system prompt lives before writing the guardrail. If it turns out the offer runner does not have a clean injection point (e.g. the prompt is assembled from many fragments), the fallback is to drop the offer runner update from this change entirely and keep the guardrail in synthesize + media-plan only — the "offer analysis considers whether offer is the blocker" insight is secondary to the primary anti-duplication goal.
