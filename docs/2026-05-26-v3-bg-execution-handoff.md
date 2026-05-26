# AI-GOS v3 — Phases B–G Execution Handoff (Codex)

> Written 2026-05-26 after a 5-track alignment pass. Phase A (T3.7 front-door flip) is **shipped + proven**. This doc is the spec for B→G.
> Executor: **Codex at `model_reasoning_effort=xhigh`**, on the **`feat/v2-lab-section-wire` worktree** (`/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`). Claude plans + reviews. TDD + verification gate per phase.

---

## 0. Locked decisions (do not relitigate)

1. **System of record = `feat/v2-lab-section-wire`.** This branch holds the v3 lab engine + the planning docs (some uncommitted). At Phase G it is PR'd → `main`; the `codex/claude-managed-agents-work` branch is retired (merging it forward would re-introduce code F deletes).
2. **Sections use REAL in-section tools** (reversal of the old corpus-only lock). Real data, **zero synthetic backfill**. **DeepSeek runs the whole loop, tools included — no model split.** This is a *surgical flip of existing gated machinery*, not new infra.
3. **Media plan = a NEW DeepSeek synthesis section** (`positioningPaidMediaPlan`), a dependent final wave after the 6. The old `src/lib/media-plan/` Perplexity pipeline is **deprecated + deleted** (Phase F). → ADR-0005.
4. **Prod cutover (G) fires after D lands** (real data) on top of A's flip — before B/C reader polish. No fabricated data ever reaches prod.
5. **Full proof bar** gates teardown (F) and prod (G): ≥3 fresh real URLs at 6/6 with real-tool data, green baselines, 48h soak, no section > 270s. (§F gate.)
6. **All visual/design work → a separate `/ui-ux-pro-max` design session.** This doc specifies *structure/UX/data only*; DESIGN.md is the binding constraint for the design session.
7. Verification gate per phase: frontend `tsc --noEmit` 0 / `npm run test:run` green / `npm run build` 0; worker `npm run build` = exactly its 6 known-baseline errors (no 7th); live proof on `:3100`.

---

## P0 — prerequisite fix (blocks E trigger + the F/G gate)

**Parent-artifact rollup bug:** the parent run stays `queued / children_complete=0` even when all 6 section rows + UI are complete. This is the "6/6 complete" signal E's media-plan trigger and the proof gate depend on. **Fix the rollup so the parent flips to complete when its children do** before E's trigger work and before any gate run. Owner: whoever starts E (it's E's hard dependency); verify with a fresh run showing parent `complete` + `children_complete=6`.

---

## The section-tools flip (the heart of B–E, shared mechanics)

Existing, verified machinery — re-enable, don't rebuild:
- `src/lib/research-v2/lab-section-job.ts` — `getLabEngineAllowedTools()` returns `[]` unless `LAB_ENGINE_LIVE_TOOLS==='true'`. Returning `undefined` makes `run-section.ts` fall through to each section's registry allowlist. **Flip = return the per-section allowlist (or `undefined`) in prod.**
- `src/lib/lab-engine/sections/section-registry.ts` — per-section `allowedTools` + `maxExternalLookups` already populated.
- `src/lib/lab-engine/agents/tools/` — 11 live adapters (firecrawl, google-ads, meta-ads, pagespeed, spyfu, reviews, ga4, adlibrary, keyword-ad-probe, +shared). All key-gated, **fail-soft** (missing key → `credentialGap`, never crash; budget spent → `rate_limited` gap, never loops).
- Loop caps already exist: research pass `stepCountIs(maxStepCount=4)`; `ToolBudget(maxExternalLookups)` + `webSearchMaxUses`; `structuredOutputTimeoutMs=240_000`. The "paid API never loops without an abort" rule is **already satisfied** — D only tightens the numbers.

**Per-section allowlist + budget (D's map — edit the registry):**

| Section | allowlist | maxExternalLookups (today→new) |
|---|---|---|
| Market & Category | `web_search`, `firecrawl` | 6 → 4 |
| Buyer & ICP | `web_search`, `firecrawl` | 6 → 4 |
| Competitor | `web_search`, `firecrawl`, `adlibrary`, `reviews` | 14 → 6 |
| Voice of Customer | `web_search`, `reviews`, `firecrawl` | 6 → 5 |
| Demand & Intent | `web_search`, `keyword_ad_probe`, `firecrawl` | 8 → 5 |
| Offer & Performance | `web_search`, `firecrawl`, `pagespeed` | 6 → 4 |

`adlibrary`/`reviews`/`keyword_ad_probe` → `SEARCHAPI_KEY` (the ad path; Apify is dead). Target ~60–150s/section; worst case (Competitor) must stay < 270s.

**Delete synthetic backfill** in `src/lib/research-v2/corpus-to-research-input.ts`: `buildSyntheticCompetitorAds`, `ensureCompetitorSeeds`, `buildSourceSupplementExcerpt` (+ the `while(<3)` supplement loop), the `https://example.com/${slug}` fallback in `resolveUrl`, the "…preserves the lab schema minimum…" filler in `ensureExcerptTextLength`, and `logSafeDefault` once orphaned.
**Relax the `ResearchInput` floors** (`src/lib/lab-engine/artifacts/artifact-envelope.ts`): `competitorAds` → drop `.min(3)`, keep `.max(5)`, allow `[]`; `corpus.excerpts` → `.min(1)` or drop. Update fixtures/tests that depended on the old floors. (This is why deleting backfill is safe: real ads now come from the Competitor section's live `adlibrary`, not from `ResearchInput`.)

---

## Phase B — Per-section paginated reader

**GOAL:** turn the stacked `BattleshipShell` into a paginated reader.
**Locked structure:** single tab strip of **7** (6 sections + media-plan terminal page); **all tabs always clickable**, each renders its own live state (queued / running / done); **per-tab live-status indicator is a hard requirement** (so parallel progress stays visible under pagination); media-plan tab **locked-but-visible** ("unlocks after 6/6"); **next/prev** walks all 7 in pipeline order, ends disabled; **default land on section 1**; deep-link `?runId=<uuid>&section=<sectionId>`. Verdict line uses the existing `verdict: z.string().min(1)` field (no schema change); confidence/sources demoted inline.
**FILES:** `src/components/research-v2/` (shell + section-renderers + `typed-artifact-renderer.tsx`), `src/lib/research-v2/use-audit-state.ts`, `src/app/research-v3/page.tsx` (runId/section URL sync).
**NON-GOALS:** visuals (tab-strip treatment, accents, typography, verdict styling) → design session.
**VERIFY:** all 7 tabs reachable; deep-link restores section; queued/running/done states render; tsc/test/build green.

## Phase C — Live sub-section reveal

**GOAL:** progressive sub-section reveal + "Wave X of Y · N running/queued/complete" header.
**Locked:** **C1 = add a `sub-section-committed` variant to the activity-event `discriminatedUnion`** (`run-section.ts` emits it as each sub-section commits); reader ticks a checklist of the statically-known sub-section names (from the section schema / `research-sections.md`). **Content still commits per-section atomically** — the event carries `{sectionId, subSectionKey, status}`, *not* incremental body content (checklist-tick contract, not partial-persistence). This is additive plumbing on the existing union.
**FILES:** worker/lab `run-section.ts` (emit), the activity-event schema (union variant), reader progress components, `use-audit-state.ts` (surface events).
**NON-GOALS:** reveal animation / visual form → design session.
**VERIFY:** checklist ticks live during a run; wave header counts correct; no change to committed artifact shape.

## Phase D — Real-tool sections + kill fabrication

**GOAL:** flip `LAB_ENGINE_LIVE_TOOLS` on with the bounded per-section allowlist above; delete synthetic backfill; relax `ResearchInput` floors; so fresh real URLs hit 6/6 on **genuinely fetched** evidence.
**Locked:** the Railway corpus pass **stays as the shared base** (company facts + 24 onboarding fields) — do **not** expand it; deep evidence moves in-section. Abort = the existing `stepCountIs(4)` + `ToolBudget` + `webSearchMaxUses` + 240s timeout; per-section paid-call ceiling = the `maxExternalLookups` above. Est. cost +$0.20–0.70/audit over the ~$1.50–2 corpus pull.
**FILES:** `lab-section-job.ts` (gate), `section-registry.ts` (allowlist+budgets), `corpus-to-research-input.ts` (delete backfill), `artifact-envelope.ts` (relax floors), affected fixtures/tests.
**VERIFY:** a fresh real URL → 6/6 with `LAB_ENGINE_LIVE_TOOLS=true` and backfill removed, no `Synthetic:` strings / `example.com` URLs in committed artifacts; no section > 270s; tsc/test/build green.

## Phase E — 7th section: positioningPaidMediaPlan

**GOAL:** new DeepSeek synthesis section, dependent final wave, own terminal page.
**Locked:** **keep it OUT of `POSITIONING_SECTION_IDS`** (add a sibling `PAID_MEDIA_PLAN_SECTION_ID` + derived `ALL_SECTION_IDS` for the all-7 surfaces only); the 6-only array still drives the parallel fan-out (`dispatchLabSectionJobs`, `seedOrchestration`, the `orchestrate-client` length assert). **Trigger = Next.js poll (2b):** when `use-audit-state` sees 6/6 commit (post-P0 fix), POST a dedicated lab dispatch for the media-plan section. Section synthesizes the 6 committed artifacts + frozen GTM brief via `streamObject(PaidMediaPlanArtifactSchema)` (the established runner; **never** `Output.object` on the answer tool). 12 sub-sections per `docs/2026-05-26-media-plan-v3-structure.md`; **sub-section #11** (client channel/funnel) gets the one bounded client-channel research step (SearchAPI/keyword-probe on the client's own domain, 1–2 calls, same abort rules); **#7 is pure synthesis**. → ADR-0005.
**FIELD-SYNC (7 surfaces):** `POSITIONING_SECTION_LABELS` + the new const (`positioning-skills/index.ts`), `SECTION_TO_TOOL` (`dispatch-research.ts`), `TYPED_ARTIFACT_KEYS_BY_ZONE` (`positioning-artifact.ts`), renderer switch (`typed-artifact-renderer.tsx`), `intent-router.ts`, worker registry (`research-worker/src/index.ts`: `ToolName`/`TOOL_RUNNERS`/`POSITIONING_TOOL_NAMES`/`TOOL_TO_ZONE`), Zod schema mirror (worker ↔ `src/lib/managed-agents/schemas/`).
**NON-GOALS:** terminal-page visuals + prototype-C refinement → design session.
**VERIFY:** media plan fires only after 6/6; renders on its terminal page (7th tab); no member of the 6-parallel-wave; tsc/test/build green.

## Phase F — Lean teardown (after the gate)

**KILL (verified safe):** `src/app/research-v2/` (page + managed-agents-prototype + __tests__); orchestrate `draft`/`deep`/`managed` branches + `kickoffWorker` (**keep** route + `lab` branch + `seedOrchestration` + `dispatchLabSectionJobs`); managed-agents **runtime** (`start-audit`,`webhook-handler`,`client`,`agents`,`signature`,`supabase-adapter` + __tests__ + `api/webhooks/managed-agents/route.ts` + `MANAGED_AGENTS_*` flags); old media-plan pipeline (`src/lib/media-plan/`, `src/components/media-plan/`, `api/chat/media-plan-agent/route.ts`, `api/media-plan/generate/route.ts`); 8 dead `SECTION_TO_TOOL` entries (map-only).
**KEEP (load-bearing — do NOT touch):** `src/lib/lab-engine/agents/tools/`, the section-registry allowlists, the `LAB_ENGINE_LIVE_TOOLS` gate (now LIVE); `src/lib/managed-agents/schemas/` + `section-artifact-schemas.ts` (the 6 reader renderers import them); the Railway corpus path.
**MUST ALSO:** rewire the **7+ inbound `<Link href="/research-v2">`** (dashboard/landing/profiles) to `/research-v3`; sweep orphan `__tests__` + barrel/registry refs for every deleted module (else TS2307 / dangling-import breaks the build). Incremental, build-green PRs. → ADR-0006 (managed-agents deprecation — records the reversal of the May-20 default-on).
**VERIFY:** tsc/test/build green frontend; worker build = its 6 baseline errors; no dead links; app fully functional on `lab` path only.

## Phase G — Promote to production

**GOAL:** DeepSeek-only prod, after D. **STEPS:** PR `feat/v2-lab-section-wire` → `main`; `DEEPSEEK_API_KEY` in Vercel prod env (rotation = non-blocking follow-up); confirm `maxDuration=300` (Vercel Pro); worker deploys separately (`cd research-worker && railway up`). **Rollback:** pin the previous Vercel deploy for instant revert. **VERIFY:** authenticated fresh-URL run in prod → 6/6 + media plan, real data, no error boundary.

---

## Gates — two levels (resolves "prod after D")

**Prod-cutover gate** (fires after D — ships the honest engine to real users *before* E/F): conditions **1, 2, 4, 5, 6** on the **6 sections** (not the 7th). This is the "real users get the fast, real-data engine" moment decision #4 asks for.

**Teardown gate** (F — deleting the old fallback): **ALL of 1–6 including 3 (the 7th section)**, because F removes the old media-plan pipeline, which can't go until E's new one works.

1. A3 flipped + a fresh user observed landing on `/research-v3` live.
2. **≥3 distinct fresh real URLs** each → 6/6 complete + real content, with `LAB_ENGINE_LIVE_TOOLS=true` and backfill removed (real-fetched, no synthetic), no error boundary, authenticated `:3100`.
3. The 7th section (`positioningPaidMediaPlan`) renders on its terminal page in those runs. *(teardown gate only)*
4. Green baselines: frontend `tsc 0` / `test:run` green / `build 0`; worker build = exactly 6 known errors.
5. A3 soaked **≥48h** as live default, zero error-boundary / stuck-`queued` regressions.
6. No section breaches the **270s** job-timeout on the proof runs; p95 section latency < 180s (watch-line), captured as evidence.

> The old `src/lib/media-plan/` removal is gated on E's new section rendering; the non-media-plan F deletions can start once the teardown gate's 1–6 hold.

---

## ADRs to write
- **ADR-0005** — Paid Media Plan = new DeepSeek synthesis section outside the positioning registry, poll-triggered dependent wave; old Perplexity+CAC pipeline deprecated.
- **ADR-0006** — Sections use real in-section tools (reversal of corpus-only) + managed-agents runtime deletion (reverses the 2026-05-20 default-on); schemas retained.

## Parallelism
B / C / D / E run in parallel after A (done). Prod cutover after D. F after the gate. G last.

---

## Reconciliation with the goal docs (checked 2026-05-26)

This handoff is the current execution spec; `docs/2026-05-26-v3-scope-and-plan.md` + `docs/2026-05-26-v3-codex-goal-handoff.md` stay the per-task narrative. Where they differ, the deltas below + the ADRs govern (amendment banners added to both goal docs):

- **Corpus-only → live in-section tools** (ADR-0006). The goal docs' decisions #2/#9 + the "Do NOT enable `LAB_ENGINE_LIVE_TOOLS`" anchor are **reversed**. Phase D here = real-tool sections + kill backfill + relax floors, *not* "enrich the corpus pass."
- **Client-channel research step = sub-section #11, not #7** (media-plan structure doc + ADR-0005; the scope doc's "#7" is stale). #7 is pure synthesis.
- **Prod after D + full proof bar + lab-wire→main** supersede the goal docs' "G last," single-URL gate, and unspecified branch plan.

**Carried from the goal docs — do NOT drop (they augment the phases above):**
- **D2** — competitor `adPresence` as a typed Competitor-schema field (field-sync), now populated from the in-section `adlibrary` results.
- **D3** — surface each section's tool calls as visible steps (query→search→synthesis) feeding Phase C's reveal.
- **E3** — brief field additions (G4/G5): `salesProcessDocs[]` + `salesLoomUrl`, SLG/PLG flag, creative capacity, lead-list availability — 6-place field-sync each (don't exist yet).
- **B4** — wire typed sub-section renderers per `research-sections.md` (prototype-A primitives → real renderers).

**Open coordination item:** the **agent-bus goal** + the ground-truth HTML `§07` board still reflect the *old corpus-only plan* — re-sync them to this amended spec at Codex kickoff (the goal doc's D9 mirror step).
