# AIGOS Claude Code — Operating Manual

One document. Read it once. Go back to work.

## The contract in one paragraph

You are the architect. Claude is a senior engineer with three non-negotiable habits: it classifies every ask before acting, it runs its own verification gate before claiming done, and it records its mistakes as durable patterns so the same mistake is cheaper the next time. You describe outcomes + constraints + quality bar and reject work that doesn't match. Claude does the rest — reading, research, implementation, tests, deploy prep. When this contract breaks, it breaks in predictable ways and the system has a ritual for each one. The rituals are in this file.

## The session lifecycle (what always happens)

```
you type an ask
   │
   ▼
[SessionStart hook]  session-restore + memory-import + env-snapshot
   │
   ▼
[UserPromptSubmit]   classification nudge + skill router
   │
   ▼
Claude classifies:  quick-question | 10-min-fix | half-day | day | week+ | production-bug | beast-mode
   │                      │
   ▼                      ▼
answer directly        load context (hot → index → relevant rules → relevant files)
                       │
                       ▼
                       research if gap detected (web, wiki, docs)
                       │
                       ▼
                       implement surgically (additive > mutation; every line traces)
                       │
                       ▼
                       [PostToolUse hook]  tsc --noEmit on every edit
                       │
                       ▼
                       verify (build + test + manual check)
                       │
                       ▼
                       report diff + link files (computer:// URLs)
                       │
                       ▼
[Stop hook]           memory sync (session summary → durable file)
```

You inspect the diff and the report. If it matches the ask, approve. If it doesn't, the rejection is itself a learned pattern — append to `rules/learned-patterns.md` with a pointer to this session.

## Classification (the seven classes)

Claude must state its classification in one line before acting. This is the cheapest correctness check you have.

| Class | When | Skips | Verification |
|---|---|---|---|
| `quick-question` | pure Q&A | all stages | none |
| `10-min-fix` | one file, obvious change | discover + plan | build + test |
| `half-day` | 1 feature, 2-6 files | discover + plan | full gate |
| `day` | multi-file feature | nothing | full gate + audit |
| `week+` | epic, crosses subsystems | nothing, routes through `workspaces/aigos-feature-dev/` | full gate + stage-by-stage audit |
| `production-bug` | user reports breakage | nothing — `rules/bug-triage.md` Step Zero FIRST | full gate + post-mortem |
| `beast-mode` | **only** when ask contains `beast mode`, `boil the ocean`, or `/beast` | opts IN to Garry Tan's maximalist prompt | full gate, raised bar |

If the ask is ambiguous, Claude states one assumption and proceeds, or asks ONE clarifying question. Never more.

## What Claude always does (non-negotiable)

These fire on every `10-min-fix` and up. They are what separates a senior engineer from an autocomplete.

1. **Rewrite vague asks into verifiable goals.** "Fix the bug" → "Write a failing test that reproduces the symptom, then make it pass." See `rules/verification.md`.
2. **State a subagent budget before dispatch.** Every `Explore`/`Task`/`Agent` call names a time cap + tool-call cap. See `rules/exploration-budget.md`.
3. **Run the verification gate before declaring done.** `npm run build` + `npm run test:run` + manual check (curl / screenshot / test output). No "should work." No "looks good."
4. **Prefer additive changes over mutations.** New file > new preamble > mutated control flow. Lesson from Meta-Harness (Lee et al. 2026). See `wiki/wiki/concepts/additive-over-mutation.md`.
5. **Record durable lessons.** Every non-obvious fix → one line in `rules/learned-patterns.md` with a session-trace pointer. Every 4 weeks → prune.
6. **Step Zero for bugs.** Infra (env vars, Supabase quota, Railway worker health, upstream status) before source. See `rules/bug-triage.md`.

## Five fast iterations (the feedback discipline)

For any task larger than `10-min-fix`, Claude does NOT write one big implementation and hand it to you. It runs five fast iterations against the verification gate:

```
iter 1  smallest unit that could work  →  build + test  →  report failure modes
iter 2  address top failure from iter 1  →  build + test
iter 3  address remaining failure        →  build + test
iter 4  edge cases + error paths         →  build + test
iter 5  polish + verification gate pass  →  ship-ready
```

If iter 5 still fails, Claude stops and reports. It does not keep iterating silently. The five-iteration budget is the signal that the approach is wrong.

Why five: Meta-Harness Appendix D recommends "3-5 iterations each" for skill-refinement runs; five matches that empirically-grounded cap. More usually means the problem was misclassified — kick back to classification.

## Research policy

Claude has four research surfaces. They're ordered cheapest to most-expensive; Claude must climb the ladder, not skip:

1. **`wiki/hot.md`** — last session's crumbs.
2. **`wiki/index.md` → linked synthesis pages** — our second brain.
3. **Web search (`WebSearch` / `WebFetch`)** — best practices, doc lookups, recent API changes. OK to use when a gap is diagnosed, never on auto.
4. **Paid APIs (Firecrawl, Perplexity)** — only with explicit user approval. Never in a loop without an abort condition (`CLAUDE.md` rule).

The rule Claude violates most is skipping straight to (3) or (4) without checking (1) and (2). The wiki exists so it doesn't have to.

## When you (the architect) step in

You intervene in four situations, and only these:

1. **Classification challenge.** Claude classified wrong. Override: "treat this as `production-bug`, Step Zero first."
2. **Goal rewrite mismatch.** Claude's rewritten verifiable goal doesn't reflect what you meant. Correct it before code.
3. **Verification rejection.** The diff doesn't match the rewritten goal. Reject + say which line doesn't trace.
4. **Pattern learning.** Claude made a mistake that should have been prevented. Decide: missing rule (append to `learned-patterns.md`) or ignored rule (tighten the owning rule instead).

Everything else — library selection, file organization, test authoring, refactor style, commit prep — is Claude's job.

## Failure modes this system catches (and how)

| Failure mode | Catching mechanism |
|---|---|
| Treating a prod bug as a code bug when it's an env var | `rules/bug-triage.md` Step Zero |
| Subagent exploration spirals (161k-token audits) | `rules/exploration-budget.md` — budget + cap in every dispatch |
| Delivering untested code | `rules/verification.md` — gate forbidden to skip |
| Over-engineering a 10-min fix | beast-mode is opt-in only; surgical-change clause in `CLAUDE.md` |
| Duplicating knowledge in rule files | `rules/learned-patterns.md` — "tighten the original, don't duplicate" |
| Losing context between sessions | `wiki/` + session memory + SessionStart hook |
| Running paid API in a loop | explicit rule in `CLAUDE.md`; deny-list in `settings.json` |
| AI SDK v6 gotchas (`inputSchema`, transport matching, convertToModelMessages) | `rules/ai-sdk-patterns.md` |
| Env var drift surfacing mid-implementation | **new:** `scripts/env-snapshot.sh` runs at SessionStart; see below |

## Env-snapshot preamble (the new piece)

Meta-Harness TB2 iter 7 won by prepending an environment snapshot to the agent's initial prompt — pwd, installed languages, package managers, memory. +1.3 absolute points on TerminalBench-2, eliminating 2-4 exploratory turns per task.

Applied here: `.claude/scripts/env-snapshot.sh` runs at SessionStart and emits (in <3 seconds):

- Git branch, ahead/behind main, dirty-state count.
- Env-var presence (NAMES only, never values — `rules/security.md`).
- Supabase URL reachable? (one `curl -s --max-time 2`).
- Railway worker health? (if `RAILWAY_WORKER_URL` set).
- Last `npm run build` result + timestamp (from `.next/build-marker`).
- Last test run summary (from `.vitest-last-run` or equivalent).
- Recent rule/CLAUDE.md edits (git log --oneline .claude/ -3).

This is a **preamble**, not a gate. It prints; it does not block. Claude reads it and adjusts. If `ANTHROPIC_API_KEY` is missing, Claude sees that before burning 20 tool calls wondering why dispatches fail silently.

Wired in `settings.json` under `SessionStart`. Additive — old hooks unchanged.

## The map (where things live)

```
/ (repo root)
├── CLAUDE.md                    # 65-line project prompt — classification, contract, map, top-5 gotchas
├── README.md                    # your repo-facing README (not this one)
│
└── .claude/
    ├── README.md                # THIS FILE — operating manual
    ├── ARCHITECTURE.md          # stack, commands, env vars, journey flow, gotchas (100 lines)
    │
    ├── rules/                   # 11 files — the harness
    │   ├── verification.md         build + test + manual before done; vague-ask rewriting
    │   ├── bug-triage.md           Step Zero infra checklist for production bugs
    │   ├── model-selection.md      Haiku / Sonnet / Opus cost-aware routing
    │   ├── exploration-budget.md   time + tool-call cap on every subagent
    │   ├── context-management.md   /clear / /compact / subagent-research
    │   ├── ai-sdk-patterns.md      Vercel AI SDK v6 — transports, tools, message conversion
    │   ├── hooks-and-automation.md active hooks, bypass-permissions safe list
    │   ├── security.md             secrets, dependency safety, agent isolation
    │   ├── mcp-policy.md           project MCPs vs Cowork MCPs; weekly audit
    │   ├── learned-patterns.md     self-improvement log — append + prune
    │   └── beast-mode.md           opt-in maximalist prompt (literal trigger only)
    │
    ├── commands/                # slash commands
    │   ├── feature.md              /feature — wraps day+ work through 5-stage pipeline
    │   ├── ingest.md               /ingest — wiki triage + synthesis
    │   ├── wiki-lint.md            /wiki-lint — health check, orphan/stale detection
    │   └── ...                     (claude-flow, sparc, grade-scripts, github/, analysis/, etc.)
    │
    ├── workspaces/aigos-feature-dev/  # 5-stage feature pipeline
    │   ├── CLAUDE.md               how to use the workspace
    │   ├── CONTEXT.md              active feature + stage tracker
    │   └── stages/
    │       ├── 01-discover/        scope, 6 questions, no source reading
    │       ├── 02-plan/            atoms, budgets, explicit assumptions
    │       ├── 03-build/           implementation, five-fast-iterations
    │       ├── 04-verify/          gate: build + test + manual
    │       └── 05-ship/            PR, deploy, post-mortem hooks
    │
    ├── wiki/                    # second brain — raw + synthesis + index
    │   ├── CLAUDE.md               wiki operating contract (111 lines)
    │   ├── index.md                master table of contents (canonical)
    │   ├── log.md                  append-only ingest history
    │   ├── hot.md                  last ~500 chars of notable context (session-scoped)
    │   ├── taxonomy.md             4-domain × 8-intent triage gate
    │   ├── retrieval-rules.md      hot → index → pages → sources → raw
    │   ├── review-queue.md         pressure valve for ambiguous items
    │   ├── raw/                    immutable source material
    │   └── wiki/                   interpreted layer — sources/, concepts/, entities/, tools/, techniques/, analysis/
    │
    ├── scripts/                 # [NEW] operational shell scripts
    │   └── env-snapshot.sh         prepended at SessionStart — the diagnostic preamble
    │
    ├── helpers/                 # 40+ node/shell helpers (memory, hooks, routing, statusline)
    ├── settings.json            # hook wiring + permissions
    ├── settings.local.json      # local MCP enables
    ├── mcp.json                 # project MCPs (lean — 1 server)
    └── skills/ agents/ archive/ # adjunct material
```

## Five things to remember

1. **Classify first, act second.** The cheapest correctness check.
2. **Every line traces.** Changed lines point at sentences in the ask. No drive-by refactors.
3. **Additive over mutation.** Add a preamble; don't rewrite the flow.
4. **Five iterations is the cap.** If iter 5 fails, the problem was misclassified.
5. **The wiki is canonical, the wiki isn't.** The *index* is canonical; the wiki is a projection you can rebuild.

## If this manual contradicts a rule file

The rule file wins. This README is the map; `rules/*.md` is the territory. If you see drift, tighten the rule file and update the matching section here — in that order.

## What to do when this system fails you

1. Tell Claude exactly which of the six non-negotiables it skipped.
2. If it's a missing rule: one line in `rules/learned-patterns.md` with a session-trace pointer.
3. If it's an ignored rule: tighten the rule, don't duplicate it.
4. If the failure is systemic (5+ sessions, same pattern), surface it — it's probably a harness gap worth a new rule file.

That's the loop. Keep the loop tight and the senior-engineer level rises over time without you doing the work. Per Meta-Harness: "iterating on the skill text had a larger effect on search quality than changing iteration count or population size." This file IS the skill text.
