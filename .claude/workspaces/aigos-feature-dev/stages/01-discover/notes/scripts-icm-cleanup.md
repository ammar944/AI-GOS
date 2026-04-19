# Feature: scripts-icm-cleanup

## Classification
`day` — scoped cleanup of the script pipeline. Touches ~15 files across `research-worker/src/`. Not week+ because it's deletion + refactor with no new behavior.

## 1. Ask, in one sentence
Collapse the script pipeline to a single ICM-shaped implementation: delete v2.0 orphan stages, unify shared utilities into a clean `scripts/` module, decide v1's fate, fix the deterministic-planner lie, and add reflective Layer 0/1/2 context files.

## 2. Success criteria
- [ ] `research-worker/src/scripts/stages/` contains ONLY directories that the live pipeline imports from.
- [ ] `research-worker/src/scripts/pipeline.ts` does NOT import from `../runners/ad-scripts`.
- [ ] `planner.ts` is reproducible: same input + same seed → same matrix. Tests assert this.
- [ ] Exactly one input type shape exists (not two near-duplicates).
- [ ] `research-worker/src/scripts/CLAUDE.md`, `CONTEXT.md`, and one `CONTEXT.md` per live stage exist and describe the actual contracts.
- [ ] `npm run build` green. `npm run test:run` green (especially `research-worker/src/scripts/__tests__/*`). End-to-end script generation still produces 15 scripts.

## 3. In scope
- `research-worker/src/scripts/**` (all)
- `research-worker/src/runners/ad-scripts.ts` (may be deleted)
- `research-worker/src/prompts/ad-scripts-pass1.ts`, `ad-scripts-pass2.ts` (delete if v1 goes)
- `research-worker/src/schemas/ad-scripts.ts` (move to scripts/ or delete)
- `research-worker/src/__tests__/ad-scripts-angles.test.ts`, `sanitize-scripts.test.ts`
- `research-worker/src/index.ts` lines ~465–550 (the v1/v2 toggle and both call sites)
- `src/app/api/scripts/generate/route.ts` (confirm no `pipelineVersion: 'v1'` is set)
- `src/lib/scripts/schemas.ts` (ensure frontend types still match)

## 4. Out of scope
- Frontend components under `src/components/scripts/**` — do NOT touch UI.
- `src/lib/scripts/trim-research-context.ts` — out of scope.
- Any research runner OTHER than ad-scripts (industry, icp, competitors, offer, keywords, synthesize, media-plan, meeting-extract).
- Prompt content changes. Wording of prompts stays identical; only their location may move.
- Schema shape changes. The output shape the frontend receives must not change.

## 5. Do-NOT-Load
- `node_modules/**`
- `.next/**`
- `research-worker/node_modules/**`
- `src/components/scripts/**` (out of scope — loading it wastes context)
- `research-worker/src/runners/{industry,icp,competitors,offer,keywords,synthesize,media-plan,meeting-extract}.ts`
- `*.lock`

## 6. Size rationale
Day-sized because: 6 atoms (below), worst case one of them requires a schema migration if v1 is the only caller supporting a legacy DB row, and the integration test surface (worker → Supabase → realtime → frontend) requires manual verification. Not week+ because no new behavior is introduced and every atom is reversible via git.

---

## Plan

| # | Atom | Model | Budget | Verification |
|---|------|-------|--------|--------------|
| 1 | Confirm no caller sets `pipelineVersion: 'v1'`. Grep frontend (`src/**/*.{ts,tsx}`) and API routes. Report findings. | Haiku | 5m / 20 calls | Written report: zero callers OR list of callers |
| 2 | Delete orphan stage dirs: `research-worker/src/scripts/stages/03-hooks/`, `04-body/`, `06-voice-polish/`. Confirm via grep that no imports reference them. | Haiku | 5m / 15 calls | `grep -r "hook-generator\|body-writer\|voice-polisher" research-worker/src` returns nothing; `tsc --noEmit` clean |
| 3 | Create `research-worker/src/scripts/utils/post-process.ts`. Move `sanitizeScript`, `stripDashes`, `dedupScripts`, `getProofSubset`, `detectUsedProofPoints` from `runners/ad-scripts.ts`. Update both `pipeline.ts` and (if still alive) `runners/ad-scripts.ts` to import from the new location. Move/copy tests in `__tests__/sanitize-scripts.test.ts` to point at the new location. | Sonnet | 15m / 40 calls | `tsc --noEmit` clean; `npm run test:run -- research-worker/src/scripts` green |
| 4 | Fix `planner.ts` determinism. Change `buildScriptMatrix` to accept `seed?: number`. Default to a hash of `input` fields (stable across runs with same input). Remove `Date.now() % 100`. Add a test asserting identical input → identical output. | Sonnet | 15m / 30 calls | New test passes; existing planner tests still green |
| 5 | Based on atom 1 findings: if zero v1 callers, delete `runners/ad-scripts.ts`, `prompts/ad-scripts-pass1.ts`, `prompts/ad-scripts-pass2.ts`, `schemas/ad-scripts.ts`, `__tests__/ad-scripts-angles.test.ts`. Remove the `useV2` toggle + else branch in `index.ts`. Move `schemas/ad-scripts.ts` into `scripts/` if still needed by v2. | Sonnet | 20m / 50 calls | `tsc --noEmit` clean; `npm run build` green; worker starts; one manual end-to-end script generation produces 15 scripts |
| 6 | Unify input types. Create `research-worker/src/scripts/types.ts` with a single `PipelineInput` (and `ProofPoint`, `StyleReference`, `BrandVoiceNotes`). Update `pipeline.ts` and `creative-writer.ts` to import from there. | Haiku | 10m / 20 calls | `tsc --noEmit` clean |
| 7 | Write ICM context layer: `research-worker/src/scripts/CLAUDE.md` (Layer 0, the module contract + Do-NOT-Load), `research-worker/src/scripts/CONTEXT.md` (Layer 1, current state + version), and one `CONTEXT.md` per live stage (`01-plan/`, `02-claims/`, `03-write/`, `05-quality-gate/`) with Inputs / Process / Checkpoints / Outputs matching the workspace pattern. Each stage CONTEXT.md replaces the JSDoc header (which can become a one-liner pointing at CONTEXT.md). | Sonnet | 20m / 25 calls | All files exist; diff against `JSDoc` contracts shows no loss of information |

### Dependencies
- Atom 1 must complete before atom 5.
- Atoms 2, 3, 4, 6, 7 are independent and can run in any order after atom 1 ships.

---

## Verification (stage 04)

1. `cd research-worker && npm run build` → exits 0.
2. `npm run test:run -- research-worker/src/scripts` → all green.
3. `npm run build` (root Next.js) → exits 0.
4. Manual: run one script generation end-to-end (local worker + Next.js). Confirm script pack in Supabase has 15 scripts and the frontend renders them.
5. Re-read this brief's success criteria: all 6 checked off.

## Ship (stage 05)

- PR title: `chore(scripts): collapse pipeline to single ICM implementation`
- PR body: copy success criteria as a checklist + link to this brief.
- After merge: deploy worker (`cd research-worker && railway up`), monitor for 10 minutes, watch script-pack error rates.
- Capture any new learned patterns in `.claude/rules/learned-patterns.md`.
