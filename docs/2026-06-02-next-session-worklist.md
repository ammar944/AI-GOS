# Next-session worklist — AIGOS research-v2 (post-integration)

**State at handoff (2026-06-02):** `feat/v2-lab-section-wire` @ `1dd580ea`. Two work streams are now integrated and **gate-clean** (tsc 0 · lint 0/66 · 1346 tests pass / 1 skip · Next build ✓ · worker build ✓). **51 ahead of `origin/main`, UNPUSHED.**

Integrated this session:
- VoC/repair/stale-card fixes — **HQ-verified PASS** via paid ramp.com E2E (run `043a3577`). P0 closed.
- Audit Reader UI overhaul (Variant A, commit `b54d0953`) — cherry-picked from `feat/v2-artifact-ui-overhaul` (clean, disjoint files), HARD tsc blocker fixed, one stale research-v3 test updated (`1dd580ea`).

The following were deliberately deferred to this new session.

## A. UI overhaul — MED gaps (from Cursor QA, fix before a "designed" live demo)

1. **Inline `[n]` citations are dead in the bodies.** `ReaderSourcesProvider` + `renderProseWithCitations` are wired, but `NarrativeBlock`/`SubsectionBlock` render prose as raw `<p>{p}</p>` and never call it — so `[n]` markers show as literal text in the prose that holds ~95% of the content. Footer works; inline half doesn't. **Fix:** wrap paragraphs in `ProseWithCitations`.
2. **Streaming/draft view still renders OLD card slop.** `DraftingArtifactView` → `GenericTypedArtifactRenderer` (`typed-artifact-renderer.tsx:399-456`) uses raw `<h2 text-xl>` / `prose prose-sm` / `<Separator>` / its own duplicate `ArtifactSources` — so during a run you see pre-overhaul aesthetics, then it snaps to the new look on commit. **Fix:** route the draft through the typed renderer, or de-slop the fallback.
3. **Rail sublines read lowercase `running`/`queued`** (`sectionStatusSubline` falls through to the raw enum) — most visible during a live run. **Fix:** use `STATUS_META[status].label`.
4. **Two un-consolidated badges.** The shell uses a local boxed `rounded-full` `VerificationBadge` while the clean mono ui-kit one sits exported-but-unused; `demand-intent.tsx:56` `DomainChips` is a second grey-fill pill instead of `MonoBadge`. **Fix:** consolidate onto the ui-kit badge.

## B. UI overhaul — LOW (token sweep + dead code)

- `text-[13.5px]` half-pixel (`audit-reader-shell.tsx:488`); un-tokenized `text-[12/13/14/18/20px]` + mono labels faked inline instead of `Eyebrow` (competitor-landscape, buyer-icp, market-category, demand-intent); a few `text-muted-foreground` body cells that should be `foreground`.
- Dead serif blocks `document-header.tsx` + `chapter-divider.tsx` survive (the banned 56px/32px italic serif — only their tests import them; **delete** both + their tests).
- A few unused ui-kit exports.
- **True pixel QA still needs a live `/research-v2` run** (the shell renders only with `runId` + `audit-state`); code-level fidelity is high but unverified against real paint.

## C. App fixes (from the VoC sign-off calibration)

1. **CompetitorLandscape first-pass schema.** It repaired twice (~60s of the 184s) on `body.competitorSet.competitors: missing competitor types indirect` — a legit schema-validation repair (fix #1 correctly keeps these). **Fix:** nudge the `positioning-competitor-landscape` skill/prompt to always include ≥1 `indirect` competitor, and/or relax the schema to allow a justified empty indirect set. Drops the 2 repairs. The cumulative cross-path section-budget (#3c/#4a) is **NOT needed** — every section finished well under the 270s ceiling.
2. **SKILL.md Vercel file-tracing (deploy-blocker-in-waiting).** `next.config.ts` `outputFileTracingIncludes` traces `SKILL.md` into the `/api/research-v2/orchestrate` lambda, but `loadLabSkill` (`lab-section-job.ts:114-130`) `readFile`s it inside the **`/api/research-v2/run-lab-section`** lambda's `after()` callback → ENOENT-all-sections on Vercel. Local `next dev` is unaffected. **Fix:** add the `src/lib/lab-engine/skills/**/SKILL.md` trace include for `run-lab-section` (and verify the production bundle).

## D. Push / deploy (USER-GATED — do not do without explicit go)

- Branch is 51 ahead of `origin/main`, unpushed. Not on `main`.
- Live run provider was **`deepseek-direct` / `deepseek-v4-flash`** → `DEEPSEEK_API_KEY` must be present in the Vercel deploy env (it hard-throws at module load if absent), alongside `ANTHROPIC_API_KEY` (fallback), `SEARCHAPI_KEY`, `BRAVE_SEARCH_API_KEY`, `RAILWAY_WORKER_URL`/`RAILWAY_API_KEY` (corpus stage).
- Recommend landing A + the SKILL.md fix (C2) before any deploy.
