# Codex Handoff — Wave 1 (competitor ad engine: restore the relevance-filtered evidence)

> Dispatch with `model_reasoning_effort=xhigh`, working root = this worktree
> (`feat/v2-lab-section-wire`). Four atomic commits, in order.
> Report only what you changed + build/test output + the 4 commit SHAs + anything that didn't match this spec.
> Full audit context (do not need to read to execute): `docs/2026-05-27-pipeline-audit-and-restructure.md`
> + sub-report `docs/audit/2026-05-27-tool-layer-ad-engine-kinks.md`.

## Mission & landing context
This is the DeepSeek **lab-engine** pipeline (`executionMode:'lab'` → `src/lib/lab-engine/`), the canonical engine. Wave 0 already landed (Brave `web_search`, evidence→source attribution, lab-mode kickoff). **Wave 1 restores the single most valuable artifact the lab reimplementation regressed: real, relevance-filtered competitor ad evidence.**

The audit's verdict: the lab forked from `main`'s rich ad engine and kept only a thin name-scorer. Three failures stack:
1. The Competitor section **cannot call `google_ads`/`meta_ads`** (not in its allow-list), so the deterministic ad probe always returns `[]`.
2. Even when called, the lab ad tool uses a weak name-score (`>0.5` cutoff, no domain) instead of `main`'s domain-aware `isAdvertiserMatch`/`resolveBestCandidate`. **Naively enabling the tools produces wrong-company creatives — worse than empty.** (The product owner specifically values this relevance filter.)
3. The reader **drops `adEvidence` entirely** — the renderer types against a managed-agents schema that omits the field, laundered by an `as unknown as` cast. A fully-built `CompetitorAdEvidence` component exists but is wired only to the old renderer.

**The live path is MODEL-DRIVEN.** `corpus-to-research-input.ts:616` seeds `competitorAds: []`, so the deterministic probe (`getCompetitorAdProbeAdvertisers`) has nothing to probe in production. Real ad evidence comes from the **section agent** calling `google_ads`/`meta_ads` with advertiser names + domains it discovered via `web_search`/`firecrawl`; `buildAnswerToolAdEvidence` normalizes those tool results into `body.adEvidence`. So the must-fix is: (a) let the agent call the tools, (b) make the tools return correct-company ads, (c) render the result. The deterministic probe is belt-and-suspenders (it matters for fixtures/tests).

## Global constraints (apply to every task)
- **Surgical.** Change only what each task specifies. Match existing style. Don't "improve" adjacent code or refactor unrelated paths.
- **Secrets:** never read/print/commit `.env*`. Reference keys only as `process.env.X`.
- **Zod for model-facing schemas:** do NOT put `.min()`/`.max()` on *number* fields in tool `inputSchema` (Anthropic rejects `minimum`/`maximum`). `.min(1)` on *strings* is fine. The tools may run under Anthropic OR DeepSeek — keep schemas provider-agnostic.
- **Do NOT touch the legacy worker** (`research-worker/src/...`). You will READ `main:research-worker/...` files to port logic, but every change lands in `src/lib/lab-engine/` or `src/components/`.
- **Do NOT reintroduce** any `v_current_run_id <> p_section_run_id` guard in `commit_artifact_section` (intentional revision-CAS, out of scope).
- **Port, don't import.** `main`'s matcher lives in the worker tree, which the Next.js app cannot import from. Port (copy + adapt) the functions into a new lab file.
- **Build/test gate (frontend only — Wave 1 does not touch `research-worker/`):**
  - Baseline (already captured at Wave 0 HEAD): `npm run test:run` = **131 files / 1059 tests passed, 1 skipped**; `npm run build` exit 0.
  - Pre-existing TS errors in openrouter tests and chat-blueprint tests are **expected** — do not fix, just don't add new failures.
  - After each commit: `npm run build` exits 0 and `npm run test:run` shows no *new* failures (count ≥ 1059 + your new tests).
- **Commits:** four atomic commits on `feat/v2-lab-section-wire` (do not branch, do not push). End each message with the Co-Authored-By trailer the repo uses.

---

## Task 1 — Port `main`'s advertiser-relevance matcher into the lab (pure module + tests)
**GOAL:** create the relevance engine the lab dropped, as a pure, self-contained module with no behavior change yet (applied in Task 2). This is the function the product owner values — port it faithfully.

**SOURCE (read these from `main`, do not import):**
- `main:research-worker/src/utils/name-matcher.ts` — `normalizeCompanyName` (:12), `calculateSimilarity` (Jaro-Winkler, :72), `extractCompanyFromDomain` (:182). The file is 201 lines, **zero imports** (self-contained).
- `main:research-worker/src/tools/adlibrary.ts` — `normalizeDomain` (:91), `isAdvertiserMatch` (:224-353), `resolveBestCandidate` (:390-599). Read the doc-comments at :195-223 and :355-367 — they encode the behavior matrix (short-name URL guard, corporate-suffix containment, first-word + Jaro-Winkler ≥0.8, domain corroboration, verdict tree). Port the logic verbatim; keep the comments.

**FILES**
- NEW `src/lib/lab-engine/agents/tools/advertiser-match.ts`
- NEW `src/lib/lab-engine/agents/tools/__tests__/advertiser-match.test.ts`

**STEPS**
1. In `advertiser-match.ts`, port (copy + TS-tidy to repo style): `normalizeCompanyName`, `calculateSimilarity`, `extractCompanyFromDomain`, `normalizeDomain`, `isAdvertiserMatch`, `resolveBestCandidate`. Export `isAdvertiserMatch`, `resolveBestCandidate`, `calculateSimilarity`, `extractCompanyFromDomain`, `normalizeDomain`.
2. Adapt the `Candidate` type to the lab's existing shape. The lab's `readCandidates` (`adlibrary.ts:206-221`) yields `{ id: string; name: string }`. `main`'s `resolveBestCandidate` `Candidate` is `{ name; id; entity }` and only reads `.name`. Define the ported `Candidate` as `{ id: string; name: string }` (drop `entity`) and adjust `ResolverResult.candidate` accordingly. Keep the verdict union `'accepted' | 'ambiguous' | 'rejected'` and the `reason`/`candidates` log fields.
3. `isAdvertiserMatch(advertiserName, companyName, domain?, adUrl?)` and `resolveBestCandidate(candidates, companyName, domain?, isDomainVerified?)` keep `main`'s exact signatures and decision logic.
4. No `process.env`, no network, no other lab imports — keep it pure.
5. Tests (`advertiser-match.test.ts`), mirror `main`'s documented cases:
   - `isAdvertiserMatch`: `"Buffer Inc"` vs `"Buffer"` → true; `"Atlas VPN"` vs `"Atlas"` → false; `"Direct Metals"` vs `"Directive"` → false; exact normalized match (`"Fathom"` vs `"Fathom"`) → true; short-name URL guard: `"Fathom"`/domain `fathom.video`/adUrl `https://fathomdem.com/...` → false, adUrl containing `fathom.video` → true.
   - `resolveBestCandidate`: empty → `rejected`; clear long-name winner → `accepted`; short name + verified domain + no corroboration → `ambiguous` (not hard reject); top score `<0.8` → `rejected`.
   - `calculateSimilarity`: identical strings → 1; clearly different → low.

**VERIFY:** `npm run build` exit 0; `npm run test:run -- src/lib/lab-engine/agents/tools/__tests__/advertiser-match.test.ts` green; full `test:run` no new failures.
**COMMIT:** `feat(lab-engine): port main advertiser-relevance matcher (isAdvertiserMatch + resolveBestCandidate)`

---

## Task 2 — Apply the matcher + add domain plumbing in lab `adlibrary.ts`
**GOAL:** replace the weak `0.5` name-score selection with the ported verdict resolver, add an `isAdvertiserMatch` final safety filter so wrong-company creatives are dropped, accept an optional `domain`, and return a **typed gap** (not `[]`) when a lookup ran but matched nothing.

**FILES**
- `src/lib/lab-engine/agents/tools/adlibrary.ts`
- `src/lib/lab-engine/agents/tools/__tests__/adlibrary.test.ts` (extend; create if absent)

**STEPS**
1. **Input schema** (`adLibraryAgentTool`, :586-592): add `domain: z.string().min(1).optional()`. Keep `advertiser`, `platform`, `max_results` as-is.
2. **Candidate selection:** in `searchGoogleAds` (:465-509) and `searchMetaAds` (:511-553), after `readCandidates(...)`, replace `chooseBestCandidate(candidates, advertiserName)` with `resolveBestCandidate(candidates, advertiserName, domain, domain !== undefined)`. Treat verdict `'accepted'` and `'ambiguous'` as "use `result.candidate`" (ambiguous = "try anyway", downstream filter re-checks — matches `main`). Treat `'rejected'` (or no candidate) as no-match → see step 4. Thread `domain` from `execute` into both fetchers (add `domain` to their arg objects + `fetchNativeAds`).
3. **Final relevance filter:** in `normalizeSearchApiRecords` (:446-463), after building `NormalizedAd[]`, drop any creative whose `advertiserName` fails `isAdvertiserMatch(ad.advertiserName, advertiserName, domain, ad.detailsUrl ?? ad.landingUrl ?? ad.url)`. This is `main`'s `normalizeSearchApiToCreatives` final safety pass (`main:.../adlibrary.ts:1069-1091`) — it catches wrong-company rows the candidate step let through. Pass `advertiserName` (the searched company) + `domain` down into `normalizeSearchApiRecords`.
4. **Typed gap on no-match (B6):** today `searchGoogleAds`/`searchMetaAds` `return []` when no candidate (`:490-492`, `:533-535`). Change the contract so a *lookup that ran but matched nothing* is distinguishable from "found ads". Simplest surgical shape: keep returning `NormalizedAd[]` from the fetchers, but in `execute` (:594-622), when the resolver rejected (no candidate) AND the API call succeeded, return a typed `ToolGap` — e.g. `{ type: 'gap', reason: 'not_implemented', message: \`No <platform> advertiser matched "<advertiser>"<domain?> with sufficient confidence.\` }` using the existing gap helpers/shape from `_shared.ts:3-18`. Do NOT fabricate — an honest "no confident match" gap is the goal. (Empty `ads: []` after a *matched* advertiser with zero creatives stays a successful result — that's a real "advertiser found, no active ads" signal the adapter turns into `dataGaps`.)
5. Keep the Google/Meta **SearchAPI engines and the name-search flow as-is** — the relevance gain comes from the resolver + final filter + domain corroboration, not from changing engines. (Domain-FIRST SearchAPI lookup — `main`'s `google_ads_advertiser_info` domain path — is a **noted stretch, out of scope** for Wave 1; the domain string is already used by the resolver/filter, which is the bulk of the value.)

**VERIFY:** unit tests: (a) candidates with a wrong-company name are rejected → gap; (b) a correct match returns ads; (c) a creative whose advertiserName mismatches is filtered out of `ads[]`; (d) `domain` strengthens an ambiguous short-name match. `npm run build` exit 0; full `test:run` no new failures.
**COMMIT:** `fix(lab-engine): relevance-filter adlibrary candidates + creatives, drop empty-on-miss for typed gap`

---

## Task 3 — Capture the model's ad-tool calls into `adEvidence` + enable the tools for Competitor (the live-path linchpin)
**GOAL:** make the Competitor agent's `google_ads`/`meta_ads` results actually become `body.adEvidence`. Two compounding bugs block this today: (a) the tools aren't in the section's allow-list, and (b) **even if they were, the answer-tool path harvests ad evidence ONLY from a deterministic pre-pass probe that is empty in the live flow, and discards the model's own ad-tool results.** Fix both.

**CONTEXT (verified — read before editing):**
- `streamSectionViaAnswerTool` (run-section.ts) builds ad evidence by calling `buildAnswerToolAdEvidence` at **:2581**, BEFORE the answer tool runs. That helper (:2141-2178) runs `runCompetitorAdProbeSteps` (the deterministic probe over `researchInput.competitorAds`) and `buildCompetitorAdEvidenceGroups({ steps: adProbeSteps })` — **probe steps only.**
- `researchInput.competitorAds` is seeded **`[]`** by the corpus (`corpus-to-research-input.ts:616`), so in the live flow the probe has no advertisers → `normalizedAdEvidenceGroups` is empty → `body.adEvidence` is empty.
- The model's own `google_ads`/`meta_ads` calls during the answer-tool loop arrive in `answerResult.steps` (in scope at run-section.ts **:2678**, just before `buildAnswerToolAttempt` at :2696). They are captured as activity events via `onStep`→`buildToolEvents` (:2634-2643) but their **tool results are never run through `buildCompetitorAdEvidenceGroups`** — so they never reach the artifact.
- The adapter `buildCompetitorAdEvidenceGroups` (`competitor-ad-adapter.ts:470-524`) already walks `step.toolResults` for `adlibrary`/`google_ads`/`meta_ads` and parses `AdLibraryOutputSchema` — so feeding it `answerResult.steps` works with no adapter change.
- `buildAnswerToolAttempt` (:2696-2702) receives `normalizedAdEvidenceGroups` and injects them into `body.adEvidence` via `withNormalizedSectionOutput`→`withNormalizedCompetitorAdEvidence`.

**FILES**
- `src/lib/lab-engine/sections/section-registry.ts` + `src/lib/lab-engine/sections/__tests__/section-registry.test.ts`
- `src/lib/lab-engine/agents/tools/google-ads.ts`, `src/lib/lab-engine/agents/tools/meta-ads.ts`
- `src/lib/lab-engine/skills/positioning-competitor-landscape/SKILL.md`
- `src/lib/lab-engine/agents/run-section.ts` — `streamSectionViaAnswerTool` harvest point (~:2678-2701); `runCompetitorAdProbeSteps` (:1852-1916); `getCompetitorAdProbeAdvertisers` (:1638-1646)
- `src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts` (`ensureGroup` :145-176)

**STEPS**
1. **Allow-list** (`section-registry.ts` :140): `["web_search","firecrawl","adlibrary","reviews"]` → `["web_search","firecrawl","adlibrary","google_ads","meta_ads","reviews"]` (leave `maxExternalLookups:6`; do NOT add `spyfu` — Wave 4). Update `section-registry.test.ts` to match.
2. **Domain pass-through** (`google-ads.ts`/`meta-ads.ts` :14-19): add `domain: z.string().min(1).optional()` and forward it to `adLibraryAgentTool.execute({ advertiser, platform, max_results, domain }, options)`.
3. **SKILL instruction** (Competitor `SKILL.md`, tool table ~:76-87): add one line — when calling `google_ads`/`meta_ads`, **pass the competitor's root `domain`** (e.g. `gong.io`) alongside `advertiser` so the relevance filter can disambiguate same-named companies. Keep model-facing tool names unchanged.
4. **HARVEST THE MODEL'S CALLS (linchpin)** in `streamSectionViaAnswerTool`: after `await flushBufferedEvents()` (~:2678) and before `buildAnswerToolAttempt` (:2696), and only for `positioningCompetitorLandscape`, build groups from the model's steps and merge with the pre-pass groups:
   ```ts
   const modelAdGroups = buildCompetitorAdEvidenceGroups({
     steps: answerResult.steps,
     observedAt: getNow(deps).toISOString(),
   });
   const mergedAdGroups = mergeAdEvidenceGroups(
     adEvidence.normalizedAdEvidenceGroups ?? [],
     modelAdGroups,
   ); // dedupe by advertiserName.toLowerCase(); union creatives/links; model groups win on conflict
   ```
   Pass `mergedAdGroups` (not `adEvidence.normalizedAdEvidenceGroups`) as `normalizedAdEvidenceGroups` to `buildAnswerToolAttempt` (:2701). Add a small `mergeAdEvidenceGroups` helper (or inline the dedupe). Non-Competitor sections: unchanged (pass through as today). This is what makes live `body.adEvidence` non-empty.
5. **Adapter `group.domain`** (`competitor-ad-adapter.ts`): set `group.domain` from the tool call's `input.domain` (read off `matchingToolCall?.input` the same way `readRequestedPlatform` does at :97-109) instead of leaving it `null` at :163.
6. **Honest gap on missing tools (B6)** + probe domain (belt-and-suspenders, fixtures): in `runCompetitorAdProbeSteps` (:1863-1868), when `google_ads`/`meta_ads` are absent, return a single synthetic gap step (`toolResults` carrying `{ type:'gap', reason:'not_implemented', message:'...' }`) instead of `return []`, so the adapter records a `sourceError`. When present and `researchInput.competitorAds[]` carries a derivable domain, pass `domain` in the probe inputs. (Live `competitorAds` is `[]`, so this is mostly fixture/test correctness — the live evidence comes from step 4.)

**VERIFY:** integration/unit test: feed an `answerResult.steps` fixture containing a `google_ads` (and `meta_ads`) result with matching-company ads through the harvest path → assert `body.adEvidence.advertiserGroups` is populated and a wrong-company ad is filtered (Task 2). `section-registry.test.ts` + adapter test green (`group.domain` set from input; missing-tools probe yields a gap step). `npm run build` exit 0; full `test:run` no new failures.
**COMMIT:** `feat(lab-engine): harvest model ad-tool calls into adEvidence + enable google_ads/meta_ads for Competitor`

---

## Task 4 — Render `adEvidence` in the reader (E1/E2 — stop dropping the headline artifact)
**GOAL:** the Competitor renderer must show the fetched ad creatives + library links + raw/displayable counts + data gaps. Today it destructures every body field **except** `adEvidence` and types against a managed-agents schema that omits the field.

**FILES**
- `src/lib/managed-agents/schemas/competitor-landscape.ts` (add the `adEvidence` shape to the type the renderer imports)
- `src/components/research-v2/section-renderers/competitor-landscape.tsx`
- `src/components/research-v2/section-renderers/__tests__/competitor-landscape.test.tsx` (extend; create if absent)
- (reuse, do not modify) `src/components/research/competitor-ad-evidence.tsx`

**CONTEXT (verified):**
- The lab body schema **already carries** `adEvidence` (`src/lib/lab-engine/artifacts/schemas/competitor-landscape.ts:225-243`) — Task 3 is what makes it non-empty in the live flow; this task renders whatever it holds: `adEvidence.advertiserGroups[]` each `{ advertiserName, domain, platforms, rawCounts{google,meta,linkedin}, displayableCounts, displayableTotal, returnedCreativeCount, creatives[], libraryLinks{google?,meta?,linkedin?}, rawSourceSamples[], dataGaps[], sourceErrors[], observedAt }`. Each creative: `{ id, platform, advertiserName, headline|null, body|null, landingUrl|null, creativeUrl|null, imageUrl|null, videoUrl|null, detailsUrl|null, sourceUrl, firstSeen|null, lastSeen|null, format, isActive }`.
- At runtime `adEvidence` IS on the object the renderer receives (the picker spreads the whole body); it's invisible only because the **managed-agents type** (`src/lib/managed-agents/schemas/competitor-landscape.ts:118-137`) has no `adEvidence`, and `typed-artifact-renderer.tsx:485` casts `artifact as unknown as CompetitorLandscapeArtifact`, laundering the gap.
- The existing component `CompetitorAdEvidence` (`src/components/research/competitor-ad-evidence.tsx:407-567`) takes props `{ adActivity?, adCreatives?: AdCreative[], libraryLinks?: { metaLibraryUrl?, linkedInLibraryUrl?, googleAdvertiserUrl? } }`. `AdCreative` = `{ platform:'linkedin'|'meta'|'google', id, advertiser, headline?, body?, imageUrl?, videoUrl?, format, isActive, detailsUrl?, firstSeen?, lastSeen? }`. It renders a creatives carousel + library links + filter pills.

**STEPS**
1. **Schema type:** in `src/lib/managed-agents/schemas/competitor-landscape.ts`, add Zod sub-schemas mirroring the lab `adEvidence` shape (advertiserGroups + creatives + libraryLinks + counts + dataGaps + sourceErrors) and add `adEvidence: AdEvidenceSchema` to `CompetitorLandscapeArtifactSchema` (flat, top-level — this file's artifact is flat, fields at top level, not under `body`). Mirror the lab schema's field names/nullability exactly so the runtime object type-checks. Keep this file's looser validation style (it's the Next.js mirror); the lab schema remains the strict source of truth.
2. **Renderer:** in `competitor-landscape.tsx`, add `adEvidence` to the destructure (:313-321). Add an `8 · Ad Evidence` `SubsectionBlock` after `7 · Ad Presence` (:541-549). Map `adEvidence.advertiserGroups` → for each group render `<CompetitorAdEvidence adCreatives={...} libraryLinks={...} />`:
   - `adCreatives`: map `group.creatives` → `AdCreative` (`advertiserName`→`advertiser`; `null`→`undefined` for optional fields; `format` is a free string in the lab schema, coerce/pass through — the component treats unknown formats gracefully).
   - `libraryLinks`: `{ metaLibraryUrl: group.libraryLinks.meta, linkedInLibraryUrl: group.libraryLinks.linkedin, googleAdvertiserUrl: group.libraryLinks.google }`.
   - Header per group: `group.advertiserName` + a small "raw N / displayable M" count line from `rawCounts`/`displayableCounts`.
   - **Surface gaps honestly:** if `group.dataGaps`/`group.sourceErrors` are non-empty, render them as muted notes (don't hide them) — this is the "honest gap" bar.
   - Empty state: if `adEvidence.advertiserGroups` is empty, render `adEvidence.prose` + a muted "No live ad creatives captured for this audit." (do not invent data).
3. Keep using the design-token classes already in the file; do not introduce new color vocabularies (the `--text-primary`/`--accent-blue` drift is a Wave 4 cleanup — don't expand it, but you may use the shadcn semantic tokens the rest of the shell uses for any new markup).

**VERIFY:** extend the competitor renderer test with an artifact fixture that has `adEvidence.advertiserGroups[0].creatives[...]` and assert the creatives + a library link render (and that an empty `advertiserGroups` shows the empty state, not a crash). `npm run build` exit 0; full `test:run` no new failures. **Manual:** note that a live screenshot needs a real run with `SEARCHAPI_KEY` — flag as manual follow-up, do not loop paid API calls.
**COMMIT:** `feat(research-v2): render competitor adEvidence creatives + library links in the reader`

---

## Out of scope for Wave 1 (do not touch)
- Streaming partials, telemetry rollup (`latestTool`/`latestSource`), source-URL capture, orphan reaper, double-kickoff de-dup → **Wave 2**.
- Claim/citation verifier, eval harness → Wave 3.
- LinkedIn + Foreplay platform breadth, domain-FIRST SearchAPI engine lookup, `spyfu` enablement, SERP-shim renames, skill↔registry diff test, the `--text-primary`/`--accent-blue` color sweep → Wave 4.
- `commit_artifact_section` revision CAS (working as intended).

## Optional Wave-0 carry-over (only if trivially in-flight; else skip)
- `brave-search.ts` hardcodes `extra_snippets: []` and its `BraveSearchApiResult` interface omits the field — Brave returns `web.results[].extra_snippets`. If you're already in the tool layer, you may populate it (`extra_snippets: Array.isArray(result.extra_snippets) ? result.extra_snippets : []`) and add the field to the interface. Strictly optional; not part of any Wave 1 commit's scope if it adds risk.

## Report back
The 4 commit SHAs; baseline vs final `test:run` counts; `build` exit code; confirmation that (a) the matcher is a pure no-import module, (b) `google_ads`/`meta_ads` are in Competitor's allow-list and the test matches, (c) the renderer shows `adEvidence` with an empty-state fallback; and anything that didn't match this spec (flag it, don't silently work around it).
