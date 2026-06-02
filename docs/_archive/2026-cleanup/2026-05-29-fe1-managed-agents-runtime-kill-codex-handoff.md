# Codex Handoff — FE-1: Kill managed-agents runtime + webhook (keep schemas/)

> **Executor:** Codex (`-c model_reasoning_effort=xhigh -s workspace-write`). **Edit files only — do NOT run any git command.** Claude reviews + gates + commits.
> **Worktree (cwd):** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire` · branch `feat/v2-lab-section-wire`.
> **Grounded in:** `docs/2026-05-29-state-of-the-app-assessment.md` (slop item #1 — orphaned Anthropic-hosted runtime + live HMAC webhook for a flow nothing initiates) + ADR-0006 Phase F.

## GOAL
The Claude Managed Agents (Anthropic-hosted) path lost to the in-process lab engine and is dead on `main` — `orchestrate/route.ts` accepts only `executionMode:'lab'`, `startManagedAudit` has zero callers — yet its runtime still compiles and its HMAC webhook route is still live. Remove the runtime + webhook, after extracting the **only 2 helpers the live lab path imports from this tree.** Behavior of the live commit path must be **byte-for-byte identical** (pure move/extract, no rewrite).

## EXACT LIVE EDGES (verified by grep — handle all of them)
Runtime imports from `@/lib/managed-agents` (the only non-type, non-schema live deps):
- `src/lib/research-v2/supabase-run-store.ts:6` → `createSupabaseWebhookAdapter` from `@/lib/managed-agents/supabase-adapter`
- `src/lib/research-v2/supabase-run-store.ts:7` → `buildCommitPatch` from `@/lib/managed-agents/webhook-handler`

Type-only schema imports (`managed-agents/schemas/*`) from ~8 renderer/view files + tests — **OUT OF SCOPE for FE-1. Do NOT touch `src/lib/managed-agents/schemas/`.** (Task FE-2 consolidates schemas.)

## STEPS (each must keep `tsc` at 0)
1. **Extract the 2 helpers (minimal closure).**
   - Create `src/lib/research-v2/commit-patch.ts` and move `buildCommitPatch` there. Trace its transitive closure inside `webhook-handler.ts`: move every private helper/const/type `buildCommitPatch` actually uses (and nothing else). If a needed type lives in `managed-agents/schemas/` (kept) or `lab-engine/`, import it from there.
   - Create `src/lib/research-v2/supabase-webhook-adapter.ts` and move `createSupabaseWebhookAdapter` (+ its minimal closure from `supabase-adapter.ts`) there.
   - Repoint `supabase-run-store.ts:6-7` imports to the two new modules.
   - Behavior identical — do not refactor logic, just relocate.
2. **Delete the runtime files** (after step 1 leaves them with no live importers):
   `src/lib/managed-agents/agents.ts`, `client.ts`, `start-audit.ts`, `signature.ts`, `webhook-handler.ts`, `supabase-adapter.ts`, `section-artifact-schemas.ts`, and the whole `src/lib/managed-agents/__tests__/` dir.
   **KEEP** `src/lib/managed-agents/schemas/` and any `index.ts` that only re-exports `schemas/` (trim such an index so it references nothing deleted).
3. **Delete the webhook route** dir: `src/app/api/webhooks/managed-agents/` (route + any colocated tests).
4. **Flags:** after deletion, `rg "MANAGED_AGENTS_" src` must return only `schemas/` hits (if any) and zero live process.env reads. (Doc references in CLAUDE.md/.env.example are handled in a later task — leave docs alone here.)
5. **Verify no dangling imports:** `rg "@/lib/managed-agents/(agents|client|start-audit|signature|webhook-handler|supabase-adapter|section-artifact-schemas)" src` → zero hits; `rg "webhooks/managed-agents" src` → zero hits.

## CONSTRAINTS
- `tsc --noEmit` must stay **0 errors** at every step; no `as any`/`@ts-ignore` to paper over the extraction.
- No behavior change to `buildCommitPatch` / `createSupabaseWebhookAdapter` (pure move). The live section-commit path (`supabase-run-store`) must work exactly as before.
- Do NOT touch: `src/lib/managed-agents/schemas/`, the lab engine (`src/lib/lab-engine/`), `research-worker/`, or any renderer.
- Match existing style (named exports, kebab-case files, absolute `@/` imports). Do NOT run git.

## VERIFY (Claude will re-run these before committing)
```bash
cd /Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire
npx tsc --noEmit                          # 0 errors
npm run lint                              # 0 errors
npm run test:run                          # full suite green (1118 baseline minus deleted managed-agents tests)
rg -l "@/lib/managed-agents/(agents|client|start-audit|signature|webhook-handler|supabase-adapter)" src   # expect: no output
```

## DONE WHEN
`managed-agents/` contains only `schemas/` (+ a trimmed index if present); the webhook route is gone; the 2 helpers live in `research-v2/`; `supabase-run-store` works unchanged; tsc/lint/test green. Report the deleted file list + LOC removed.
