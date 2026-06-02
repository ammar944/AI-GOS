# Ad Engine Resurrection + I1–I6 QA Sweep — Implementation Plan (v2, Codex-reviewed)

> **Execution model:** This plan is handed to a FRESH session that executes via the **Workflow** tool (dynamic workflows), phase by phase, with the gates below. It is NOT a subagent-driven-development plan. Steps use checkbox (`- [ ]`) tracking.
>
> **v2 changelog (Codex xhigh review, 2026-06-02):** corrected stale paths; expanded `run-section.ts` to ALL ad-probe/merge sites (primary+repair+rescue); Foreplay is now a direct prepass service call (not a registered tool); seeding fix retargeted to the real bug (`buildCompetitorSeedHints`); schema + wiring + gate lists completed; dedup reconciled across 3 layers; dropped the stale Google flat-field task.

**Goal:** Make competitor ad creatives appear in CompetitorLandscape (SearchAPI Google/Meta/LinkedIn + Foreplay, deduped, displayable), and clear the six live-QA findings (I1–I6).

**Architecture:** The 6 positioning sections run **in-process on Vercel**. The ad probe is a deterministic prepass in `run-section.ts` that fires **before** the model runs — and it repeats across the runner's **primary / repair / rescue** phases. A live probe proved the ad *tool* is healthy; zero-ads is upstream (probe seeds from onboarding `topCompetitors`; the model's *seed hints* read the empty `competitorAds`). Fix: correct the seed-hints bug, widen the engine to LinkedIn + Foreplay with reconciled cross-provider dedup, make a genuine zero-ad section stop passing the gate, and clear the UI findings.

**Tech Stack:** Next.js 16, React, Tailwind v4 + shadcn/ui, Vercel AI SDK v6, Zod (`.strict()`), SearchAPI.io, Foreplay API, Supabase, Clerk.

**Read before executing:**
- `docs/2026-06-02-ad-engine-and-qa-research-synthesis.md` (findings + §7 live-probe results)
- `docs/2026-06-02-qa-next-research-list.md` (the I1–I6 handoff)
- This plan's §"Verified code map" below (the Codex-confirmed file:line truth)

---

## Verified code map (Codex-confirmed — use THESE paths)

| Concern | Correct location |
|---|---|
| Section registry (allowedTools, `adReservedLookups`) | `src/lib/lab-engine/sections/section-registry.ts` (registry ~:155, `adReservedLookups` ~:169) |
| Ad tool + creative schema + platform enum | `src/lib/lab-engine/agents/tools/adlibrary.ts` (enum :18, `adLibraryAdSchema` :20-36, `fetchNativeAds` ~:582, nested Google/Meta parsing ~:320, tool execute :632-674) |
| Advertiser resolution | `src/lib/lab-engine/agents/tools/advertiser-match.ts` (`resolveBestCandidate` :547) |
| Ad adapter (dedup, tool names, platform map, gaps) | `src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts` (tool names :49, platform :83, insert/cap :341, `returnedCreativeLimit` :55, `linkedinNotProbedGaps` :461) |
| Tool catalog | `src/lib/lab-engine/agents/tools/index.ts` |
| Budget ad-tool set | `src/lib/lab-engine/agents/budget.ts` (ad set :27-29, reserve note :33) |
| Prompt seed-hints + tool-denial | `src/lib/lab-engine/agents/build-prompts.ts` (`buildCompetitorSeedHints` :246-249, corpus-only denial :115, seed-hint wiring :275-277) |
| Ad-evidence gate | `src/lib/lab-engine/sections/required-evidence.ts` (`hasAdEvidenceOrGap` :118, `hasNestedGap` :64) |
| Artifact ad schemas | `src/lib/lab-engine/artifacts/schemas/competitor-landscape.ts` (`adEvidenceCreativeSchema` :149, `adEvidenceRawSourceSampleSchema` :177, group :216-218) |
| Seed builder | `src/lib/research-v2/corpus-to-research-input.ts` (`buildCompetitorSeeds` ~:654-709 — **already cleans/dedupes/caps**; `competitorAds` hardcoded `[]` :882) |
| Ad creative RENDERER + UI dedup | `src/components/research/competitor-ad-evidence.tsx` (interface :8, UI dedup keyed incl. imageUrl :407) — **V1 `components/research/` path, NOT research-v2** |
| DataTable | `src/components/research-v2/ui-kit/data-table.tsx` (row key :78, `<table>` :47) |
| Foreplay rich client | `src/lib/foreplay/service.ts` (`searchBrands(params: ForeplayBrandSearchParams)` :265, `searchAds(params: ForeplayAdSearchParams)` :376, noisy logging + empty-on-error :290/:421) |
| Image proxy client gate | `src/lib/image-proxy.ts` (`PROXY_DOMAINS` :5 — missing foreplay domains) |
| LinkedIn port source | `research-worker/src/tools/adlibrary.ts` (`searchLinkedInAds` ~:737-859, link-redirect guard ~:785-847 — returns `[]` on failure; must be adapted to structured gaps) |
| **run-section ad sites (ALL must change together)** | `src/lib/lab-engine/agents/run-section.ts`: probe `runCompetitorAdProbeSteps` :2697 (callers :3117 primary, :5571 repair, :5932 rescue), per-advertiser step :2638, merge `buildMergedAnswerToolAdEvidenceGroups` :3650 (callers :4430/:4527/:4893/:5003/:5293), `buildAnswerToolAdEvidence` :4184/:4715 |

**Centralization mandate (Codex #3):** the probe-orchestration, budget math, and dedup changes MUST be made in the shared helpers (`runCompetitorAdProbeSteps`, `runCompetitorAdProbeAdvertiserStep`, `buildMergedAnswerToolAdEvidenceGroups`, `buildCompetitorAdEvidenceGroups`) so all three runner phases (primary/repair/rescue) inherit them. Do NOT patch only the primary call site. After any edit, grep the 3 probe callers + 5 merge callers and confirm none diverged.

---

## Scope decomposition (phases; each independently shippable + gated)

| Phase | Subsystem | Risk | Depends on |
|---|---|---|---|
| 0 | Foreplay sandbox probe | low | — |
| 1 | UI quick-wins (I1, I5, I6, I4-A) | low | — |
| 2 | I3 DataTable readability (DESIGN.md amendment) | med | **DESIGN.md amendment PRE-APPROVED by user 2026-06-02** |
| 3 | Seed-hints bug fix (the real zero-ads model gap) | low | — |
| 4 | Ad engine resurrection (LinkedIn tool + Foreplay direct-call + 3-layer dedup + gate) | high | Phase 0 |
| 5 | Live E2E sign-off (~$2) | — | Phases 3–4 |

**Global guardrails (do NOT regress):**
- Never break the fabrication/provenance gate (`structuralVerifier`, `validateMinimums`, `checkVoiceOfCustomerSelfSourcing`, `checkDemandIntentKeywordProvenance`, `deriveGroundedConfidence`).
- **Serialize all writes to `run-section.ts`** — one workflow stage edits it at a time.
- Gates each phase: `npx tsc --noEmit` clean vs baseline, `npm run lint` 0 errors (≤67 warns), `npm run test:run` ≥ baseline pass, `npm run build` exit 0. Build in isolation if a `next dev` server shares `.next`.
- Throwaway probes (`scripts/zero-ads-probe.ts`, `scripts/foreplay-probe.ts`) stay **uncommitted**.
- Paid APIs: no loop without an abort/cap.

---

## Task 0.0: Capture baseline gates (first, in isolation)

- [ ] Run `npx tsc --noEmit`, `npm run lint`, `npm run test:run` from the worktree; record tsc/lint/test baselines in the execution log as the "do not regress" line.

---

# Phase 0 — Foreplay sandbox probe

Settle: is `FOREPLAY_API_KEY` funded? does `searchBrands`/`searchAds` return durable, hot-linkable media (video/image)? does `ad_archive_id == ad_library_id` hold (the dedup tier-1 join)?

## Task 0.1: Author + run the bounded Foreplay probe

- [ ] Create throwaway `scripts/foreplay-probe.ts` (hard cap ≤6 requests, abort on cap, Boolean key presence only — never the value). For domain ∈ {notion.so, clickup.com, asana.com}: `const svc = createForeplayService(); const brands = await svc.searchBrands({ domain, limit: 1 }); const ads = await svc.searchAds({ brand_id: brands[0].id, limit: 6 });` (use the OBJECT-param signatures — service.ts:265/:376). Log per ad: `id`, `ad_library_id`, presence of `creative.url`/`video`/`thumbnail_url`/`video_transcript`, the media URL **host** only, `display_format`.
- [ ] Run: `node_modules/.bin/tsx scripts/foreplay-probe.ts` (in-script dotenv; do not pass the env file on the CLI).
- [ ] Record the decision: **displayable** (media URLs on durable CDN) vs **signal-only** (401/403 or signed/expiring URLs). Note whether `ad_library_id` matches a Meta `ad_archive_id` for any overlapping ad.

**Gate:** a recorded displayable-vs-signal decision. Do not commit the probe.

---

# Phase 1 — UI quick-wins

## Task 1.1: I1 — DataTable duplicate key
- [ ] `data-table.tsx:78` → `` key={`${keyFn(row, rowIndex)}-${rowIndex}`} ``.
- [ ] `npm run test:run -- src/components/research-v2/ui-kit/__tests__/data-table.test.tsx` and the competitor-landscape renderer test. Commit.

## Task 1.2: I5 — Label RunStatusBar counts
- [ ] In `audit-reader-shell.tsx` RunStatusBar (~:718-728), add inline labels + tooltip/aria-label: "N verified / N unverified claims — advisory, does not block the report." Confirm the gate is default-OFF (`evidence-support.ts:75-76` → `Infinity`). Leave the per-section badge untouched. Test + commit.

## Task 1.3: I6 — Doc-only canonical fix
- [ ] CLAUDE.md + memory: `/research-v3` canonical; `/research-v2` page orphaned-but-retained (its `/api/research-v2/*` are the shared backend; `page-one-pager.test.tsx` imports the page). Do NOT delete the route. Commit.

## Task 1.4: I4-A — Surface corpus sources (trace first)
- [ ] Confirm `session-state.ts` drops `corpus.sources`/`citations`; `onboarding-wizard.tsx` ignores `review.fields[].sourceUrl` (populated in `onboarding-review.ts`); reuse the `prefill-summary.tsx` ExternalLink+ConfidenceBadge PATTERN (not the legacy component).
- [ ] Render per-field `sourceUrl` links in the brief review; thread `corpus.sources`/`citations` through `session-state.ts`; add a **persistent** "Researched N sources" collapsible (count from `corpus.citations.length`). No new onboarding field → 6-place field-sync NOT triggered (confirm). Test + screenshot + commit.

---

# Phase 2 — I3 DataTable readability (DESIGN.md amendment PRE-APPROVED 2026-06-02 — execute without stopping)

## Task 2.1: Amend DESIGN.md table spec
- [ ] Tables section (~:137-140): headers `mono uppercase 11px, text-2` (was 10px text-4, failed ~1.6:1 contrast); faint hairline row separators `border-bottom: 1px var(--border)` + hover (was transparent); table-heavy sections may opt into ≤960px width for the table only. Commit.

## Task 2.2: DataTable column-sizing API + restyle
- [ ] Extend `DataTableColumn<T>` (additive, all optional): `width / minWidth / maxWidth / grow / wrap('wrap'|'truncate'|'nowrap'|'clamp') / clampLines`.
- [ ] When ≥1 column opts in, render `<colgroup>` + add `table-fixed`. **The column-sizing API is byte-identical when unused.** Separately, the **header+row restyle is a GLOBAL intentional change to every table** (not byte-identical) — update any snapshot/DOM test that asserts the old header classes.
- [ ] Use a **static** line-clamp class map (`{2:'line-clamp-2',3:'line-clamp-3'}`), NOT dynamic `line-clamp-${n}` (Tailwind can't see dynamic classes).
- [ ] Header class → 11px + a ≥4.5:1 token (`text-foreground/70` or a `--text-2` utility — verify contrast). Row class → `border-b border-border/60` + keep `hover:bg-muted/40`. Tests + commit.

## Task 2.3: Content discipline on worst renderers
- [ ] paid-media "Framework" cell (`paid-media-plan.tsx`) → `wrap:'clamp', clampLines:2` + expandable detail row. competitor 6-col pricing → trim or wide opt-in. Numeric cols `nowrap`+`width`; one prose col `grow`. Screenshots @1440/768. Commit per renderer.

---

# Phase 3 — Seed-hints bug fix (the real model-side zero-ads gap)

**Codex #6/#7 correction:** `buildCompetitorSeeds` ALREADY cleans/dedupes/caps onboarding competitors (corpus-to-research-input.ts ~:688), and the deterministic probe already uses `competitorSeeds`. The real bug is the MODEL's seed hints read the empty `competitorAds`. Honest scope: this improves the model's competitor coverage/prose; the probe's yield is driven by Phase 4 (engine breadth) + whether onboarding `topCompetitors` was populated (confirm in Phase 5).

## Task 3.1: Point seed hints at competitorSeeds
- [ ] `build-prompts.ts:246-249` `buildCompetitorSeedHints` currently maps `researchInput.competitorAds` (always `[]`). Change it to read `researchInput.competitorSeeds` (the populated, cleaned set). Keep the :276-277 prompt copy that frames `competitorAds` as fixture-only.
- [ ] Write a failing test asserting seed hints are non-empty when `competitorSeeds` is populated and `competitorAds` is empty; make it pass.
- [ ] Optional recall improvement: in `buildCompetitorSeeds`, attach a `domain` when an onboarding competitor row has a recoverable URL so `resolveBestCandidate` runs domain-verified (Codex #7: not sufficient alone if domains aren't typed/recoverable — best-effort). Test + commit.

---

# Phase 4 — Ad engine resurrection (serialize run-section.ts)

## Task 4.1: LinkedIn — add to the lab ad tool (atomic enum+fetch+register)
- [ ] **Atomically** (Codex #12 — avoid a broken intermediate): add `"linkedin"` to `adLibraryPlatformSchema` (adlibrary.ts:18) AND the `linkedin` branch in `fetchNativeAds` (~:582) AND register the `linkedin_ads` wrapper in the same change.
- [ ] Port `searchLinkedInAds` (worker :737-859) incl. the link-redirect guard (~:785-847). **Adapt the error model (Codex #10):** worker returns `[]` on failure; the lab branch must return structured `credentialGap`/`apiErrorGap`/`NoMatchedAdvertiserError` like the Google/Meta branches, not silent `[]`.
- [ ] Create `linkedin-ads.ts` wrapper mirroring `google-ads.ts`/`meta-ads.ts`. Register in `TOOL_CATALOG` (tools/index.ts).
- [ ] **Full wiring (Codex #4 — all required):** `sections/section-registry.ts` allowedTools; `budget.ts:27-29` ad-tool set; `build-prompts.ts:115` corpus-only denial list (add `linkedin_ads`); `competitor-ad-adapter.ts:49` tool-name set (`linkedin` platform already accepted at :83). Update tests: `__tests__/competitor-ad-probe.test.ts:124`, `sections/__tests__/section-registry.test.ts:22`, any verifier mock that builds a tool map.
- [ ] Mock-based tests (use the probe's proven 200/24-ads shape). Commit.

## Task 4.2: Foreplay — direct prepass service call (NOT a registered tool)
**Codex #5 resolution:** registering `foreplay_ads` in `allowedTools` would wrap it in `SectionToolBudget` and consume the SearchAPI reserve. Foreplay bills in its own credits. So call the Foreplay service **directly in the prepass**, outside the tool registry, and inject its normalized output into the merge.
- [ ] (Gated on Phase 0 = displayable.) In `runCompetitorAdProbeAdvertiserStep` (run-section.ts:2638), after the SearchAPI `Promise.allSettled`, when `FOREPLAY_API_KEY && ENABLE_FOREPLAY==='true'`, call `createForeplayService().searchBrands({domain,limit:1})` → `searchAds({brand_id,limit:6})` with an **8–10s timeout + error normalization** (Codex #13 — the client logs noisily and returns empty-on-error; wrap so "no ads" ≠ "provider failed": catch → structured `sourceError`).
- [ ] Normalize Foreplay ads into the existing `NormalizedAd` shape + additive fields (Task 4.3), platform mapped (`facebook|instagram→meta`), `source:'foreplay'`, populate `videoUrl`/`imageUrl` from `creative.url`/`thumbnail_url`, `transcript` from `creative.video_transcript`. Inject into the per-advertiser result the adapter consumes (a synthetic `foreplay` group entry alongside the tool results).
- [ ] Add `foreplay.co`, `cdn.foreplay.co` to `PROXY_DOMAINS` (image-proxy.ts:5).
- [ ] (If Phase 0 = signal-only) implement as themes/transcript signal only; skip media/proxy; record why.
- [ ] Tests with a mocked Foreplay client. Commit.

## Task 4.3: Additive strict-schema fields (Codex #8 — full list)
Add optional `source`/`transcript`/`cta` (artifact-side nullable) to EVERY `.strict()` schema + interface + mapping + fixture in the chain, or Zod rejects Foreplay output:
- [ ] `adLibraryAdSchema` (adlibrary.ts:20-36) + the `NormalizedAd` interface.
- [ ] `competitor-landscape.ts` `adEvidenceCreativeSchema` (:149) AND `adEvidenceRawSourceSampleSchema` (:177).
- [ ] adapter `RawAd` + `buildCreative` + raw-sample mapping (competitor-ad-adapter.ts).
- [ ] `components/research/competitor-ad-evidence.tsx` `AdCreative` interface + render; `mapAdCreative` (competitor-landscape renderer).
- [ ] Any old card casts + fixtures (`fixtures/competitor-ads.ts`, `fixtures/competitor-landscape-artifact.ts`) + their self-tests.
- [ ] Run schema + renderer + fixture tests. Commit.

## Task 4.4: Multi-provider probe + 3-layer dedup reconciliation (Codex #3, #11)
- [ ] In `runCompetitorAdProbeAdvertiserStep`: change the per-advertiser SearchAPI `Promise.all([google,meta])` to `Promise.allSettled([google,meta,linkedin])` (failure isolation → each rejection becomes a group `sourceError`). Foreplay is the direct call from 4.2.
- [ ] Budget: `competitorAdProbeAdLookupsPerAdvertiser` 2→3 (run-section.ts ~:784) for the 3 SearchAPI platforms; `adReservedLookups` 6→9 (sections/section-registry.ts:169) to hold 3 advertisers. Fix the stale comment near the budget math.
- [ ] **Reconcile dedup across all 3 layers** (or creatives double-show / wrongly collapse):
  1. Adapter `buildCompetitorAdEvidenceGroups` insert/cap (:341): cross-provider fingerprint = tier-1 canonical ad id (Meta `ad_archive_id` == Foreplay `ad_library_id`, prefix-stripped — **only if Phase 0 confirmed the join**); tier-2 `canonicalPlatform(facebook/instagram→meta) | normalize(headline,80) | normalize(body,80)`; **keep `imageUrl` in the key when headline+body are empty** (media-only creatives, Codex #11); tie-break richer-wins (video > transcript/cta > image).
  2. `buildMergedAnswerToolAdEvidenceGroups` (run-section.ts:3650) merge dedup currently keys by platform/id/source-URL — align it to the same canonical fingerprint.
  3. UI dedup at `components/research/competitor-ad-evidence.tsx:407` includes `imageUrl` — align to the same rule (so the canonical-platform collapse + media-only carve-out match the server).
- [ ] Optional: `returnedCreativeLimit` 4→6 (competitor-ad-adapter.ts:55).
- [ ] Apply via the SHARED helpers so primary/repair/rescue all inherit it; grep the 3 probe callers (:3117/:5571/:5932) + 5 merge callers to confirm no divergence. Dedup unit tests (cross-provider collision, media-only carve-out, richer-wins). Commit.

## Task 4.5: Gate teeth (Codex #9 — precise)
- [ ] Remove/condition the unconditional `linkedinNotProbedGaps` (competitor-ad-adapter.ts:461) now that LinkedIn is probed.
- [ ] In `hasAdEvidenceOrGap` (required-evidence.ts:118): define passing precisely — a group passes only with `displayableTotal > 0` OR a genuine probe-attempt `sourceError`/dataGap (a real provider failure/empty), NOT merely `rawSourceSamples.length` or any nested gap. Put behind `LAB_AD_EVIDENCE_STRICT` (default off → on after the live E2E proves yield). Tests. Commit.

---

# Phase 5 — Live E2E sign-off (~$2, user-gated)

## Task 5.1: Vercel env check
- [ ] Confirm `SEARCHAPI_KEY`, `FOREPLAY_API_KEY`, `ENABLE_FOREPLAY`, `BRAVE_SEARCH_API_KEY` present in the Vercel runtime (lab runs in-process there). Boolean echo on a deployed route or dashboard — never print values.

## Task 5.2: Full CompetitorLandscape live run
- [ ] One `/research-v3` audit on a real brand with ≥3 onboarding competitors. Confirm `topCompetitors` was populated (the upstream zero-ads variable).
- [ ] Assert: `body.adEvidence.advertiserGroups[].creatives[]` non-empty across ≥2 platforms; LinkedIn rows when present; Foreplay video renders (or link-out fallback); gate flags a genuine zero-ad advertiser instead of silent-empty; CompetitorLandscape latency not materially worse (providers run concurrently). Second-by-second note + screenshots = definition of done.

---

## Self-review (spec coverage)

| Requirement | Task |
|---|---|
| I1 dup-key | 1.1 |
| I2 zero-ads | Phase 3 (model hints) + Phase 4 (engine) + Phase 5 (proof) |
| I3 table | Phase 2 (+ DESIGN.md 2.1) |
| I4 corpus sources (A) | 1.4 |
| I5 labels | 1.2 |
| I6 doc | 1.3 |
| Foreplay+SearchAPI combined, displayable | Phase 0 + 4.2 + 4.4 |
| LinkedIn resurrection | 4.1 |
| All run-section ad sites | Task 4.4 centralization mandate |

**Deferred:** second-probe-from-model-discovered (user: onboarding-only); I3 <640px card mode; I4-B live chips; Apify; `/research-v2` route deletion; Google flat-field (stale — lab already parses nested fields); streaming/latency.

**Open risks:** Foreplay media durability/CORS + the `ad_archive_id==ad_library_id` join (settled in Phase 0); whether onboarding `topCompetitors` is populated on real runs (settled in Phase 5); the 3-layer dedup must stay in sync (server merge + adapter + V1 UI component).

## Codex review record
xhigh review 2026-06-02: 9×P1, 5×P2, 1×P3 — all folded into this v2 (paths corrected, run-section multi-site centralization, Foreplay direct-call, seed-hints retarget, schema/wiring/gate completed, dedup 3-layer reconciliation, Google flat-field dropped). The only finding reframed not literally applied: #1 (the "ignore ~/.claude" line was the boundary instruction to Codex, not a plan rule) — but the header was changed to workflow-execution regardless, per the chosen execution model.
