# Journey Competitor Ad Intelligence Fix Design

**Goal:** Restore high-quality competitor ad intelligence in `/journey` so the competitor section shows real ad evidence, clickable library links, and clear platform-specific coverage without mixing in account-performance tools like Meta Ads Manager.

## Problem

The current journey competitor flow is underpowered for ad intelligence because three layers are misaligned:

- the worker-side competitor tool summarizes ad activity too early,
- the worker-side result contract strips anything outside the current competitor schema before persistence,
- the journey schema only preserves `adActivity` summary fields,
- the journey UI only renders that summary.

At the same time, the repo already contains a richer ad-intel path in the older strategic-research stack:

- raw `adCreatives[]`,
- per-ad `detailsUrl`,
- platform search helpers,
- ad carousel UI.

The practical result is that the current competitor artifact cannot answer the user’s actual questions:

- What ads are competitors running?
- Can I click into Meta Library, LinkedIn Ad Library, and Google Ads Transparency?
- What is verified vs inferred?

## Constraints

- Keep `metaAds` scoped to account-performance and media planning. It should not be pulled into competitor intelligence.
- Preserve the current worker architecture. Research still runs through `research-worker/`.
- Stay compatible with strict TypeScript and Zod-validated journey schemas.
- Avoid a repo-wide package refactor just to share one service.

## Options

### Option 1: Minimal summary patch

Keep the current worker tool, tighten prompts, and add more ad summary fields like platform counts and stronger evidence language.

Pros:
- Smallest diff
- Low implementation risk

Cons:
- Still no clickable ads
- Still no raw creatives
- Still no Meta/LinkedIn library navigation
- Does not solve the main product complaint

### Option 2: Hybrid contract restore with journey UI port

Keep the current journey architecture, but expand the competitor contract to include ad creatives and library links, upgrade the worker ad-library behavior to mirror the richer service logic, and port the older strategic-research ad experience into the journey artifact.

Pros:
- Solves the actual user problem
- Reuses proven UI and helper patterns already in the repo
- Keeps scope bounded to competitor intelligence

Cons:
- Requires coordinated backend + schema + UI changes
- Requires careful normalization of worker output

### Option 3: Full ad-intelligence platform unification

Refactor both app and worker to depend on a fully shared ad-library module outside both runtimes, then rebuild both journey and strategic-research views on top of one canonical ad-intel domain layer.

Pros:
- Cleanest long-term architecture
- Lowest future duplication

Cons:
- Highest scope
- More risky than the user needs right now
- Delays visible product improvement

## Recommendation

Choose **Option 2**.

It is the smallest change that fixes the real product issue. The core move is:

1. define a canonical competitor ad-evidence contract in the journey schema,
2. preserve that contract through the worker result boundary,
3. upgrade the worker ad-library path so it can populate that contract with real multi-platform evidence,
4. port the already-proven strategic-research ad UX into the journey artifact.

This gives the user the missing experience quickly without turning the task into a cross-repo infrastructure rewrite.

## Proposed Architecture

### 1. Canonical contract across both boundaries

Expand `competitorIntel` so each competitor can preserve both:

- the existing summary interpretation for quick reading,
- and raw ad evidence for inspection.

This payload has to survive two schema boundaries:

- `research-worker/src/contracts.ts` when the worker finalizes runner output,
- `src/lib/journey/research-result-contract.ts` when the app validates stored results.

Today both sides use non-strict Zod objects, so unknown fields are silently stripped instead of rejected. That means `adCreatives` and `libraryLinks` can disappear without any obvious failure. The fix must update both contracts together.

Add:

```ts
const competitorAdCreativeSchema = z.object({
  platform: z.enum(['linkedin', 'meta', 'google']),
  id: nonEmptyStringSchema,
  advertiser: nonEmptyStringSchema,
  headline: nonEmptyStringSchema.optional(),
  body: nonEmptyStringSchema.optional(),
  imageUrl: nonEmptyStringSchema.optional(),
  videoUrl: nonEmptyStringSchema.optional(),
  format: z.enum(['video', 'image', 'carousel', 'text', 'message', 'unknown']),
  isActive: z.boolean(),
  firstSeen: nonEmptyStringSchema.optional(),
  lastSeen: nonEmptyStringSchema.optional(),
  platforms: nonEmptyStringArraySchema.optional(),
  detailsUrl: nonEmptyStringSchema.optional(),
});

const competitorLibraryLinksSchema = z.object({
  metaLibraryUrl: nonEmptyStringSchema.optional(),
  linkedInLibraryUrl: nonEmptyStringSchema.optional(),
  googleAdvertiserUrl: nonEmptyStringSchema.optional(),
});
```

Then add these to each competitor:

```ts
adCreatives: z.array(competitorAdCreativeSchema).default([]),
libraryLinks: competitorLibraryLinksSchema.optional(),
```

Mirror those same fields in the worker contract so the enriched competitor payload survives finalization before it ever reaches the journey schema.

This preserves the current `adActivity` block but stops losing the evidence behind it.

### 2. Worker-side ad intelligence

Do not pull in `metaAds`.

Instead, upgrade the worker `adLibrary` tool so it can emit:

- summary,
- raw creatives,
- source counts,
- platform-specific library links.

The worker should mirror the app-layer behavior, not necessarily literally import it. Because `research-worker/tsconfig.json` is rooted to `research-worker/src`, true code sharing is awkward in the current repo. The practical design is:

- keep one canonical JSON contract,
- mirror the richer retrieval logic in the worker,
- port the same advertiser-matching and false-positive guards used in the richer ad-library path,
- add a follow-up cleanup item to extract a shared module later if the path proves stable.

### 3. Competitor runner behavior

Update the competitor runner prompt so ad research is first-class, but still bounded by the current latency budget.

New behavior:

- use web search to rank the 5 strongest direct competitors first,
- run richer ad-library retrieval for the top 3 competitors only,
- generate `libraryLinks` for all surfaced competitors, including the two that do not get a full creative fetch,
- if evidence is sparse or retrieval is skipped for budget reasons, say so explicitly,
- still return `libraryLinks` even when the creative set is empty,
- distinguish:
  - verified current creatives,
  - partial current coverage,
  - historical-only coverage,
  - no verified ads found.

This keeps the primary competitor runner within the current 120-second timeout envelope while materially improving the artifact. Only raise the timeout after measuring the top-3 path.

### 4. Journey UI behavior

Port the proven ad evidence affordances from strategic-research into the journey artifact:

- ad carousel inside each competitor card,
- clickable per-ad buttons using `detailsUrl`,
- platform search buttons for Meta Library, LinkedIn Ad Library, and Google Ads Transparency,
- current summary blocks retained above the detailed evidence.

The journey artifact should read top-down:

1. competitor narrative,
2. ad summary,
3. ad evidence,
4. platform library links.

### 5. Fast-hits alignment

`competitorFastHits` should remain a lightweight tool, but its output language must align with the new contract vocabulary:

- use the same coverage semantics,
- keep Meta Library in the public-ad-library lane,
- do not mention Meta Ads Manager.

## Non-Goals

- No attempt to bring `metaAds` into competitor intelligence.
- No full package extraction of ad-library code in this phase.
- No redesign of the entire journey artifact panel.
- No attempt to rewire `mediaPlan` into the live journey stream as part of this work.

## Data Flow After Fix

1. Lead agent dispatches `researchCompetitors`.
2. Worker competitor runner performs:
   - web search and ranking,
   - richer ad-library lookup for the top 3 competitors,
   - library-link generation for all surfaced competitors,
   - optional SpyFu.
3. Worker emits a competitor artifact with:
   - summary fields,
   - `adCreatives[]`,
   - `libraryLinks`.
4. `research-worker/src/contracts.ts` finalizes and preserves that data.
5. Journey normalization + validation preserves that data.
6. Artifact panel renders summary plus detailed ad evidence.

## Testing Strategy

### Backend

- Worker unit tests:
  - richer ad-library output shape,
  - low-confidence normalization,
  - link generation,
  - false-positive advertiser/domain mismatch cases,
  - competitor runner JSON extraction with the expanded schema.
- Worker contract tests:
  - enriched `adCreatives` and `libraryLinks` survive `finalizeRunnerResult`,
  - low-confidence competitors can retain empty creative arrays plus library links.
- Journey schema tests:
  - competitor schema accepts enriched competitor records,
  - validation still rejects malformed ad evidence.
- Journey normalization/contract tests:
  - expanded results survive storage + normalization,
  - no silent field stripping regression for competitor ad evidence.

### Frontend

- Artifact panel tests:
  - renders ad carousel when `adCreatives` exist,
  - renders platform library buttons,
  - preserves current limited-coverage wording for sparse results.

## Rollout Strategy

### Phase 1

Fix backend contract first:

- schema,
- worker tool,
- competitor runner,
- tests.

This gives us stable data before any UI migration.

### Phase 2

Port journey UI:

- helper extraction,
- journey ad evidence block,
- artifact panel tests.

### Phase 3

Cleanup:

- align `competitorFastHits`,
- update the research audit so it documents the real public ad-library architecture and contract boundaries,
- remove stale docs that recommend `metaAds` for competitor parity,
- document the separation between public library intelligence and account-performance tools.

## Success Criteria

- Competitor artifacts show real ad evidence, not just ad summaries.
- Enriched competitor payloads survive both the worker contract and the journey contract.
- Users can click:
  - Meta Library,
  - LinkedIn Ad Library,
  - Google Ads Transparency.
- The current competitor flow no longer depends on `metaAds`.
- Sparse data is labeled honestly without collapsing the entire feature into vague summaries.
- Existing strategic-research ad UX patterns are reused instead of duplicated blindly.
