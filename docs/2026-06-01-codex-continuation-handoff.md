# Handoff — AI-GOS research-quality Phase 1 done; LIVE RUN is the next action

## Where to work
- **Worktree (v3 system of record):** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`, branch `feat/v2-lab-section-wire`. All work below is committed there, **NOT pushed, NOT deployed** (push/deploy stays user-gated).
- The main checkout `/Users/ammar/Dev-Projects/AI-GOS` is on an unrelated branch (`codex/claude-managed-agents-work`) — do not work there.

## What this session shipped (all committed, every gate green: build 0 / tsc 0 / lint 0 errors (67 baseline warnings) / 1206 tests pass)
Commit stack on `feat/v2-lab-section-wire` (newest first):
- `7f646819` G6 — goal recitation at the answer-tool prompt tail (Manus lever; wired at both answer-tool assembly sites in run-section.ts)
- `18a746c3` chore — P1.3 learned patterns
- `060f88c4` **P1.3** — real SpyFu `keyword_volume` tool + validator rejects `"not disclosed"` (Option A)
- `3f6a98f6` **P1.4** — ban self-sourced VoC pain quotes + quotes load-bearing (fixes the audit's ONE confirmed loss)
- `a392b01a` **P1.2** — 4 stub skills enriched 44→240-253 lines, 6 dead `.ts` purged, skill-resolution CI test
- `5f8d6e67` **docs(corpus)** — `docs/corpus/` technical corpus v1 (6 docs)
- `ecbf1e08` **P1.1** — positioningSynthesis capstone (prior session)

**Phase 1 of the research-quality Pass-2 plan is COMPLETE.** Full narrative + every decision/deviation is in memory `project_corpus_and_phase1_2026_05_31.md` (read it first) and the commit messages. Don't re-derive.

## THE NEXT ACTION — the ~$2 live validation run (user already said GO, target = ramp.com)
There is **no headless dispatch path** (the only scripts are dead managed-agents canaries). The run must go through the running app, and `/research-v2` + `/api/research-v2/*` are **Clerk-auth-gated** (`src/middleware.ts`) — an agent cannot self-serve the login.

State when the session paused:
- The user's **dev server is already up on `localhost:3000` serving THIS worktree** (PID 10486, verified via lsof cwd). Turbopack has hot-reloaded the Phase-1 commits. Use it; don't kill it.
- I asked the user to do the one auth-gated step: at `localhost:3000/research-v2`, enter **ramp.com**, run the audit (URL → auto corpus → confirm GTM brief → submit → fans out 6 sections + Synthesis + PaidMediaPlan). The user invoked `/handoff` instead of confirming the trigger — so **the live run has NOT happened yet.**

How to drive it next session (pick one):
1. **User triggers, you monitor** (fastest, what I proposed): once they kick off ramp.com, find the latest run in the **AIGOS Supabase** (via the `supabase` MCP — it's connected; the audit DB was already managed via MCP this project) and inspect the committed section artifacts headlessly.
2. **You fully drive** via the `browse` skill + `setup-browser-cookies` (import the user's localhost/Clerk cookies → authenticated headless session → navigate /research-v2). Heavier but self-contained.

**Validation checklist for the run (this is the actual deliverable — a verdict):**
- **P1.4:** `body.painLanguage.quotes[]` — zero `sourceUrl` whose registrable domain == ramp.com (no self-sourcing). The confirmed-loss fix.
- **P1.3:** every `body.keywordDemand.keywords[].monthlyVolume` is a real SpyFu number, no `"not disclosed"`.
- **P1.1:** `positioningSynthesis` reads the 6 committed artifacts and coheres (recommended wedge + 2-3 divergent angles).
- **G6:** output stays on-goal / grounded (recitation working).
- Watch CompetitorLandscape latency (flagged in prior memory).

## After the live run (the user's agreed order was 1→2→3; "1" was split — see below)
- **Boilerplate→shared-preamble dedup** (the deferred half of corpus G1): the `## Capability Gaps` + budget-note blocks are near-identical across the 6 tool skills. Move them into the shared `build-prompts.ts` preamble (inject in `buildAnswerToolInstructions` + `buildStructuredPrompt`, gate on `externalToolNames` non-empty) and strip from the 6 skills. The skill body is appended at ~6 sites in `run-section.ts` (grep `skillMd`); the 2 prompt-builders are the common chokepoints. paid-media/synthesis have no Capability-Gaps block (no tools) — leave them. This is pure token/cache hygiene; it does NOT change prompt content, which is why it was deferred past the live run.
- **Corpus refresh** (fix the v1 defects, all noted in the memory file): doc `04-gap-analysis-and-roadmap.md` shuffles its G-numbers between the table and the detail sections, and mislabels Pass-2 tie-ins (it calls stub-enrichment "P1.3" — in the execution plan that's **P1.2**); mark G1 (stubs) + G7 (dead code) as SHIPPED; `index.ts` citations drifted ~-4 lines from the P1.2 edit; docs 00/04 still describe the pre-Phase-1 state. **SpyFu is FUNDED** (probe proved it) — correct the corpus + audit "dead key" claims.
- **Phase 2** (`docs/2026-05-29-research-quality-pass2-execution-plan.md` §3): P2.1-JUDGE (assumes P1.4's `'quote'` LoadBearingClaimKind — already landed), P2.2, P2.3, P2.1-DELETE-STREAM.
- **Closing deliverable** (user asked): when Pass 2 is fully done, a designed before/after HTML report on the **Desktop** (NOT repo), per the 4-step design workflow.

## Key facts / gotchas (don't relearn the hard way)
- **NEVER touch `.env.local`** — even `grep -q` for a key name is denied by the user/hooks (security rule forbids reading `.env*`). Use `vercel env ls` (names only, secrets-safe) for Vercel-side checks; rely on the user for local env.
- **SpyFu is funded** — `SPYFU_API_KEY` present in Vercel (all envs) + `.env.local`; a scrubbed bulk probe returned real data (`crm software` vol=33,200 / cpc=$28.45). The audit's "dead key" was wrong.
- **Lab-engine skills are WHOLESALE-INJECTED** into the section system prompt; the running model has **no filesystem/Read tool** → Anthropic progressive disclosure does NOT transfer. This is the corpus's load-bearing thesis (`docs/corpus/01`, `03 §7`). Author skills self-contained + concise.
- **`section-registry.test.ts`** ("Phase D bounded in-section tool contract") pins each section's EXACT `allowedTools` array (order-sensitive) — update it when you change allowedTools, and include it in your targeted test run (parity/skill-resolution do NOT catch allowedTools changes). Bit me this session.
- **Full-suite background exit code can mislead** — a `npm run test:run > log &` reported "exit 0" while a test failed. Always check `TEST_EXIT=$?` printed into the log AND `sed 's/\x1b\[[0-9;]*m//g' log | grep -E "Test Files|Tests |FAIL|×"`.
- **claude-mem hook truncates `Read` to line 1** for files "with prior observations" — read with explicit `offset`/`limit`, or `cat` via Bash for QC.
- **Codex:** the `codex review` engine errored on `Operation not permitted` (sandbox PATH/app-server init) this session; a codex-rescue agent fell back to a manual grounded review (returned PASS). The free-form consult also flaked on output-capture. If using Codex, prefer `codex review --commit <SHA>` with **high** (not xhigh — hangs) reasoning, and expect the engine may not init.
- Line anchors in the Pass-2 plan are STALE (file grew); re-derive via grep before editing (e.g. `buildAnswerToolAttempt` is at 2861, not the plan's ~2763).

## Suggested skills for the next session
- `browse` (+ `setup-browser-cookies`) and/or `qa` — to drive/observe the authenticated ramp.com live run.
- `supabase` — to query committed section artifacts for the validation verdict.
- `verify` — evidence-based confirmation the live run actually validates the fixes.
- Read `docs/corpus/00`–`04` as the reference for any further lab-engine/skill work.
