# CLAUDE.md

## Skill-first architecture (v3 — proposed 2026-04-24)

AIGOS is pivoting to a **skill-first architecture**. Each pipeline stage is becoming a self-contained skill folder at `skills/<name>/` carrying its own SKILL.md, schemas, prompts, scripts, assets, and example. See `.claude/architecture/v3-skill-first.md` for the full design doc and decisions.

Current state:
- **1 reference skill implemented**: `skills/research-competitor/` (works end-to-end — the pattern everything else generalizes from)
- **15 skills scaffolded, stubs only**: `ingest-url`, `ingest-fathom`, `ingest-docs`, `ingest-identity`, `research-market`, `research-icp`, `research-offer`, `research-keywords`, `research-voc`, `research-cross`, `synthesize-positioning`, `synthesize-media-plan`, `synthesize-scripts`, `chat-refine`, `present-workspace`
- Each has `.claude/skills/<name>/` bridge + `.claude/commands/<name>.md` slash command

Locked decisions:
- **Each skill is a self-contained island** — no shared `lib/` extractions yet. Duplication is fine for now.
- **No cross-skill layer semantics** (no "Layer 1/2/3"). Every skill is a peer.
- **All skills are user-invoked** via slash command. No auto-dispatch on URL paste, no magic triggers.
- **Skills will live in their own publishable GitHub repo**. No skill may import from outside its own folder — portability first.
- **Canonical per-skill layout**: `SKILL.md + README.md + package.json + tsconfig.json + references/ + scripts/ + assets/ + example/` (Anthropic-conformant).

Guardrails that still apply: everything under `.claude/rules/` — verification gate, exploration budget, bug-triage Step Zero, model-selection, security. The `refactor/agent-loop-v1` branch's Phase 1 agent-loop skeleton (commit `4a159e86`) has been deleted — it never loaded `skills/<name>/SKILL.md` and had no callers. The v3 skill dispatcher does not exist yet; routing source of truth is `src/lib/skills/route-table.ts` (doc mirror at `.claude/workspaces/v3-migration/workspace-map.md`, regenerate via `npx tsx scripts/generate-workspace-map.ts`).

Until all 15 stub skills are implemented, the legacy runners in `research-worker/src/runners/` are still the production path. Do not delete them.

## Session Startup Protocol (MANDATORY)

Before responding to any user message, classify the ask and state the classification in one line. Only then act.

- `quick-question`: pure Q&A, no tools. Answer directly.
- `10-min-fix`: one file, obvious change. Skip discover, jump to implement + verify (run `.claude/rules/verification.md` gate).
- `half-day`: single feature, 2-6 files. Skip stages 01-02 of the workspace pipeline. Run verification gate at end.
- `day` / `week+`: route through `.claude/workspaces/aigos-feature-dev/stages/01-discover/CONTEXT.md`. Never skip discover on these.
- `production-bug`: run `.claude/rules/bug-triage.md` Step Zero FIRST. Do not load source until infra clears.
- `skill-invocation`: if you type `/design`, `/review`, `/ship` on a task larger than 10-min, wrap the skill inside a `/feature` call first (`.claude/commands/feature.md`).
- `beast-mode`: ONLY when the user's message contains the literal phrase `beast mode`, `boil the ocean`, or `/beast`. Opts into Garry Tan's maximalist-completion prompt. See `.claude/rules/beast-mode.md`. Refuse to self-activate — if the trigger isn't present, do not apply it even if the task "feels big." On small edits this over-engineers.

Rules that apply to every classification:
- Never dispatch an `Explore`, `Task`, or `Agent` subagent without stating a time budget and tool-call cap up front. See `.claude/rules/exploration-budget.md`.
- Never run a paid API (Firecrawl, Perplexity) in a loop without an abort condition.
- `/clear` between unrelated features. Compact at 70% context with a feature focus.

If ambiguous, state one assumption and proceed, or ask ONE clarifying question. Never more.

## Behavioral Contract

### Banned openers
Never start with: "Great question", "You're absolutely right", "Excellent idea", "I'd be happy to", "Certainly!", "Of course!", "Sure thing". Start with the answer or the action. If the premise is wrong, say so before doing the work.

### Surgical changes — every line traces
Every changed line must trace directly to the stated request. No drive-by refactors, no reformatting, no "while I was in there" cleanups. Exception: clean up orphans your own change created. Self-check: can I point at every changed line and name the request sentence it serves?

### Simplicity first — bias toward deletion
Minimum code that solves the stated problem. No speculative error handling, no "for future extensibility". When in doubt, delete. Self-check: would a senior engineer call this overcomplicated?

### Direct, not diplomatic
"This won't scale because X" beats "That's an interesting approach, but…". Two or three short paragraphs is usually enough. Prose is usually clearer than structure for short answers.

### Never fabricate
Not file paths, commit hashes, function signatures, library APIs, or test results. If you don't know, read the file, run the command, or say "I don't know, let me check."

## Knowledge map — where to look

- **Architecture, stack, commands, env vars, pipeline, key files** → `.claude/ARCHITECTURE.md`
- **Wiki (second brain, ingested sources, concepts)** → `.claude/wiki/` (read `.claude/wiki/CLAUDE.md` before querying)
- **Rules** (verification, bug-triage, model-selection, exploration-budget, context-mgmt, AI SDK, hooks, security, MCP policy, learned patterns) → `.claude/rules/`
- **Feature workspace** (5-stage pipeline for half-day+ work) → `.claude/workspaces/aigos-feature-dev/`
- **Design System** → `DESIGN.md` (read before any visual/UI work)

## Top-5 Gotchas (full list in ARCHITECTURE.md)

- **id vs run_id**: Frontend passes `run_id`. Query `.eq('run_id', id)`, use `session.id` for FKs.
- **Railway worker boundary**: Cannot import from `src/lib/`. Schemas/types live in both places.
- **Field sync across 6 places**: new onboarding fields — see ARCHITECTURE.md.
- **AI SDK v6 renames**: `inputSchema` not `parameters`, `maxOutputTokens` not `maxTokens`. Details in `.claude/rules/ai-sdk-patterns.md`.
- **Pre-existing TS errors** in openrouter + chat blueprint tests — ignore them.

## Skill routing

Match intent → invoke via the Skill tool FIRST:
- Product ideas, brainstorming → `office-hours`
- Bugs, errors, 500s → `investigate`
- Ship, deploy, PR → `ship`
- QA, test the site → `qa`
- Code review → `review`
- Design system → `design-consultation`
- Visual audit → `design-review`
- Architecture review → `plan-eng-review`

## Think Before Coding

Adapted from Karpathy's LLM coding guidelines (forrestchang/andrej-karpathy-skills). Karpathy's simplicity-first and surgical-changes principles are already in the Behavioral Contract above; this section adds what those don't cover.

Before writing code:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

For multi-step tasks, state a brief plan with per-step verification before acting:

```
1. [step] → verify: [check]
2. [step] → verify: [check]
3. [step] → verify: [check]
```

Strong per-step success criteria let the session loop independently. Weak criteria ("make it work") force constant clarification round-trips.

## GBrain Configuration (configured by /setup-gbrain)
- Engine: pglite
- Config file: ~/.gbrain/config.json (mode 0600)
- Setup date: 2026-04-24
- MCP registered: yes
- Memory sync: off
- Current repo policy: read-write
- Project Obsidian vault: /Users/ammar/Obsidian/AI-GOS
