# Ad Engine + I1–I6 — Decision-Ready Findings

Worktree: `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire/` · Branch `feat/v2-lab-section-wire` · HEAD `98c033c5`
Mode: read-only research. No live/paid calls were made. All file:line refs verified at this HEAD unless marked low-confidence.

---

## 1. Executive Summary

- **The live ad engine is real but thin and structurally unable to fail loud.** The 6 positioning sections (including the CompetitorLandscape ad probe) run **in-process on Vercel**, not on the Railway worker (adversarial-verdict: **confirmed** — `lab-section-job.ts:53-61`, `orchestrate/route.ts:84-86,134`). The lab only ported the **Google + Meta** SearchAPI paths into `src/lib/lab-engine/agents/tools/adlibrary.ts:18` (`z.enum(["meta","google"])`, verified). LinkedIn, Foreplay, and cross-platform merge/dedup were dropped. The full worker engine (`research-worker/src/tools/adlibrary.ts`) is orphaned off the live path.
- **Zero ad creatives is an ORDERING problem, not a probe bug.** The competitor-ad probe is a deterministic **prepass** created at `run-section.ts:4184` and fully `await`ed at `:4224` **before** the answer-tool model runs (`:4234`). It can only search ad libraries for advertisers seeded from onboarding `topCompetitors` (`corpus-to-research-input.ts:882-890`, verified: `competitorAds: []` hardcoded, `competitorSeeds` = `topCompetitors` only).
- **CORRECTION (verdict refutes investigate):** the `seeding-dataflow-I2` finding's *secondary* claim that "re-seeding from the model-discovered set is feasible because the discovered set exists before the probe fires" is **REFUTED**. The premise is inverted — the prepass finishes and its output is fed *into* the model's instructions (`:4329`); the LLM-discovered competitors do not exist at probe time. Re-seeding requires a **second probe after generation**, not re-seeding the already-run one.
- **CORRECTION (verdict tightens a recommendation):** the `provider-capabilities` finding recommends "promote Foreplay to primary." The adversarial verdict **confirms** the Foreplay API contract and that a real key + `ENABLE_FOREPLAY=true` exist in `research-worker/.env.local`, but bounds it: key liveness/credit balance is **unverifiable without a live call**, and Foreplay yield is a fallback path. So Foreplay is "plausibly funded," not "proven primary."
- **I1 (duplicate React key) is CONFIRMED and NOT fixed on HEAD** — `data-table.tsx:78` still reads `key={keyFn(row, rowIndex)}` (verified). One-line fix. I3 (table width) needs an additive API + human design forks. I4/I5/I6 confirmed (I5 gate is default-OFF, verified `evidence-support.ts:75-76`). I6 is **doc-only** — the `/research-v2` page route cannot be deleted (live test imports it).

---

## 2. Ad Engine — Confirmed Truth + Resurrection Plan

### 2.1 Where ads actually come from (confirmed)

| Layer | Reality | Evidence |
|---|---|---|
| Runtime | In-process on Vercel; worker engine unreachable | `lab-section-job.ts:53-61`, `orchestrate/route.ts:84-86,134` (verdict: confirmed) |
| Platforms | **Google + Meta only**; LinkedIn is a schema phantom (counts structurally 0) | `adlibrary.ts:18` (verified); adapter always appends a "LinkedIn not probed" gap `competitor-ad-adapter.ts:456-467` |
| Invocation | Deterministic **prepass**: `runCompetitorAdProbeSteps` fires `google_ads`+`meta_ads` per advertiser regardless of the model | `run-section.ts:2697-2792`, `section-registry.ts:155-169` (`adReservedLookups=6`) |
| Fetch shape | 2 sequential SearchAPI GETs/platform (candidate search → id → ads), region=US, 15s/call | `adlibrary.ts:464-523` (Google), `:525-580` (Meta) |
| Landing field | Live probe → `body.adEvidence.advertiserGroups[].creatives[]`; `body.adPresence` is **separate model prose**, NOT the probe | `run-section.ts:998-1031`; `competitor-landscape.ts:124-243` |
| Failure mode | Every failure (no key / no match / HTTP error / abort / zero creatives) degrades to a typed gap — **never throws** | `adlibrary.ts:616-672`; `competitor-ad-adapter.ts:412-475` |

**The toothless gate.** `hasAdEvidenceOrGap` passes if any group has creatives>0 OR has a nested gap, and `buildDataGaps` **always** appends the linkedin-not-probed gap (`required-evidence.ts:118-142` + `competitor-ad-adapter.ts:461-467`). Net: **zero-creative runs always pass CompetitorLandscape and silently ship an empty ad section.**

### 2.2 The seeding/ordering constraint (load-bearing — drives the plan)

The probe is seeded only from static inputs known before the model runs:
1. `researchInput.competitorSeeds` (priority) — built **solely** from onboarding `topCompetitors` (`corpus-to-research-input.ts:883-890`, `buildCompetitorSeeds` returns `[]` on empty input `:692`).
2. `researchInput.competitorAds` — **hardcoded `[]`** (`:882`), a fixture/preview field, never populated at runtime.

Because the prepass is awaited at `run-section.ts:4224` *before* `runAnswerTool` (`:4234`), **the LLM-discovered competitor set cannot seed the probe.** Two non-exclusive fixes:

- **Fix A (cheap/surgical):** ensure onboarding `topCompetitors` is non-empty AND the typed names match real ad-library advertiser records. If `topCompetitors` is empty in the failing run, this alone explains zero creatives — no architecture change.
- **Fix B (architectural, higher-yield):** add a **second ad probe AFTER the answer tool emits its competitor list**, seeded from discovered names, merged via the existing `buildMergedAnswerToolAdEvidenceGroups` hook (`run-section.ts:4430`/`:4527`). **Must re-check the shared `adReservedLookups=6` budget** (`SectionToolBudget`, `run-section.ts:4160-4163`) so the second probe does not starve the first or double-count.

> Any resurrection plan MUST decide A vs B (or both). The live sandbox probe (§3) settles whether the bottleneck is seeding/name-matching (→ A) or true-empty-at-source/over-filter (→ tool fixes), before either lands.

### 2.3 LinkedIn + Foreplay port spec (skip Apify)

Resurrect **three** worker capabilities into the lab tool layer; **do NOT port Apify** (dead in the worker too — `apify-ads.ts:455-458`; worker-only `apify-client` dep; 75s actor waits; account exhausted 2026-03-30).

**(1) LinkedIn — NEW `src/lib/lab-engine/agents/tools/linkedin-ads.ts`**
- Lift `searchLinkedInAds` from `research-worker/src/tools/adlibrary.ts:737-859`. Engine `linkedin_ad_library`, param **`advertiser=`** (NOT `q=`), read **`payload.ads`** (not `page_results`/`ad_creatives`).
- **Port the Layer-4 link-redirect false-positive guard verbatim** (`worker adlibrary.ts:785-847`): %2E-decoded domain check + `linkedin.com`/`lnkd.in` slug extraction (`:811-829`) + short-name drop rules. This guard exists to stop the Fathom-style wrong-company flood; do not drop it.
- Reuse the already-inlined `isAdvertiserMatch` / `normalizeSearchApiRecords` / `normalizeDomain` from `advertiser-match.ts` — **zero new matcher duplication**; only the private slug-guard helper is new.

**(2) Foreplay — NEW `src/lib/lab-engine/agents/tools/foreplay-ads.ts`**
- Lift `searchForeplayAds` (`worker adlibrary.ts:969-1036`). Two fetches: `getBrandsByDomain` (limit=1, order=most_ranked) → `getAdsByBrandId` (brand_ids, limit=12, order=newest). Base `public.api.foreplay.co`. Auth = raw key in `Authorization` (no Bearer). 8s timeout. **Verdict: confirmed** the contract is current and a non-placeholder key + `ENABLE_FOREPLAY=true` exist in `research-worker/.env.local`.
- Gate: `FOREPLAY_API_KEY && process.env.ENABLE_FOREPLAY==='true'`. Trigger: only when summed `google+meta(+linkedin)` raw count < 3.
- Duplicate ONLY the two interfaces (`ForeplayBrand` worker `:72-76`, `ForeplayAdRecord` worker `:78-86`).
- **Wire at the probe-merge join, NOT as an agent tool.** Foreplay contributes **themes/confidence signal only**, never displayable creatives (worker `buildAdInsight :1309-1334` — Foreplay ads feed messages, not `adCreatives`).

**(3) Wire `linkedin_ads` through the four registries (or it is silently dropped):**
- `agents/tools/index.ts` → register `linkedin_ads` in `TOOL_CATALOG`.
- `competitor-ad-adapter.ts`: add to `AdToolName` (`:12`), `adToolNames` (`:49`), `platformFromToolName`→`linkedin` (`:89-95`); **DELETE/condition** the hardcoded linkedinNotProbedGaps (`:456-467`) so real results aren't shadowed.
- `run-section.ts`: 3-way `Promise.all` in `runCompetitorAdProbeAdvertiserStep` (`:2632-2695`) + `linkedin_ads` lookup in `runCompetitorAdProbeSteps` (`:2697-2766`).
- `budget.ts:27-33`: add `linkedin_ads` to the ad-tool set.
- `section-registry.ts:155-169`: add `linkedin_ads` to allowedTools.
- The competitor-landscape schema already has the `linkedin` slot (`competitor-landscape.ts:10,145,173`) — **no schema change**.

**Budget math (decision point):** `adReservedLookups=6` ÷ 2 lookups/advertiser = 3 advertisers. With LinkedIn it's 3 lookups/advertiser → only 2 advertisers. To keep 3 advertisers × 3 platforms, raise `adReservedLookups` 6→9 (`section-registry.ts:169`), ~$0.5–1 added/run.

### 2.4 Provider capability + cost ranking

| Rank | Source | Creative richness | Cost | Status in code |
|---|---|---|---|---|
| 1 | **Foreplay** | video file + duration + transcription + emotional analysis + media + copy + CTA; durable hosted media (107M ads) | 1 ad = 1 credit; 10k free/mo; $99/mo=100k | wired but **gated OFF**, fallback only; **liveness unverified** |
| 2 | **SearchAPI Meta** | full inline creative (title/body/caption/cta + image/video) | ~$3.20→$1.60 / 1k ads | live, wired |
| 2 | **SearchAPI LinkedIn** | headline/body_text/image/cta | per-search billing | engine exists; **not ported to lab** |
| 3 | **SearchAPI Google** | **metadata only** (thumbnail/format/dates) — NO copy in main response | per-search | live; **flat-field bug** below |
| 4 | **Apify** | all 3 libraries, sub-cent/ad | cheapest | async/brittle/exhausted — **do not use live** |

**Real bug (worker layer, confirmed by docs):** Google creatives are read via FLAT `record.image_url`/`record.headline` (`worker adlibrary.ts:27-28,1097-1134`) but SearchAPI's Google engine returns **nested `image.link` and NO text**. So Google ad images + copy are structurally unreachable. Treat Google as metadata-only; map `image.link` if a thumbnail is wanted; stop expecting Google ad copy. (Confidence: high on docs; the exact lab normalizer equivalent should be checked when the LinkedIn port touches that path.)

### 2.5 What the sandbox probe MUST settle before any code lands

1. Is `SEARCHAPI_KEY` present and valid (vs 401/403 vs 429)?
2. For real competitors: empty candidates (not indexed) vs verdict-rejected (name-match) vs candidate-but-zero-ads (true empty) vs rows-fetched-but-all-filtered (over-filter, code fix)?
3. Does the `linkedin_ad_library` engine even respond on this plan/key?
4. Is the production 0-ads symptom at the tool layer at all, or upstream in seeding (outcome **J** = "look upstream")?

If all cells come back HEALTHY, the fix is seeding (Fix A/B), not the tool.

---

## 3. The Bounded Sandbox Probe

Throwaway diagnostic. Makes real (paid) SearchAPI calls, **HARD-capped** at `MAX_SEARCHAPI_REQUESTS` (default 24). No loop runs without the abort condition (paid-API rule honored). Prints **no** secret values — only Boolean key presence. **Do NOT commit.**

**Create:** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire/scripts/zero-ads-probe.ts`

**Run command (worktree root):**
```bash
node_modules/.bin/tsx --env-file=.env.local scripts/zero-ads-probe.ts
# or
npx tsx --env-file=.env.local scripts/zero-ads-probe.ts
# raw-replicate ALL 6 cells too (25 requests):
MAX_SEARCHAPI_REQUESTS=25 npx tsx --env-file=.env.local scripts/zero-ads-probe.ts
```

**What it does** (verified against ground truth — lab tool signature `execute({advertiser,platform,max_results,domain},{abortSignal})` `adlibrary.ts:644-647`; Google/Meta engine names + param keys `:477-522,538-579`; `resolveBestCandidate(...,domain!==undefined)` `:490-495,547-552`; post-filters `isAdvertiserMatch`→`hasUsableCreativeText` `:444-462`; LinkedIn `advertiser=`+`ads[]` worker `:737-757`; tsx 4.22.3/dotenv/ai v6/zod v4 installed, `.env.local` present):

1. Logs `SEARCHAPI_KEY`/`FOREPLAY_API_KEY` presence as Booleans only.
2. One raw `linkedin_ad_library?advertiser=Notion` probe (proves engine existence) — request #1.
3. Real `adLibraryAgentTool.execute()` for {Notion, ClickUp, Asana} × {google, meta} — 6 cells × 2 internal fetches = 12 (total 13).
4. Raw-replicates the exact two-step SearchAPI sequence for **gap/empty cells first**, logging candidate list, `resolveBestCandidate` verdict+reason+per-candidate scores, raw rows pre-filter, rows surviving `isAdvertiserMatch`, then rows surviving `+hasUsableCreativeText` — until the budget is exhausted, aborting deterministically.

A module-level counter `reserveRequest()` is called immediately before every fetch (including reserving the 2 internal fetches each `execute()` makes, which bypass the script's own counter) and throws `BudgetExceededError` past the cap → `≤24` guaranteed.

> Note: Notion/ClickUp/Asana are all >6 chars, so short-name ambiguity is **out of scope** for the default run. If the real production failures are short brands (e.g. `ramp.com`), add one short-named advertiser+domain to `ADVERTISERS` to exercise the short-name reject/ambiguous branches. The full script body is in the `sandbox-probe-spec` finding's `exact_edit_sites` and should be created verbatim.

**Interpretation table (outcome → cause):**

| # | Observable outcome | Root cause |
|---|---|---|
| A | `SEARCHAPI_KEY present:false` | KEY ABSENT (config). Lab returns `missing_credential` gap; never fetches. |
| B | candidate/ads fetch HTTP 401/403 | KEY INVALID/unauthorized for this engine on the plan. |
| C | HTTP 429 | RATE LIMITED (transient). Re-run; not a 0-ads root cause. |
| D | HTTP 5xx | SearchAPI server error (transient). |
| E | candidates list EMPTY (200, 0 candidates) | NO CANDIDATE — advertiser not indexed. Lab → `not_implemented` gap. |
| F | candidates non-empty BUT verdict=rejected | NO CANDIDATE (name-match <0.8 / wrong entity). Lab → `not_implemented` gap. |
| G | verdict accepted/ambiguous, ads endpoint 0 rows | CANDIDATE-BUT-NO-ADS — true empty at source for that platform/region. |
| H | raw rows >0 BUT survived(+usableText)=0 | OVER-FILTER — `isAdvertiserMatch`/template gate drops everything. **Code-side fix.** |
| I | raw rows >0 AND survived >0 BUT execute()=0/gap | DIVERGENCE — region/param/maxResults/normalizeDomain mismatch between raw and lab. Inspect the differing arg. |
| J | raw healthy AND execute() returned ads | HEALTHY — 0-ads is NOT this cell; **look upstream (seeding/competitor inputs).** |

---

## 4. I1, I3, I4, I5, I6

### I1 — Duplicate React key (DataTable)
- **Fixed on HEAD?** **NO** — verified `data-table.tsx:78` still reads `key={keyFn(row, rowIndex)}`.
- **Root cause:** `competitor-landscape.tsx:715` passes `rowKey={r => r.url || r.name}` over the raw unconstrained-LLM array; schema `competitor-landscape.ts:16-17` puts no uniqueness on `url`/`name`. When the LLM emits the same url twice → identical React keys → mis-reconciliation.
- **Edit:** `data-table.tsx:78` → `` key={`${keyFn(row, rowIndex)}-${rowIndex}`} ``. Single line; immunizes all DataTable call sites (the only `rowKey`-bearing component). No test changes (`data-table.test.tsx` asserts content/`rowTestId`, never keys).
- **Type:** **quick-win.** Verify `npm run test:run` on data-table + competitor-landscape.
- *Out of scope flag:* the carousel keys cards by unconstrained `creative.id` (`competitor-ad-evidence.tsx:546`) — a separate latent dup-key surface the data-table fix does not reach.

### I3 — Width-naive DataTable
- **Fixed on HEAD?** **NO** — `data-table.tsx:47` is `w-full border-collapse` with no `table-fixed`/`<colgroup>`/per-column wrap; columns are 100% browser-auto, so a prose cell starves the others. Lives in a 760px reader column (`audit-reader-shell.tsx:1243`).
- **Root cause sites:** `data-table.tsx:7-14` (no width/wrap fields), `:47` (no `table-fixed`), `:45` (only `overflow-x-auto`, zero <640px strategy), `:55` (10px low-contrast header), `:80` (transparent row borders). Worst offender: `paid-media-plan.tsx:128-131` "Framework" joins ≤7 sentences into one cell.
- **Quick-win (ship now, mechanical, within DESIGN.md):** add optional `width/minWidth/maxWidth/grow` + `wrap('wrap'|'truncate'|'nowrap'|'clamp')/clampLines` to `DataTableColumn`; emit `<colgroup>` + apply `table-fixed` **only when a column opts in** (untouched tables byte-identical → zero regression, `data-table.test.tsx` stays green). Apply `clamp(2)` to the named prose columns; move paid-media "Framework" out of the cell.
- **Design-gated (needs approval — these are the literal DESIGN.md spec, not bugs):** header contrast (`DESIGN.md:139` mandates 10px text-4), visible row separators (`DESIGN.md:138` mandates none), widening the 760px column (`DESIGN.md:106`), and the <640px stack-vs-scroll default. See §6 forks.

### I4 — Corpus sources/citations never rendered
- **Fixed on HEAD?** **NO** (data captured, never shown).
- **Root cause / data flow:** corpus runner DOES return `corpus.sources`, `corpus.evidence`, top-level `citations[]` (`deep-research-program.ts:1276-1280`). But (1) `session-state.ts:89` reads **only** `corpus.data.onboardingFields` — sources/citations are dropped; (2) `onboarding-wizard.tsx:481-482,509` consumes `review.pinnedFieldKeys`/`fieldCount` only, never `review.fields[].sourceUrl` (which IS populated — `onboarding-review.ts:126-137`).
- **Edit sites:** add a "Researched N sources" surface (`corpus-stream.tsx:50-72`); thread `corpus.sources`/`citations` through `session-state.ts:84-98`; render `review.fields[].sourceUrl` as an `ExternalLink` in `onboarding-wizard.tsx:481-509`. **Reuse the PATTERN of `prefill-summary.tsx:168-179` (ExternalLink + ConfidenceBadge), NOT the component** — it is legacy `CompanyResearchOutput`-typed with mismatched field keys.
- **Type:** quick-win for per-field links (data already present); the source-count surface needs the §6 placement decision (live transient vs persistent).

### I5 — Unlabeled verification numbers (header RunStatusBar)
- **Fixed on HEAD?** Partially — the **per-section** `VerificationBadge` IS labeled ("Verified N / Unsupported N", `audit-reader-shell.tsx:320-324`). The **header RunStatusBar** is NOT (bare Check icon + number, AlertTriangle + number, no text/tooltip/aria-label, `:718-728`, render `:1224-1230`).
- **Gate is default-OFF (verified):** `getMaxUnsupportedAllowed` returns `Infinity` unless `LAB_VERIFIER_MAX_UNSUPPORTED` is set (`evidence-support.ts:75-76,81-82`; wiring `run-section.ts:5832-5835` "armed but default-OFF"). So flagged claims are **advisory**, not blocking — copy must say so.
- **Edit:** label/tooltip on the two spans at `:718-728` only. Do NOT touch the per-section badge.
- **Type:** quick-win.

### I6 — `/research-v3` canonical; `/research-v2` page orphaned
- **Fixed on HEAD?** Nav is already correct — every non-test navigation targets `/research-v3` (`page.tsx:83`, `dashboard/page.tsx:47,108`, `app-sidebar.tsx:22`, `onboarding/page.tsx:37`, sign-in/up `:28`). The **doc** is the only thing to fix.
- **Constraint:** the `/research-v2` page route is **orphaned for nav** but its `/api/research-v2/*` routes are the shared backend v3 itself calls (`research-v3/page.tsx:286,413,447,474`). And the page route is imported by a **live test** (`research-v2/__tests__/page-one-pager.test.tsx:62` — `await import('../page')`).
- **Edit:** **doc-only.** Mark `/research-v3` canonical, `/research-v2` page route orphaned-but-retained. **Do NOT delete the v2 route** this pass — it would break `npm run test:run` and the `/api/research-v2/*` endpoints are load-bearing for v3.
- **Type:** quick-win (doc-only). Full route deletion = follow-up requiring test port.

---

## 5. Recommended Phased Execution Plan

Serialize all writes to `run-section.ts` (probe ordering, second-probe, LinkedIn 3-way Promise.all, budget all touch it). Each phase has a verify gate.

**Phase 0 — Live sandbox probe (settles the 0-ads cause before any code).**
- Create + run `scripts/zero-ads-probe.ts` (§3) at default cap 24.
- **Verify gate:** map every cell to the interpretation table. Decide the dominant cause: seeding/name-match (→ Phase 2 Fix A/B) vs over-filter (→ tool code fix) vs true-empty. Confirm whether `linkedin_ad_library` responds on the plan. Do NOT commit the probe.

**Phase 1 — I-list quick-wins (no ad-engine entanglement, parallel-safe).**
- I1 (`data-table.tsx:78`), I5 (`audit-reader-shell.tsx:718-728` label), I6 (doc-only), I3 additive API + `clamp(2)` on named prose columns + move paid-media "Framework" out of cell.
- I4 per-field `sourceUrl` links + thread `corpus.sources` through `session-state.ts`.
- **Verify gate:** `npm run build` exit 0; `npm run test:run` green (data-table, competitor-landscape, page-one-pager untouched); manual screenshot of one section + onboarding.

**Phase 2 — Seeding fix (depends on Phase 0 verdict).**
- If Phase 0 = seeding/name-match: **Fix A** — guarantee `topCompetitors` is non-empty + cleaned at the corpus seam (`corpus-to-research-input.ts:883-890`).
- If Phase 0 says the discovered set is needed: **Fix B** — second post-model probe seeded from the answer-tool competitor list, merged via `buildMergedAnswerToolAdEvidenceGroups` (`run-section.ts:4430/4527`); **re-account `adReservedLookups` budget** so the second probe can fund advertisers.
- **Verify gate:** unit test the seed builder on empty/decorated inputs; one live single-advertiser probe shows ≥1 creative for a seeded competitor.

**Phase 3 — Ad engine resurrection (serialized writes to run-section.ts).**
- 3a. NEW `linkedin-ads.ts` (port `searchLinkedInAds` + Layer-4 guard).
- 3b. Wire `linkedin_ads` through index/adapter/budget/section-registry; delete the stale linkedinNotProbedGaps; 3-way `Promise.all` in the probe.
- 3c. NEW `foreplay-ads.ts` wired at the merge join (themes/confidence only); gate `FOREPLAY_API_KEY && ENABLE_FOREPLAY`.
- 3d. Fix the Google flat-field read (map `image.link`; stop expecting copy).
- 3e. Tighten the toothless gate: require a creative OR a non-linkedin gap (`required-evidence.ts:118-142`) so "no ads" stops shipping silently (gate behind a flag if regression-risky).
- **Verify gate:** `npm run build` + targeted tests; the §3 probe (or a LinkedIn-extended variant) shows the LinkedIn engine returning rows with the guard applied; no regression on Google/Meta cells.

**Phase 4 — Behavioral E2E (live, cost-gated ~$2).**
- One full CompetitorLandscape run on a real brand with ≥3 seeded competitors.
- **Verify gate:** `body.adEvidence.advertiserGroups[].creatives[]` non-empty across ≥2 platforms; LinkedIn populated when present; Foreplay only fires on <3 and adds themes not creatives; gate now blocks/visibly flags a genuine zero-ad section.

---

## 6. Remaining HUMAN Forks (research could not settle these)

1. **I3 — table column/overflow contract & look (design-system amendment, not a code fix).**
   `DESIGN.md:138-139` explicitly mandates **no visible row borders** and **10px text-4 headers** — the exact "low contrast / unscannable" complaint. Ammar must choose: (a) keep spec as-is, (b) bump headers to 11px/text-3, (c) add faint row separators. Plus: should table-heavy sections (paid-media's ~9 tables, competitor's 6-col pricing) break the 760px reader column out to ~900-1080px (`DESIGN.md:106` allows 1080px standalone), conflicting with the single-reading-column intent of `feedback_lean_one_pager_not_dashboard`?

2. **I3 — <640px responsive default.** Stacked label:value cards vs horizontal scroll, global default vs per-table override. Recommended hybrid (numeric→scroll, prose→stack) needs sign-off; stacking changes the row-as-table mental model and adds component complexity. Not visually measured (read-only, no browser pass).

3. **I4-B — corpus source UI: live-transient vs persistent.** Show "Researched N sources" transiently in `CorpusStream` on completion, or persistently atop `OnboardingWizard`? The persistent option requires threading `corpus.sources`/`citations` through `session-state.ts` to survive reload/resume. Also: count from `corpus.citations.length` (provider-cited URLs) vs `corpus.sources.length` (curated, with whyItMatters) — they differ.

4. **Provider decision the verdicts complicated — Foreplay primary vs fallback.** The verdict **confirms** the contract + a configured key + `ENABLE_FOREPLAY=true`, but liveness/credit balance is **unverifiable without a live call**, and Foreplay only yields themes/confidence in the current shape (not displayable creatives without extra wiring). Human call: spend one live Foreplay probe to confirm the key before promoting it, and decide whether to wire Foreplay creatives into displayable cards (a larger change than enabling the flag) or keep it as a signal-only fallback. Budget fork: keep `adReservedLookups=6` (2 advertisers × 3 platforms) or raise to 9 (3×3, ~$0.5–1/run).

---

## 7. Phase 0 — LIVE sandbox probe results (2026-06-02, 23 SearchAPI requests, bounded)

Ran `scripts/zero-ads-probe.ts` (throwaway, uncommitted) against the real SearchAPI with the worktree `.env.local` keys. **Decisive: the ad TOOL is healthy; zero-ads is an UPSTREAM SEEDING problem.**

**Keys:** `SEARCHAPI_KEY present: true`, `FOREPLAY_API_KEY present: true` (local `.env.local` — Vercel runtime still to be confirmed separately).

**LinkedIn engine:** `linkedin_ad_library?advertiser=Notion` → HTTP 200, **24 ads**. Engine exists and yields. Porting it is justified.

**Lab `execute()` per cell (the REAL path):**
| Advertiser | google | meta |
|---|---|---|
| Notion | 8 ads | 8 ads |
| ClickUp | 1 ad | 8 ads |
| Asana | 8 ads | 1 ad |

Every cell returned creatives. Raw replication confirmed HEALTHY engine paths: Notion/google 38/38 survive filters, ClickUp/google 1/1, ClickUp/meta 30/30, Asana/google 40/40. Advertiser resolution worked (exact-match + domain-corroboration verdicts all `accepted`).

**One artifact, not a bug:** Notion/meta raw replication showed 0/30 surviving `isAdvertiserMatch`, BUT the real `execute()` returned 8 ads for that same cell. The 0/30 is the probe script's *approximate* filter reimplementation (imperfect meta-row advertiser-name extraction), not the lab path. Spot-check during the LinkedIn port; do not chase as a fix.

**Interpretation = outcome J for every cell:** raw healthy + execute returns ads ⇒ the 0-ads symptom is **not the tool**. It is upstream:
- The CompetitorLandscape ad probe is a prepass seeded ONLY from onboarding `topCompetitors` (`corpus-to-research-input.ts:882-890`: `competitorAds: []` hardcoded, `competitorSeeds` = topCompetitors only).
- It runs and is fully awaited (`run-section.ts:4184→4224`) BEFORE the model discovers competitors, so it never probes the rich model-discovered set.
- ⇒ On a real run, zero ads happens when `topCompetitors` is empty or its names don't match ad-library advertisers.

**Revised fix priority (probe-driven):**
1. **PRIMARY — seeding (Fix B):** add a SECOND ad probe AFTER the answer tool emits its competitor list, seeded from the discovered names, merged via the existing `buildMergedAnswerToolAdEvidenceGroups` hook (`run-section.ts:4430/4527`); re-account `adReservedLookups`. This is what actually closes zero-ads, because the tool already works — it just needs good advertiser names, which the model produces.
2. **SECONDARY — Fix A insurance:** also clean/guarantee onboarding `topCompetitors` seeding at the corpus seam (cheap, helps the prepass).
3. **COVERAGE — resurrection:** port LinkedIn (proven 24 ads) + Foreplay (<3-ad fallback) for richer multi-platform creatives.
4. **HONESTY — gate teeth:** the toothless gate (`required-evidence.ts:118-142`, always-appended linkedin gap) lets a genuine zero-ad section ship silently; tighten once seeding works.

**Vercel-env caveat:** the probe proves the key works locally; the live research-v3 path runs in-process on Vercel, so a `Boolean(process.env.SEARCHAPI_KEY)` confirmation in the Vercel runtime is still the cheapest production check (memory suggests it's present, but confirm during the live E2E).
