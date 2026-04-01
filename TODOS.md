# TODOS

## Scripting Engine — Phase 2 Quality Improvements

### Prompt requirement overload (from Codex review 2026-03-30)
**What:** Pass 1 prompt asks 3 scripts to cover 3-5 angles, all 3 formats, and all 3 platforms. That's 9+ combinations from 3 scripts, which is contradictory.
**Why:** The model has to make impossible tradeoffs. Some batches will always miss a format or platform because 3 < 9.
**Pros:** Fixing this would let each script focus on doing one thing well instead of trying to be everything.
**Cons:** Requires rethinking the generation architecture (maybe 5 scripts per level, or format-specific prompts).
**Context:** Identified by Codex during plan review. Pre-existing since the scripting engine was built. Not blocking the current quality fixes. Consider after eval data from 3 batches.
**Depends on:** Current quality fixes shipped first.

### Google RSA schema mismatch (from Codex review 2026-03-30)
**What:** The `adScriptGenerateSchema` has a single `headline` field, but Google RSAs need up to 15 headlines and 4 descriptions that work in any combination.
**Why:** Google RSA scripts are structurally different from Meta/LinkedIn ads. The current schema can't represent them properly.
**Pros:** Fixing would let the engine generate proper RSA assets that can be pasted directly into Google Ads.
**Cons:** Requires schema versioning or a union type, plus frontend rendering changes.
**Context:** Identified by Codex. Pre-existing. The current schema works for Meta and LinkedIn but is insufficient for Google.
**Depends on:** Nothing blocking, but lower priority than the quality fixes.

### Deterministic per-script proof assignment (from Codex review 2026-03-30)
**What:** Instead of showing a subset of proof points to each level and letting Claude pick, assign specific proof points to specific scripts deterministically.
**Why:** Maximum control over proof distribution. Eliminates any chance of the same stat appearing in every script.
**Pros:** Guaranteed proof diversity. No reliance on prompt compliance.
**Cons:** Removes Claude's ability to pick the most contextually appropriate proof for each angle. More rigid.
**Context:** Codex recommended this. Review chose the subset+tracking approach for v1. Re-evaluate after 3 batch evals. If proof overuse persists despite subset rotation, upgrade to deterministic.
**Depends on:** Current subset+tracking approach shipped and evaluated first.

## Wasam Feedback Sprint — Implementation Notes (from eng review 2026-03-31)

### PR 3: adLibraryTool type mismatch in offer runner
**What:** `adLibraryTool` is a `betaZodTool` (different type than `WEB_SEARCH_TOOL`/firecrawl tools). The `OfferTool` union type at `offer.ts:21` must be extended. Also verify the offer runner's context includes the client's domain — competitors runner gets it, but offer runner might not.
**Why:** Without the type fix, TypeScript will reject the tool array. Without the domain, the ad library search has nothing to query.
**Pros:** Catching this before implementation saves debug time.
**Cons:** None.
**Context:** Found by outside voice (Claude subagent) during eng review. PR 3 effort revised from S to M.
**Depends on:** Nothing — part of PR 3 implementation.

### PR 5: Capterra must go in reviews.ts, not runner prompt
**What:** Review fetching is handled by `research-worker/src/tools/reviews.ts:fetchReviews()`, a deterministic utility running outside the AI agent loop. Add `scrapeCapterra(domain)` to `reviews.ts` alongside `scrapeTrustpilot()` and `searchG2()`, NOT via prompt instruction.
**Why:** Mixing deterministic review fetching (reviews.ts) with AI-directed fetching (prompt) creates two parallel mechanisms that fight each other.
**Context:** Found by outside voice during eng review. Changes implementation approach for PR 5 but not scope.
**Depends on:** Nothing — part of PR 5 implementation.

### PR 6: Verify competitor domains in keywords context
**What:** Before coding the parallel pre-fetch for per-competitor SpyFu calls, verify that competitor domains are actually passed into the keywords runner's context payload. The keywords runner runs after competitors in the pipeline, but that doesn't guarantee domain data flows through.
**Why:** If domains aren't in the context, the pre-fetch has nothing to fetch and SpyFu calls will fail or use fabricated domains.
**Context:** Found by outside voice during eng review. Prerequisite check, not a code change.
**Depends on:** Must be verified BEFORE starting PR 6 implementation.

### PR 7: Add structured CVR field to synthesis schema
**What:** Add `estimatedDemoPageCvr: z.number().max(10).optional()` to the synthesis output schema so CVR can be validated programmatically, not just via prompt guardrails.
**Why:** `planningContext` has no CVR/percentage fields — CVR appears in free-text only. Prompt guardrails are the 80/20 fix, but a schema field enables deterministic validation.
**Context:** User chose option B (structured field) over prompt-only. Outside voice identified that post-processing on a non-existent field does nothing.
**Depends on:** Nothing — part of PR 7 implementation.
