# Phases — research-perf-and-chat-edit

> Operating model: **separate session per phase.** Each new session reads this doc, picks its phase, executes the atoms via `/superpowers:executing-plans` or `/superpowers:subagent-driven-development`, commits each atom as a discrete commit, and returns control. THIS session (where this doc was written) is the QA + strategic HQ — Ammar's head-of-engineering-and-product seat. After each phase ships, the QA gate runs here before phase N+1 is greenlit.

**Source plan**: `docs/superpowers/plans/2026-05-11-research-perf-and-chat-edit.md` (commit `f60f6597`)
**Source spec**: `docs/superpowers/specs/2026-05-11-research-perf-and-chat-edit-design.md` (commit `fa650daa`)
**Branch**: `feat/research-perf-and-chat-edit` (off `feat/research-v2`, latest commit `1bf5c91b`)

---

## Phase map (4 phases)

| Phase | Atoms | Deliverable | Est. session time | QA gate (what I check from HQ) |
|---|---|---|---|---|
| **P1: Speed** | 1, 2, 3, 4 | Full audit drops from ~30min to ~5min wall via parallel section dispatch + token caps + search caps + worker concurrency | 3-4h focused work | Timing measurements; activity log unbroken; no quality regression |
| **P2: Chat foundation** | 5, 6, 7, 8 | Chat surface live with intent classifier behind it; no execution paths yet (echoes/throws for action intents) | 3-4h focused work | DB migration applied; route auth+persistence; classifier 7/7 tests; frontend chat thread renders Claude.ai-quality |
| **P3: Edit actions** | 9, 10, 11 | All three actions live: rerun re-dispatches sections; patch updates JSONB; converse streams grounded answers. `/api/research-v2/refine` stub deleted | 3-4h focused work | Each action verified independently via curl + UI; idempotency on retry; no JSONB corruption on patch |
| **P4: E2E verify** | 12 | Full audit + all 3 chat actions tested end-to-end with real Anthropic credits | 1-2h with Ammar's eyes | Numerical timing targets met; visual QA of chat UX; ship-or-iterate decision |

**Total wall time across phases**: ~10-12h focused execution + ~2h QA from HQ.

---

## P1: Speed (atoms 1-4)

### What ships when P1 lands

- Per-section wall time drops to ~2-3 min (from ~4-5min)
- All 6 sections dispatch concurrently after corpus completes
- Worker enforces a configurable concurrency cap (default 6) so the Anthropic API doesn't get thundered
- Full audit wall drops from ~30min (sequential clicks) to ~5min (longest section)

### Session-start prompt for the executor

Copy-paste this into a fresh Claude Code session in /Users/ammar/Dev-Projects/AI-GOS:

```
I'm executing Phase 1 of the research-perf-and-chat-edit feature.

Read these in order:
1. .claude/workspaces/aigos-feature-dev/stages/03-build/phases-research-perf-and-chat-edit.md
2. docs/superpowers/plans/2026-05-11-research-perf-and-chat-edit.md (atoms 1-4 only)
3. docs/superpowers/specs/2026-05-11-research-perf-and-chat-edit-design.md (sections 4-5 only)

Execute atoms 1, 2, 3, 4 sequentially via /superpowers:subagent-driven-development.
- Atom 1 + 2 chain (same file: research-worker/src/runners/journey-section-synthesis.ts)
- Atom 3 routes through /ui-ux-pro-max for the parallel-sections visual call, then frontend agent, then /design-review per workspace CLAUDE.md frontend protocol
- Atom 4 is worker-side (semaphore + test)

Each atom is one commit. After all 4 are committed, run:
  cd /Users/ammar/Dev-Projects/AI-GOS && npx tsc --noEmit (frontend)
  cd research-worker && npm run build && npx vitest run (worker)
  git log --oneline 1bf5c91b..HEAD

Report:
- 4 commit SHAs + one-line summary each
- Frontend tsc result (baseline-only? new errors?)
- Worker build + test results
- Anything that surprised you or required deviation from the plan
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED

DO NOT proceed to atom 5+. Stop after atom 4. Phase 2 is a separate session.
```

### QA gate (run from HQ when executor reports done)

When the executor session reports DONE, I run these checks from HQ:

1. **Commit hygiene**: `git log --oneline 1bf5c91b..HEAD | head -10` — expect 4 commits, each with a clear conventional-commit message, each touching one logical surface.
2. **Token cap landed**: `grep "JOURNEY_SECTION_MAX_TOKENS" research-worker/src/runners/journey-section-synthesis.ts` — expect default `10000`.
3. **Search cap in prompt**: `grep "AT MOST TWICE" research-worker/src/runners/journey-section-synthesis.ts` — expect a hit.
4. **Parallel dispatch wired**: `grep "dispatchAllPositioningSections\|Promise.allSettled" src/app/research-v2/page.tsx` — expect a hit.
5. **Concurrency cap exists**: `grep "WORKER_RUN_CONCURRENCY\|createSemaphore" research-worker/src/index.ts research-worker/src/utils/semaphore.ts` — expect hits in both.
6. **Worker test green**: `cd research-worker && npx vitest run src/__tests__/concurrency-cap.test.ts` — expect 2/2.
7. **Worker build clean**: `cd research-worker && npm run build` — expect 0 errors.
8. **Frontend tsc**: `npx tsc --noEmit 2>&1 | grep -c "error TS"` — expect ≤65 (baseline; any number above is a regression).
9. **No accidental regressions to prior waves**: `git diff 1bf5c91b..HEAD -- research-worker/src/runner-cascade.ts research-worker/src/emit-progress.ts src/lib/journey/research-job-activity-core.ts src/components/research-v2/thinking-block.tsx` — expect NO diff in these files (P1 shouldn't touch them).
10. **Visual QA of parallel sections**: I spin up dev servers briefly, eyeball `/research-v2`, confirm all 6 sections animate in parallel after a corpus run (if Anthropic credits are OK to spend; else manual code-read of the dispatch handler).

### Failure modes that block phase progression

- Any new TS errors → fix-session before P2
- Atom 3 missed `/ui-ux-pro-max` step → re-run that step before P2
- Worker concurrency cap missing or off by default → block; this is load-bearing for P3 (concurrent reruns)
- Token cap regressed existing test fixture quality → roll back atom 1, retry with higher cap (12k?)

### Definition of Done for P1

- 4 commits land cleanly on `feat/research-v2` (or a feature branch off it)
- All 10 QA checks above pass
- A test run of one section shows wall time <150s
- No regression in the streaming activity log experience

---

## P2: Chat foundation (atoms 5-8)

### What ships when P2 lands

- DB has `audit_chat_messages` table with RLS
- `/api/research-v2/chat` POST endpoint persists messages and runs the intent classifier
- Frontend has a unified ChatThread component mounted in the workspace
- Intent classifier behind `classifyIntent()` with 7/7 fixture tests passing
- Echo/stub responses for intent matches (real actions land in P3)

### Session-start prompt for the executor

```
I'm executing Phase 2 of the research-perf-and-chat-edit feature.

Prerequisite: Phase 1 must already be merged. Verify by:
  grep "WORKER_RUN_CONCURRENCY" research-worker/src/index.ts || echo "PHASE 1 NOT MERGED — STOP"

Read in order:
1. .claude/workspaces/aigos-feature-dev/stages/03-build/phases-research-perf-and-chat-edit.md
2. docs/superpowers/plans/2026-05-11-research-perf-and-chat-edit.md (atoms 5-8 only)
3. .claude/workspaces/aigos-feature-dev/CLAUDE.md (frontend protocol — atom 7 MUST follow it)
4. Memory at ~/.claude/projects/-Users-ammar-Dev-Projects-AI-GOS/memory/feedback_unified_chat_panels.md
   (chat must be UNIFIED, NEVER per-section)

Execute atoms 5, 6, 7, 8 sequentially via /superpowers:subagent-driven-development.

Notes:
- Atom 5 (DB migration): apply via supabase MCP tool if available, or via supabase CLI. After applying, regenerate TS types.
- Atom 6: route stub. Echo behavior. Do not implement intent branches yet — atom 8 adds the classifier; atoms 9-11 (Phase 3) add the action branches.
- Atom 7: chat sidebar component. MUST route /ui-ux-pro-max → frontend agent → /design-review. Use AI Elements components where they fit (Reasoning, Message, Conversation from elements.ai-sdk.dev).
- Atom 8: classifier with 7 fixture tests. All 7 must pass.

After all 4 atoms commit, run:
  npx tsc --noEmit
  npx vitest run src/lib/research-v2/
  cd research-worker && npm run build

Smoke-test the chat surface: dev server up, post a test message via curl OR via the UI, confirm it lands in audit_chat_messages.

Report:
- 4 commit SHAs + summary
- DB migration applied? Table exists?
- Classifier test result (7/7?)
- Chat thread renders correctly in browser?
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED

DO NOT implement atoms 9-11. Stop after atom 8.
```

### QA gate (from HQ)

1. **DB migration applied**: query Supabase via MCP — `mcp__supabase__list_tables` shows `audit_chat_messages` with the expected 7 columns.
2. **Chat route exists**: `ls src/app/api/research-v2/chat/route.ts` — file present.
3. **Intent router + types files exist**: `ls src/lib/research-v2/intent-router.ts src/lib/research-v2/intent-router.types.ts`.
4. **Classifier tests green**: `npx vitest run src/lib/research-v2/__tests__/intent-router.test.ts` — expect 7/7.
5. **Chat thread component exists**: `ls src/components/research-v2/chat-thread.tsx` — and is imported in `section-shell.tsx`: `grep "ChatThread" src/components/research-v2/section-shell.tsx`.
6. **No per-section chat**: `grep -r "per-section chat\|sectionChat" src/components/research-v2/` — expect NO hits. (Enforces the unified-chat feedback.)
7. **/ui-ux-pro-max ran for atom 7**: I check the commit message for atom 7 — it should reference the design call.
8. **Frontend tsc clean**: baseline only.
9. **Auth gate works**: curl test against `/api/research-v2/chat` with no auth — expect 401.
10. **Stub echo works end-to-end**: I send a test message via curl with a valid run_id; expect a row in `audit_chat_messages` + a streaming response. (May skip if auth is complicated to mock; defer to P3 verification.)

### Failure modes that block P3

- DB RLS policies block service-role writes from the route → fix immediately before P3
- Frontend chat thread doesn't render or has theme parity bugs → fix-session before P3
- Classifier tests <7/7 pass → mandatory fix before P3 (atoms 9-11 depend on it)
- Per-section chat sneaks in → revert + redo per locked memory

### Definition of Done for P2

- 4 commits land cleanly
- All 10 QA checks pass
- Stub chat round-trip works (user message in, echo response out, both rows in DB)
- ChatThread component visible at `/research-v2` after onboarding

---

## P3: Edit actions (atoms 9-11)

### What ships when P3 lands

- User types "redo the competitor analysis focused on Cartesia" → competitor section re-dispatches with that refinement
- User types "market size should be $30B" → keyFinding patches in place, no rerun
- User types "what's the strongest angle here?" → grounded streaming answer from Sonnet with full audit context
- `/api/research-v2/refine` deleted (superseded)

### Session-start prompt for the executor

```
I'm executing Phase 3 of the research-perf-and-chat-edit feature.

Prerequisite: Phases 1 + 2 must be merged. Verify by:
  test -f src/lib/research-v2/intent-router.ts || echo "PHASE 2 NOT MERGED — STOP"
  test -f src/lib/research-v2/intent-router.types.ts || echo "PHASE 2 NOT MERGED — STOP"
  grep -q "WORKER_RUN_CONCURRENCY" research-worker/src/index.ts || echo "PHASE 1 NOT MERGED — STOP"

Read in order:
1. .claude/workspaces/aigos-feature-dev/stages/03-build/phases-research-perf-and-chat-edit.md
2. docs/superpowers/plans/2026-05-11-research-perf-and-chat-edit.md (atoms 9-11 only)
3. The current state of src/app/api/research-v2/chat/route.ts — you'll be extending it

Execute atoms 9, 10, 11 sequentially. They can technically be parallel but they all extend the same chat route file — keep them sequential to avoid merge conflicts.

Order:
- Atom 9 (rerun): adds chatRefinement plumbing through worker + dispatch helper + chat route branch. Test in research-worker.
- Atom 10 (patch): adds patch-apply.ts + 9 tests + chat route branch.
- Atom 11 (converse): replaces stub echo with real Sonnet streamText. Deletes /api/research-v2/refine/route.ts.

After all 3 commit, run:
  npx vitest run src/lib/research-v2/
  cd research-worker && npx vitest run && npm run build
  npx tsc --noEmit

Smoke-test each action:
- Rerun: post a chat message that should trigger rerun; verify worker /run is invoked AND audit_chat_messages.intent='rerun' row exists
- Patch: post a chat message that should trigger patch; verify research_runs.data has the new value AND audit_chat_messages.intent='patch'
- Converse: post a question; verify streaming answer comes back AND audit_chat_messages.intent='converse'

Report:
- 3 commit SHAs + summary
- All 3 actions verified end-to-end?
- Any data-integrity surprises with the JSONB patch?
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED

DO NOT run atom 12 (E2E verification). That's Phase 4, manual session with Ammar.
```

### QA gate (from HQ)

1. **3 commits clean**: `git log --oneline | head -3` — expect rerun, patch, converse with clear messages.
2. **Rerun: worker accepts chatRefinement**: `grep "chatRefinement" research-worker/src/index.ts research-worker/src/runners/journey-section-synthesis.ts` — multiple hits.
3. **Rerun: chat route fires dispatch**: `grep "kind === 'rerun'" src/app/api/research-v2/chat/route.ts` — hit.
4. **Patch: patch-apply.ts exists + tests green**: `npx vitest run src/lib/research-v2/__tests__/patch-apply.test.ts` — expect 9/9.
5. **Patch: route branch exists**: `grep "applyPatch\|kind === 'patch'" src/app/api/research-v2/chat/route.ts` — hits.
6. **Patch: prototype pollution blocked**: I manually call `applyPatch({}, { path: '__proto__.x', value: 1 })` and expect throw.
7. **Converse: streamText with audit context**: `grep "conversationSystem\|auditSummary" src/app/api/research-v2/chat/route.ts` — hits.
8. **Refine deleted**: `! test -f src/app/api/research-v2/refine/route.ts` — file gone.
9. **No new tsc errors**: baseline only.
10. **Smoke test from HQ**: I send 3 test messages via curl (one per intent) on a real run_id; verify each lands the right action in DB + returns the right streaming shape.

### Failure modes that block P4

- Rerun fires repeatedly in a loop (e.g., user message stored as bot rerun trigger) → fix idempotency before P4
- Patch corrupts non-target sections → revert + add stricter path-validation
- Converse hallucinates section names that don't exist → tighten the conversation system prompt
- `/refine` deletion broke an import somewhere → fix before P4

### Definition of Done for P3

- 3 commits land cleanly
- All 10 QA checks pass
- 3 actions smoke-tested by HQ
- No regression in P1's section timing or P2's chat stub

---

## P4: E2E verify (atom 12)

### What ships when P4 lands

- Documented timing measurements proving the speed targets are met
- Documented chat-action verification proving all 3 actions work in browser
- A go/no-go decision: ship to internal users, or open follow-up fix sessions

### Session-start prompt for the executor

This phase is ideally driven by **Ammar manually** (with HQ guiding). If automation is preferred:

```
I'm executing Phase 4 — E2E verification — of the research-perf-and-chat-edit feature.

Prerequisite: Phases 1-3 must be merged. Verify by running the QA checks documented in
.claude/workspaces/aigos-feature-dev/stages/03-build/phases-research-perf-and-chat-edit.md
under P1, P2, P3 sections. ALL checks must pass.

Read atom 12 in docs/superpowers/plans/2026-05-11-research-perf-and-chat-edit.md.

Execute the 10 steps of atom 12 sequentially. Use tmux for dev server lifecycle.

This phase uses real Anthropic credits (~$3-5 estimated). If Ammar isn't available to
authorize the spend, STOP and wait.

Report:
- Timing measurements (corpus, each section, total audit)
- Chat rerun outcome
- Chat patch outcome
- Chat converse outcome
- Any UX bugs spotted
- Recommendation: ship | iterate | rollback
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED
```

### QA gate (from HQ)

P4 IS the QA gate. HQ verifies the report's findings match what Ammar saw on screen.

Acceptance criteria for the whole feature:
- ✅ Full audit (corpus + 6 parallel sections) completes in <4 min wall (target ~3 min)
- ✅ Each section completes in <150s
- ✅ All 3 chat actions land their intended effect
- ✅ Activity log streams uninterrupted (no regression of Wave 1's UX work)
- ✅ No new tsc errors anywhere
- ✅ Real Anthropic API spend was within ~$5 for the full E2E

If any ✅ fails: HQ opens a fix-session targeted at the failure, then re-runs P4.

### Post-P4 decisions HQ owns

1. **Open follow-ups based on real usage:**
   - Sub-agent parallelization within sections (v2 deferred from spec)
   - Artifact versioning (v2 deferred from spec)
   - Corpus depth optimization (only if sections still feel thin after token cap)
   - AI Elements visual upgrade to thinking-block.tsx / research-activity-log.tsx (deferred Atom 10 from streaming-activity-log)
2. **Decide on internal rollout**:
   - Open to one teammate?
   - Run on a real client website?
   - Tighten more before exposing?
3. **Update strategic plan** at `.claude/architecture/strategic-plan-2026-04-29.md` if anything substantive changed.

---

## HQ operating notes

### Cadence

- HQ does NOT run execution sessions. Only QA gates + scope calls.
- Each phase's executor session is **fresh context** — they read the plan/spec, execute, report. No prior conversation history.
- HQ stays in THIS session across all 4 phases. Context discipline matters; HQ uses `/clear` between phases ONLY if needed.

### Push-back authority

If an executor returns DONE_WITH_CONCERNS or BLOCKED, HQ can:
- Send a fix-session with a tighter scope ("the parallel dispatch wired up but the queued state isn't visible — fix only that")
- Decide to land partial work and defer the broken atom to a follow-up
- Roll back the phase entirely if the architecture is wrong

If an executor returns DONE but QA finds issues:
- Open a targeted fix-session immediately
- Do NOT progress to the next phase until QA passes

### Scope drift control

If a phase grows beyond its atoms (executor "improving" adjacent code, adding features), HQ flags the scope drift and either:
- Accepts the drift if it's load-bearing for the deliverable
- Rejects the drift and demands a clean revert of the off-scope changes

### Velocity tracking

After each phase, HQ updates this doc's phase map table with actual time spent (vs estimated). Helps calibrate future phase estimates.

---

## Open questions HQ owns

(Resolve before or during the relevant phase; don't let executors guess.)

1. **Branch strategy** — RESOLVED 2026-05-12 (post-P1): **stay on `feat/research-v2`**. Reasoning: P1 already landed 6 atomic, well-named commits directly on `feat/research-v2`. Each commit is `git revert`-safe individually. Cutting a separate branch post-hoc would mean rebasing 6 commits with no real safety win since the phase-by-phase QA gates are the real rollback boundary. If P3 or P4 hits architectural retreat, we branch off THEN.

## P1 outcomes (recorded 2026-05-12)

- **Status**: ✅ PASS — 10/10 QA checks
- **Commits**: 6 (`a225885e`, `d9d92925`, `4c8b13e7`, `695a6221`, `292ac476`, `a529afae`)
- **Code-touching files**: 11 (~150 lines of actual code; rest of insertions are docs)
- **Tests**: 379 worker tests passing (zero regressions); 2/2 new concurrency-cap tests pass
- **TSC**: 0 errors (better than baseline)
- **Quality wins beyond plan**:
  - `695a6221`: imported canonical `POSITIONING_SECTION_IDS` instead of plan's hardcoded array
  - `a529afae`: closed a semaphore slot-leak window in the IIFE prologue (executor caught it)
- **Concerns**: none. Cleanup commits kept as-is (rebase-squash declined — visible fix history > silent amend).

## Original open questions (continued)

2. **Realtime delivery of patches** — TBD during P3 QA.
2. **Realtime delivery of patches**: from spec section 9 open question — does a JSONB patch on `research_runs.data` trigger the existing realtime channel? If not, P3 atom 10 needs to also write a synthetic activity row. HQ to verify during P3 QA.
3. **Concurrent edits**: what if user fires two reruns on the same section before the first completes? Spec says deferred; HQ confirms the deferral or adds an atom to P3.
4. **Chat history truncation**: classifier currently gets last 6 messages. Is that enough? Watch in P4; if classifier loses context on long sessions, bump to 10 or summarize older.
5. **Branch off-ramp**: if any phase reveals the architecture is fundamentally wrong, HQ decides whether to keep prior phases or revert the whole branch.
