# Cutover handoff — Task 2 addendum + Task 3 unblock

> Read this BEFORE `docs/2026-05-28-cutover-lab-to-main-codex-handoff.md`. This addendum supersedes Task 2's grep-based verdict and authorizes Task 3's `-s ours` fallback.

## Context

The first Codex dispatch executed Task 1 cleanly (commit `78c67999`, frontend `tsc --noEmit` 15 → 0, all gates green) and correctly halted on Task 2 because the 3 grep checks failed:

- `04e7d8d4` (card-taxonomy.ts): 2 hits for `interpretation` only — missing 3+ of the round-3 keys
- `30c02992` (field-catalog.ts): 0 hits for `salesMotion|pricingModel|conversionPath|avgAcv`
- `7eea0607` (resolve-identity.ts): 0 hits for `applyV3BusinessModelHardMap`

Codex's halt was correct discipline against a too-narrow verification check.

## Architectural-equivalence investigation

A Claude-side review (Ammar's instruction) confirmed all 3 bucket-b commits ARE genuinely superseded by lab-wire — by a deeper refactor that the same-name-in-same-file grep could not detect:

| Commit | Surface symptom | Architectural truth |
|---|---|---|
| `30c02992` (v3 field-catalog enums) | Lab-wire's `src/lib/journey/field-catalog.ts` has 0 hits for the 4 v3 enum names | Lab-wire derives `pricingModel`/`salesMotion`-equivalent values from richer fields. See `src/components/onboarding/step-product-offer.tsx:188` — `const { offerPrice, pricingModel } = derivePricingFields(tiers)`. The v3 enums are now computed values from richer field structures (e.g., `pricingTiers`), not standalone enum routing keys. 20+ lab-wire files still reference these names as derived/consumed values. |
| `7eea0607` (`applyV3BusinessModelHardMap`) | Lab-wire's `research-worker/src/identity/resolve-identity.ts` has 0 hits for the function | Intentional architectural removal. Lab-engine uses LLM-driven evidence collection + Wave 3 structural verification instead of enum-driven hard-mapping. The hard-map was a workaround for the legacy worker pipeline; lab-engine's trust layer supersedes it. |
| `04e7d8d4` (round-3 card-taxonomy mappings) | Lab-wire's `src/lib/workspace/card-taxonomy.ts` has only `interpretation` hits, missing `singleCampaignRationale`/`launchBlocker`/`decisionGate`/`leversToMoveIt` | Round-3 keys moved from the card-rendering layer to the schema layer: `src/lib/journey/schemas/offer-analysis.ts`, `research-worker/src/contracts.ts`, `research-worker/src/skills/rollout-skill.ts`. Better architectural home — schema-true, not render-true. |

**Verdict: all 3 commits are architecturally superseded by lab-wire's v3 refactor. Safe to drop in the merge.** Ammar approved 2026-05-28 via interactive review.

## Task 3 — RESUME with `-s ours` fallback (authorized)

The original handoff Task 3 says fast-forward merge first; if FF fails, surface the `-s ours` proposal to Ammar before executing it. **Ammar has now approved the `-s ours` path explicitly.** FF will fail because of the 13 main-drift commits, so go directly to the fallback.

### Execute these steps in order

1. **Confirm lab-wire HEAD includes Task 1's type-fix commit:**
   ```
   cd /Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire
   git log --oneline feat/v2-lab-section-wire -1
   ```
   Expected: `78c67999` (or later, if any subsequent commits — but Task 2 should have been no-op). If not `78c67999`, STOP and surface.

2. **Capture pre-merge state** for the report:
   ```
   git log --oneline main -1 > /tmp/cutover-main-before.txt
   git log --oneline feat/v2-lab-section-wire -1 > /tmp/cutover-labwire-head.txt
   git rev-list --left-right --count main...feat/v2-lab-section-wire > /tmp/cutover-divergence.txt
   ```

3. **Create the `-s ours` merge commit on lab-wire** (preserves main's 13 drift commits as historical ancestors; lab-wire's tree wins):
   ```
   cd /Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire
   git fetch origin main
   git merge -s ours origin/main -m "Merge branch 'main' (absorb 13 superseded drift commits)

   Architectural-equivalence audit confirmed all 13 main-drift commits
   are superseded by lab-wire's v3 lab-engine refactor:

   - 10 commits target files lab-wire deleted (legacy worker positioning,
     /onboarding/edit, journey-chat-system, editable-input tests)
   - 3 bucket-b commits (04e7d8d4, 30c02992, 7eea0607) are architecturally
     superseded — see docs/2026-05-28-cutover-task2-addendum.md for the
     side-by-side proof.

   This merge commit preserves their history as auditable ancestors;
   the working tree matches lab-wire HEAD.

   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
   ```
   If this fails for any reason (uncommitted changes, conflicts despite `-s ours`, etc.), STOP and surface the exact error.

4. **Switch to the primary checkout and fast-forward main:**
   ```
   cd /Users/ammar/Dev-Projects/AI-GOS
   git fetch origin
   git checkout main
   git pull --ff-only origin main
   git merge --ff-only feat/v2-lab-section-wire
   ```
   If `git merge --ff-only` fails now, STOP and surface (it should succeed because the `-s ours` merge in step 3 made lab-wire's tip a descendant of main's tip).

5. **Push main to origin:**
   ```
   git push origin main
   ```
   If push is rejected (concurrent push, branch protection, etc.) → STOP. Do not force-push. Surface to Ammar with the exact error.

6. **Push the updated lab-wire too** (so origin/feat/v2-lab-section-wire reflects the merge commit):
   ```
   git push origin feat/v2-lab-section-wire
   ```

7. **Post-merge log capture:**
   ```
   git log --oneline main -5 > /tmp/cutover-main-after.txt
   ```

### Verification (within Task 3)

- `git log --oneline main -1` matches `git log --oneline feat/v2-lab-section-wire -1` (both point to the `-s ours` merge commit).
- `git log --oneline origin/main -1` matches (after push).
- `git rev-list --count main` increased by ≥327 (326 lab-wire commits + 1 merge commit).
- `git status` on main is clean.
- `git log --merges main -1` shows the new merge commit at the top with the "Merge branch 'main'" message.

## Task 4 — proceed unchanged

Run exactly as written in the original handoff §Task 4. No deviation. Apply the same gate set + produce the migration manifest + env manifest, then commit them with the documented message.

## Report back (matches original spec)

1. **Task 3**: pre-merge and post-merge `git log --oneline main -1` outputs; divergence count before/after; the `-s ours` merge commit SHA; push results for both branches.
2. **Task 4**: re-run gate numbers on main; paths of the two manifest files; the commit SHA of the manifest commit.

(Task 1 already reported; Task 2 verdict is recorded in this addendum — no separate Task 2 commit needed.)

## What's still forbidden

Unchanged from original handoff:
- No `vercel deploy` / `railway up`
- No `supabase db push` / migration application (Ammar applies via Supabase MCP after merge lands)
- No `git push --force` / `--force-with-lease`
- No rebase of lab-wire's 326 atomic commits
- No deletion of `feat/v2-lab-section-wire` (keep as recovery point)
- No cherry-picking from main's 13 drift commits

If anything in Tasks 3 or 4 deviates from this spec — STOP, surface, do not improvise.
