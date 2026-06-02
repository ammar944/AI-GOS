# Codex Handoff — Cutover `feat/v2-lab-section-wire` → `main`

> Dispatch with `model_reasoning_effort=xhigh`, working root = this worktree
> (`/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`).
> Five atomic commits, in order. The first one fixes a pre-merge regression; the next two are decision checks; the fourth is the actual merge; the fifth is the post-merge verification manifest for Ammar.
> Report only what you changed + build/test output + the commit SHAs + any deviation from this spec.
> **No deploy.** No `vercel deploy`, no `railway up`. Git only.
> **No migration application.** List them; Ammar applies via Supabase MCP after the merge lands.

## Mission & landing context

`feat/v2-lab-section-wire` is **326 commits ahead** of `main` (HEAD `5ee7e1fa` vs main `8df36d3e`). The fork point is `8d742be6`. Waves 0–4 of the research-pipeline restructure shipped on lab-wire (see `docs/superpowers/specs/2026-05-28-waves-3-4-design.md`); main is still serving the pre-cutover backend. **The job is to move main forward to `5ee7e1fa` cleanly, with no rewriting of lab-wire's atomic-commit history.**

The 13 commits on `main` that aren't on lab-wire are pre-cutover work targeting files lab-wire deleted — they're all classified **safe to drop** by a read-only audit, with 3 needing a 30-second precheck (Task 2) to confirm lab-wire's v3 schema supersedes them.

**Strategy locked (do not deviate):**

1. **Fix the 15 net-new TypeScript errors** in lab-wire's test files surfaced by the pre-merge audit (Task 1). These are real `tsc --noEmit` regressions, not pre-existing baseline noise. Until they're fixed, main would inherit a broken `tsc` gate.
2. **Verify the 3 bucket-b commits on main are superseded** by lab-wire's v3 schema (Task 2) — a 30-second grep, no code change unless a regression surfaces.
3. **Fast-forward merge** `feat/v2-lab-section-wire` into `main` (Task 3) — no merge commit, no rebase, no force-push. If FF fails because of the 13 commits, Task 2 will have either confirmed they're droppable (use `git reset --hard` with documentation) or surfaced the regression to Ammar.
4. **Post-merge verification + migration manifest** (Task 4): re-run all gates on main; produce the list of new migrations Ammar applies via Supabase MCP.

## Global constraints (apply to every task)

- **Surgical.** Change only what each task specifies. Match existing style. No unrelated refactors.
- **No deploy.** No Vercel CLI, no Railway CLI, no `vercel deploy`, no `railway up`. Git operations only.
- **No migration application.** Do not run `supabase db push`, do not call any Supabase RPC. Migrations are listed in Task 4 for Ammar to apply via the Supabase MCP after the merge lands.
- **Do not rewrite lab-wire history.** No rebase. No `git filter-branch`. No `git push --force`. The 326 atomic commits stay as-is.
- **Pre-existing baseline:** `npx tsc --noEmit` should have **0 errors** on the frontend (after Task 1 fixes the 15 net-new ones); worker `tsc --noEmit` is already 0; full `vitest` is **1118 pass / 1 skip**; `next build` exit 0; `lint` 0 errors / 64 warnings (known); worker `vitest` 391 pass.
- **Commits:** five atomic commits on `feat/v2-lab-section-wire` for Tasks 1–2 (Task 2 might be a no-op if lab-wire already supersedes), then a single fast-forward merge into `main` for Task 3, then Task 4 produces an artifact + report (no commit). Co-Authored-By trailer on each new commit.
- **Pre-existing known errors to NOT touch:** openrouter tests and chat-blueprint tests (per `.claude/rules/learned-patterns.md`). These don't exist in lab-wire, so this is informational.

---

## Task 1 — Fix the 15 net-new TS errors gating the merge

**GOAL:** restore frontend `tsc --noEmit` to **0 errors** so main inherits a clean type gate. All 15 errors are in test files; no production code is wrong, but lab-wire's CI gate is silently red and must be fixed before merging.

**ERRORS TO FIX (from `npx tsc --noEmit -p .` at HEAD `5ee7e1fa`):**

| # | File | Line | Code | Issue |
|---|---|---|---|---|
| 1 | `src/components/research-v2/__tests__/audit-reader-shell.test.tsx` | 416:37 | TS2493 | Tuple `[]` of length 0 has no element at index 0 |
| 2 | `src/lib/lab-engine/agents/__tests__/run-section-corpus-only.test.ts` | 389:12 | TS18046 | `result.artifact.body.adEvidence` is `unknown` (needs type narrowing) |
| 3 | same | 466:7 | TS2722 | Cannot invoke possibly-`undefined` object |
| 4 | same | 488:12 | TS18046 | `result.artifact.body.adEvidence` is `unknown` |
| 5 | `src/lib/lab-engine/agents/tools/__tests__/brave-search.test.ts` | 83:39 | TS2352 | `[]` → `[string, RequestInit]` conversion error |
| 6 | `src/lib/lab-engine/agents/verification/__evals__/verifier.eval.test.ts` | 29:36 | TS2339 | `import.meta.glob` not in default `ImportMeta` |
| 7–15 | same | 43–58 | TS18046 | `fixture` is `unknown` (8 instances) |

**STEPS:**

1. **Errors 1, 5** — narrow the tuple/conversion at the call site. For `[]` accessed at index 0 or cast to `[string, RequestInit]`, give the test fixture a non-empty literal type (e.g. `[['https://...', { method:'POST' } as RequestInit]]` or destructure with a `?.` + assertion); do NOT change the production module's typing.

2. **Errors 2, 3, 4** — `adEvidence` is typed as `unknown` because the test reads from a generic `result.artifact.body`. Add a small assertion helper in the test file (`function assertCompetitorBody(body: unknown): asserts body is CompetitorLandscapeBody { ... }`) or use a runtime check followed by a type narrowing block. Do NOT change the lab-engine schema.

3. **Error 6** — `import.meta.glob` exists at runtime in Vitest but isn't in the default `ImportMeta` interface. Add a triple-slash directive or `declare global { interface ImportMeta { glob: ... } }` at the top of `verifier.eval.test.ts`. Vitest's own type pkg `vitest/import-meta` has this; the cleanest fix is `/// <reference types="vite/client" />` at the file top.

4. **Errors 7–15** — same as 2–4: the fixture loader returns `unknown`. Define an exported `VerifierFixture` type in the fixtures barrel and cast `as VerifierFixture` (or, better, use a Zod schema that's already in the codebase for verification fixtures).

**VERIFY (within this task):**
- `npx tsc --noEmit -p .` → **0 errors** (no longer printing those 15)
- `npx tsc --noEmit -p research-worker/tsconfig.json` → still 0 errors
- `npm run test:run` → still ≥1118 pass / 1 skip (no new failures)
- `npm run build` → still exit 0

**COMMIT:** `fix(research-v2): restore frontend tsc baseline by typing test fixtures`

---

## Task 2 — Confirm the 3 bucket-b main-drift commits are superseded (decision check, likely no-op)

**GOAL:** verify lab-wire's v3 schema already contains the work in commits `04e7d8d4`, `30c02992`, `7eea0607` on main, so they can be safely dropped in the fast-forward merge. The pre-merge audit classified all 13 main-drift commits as droppable; the other 10 are obvious (touch files lab-wire deleted). These 3 touch files that exist on both branches and need a 30-second grep to confirm lab-wire's version is the richer one.

**THREE CHECKS (run all; ALL three must come back "lab-wire supersedes"):**

1. **`04e7d8d4` — card-taxonomy.ts** — `wc -l src/lib/workspace/card-taxonomy.ts`. Lab-wire is 1440 lines, main's was 1353. Then:
   ```
   grep -E "interpretation|leversToMoveIt|launchBlocker|decisionGate|singleCampaignRationale" src/lib/workspace/card-taxonomy.ts | head -10
   ```
   Expect: ≥3 hits (lab-wire has the richer mappings). If 0 hits, surface to Ammar.

2. **`30c02992` — field-catalog.ts (v3 enums)** —
   ```
   grep -E "salesMotion|pricingModel|conversionPath|avgAcv" src/lib/journey/field-catalog.ts | head -10
   ```
   Expect: ≥4 hits across the 4 enum names. If 0, surface — lab-wire doesn't have the v3 enums and the commit needs cherry-picking.

3. **`7eea0607` — resolve-identity.ts (v3 business-model hard-map)** —
   ```
   grep -E "applyV3BusinessModelHardMap|salesMotion|avgAcv" research-worker/src/identity/resolve-identity.ts | head -10
   ```
   Expect: ≥1 hit for `applyV3BusinessModelHardMap` or the v3 field names. If 0, surface.

**STEPS:**

- Run all 3 greps. Capture the output.
- If all 3 return "lab-wire supersedes" → no code change needed. Document the finding in a commit message + move on.
- If ANY of the 3 returns "lab-wire does NOT have this" → **STOP, do not merge.** Surface the gap to Ammar with the missing functionality + the SHA that would need cherry-picking. Do not cherry-pick on your own initiative.

**VERIFY:**
- All 3 greps logged.
- If all-superseded: `git diff --stat HEAD..origin/main -- src/lib/workspace/card-taxonomy.ts src/lib/journey/field-catalog.ts research-worker/src/identity/resolve-identity.ts` — for each file, the lab-wire net change exceeds main's; confirm.

**COMMIT (only if a documentation note is needed):** `docs(cutover): record that lab-wire's v3 schema supersedes the 3 main-drift bucket-b commits`. If everything checks out clean, this can be skipped — Task 1's commit already advances HEAD.

---

## Task 3 — Fast-forward merge `feat/v2-lab-section-wire` → `main`

**GOAL:** move main from `8df36d3e` to lab-wire's HEAD (post-Task-1), preserving lab-wire's 326 atomic commits as the linear history. **No merge commit.** No rebase.

**PRECONDITIONS (verify, do not proceed if any fail):**
- Task 1 done → `npx tsc --noEmit` returns 0 errors.
- Task 2 done → all 3 greps returned "lab-wire supersedes".
- `git status` on lab-wire worktree → clean (no uncommitted changes outside the planning docs Ammar already has untracked).

**STEPS:**

1. **Capture pre-merge state** (for the post-merge diff report):
   ```
   git log --oneline main -1 > /tmp/cutover-main-before.txt
   git log --oneline feat/v2-lab-section-wire -1 > /tmp/cutover-labwire-head.txt
   git rev-list --left-right --count main...feat/v2-lab-section-wire > /tmp/cutover-divergence.txt
   ```

2. **Switch to main** (from a fresh checkout — DO NOT operate on main within the lab-wire worktree; use the primary checkout at `/Users/ammar/Dev-Projects/AI-GOS`):
   ```
   cd /Users/ammar/Dev-Projects/AI-GOS
   git fetch origin
   git checkout main
   git pull --ff-only origin main
   ```

3. **Attempt fast-forward merge:**
   ```
   git merge --ff-only feat/v2-lab-section-wire
   ```
   If this fails with "Not possible to fast-forward" → the 13 main-drift commits are blocking. STOP. Surface to Ammar with the exact error. Do not attempt `git merge` (would create a merge commit) or `git rebase` (would rewrite lab-wire).

4. **If FF succeeded:** push to origin (per Ammar's explicit "can commit to main"):
   ```
   git push origin main
   ```
   If push is rejected (concurrent push, etc.) → STOP. Do not force-push. Surface to Ammar.

5. **Post-merge log capture:**
   ```
   git log --oneline main -5 > /tmp/cutover-main-after.txt
   ```

**FALLBACK IF FF FAILS** (this is the documented path, not improvisation):

The 13 main-drift commits all target files lab-wire deleted (per the audit). The clean way to absorb them WITHOUT cherry-picking dead code is to merge with `-s ours` on a temporary branch that walks back through main's drift commits and absorbs them as no-ops. **DO NOT do this unilaterally** — surface to Ammar with the proposal: "FF blocked by N commits on main; the cleanest path is `git merge -s ours main` from lab-wire to absorb their metadata, then FF main to that merge point. Approve?"

**VERIFY (within this task):**
- `git log --oneline main -1` returns lab-wire's HEAD (which is Task 1's commit SHA, since Task 2 may not have committed).
- `git log --oneline origin/main -1` matches (after push).
- `git rev-list --count main` (count of total commits on main) increased by ≥326.
- `git status` on main is clean.

**COMMIT:** No new commit — this is a merge operation. The diff against the previous main HEAD is the 326 lab-wire commits being absorbed.

---

## Task 4 — Post-merge verification + migration manifest

**GOAL:** prove main is in the expected state and produce the migration list for Ammar to apply via Supabase MCP.

**STEPS:**

1. **From the primary checkout (`/Users/ammar/Dev-Projects/AI-GOS`) on `main`, re-run all gates from scratch:**
   - `npm install` (in case lockfile drifted)
   - `npx tsc --noEmit -p .` → 0 errors expected
   - `npm run lint 2>&1 | tail -10` → 0 errors, ~64 warnings expected
   - `npm run test:run 2>&1 | tail -10` → 1118+ pass / 1 skip expected
   - `npm run build 2>&1 | tail -10` → exit 0 expected
   - `cd research-worker && npm install && npx tsc --noEmit -p . && npm run test:run` → all clean expected

2. **Generate the migration manifest** (Ammar will apply these via Supabase MCP, NOT you):

   Run:
   ```
   git log --oneline --diff-filter=A --name-only 8d742be6..HEAD -- 'supabase/migrations/*.sql' | grep '\.sql$' | sort -u > /tmp/cutover-new-migrations.txt
   ```

   Produce a chronological manifest (filename + 1-line description from the SQL file head) for these files. Save it to `docs/2026-05-28-cutover-migration-manifest.md` with this format:

   ```markdown
   # Cutover migration manifest

   New migrations to apply on prod Supabase (in this exact order via Supabase MCP `apply_migration`).
   Per the read-only audit, all are forward-only, no destructive changes.

   1. `20260421_add_app_roles_to_user_profiles.sql` — RBAC columns on user_profiles
   2. `20260421_create_access_audit_logs.sql` — audit log table for impersonation
   3. ... [continue chronologically]

   ## Order dependencies
   - commit_artifact_section RPC is replaced 6 times in sequence (20260514 → 20260515 → 20260521 → 20260522 → 20260523 → 20260524 → 20260525)
   - seed_orchestration RPC is replaced 3 times (20260520 → 20260522 → 20260528)
   - Apply in chronological filename order; do not skip.

   ## Modified-in-place migration
   - `20260514_research_artifact_normalized.sql` was modified in commit `8cac151d` (insert-on-conflict fix + active-run guard). Supabase will see the current file state, so this is informational only — no special handling needed.

   ## Irreversible changes
   None. All migrations use `IF NOT EXISTS` / `IF EXISTS` guards.
   ```

3. **Produce the env-var manifest** for Ammar to verify in his Vercel/Railway env (not applied by you):

   Save to `docs/2026-05-28-cutover-env-manifest.md`:

   ```markdown
   # Env-var manifest (cutover)

   ## New required vars (set before next deploy)
   - `BRAVE_SEARCH_API_KEY` — lab-engine search tool. Without it, every section's search returns credentialGap.

   ## New conditional vars
   - `DEEPSEEK_API_KEY` — required ONLY if `LAB_ENGINE_PROVIDER=deepseek-direct`. Default provider is Anthropic.
   - `MANAGED_AGENTS_WEBHOOK_SECRET` — required ONLY if `MANAGED_AGENTS_POSITIONING_ENABLED=true`.

   ## New optional vars (have defaults)
   - `LAB_ENGINE_PROVIDER` (default: anthropic)
   - `LAB_ENGINE_LIVE_TOOLS` (default: enabled)
   - `WORKER_STALE_RUN_THRESHOLD_MIN` (default: 15)
   - `RESEARCH_DEEP_PROGRAM_MODEL` (default: sonar-pro)
   - `RESEARCH_JOURNEY_SECTION_MODEL` / `_MAX_TOKENS` / `_TIMEOUT_MS`
   - `ANTHROPIC_PLATFORM_SKILL_IDS` / `RESEARCH_DEEP_PROGRAM_SKILL_IDS`
   - `APP_BOOTSTRAP_ADMIN_EMAILS` / `APP_BOOTSTRAP_INTERNAL_EMAILS`

   ## Removed vars (safe to delete from env)
   - `AHREFS_API_KEY`, `SEMRUSH_API_KEY` — legacy data sources, no longer called.
   - `RESEARCH_COMPETITORS_MODEL`, `RESEARCH_ICP_MODEL`, `RESEARCH_INDUSTRY_MODEL`, `RESEARCH_KEYWORDS_MODEL`, `RESEARCH_OFFER_MODEL`, `RESEARCH_SYNTHESIS_MODEL`, and all `_FALLBACK_MODEL` / `_REPAIR_MODEL` / `_RESCUE_MODEL` / `_HEURISTIC_MODEL` siblings — replaced by unified `LAB_ENGINE_PROVIDER` switch.
   - `INJECT_INDUSTRY_TEMPLATES` — legacy feature flag.
   ```

4. **Commit the two manifests** with message: `docs(cutover): migration + env manifests for lab→main cutover`. This is the only new commit Task 4 creates.

**VERIFY:**
- All 6 gate commands listed above return their expected results on main.
- The two manifest files exist, committed.
- `git log --oneline main -1` shows the manifest commit on top of the merged history.

---

## Out of scope (do not touch — flag if blocked)

- **Vercel deploy** — explicitly user-deferred. No `vercel deploy`, no `vercel link`, no env-var pushes to Vercel.
- **Railway deploy** — explicitly user-deferred. No `railway up`. (Note: research-worker still needs the corpus runner deployed eventually; that's a separate task.)
- **Migration application** — Ammar applies via Supabase MCP. Do not run `supabase db push` or any equivalent.
- **Cherry-picking ANY of the 13 main-drift commits** — they are all classified safe-to-drop. If Task 2 surfaces one that ISN'T superseded, STOP and surface; do not cherry-pick on your own initiative.
- **Force-pushing** — `git push --force` and `git push --force-with-lease` are both forbidden. If push is rejected, surface to Ammar.
- **Rebasing lab-wire** — preserve the 326 atomic commits' history.
- **Deleting lab-wire branch** — keep it around as a recovery point until Ammar confirms the merge is good.
- **48h soak** — explicitly user-deferred.
- **Live-external-tools repro** (Voice/Demand stall) — separate investigation, not part of this cutover.

## Report back

Return only:

1. **Task 1**: the SHA of the type-fix commit; before/after `tsc` error counts; `vitest`/`build`/`lint`/`worker-build`/`worker-test` numbers (no regressions expected).
2. **Task 2**: the 3 grep outputs verbatim; the verdict (all-superseded / blocked).
3. **Task 3**: pre-merge and post-merge `git log --oneline main -1` outputs; the divergence count (`git rev-list --count` before/after); whether FF succeeded directly or the fallback was needed.
4. **Task 4**: re-run gate numbers on main; paths of the two manifest files; the commit SHA of the manifest commit.

If anything deviates from this spec — STOP, surface to Ammar with the exact deviation, do not improvise.

## Quick reference — current numbers (verified at design time)

| Gate | Lab-wire HEAD `5ee7e1fa` (pre-Task-1) | Expected on main post-merge |
|---|---|---|
| frontend `tsc --noEmit` errors | **15** (Task 1 fixes these) | **0** |
| frontend `vitest` | 1118 pass / 1 skip | ≥1118 pass / 1 skip |
| frontend `next build` | exit 0 | exit 0 |
| `lint` errors / warnings | 0 / 64 | 0 / 64 |
| worker `tsc --noEmit` | 0 | 0 |
| worker `vitest` | 391 pass | 391 pass |
| commits ahead of main | 326 | 0 (HEAD = lab-wire HEAD) |
| new migrations to apply via Supabase MCP | 18 | (Task 4 produces the manifest) |
| new env vars required | 1 (`BRAVE_SEARCH_API_KEY`) | (Task 4 produces the manifest) |
