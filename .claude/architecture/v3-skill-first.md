# v3: Skill-First AIGOS

> **Status**: proposed 2026-04-24, decisions locked same day. Additive — does not override `.claude/ARCHITECTURE.md` or root `CLAUDE.md` until explicitly promoted.
>
> **Branch context**: `refactor/agent-loop-v1`. Phase 1 skeleton (`4a159e86`) and 3-layer separation (`902ae71b`) exist but this doc does not assume their layering — per decisions below, skills are peers, not layered.
>
> **Reference skill**: `skills/research-competitor/` is the single known-good implementation. Everything below generalizes that pattern.

## Decisions (2026-04-24)

These questions from §10 are resolved. The rest of this doc still reads as if open — rely on this block where they conflict.

1. **Worker fate** — deferred. Railway deploys Railway; not in scope for the folder-structure pass.
2. **Chat granularity** — one `chat-refine` skill with its tools bundled as `references/tools/*`.
3. **Ingestion triggers** — **all skills are user-invoked via slash command**. No auto-run on URL paste. No magic.
4. **ICM layering** — **no Layer 1/2/3 semantics imposed**. Each of the 16 skills is a peer: research sections, media plan, scripts, ingestion — all standalone folders with their own infra. If cross-skill composition is needed later, we build that seam then, not now.
5. **Shared-contracts / shared-libs** — **none**. Each skill is fully self-contained. Schemas, name-matchers, caches, report primitives get duplicated into each skill that needs them. Extraction is a later, deliberate move, not a premature optimization. Section 5 of this doc is SUPERSEDED.
6. **VoC skill** — separate `research-voc`. Not folded into competitor's sov-subagent.
7. **GitHub repo for skills** — skills will live in their own publishable repo. The AIGOS repo consumes them via `skills/` at root. This means: **no skill may import from anywhere outside its own folder** (no `../../lib/*`, no `src/lib/*`). Portability first.

The folder scaffold produced in this session implements these decisions. See `§13. Scaffold produced` below.

---

## 1. The pivot in one line

**Each pipeline stage becomes a self-contained skill** that travels with its schemas, prompts, scripts, and report template. Next.js becomes the UI shell; Railway becomes a skill executor; the **skill folders are the product IP**.

Today: logic is scattered across `src/lib/ai/`, `src/lib/media-plan/`, `src/lib/journey/`, `src/lib/onboarding/`, `research-worker/src/runners/`, `research-worker/src/contracts.ts` (48 KB), and duplicated schemas in both trees.

v3: one folder per capability, one seam between them, one source of truth for every schema.

---

## 2. Two levels of ICM

The user-facing workspace already runs **ICM (Interpreted Context Methodology)** — Jake Van Clief's 5-stage feature-dev pipeline (`.claude/workspaces/aigos-feature-dev/CLAUDE.md`). v3 keeps this at two levels:

### Level 1 — Feature development (unchanged)
`01-discover → 02-plan → 03-build → 04-verify → 05-ship`. This governs *how we add or change a skill*.

### Level 2 — Runtime (new, per skill invocation)
Every skill invocation runs the same 5 sub-stages:

```
receive   → parse input against references/input-schema.ts
collect   → agent + subagents use allowed-tools to gather facts
validate  → scripts/validate.ts (Zod) + scripts/sanity-check.ts
render    → scripts/generate-report.ts writes HTML + JSON
present   → bridge surfaces result to workspace card / chat
```

Every skill must implement all five. The research-competitor skill already does; the rest inherit.

---

## 3. Skill inventory

Organized by responsibility. Bolded skills exist today; the rest are to-be-built.

### 3.1 Ingestion (turn user inputs into structured context)

| Skill | Subsumes today | One-line purpose |
|-------|---------------|------------------|
| `ingest-url` | `src/lib/onboarding/*`, URL-prefill flow | URL → company metadata → pre-filled field catalog |
| `ingest-fathom` | `src/lib/fathom/*`, `research-worker/src/runners/meeting-extract.ts` | Fathom call → structured sales-call intelligence block |
| `ingest-docs` | `src/lib/company-intel/*`, PDF parsers | User-uploaded PDFs → parsed business-profile documents |
| `ingest-identity` | `research-worker/src/runners/identity.ts` (identityResolution) | Resolve who the company actually is (canonical card) |

### 3.2 Research (each fans out subagents, like research-competitor)

| Skill | Subsumes today | One-line purpose |
|-------|---------------|------------------|
| `research-market` | `runners/industry.ts` | Category, TAM, maturity, timing |
| `research-icp` | `runners/icp.ts` | Buyer persona, awareness map, job titles |
| **`research-competitor`** ✅ | `runners/competitors.ts` | Landscape, positioning, ads, SoV (reference impl) |
| `research-offer` | `runners/offer.ts` | Offer diagnostic, activation, churn |
| `research-keywords` | `runners/keywords.ts` | Keyword intent, content gaps |
| `research-voc` | *(new)* | Voice of customer — Reddit/HN/reviews only |
| `research-cross` | `runners/synthesize.ts` (crossAnalysis) | Synthesis across the above 6 |

### 3.3 Synthesis (narrative + strategic framing)

| Skill | Subsumes today | One-line purpose |
|-------|---------------|------------------|
| `synthesize-positioning` | `src/lib/ai/prompts/*` positioning bits | Research → positioning statement + villain/hero arc |
| `synthesize-media-plan` | `src/lib/media-plan/*` (generator, phase-schemas, wave-executor, ad-copy-*) | Research + positioning → 2-campaign media plan |
| `synthesize-scripts` | `research-worker/src/scripts/*` (pipeline + stages 01-05) | ICM-structured 60/30/10 ad scripts |

### 3.4 Interaction (runtime, user-facing)

| Skill | Subsumes today | One-line purpose |
|-------|---------------|------------------|
| `chat-refine` | `src/lib/ai/chat-tools/*` (14 tools), `src/components/chat/*` (unified-chat, agent-chat, media-plan-agent-chat) | Post-research card editing chat sidebar |
| `present-workspace` | `src/components/journey/*`, workspace card renderers | Card/report presentation layer |

**Total: 16 skills.** One reference impl. Fifteen to build, in phases.

---

## 4. Canonical per-skill layout

**Anthropic convention** (from `skill-creator` SKILL.md and official best-practices): `scripts/ + references/ + assets/`. Your current skill uses `schemas/ + prompts/ + example/`. We reconcile by folding into the Anthropic trio while preserving the current semantic grouping.

### 4.1 Full implementation (at repo root)

```
skills/<skill-name>/
├── SKILL.md                    # Anthropic-canonical; YAML frontmatter + body (<500 lines)
├── README.md                   # human doc
├── package.json                # TypeScript deps (zod, tsx, optional playwright)
├── tsconfig.json
│
├── references/                 # Anthropic-canonical — loaded on demand
│   ├── input-schema.ts         # was schemas/input.ts
│   ├── output-schema.ts        # was schemas/output.ts
│   ├── collector.md            # was prompts/collector.md
│   ├── subagent-<role>.md      # was prompts/<role>-subagent.md
│   └── rules.md                # (optional) hard constraints referenced from SKILL.md
│
├── scripts/                    # Anthropic-canonical — deterministic TypeScript
│   ├── orchestrate.ts          # fan-in coordinator (spawnSync tail)
│   ├── merge-fragments.ts
│   ├── validate.ts             # Zod validation
│   ├── sanity-check.ts         # integrity gates (FAIL/WARN)
│   ├── generate-report.ts      # JSON → HTML renderer
│   ├── screenshot.ts           # Playwright optional
│   └── (skill-specific extras) # e.g. fetch-ads.ts for competitor
│
├── assets/                     # Anthropic-canonical — templates used in output
│   ├── report-shell.html       # HTML masthead/footer template
│   └── styles.css              # shared report CSS
│
└── example/                    # onboarding aid (kept — practical value)
    ├── input.json
    └── output.json
```

### 4.2 Claude-Code bridge (at `.claude/`)

```
.claude/
├── skills/<skill-name>/
│   ├── SKILL.md                # thin bridge — <80 lines; cites the full SKILL.md
│   ├── skill.json              # {name, description, version, entry_point}
│   └── index.ts                # re-exports from ../../../skills/<skill-name>/
│
└── commands/<skill-name>.md    # slash command entry — invokes the skill with $ARGUMENTS
```

### 4.3 SKILL.md frontmatter template

```yaml
---
name: research-competitor                  # gerund or noun-phrase, ≤64 chars, [a-z0-9-]
description: >                             # ≤1024 chars, 3rd person, front-load triggers
  Deep competitor landscape research — fan-out subagents to discover, browse,
  and normalize 6–10 competitors. Collects positioning, pricing, ads, reviews,
  and share-of-voice with source_url + retrieved_at on every field.
context: fork                              # runs in isolated subagent context
agent: Explore                             # or general-purpose / custom agent
allowed-tools:                             # grants (does NOT restrict; deny in /permissions)
  - WebSearch
  - WebFetch
  - Bash(npx tsx *)
  - Bash(node *)
version: 2.0.0
---
```

**Load-bearing constraints** (from Anthropic best-practices; deviate and discovery breaks):
- `description` is truncated to **1,536 chars combined with any `when_to_use`** in the listing — front-load the trigger phrase.
- SKILL.md body target **<500 lines**. Bigger → split into `references/*.md`.
- Don't nest references deeper than 1 hop. Nested reads get `head -100`-previewed, not fully loaded.
- Forbidden `name` values: reserved words `anthropic`, `claude`. Windows backslashes break on Unix.

---

## 5. Shared libraries (not skills — reused across skills)

These extract the "would-be-duplicated" code so each skill stays self-contained but doesn't re-invent infrastructure.

```
lib/                                    # NEW — top-level shared code
├── agent-tools/                        # fan-out helpers, budgeted Task dispatch
│   ├── fan-out.ts                      # dispatches N+1 parallel subagents
│   ├── web-search-adapter.ts           # budgeted wrapper around WebSearch
│   ├── browser-adapter.ts              # browser_navigate + browser_snapshot wrappers
│   └── source-tag.ts                   # enforces source_url + retrieved_at on every field
│
├── contracts/                          # SINGLE source of truth — replaces both duplicates
│   ├── input/                          # per-skill input schemas (composed from field-catalog)
│   ├── output/                         # per-skill output schemas
│   ├── shared/                         # Source, Citation, Retrieved, BaselineMetrics types
│   └── events.ts                       # job-event enums (migrated from contracts.ts)
│
├── name-matcher/                       # extracted from skills/research-competitor/scripts/
│   ├── jaro-winkler.ts
│   └── normalize.ts
│
├── cache/                              # extracted — reusable 24h disk cache
│   └── searchapi-cache.ts
│
└── report-components/                  # shared HTML building blocks
    ├── masthead.ts                     # editorial header
    ├── pills.ts                        # source pill, platform pill
    ├── stacked-bar.ts                  # chart primitive
    └── tables.ts                       # matrix, pricing grid, reviews table
```

**Rule**: anything imported by 2+ skills graduates to `lib/`. Anything specific to one skill stays inside that skill's `scripts/`.

**Open question for sign-off** — do we colocate these shared libs at repo root `lib/` or inside `skills/_shared/`? (Recommendation: repo-root `lib/` so skills remain portable.)

---

## 6. Tool + permission model (per skill)

Each skill's SKILL.md `allowed-tools` field names exactly the tools that skill may invoke without permission prompts. Denies stay in project `.claude/settings.local.json` per `.claude/rules/mcp-policy.md`.

Tier-by-skill (proposed):

| Tier | Tools | Used by |
|------|-------|---------|
| Read-only web | `WebSearch`, `WebFetch` | all research-*, all ingest-* |
| Browser | `mcp__plugin_chrome-devtools-mcp_chrome-devtools__*` | research-competitor, research-voc |
| Deterministic shell | `Bash(npx tsx *)`, `Bash(node *)` | every skill's validate/render tail |
| File writes (scoped) | `Write(skills/<name>/output/**)`, `Write(/tmp/**)` | every skill |
| Paid APIs | `Bash(curl *)` (or SearchAPI wrapper) | research-competitor ads, research-keywords |
| Authenticated | `mcp__supabase__*` | only `present-workspace` (writes cards to realtime table) |

**Per `.claude/rules/security.md`**: no skill may touch `.env*`; no skill may `git push` or deploy.

---

## 7. What becomes obsolete (archived, not deleted)

Phased archive. Nothing leaves `main` until the v3 version is proven on at least two real runs.

| Path | Replaced by | Phase |
|------|-------------|-------|
| `research-worker/src/runners/*` | Per-skill `scripts/orchestrate.ts` | B |
| `research-worker/src/contracts.ts` | `lib/contracts/**` | A |
| `research-worker/src/scripts/` (the ICM pipeline) | `skills/synthesize-scripts/` | B |
| `src/lib/ai/chat-tools/*` | `skills/chat-refine/references/tools/*` | C |
| `src/lib/media-plan/*` | `skills/synthesize-media-plan/` | B |
| `src/lib/onboarding/*` | `skills/ingest-url/` + `lib/contracts/` | B |
| `src/lib/fathom/*` | `skills/ingest-fathom/` | B |
| `src/lib/journey/*` | split: context → `skills/ingest-identity/`, UI → `src/components/journey/` | B |
| `src/lib/company-intel/*` | `skills/ingest-docs/` | B |
| Legacy `/onboarding/edit` wizard (per memory obs 3786) | Delete after `ingest-url` proven | C |

**Stays untouched**: `src/app/api/auth/*`, Clerk wiring, Supabase schema, realtime broadcast channels, `DESIGN.md`.

---

## 8. The dispatcher — what exists, what doesn't

The Phase 1 `agent-loop.ts` skeleton (commit `4a159e86`) was **deleted** on 2026-04-27. It never loaded `skills/<name>/SKILL.md`; it was an orphan with zero callers in `src/`. Earlier drafts of this doc claimed it was the v3 dispatcher — that was wrong.

**There is no v3 skill dispatcher today.** Production dispatch still flows through `src/app/api/journey/dispatch/route.ts` → Railway worker → `research-worker/src/index.ts` `TOOL_RUNNERS`.

**Routing source of truth** for the v3 wiring is `src/lib/skills/route-table.ts`. Every skill row names its production `workerTool` and (when applicable) `dispatchSection`. The doc mirror at `.claude/workspaces/v3-migration/workspace-map.md` is generated from that file via `npx tsx scripts/generate-workspace-map.ts`.

When the first skill is bridged to production, the dispatcher will live in a new module (e.g. `src/lib/skills/dispatcher.ts`) bound to the route table. Sketch of the future shape — not yet implemented:

```
dispatcher receives: { skill: "research-competitor", input: <parsed> }
  │
  ├─ row = ROUTES_BY_SKILL[skill]              ← typed lookup
  ├─ guard: row.status === 'Wired'             ← else fall back to legacy runner
  ├─ loads skills/<name>/SKILL.md              ← as system prompt
  ├─ loads skills/<name>/references/*.ts       ← as tool schemas + subagent prompts
  ├─ spawns fan-out subagents
  ├─ runs skills/<name>/scripts/orchestrate.ts ← per-skill executable
  └─ returns: { output_json, report_html, telemetry }
```

The 3-layer separation (`902ae71b`) is preserved at the data level — `research-*` skills produce Layer-1 ResearchBundles, `synthesize-positioning` produces SynthesisOutput, `synthesize-media-plan` produces MediaPlan — but layer enforcement is **not** the dispatcher's job. That belongs to the workspace card approval state and the per-skill input contract.

---

## 9. Migration phases

### Phase A — Lock architecture + extract shared libs (≈3 days)
- [ ] Create empty `skills/<name>/` folders for all 15 new skills (SKILL.md stubs only)
- [ ] Create `lib/contracts/` and port `research-worker/src/contracts.ts` into it, deduplicating against `src/lib/**`
- [ ] Extract `name-matcher`, `cache`, `agent-tools/fan-out` into `lib/`
- [ ] Update `skills/research-competitor/scripts/*` to import from `lib/*`
- [ ] Rename `skills/research-competitor/{schemas,prompts,example}` → `{references,references,example}` — keep `example/` as pragmatic exception to canonical layout
- [ ] **Verification gate** (`.claude/rules/verification.md`): `research-competitor` still produces identical output on the Airtable fixture

### Phase B — Extract each pipeline runner into its skill (≈2 weeks, 2–3 skills/day)
For each runner in `research-worker/src/runners/`:
1. Create `skills/<name>/{SKILL.md, references/, scripts/, example/}` from the existing runner
2. Port Zod schemas from `contracts.ts` to `references/*-schema.ts`
3. Write `scripts/orchestrate.ts` that runs the ported runner logic deterministically
4. Capture a fixture in `example/input.json` + `example/output.json`
5. Add `.claude/commands/<name>.md` + `.claude/skills/<name>/` bridge
6. **Dual-run**: dispatch route calls both the old runner and the new skill; compare outputs. Flag divergence.
7. **Sign-off**: 2 real runs match → archive runner.

Order (lowest-risk first): `ingest-url` → `ingest-fathom` → `research-market` → `research-icp` → `research-offer` → `research-keywords` → `research-voc` → `research-cross` → `ingest-identity` → `ingest-docs` → `synthesize-positioning` → `synthesize-media-plan` → `synthesize-scripts`.

### Phase C — Swap dispatch + archive worker runners (≈1 week)
- [ ] `/api/journey/dispatch` calls skills instead of Railway runners
- [ ] Chat refinement becomes `skills/chat-refine/` — each of the 14 chat-tools becomes a reference file, not a duplicated TypeScript helper
- [ ] Delete legacy `/onboarding/edit` (per memory obs 3786)
- [ ] Archive `research-worker/src/runners/` to a `legacy/` branch

### Phase D — Ongoing
- [ ] UI surfaces become thin over skill outputs (no business logic in components)
- [ ] New capabilities = new skills, never new runners
- [ ] Skills are versioned independently (`skill.json` version field → SemVer)

---

## 10. Open questions for sign-off

These need your answer before Phase A starts. Each has my recommendation — push back where needed.

1. **Worker fate** — Keep `research-worker/` as a thin skill executor that the Next.js app hits over HTTP? Or fold everything into the app repo and run skills in-process? *Recommendation: keep Railway worker as a "skill runtime" — Next.js serverless timeouts still bite on long research, and Railway is already paid for.*

2. **Chat granularity** — `chat-refine` as one skill with 14 internal tools, or 14 separate skills (`chat-deep-dive`, `chat-compare-competitors`, etc.)? *Recommendation: one skill, 14 tools in `references/tools/`. Per Anthropic, skills are discovery units; the chat sidebar already routes by intent so there's no discovery benefit from splitting.*

3. **Ingestion triggers** — Run `ingest-url` automatically on URL paste, or expose as a user-triggered skill with `user-invocable: true`? *Recommendation: automatic on paste, manual re-runnable via slash command. Both use the same skill.*

4. **ICM scripts layering** — Recent commit `902ae71b` enforces 3 layers. Confirm the mapping: Layer 1 = all `research-*` skills; Layer 2 = `synthesize-positioning` only; Layer 3 = `synthesize-media-plan` + `synthesize-scripts`. Or should scripts be Layer 4 (downstream of media plan)?

5. **Shared-contracts location** — `lib/contracts/` at repo root (portable) vs. `skills/_shared/contracts/` (colocated with skills)? *Recommendation: repo-root `lib/` — both skills and Next.js app import from it; a skill-nested path couples non-skill code to the skills dir.*

6. **Brand-new ingestion skill** — The current flow has no `research-voc` runner. Is VoC a separate skill or a subagent inside `research-competitor`? *Recommendation: separate skill. Reddit/HN/reviews mining is re-usable across other use cases, and the current "sov-subagent" in research-competitor is doing competitor-scoped VoC only.*

7. **CLAUDE.md changes** — When Phase A completes, the top-level `CLAUDE.md` needs a "Skill-first architecture" section pointing here, and `.claude/ARCHITECTURE.md` needs its "Key Files" section rewritten. Preserve both via Meta-Harness rule (additive preamble, not in-place rewrite)? *Recommendation: append a preamble; keep old text in a "Pre-v3 reference" subsection for 30 days then delete.*

---

## 11. Verification that we've landed this right

A v3 migration is "done" when all of these are true:

- [ ] 16 skill folders exist under `skills/`
- [ ] Each has a passing `scripts/validate.ts` run on its fixture
- [ ] Each has a `.claude/commands/<name>.md` bridge that works via `/<name>`
- [ ] No runner remains in `research-worker/src/runners/`
- [ ] `lib/contracts/` is the only location for cross-process Zod schemas
- [ ] `research-competitor` still renders an identical report to its current output (regression check)
- [ ] `CLAUDE.md` + `.claude/ARCHITECTURE.md` updated (additive preamble) with pointers here
- [ ] 3 end-to-end journey dispatches succeed on real companies, outputs unchanged from pre-v3

---

## 14. Adversarial review findings (2026-04-24)

Independent review against this doc + `skills/research-competitor/` + `skills/ingest-url/`. **Five weakest load-bearing assumptions identified. User decision required on #1 and #2 before Phase A starts.** Full analysis in `.claude/architecture/research-findings.md` §Lane 4.

### Critical contradictions (block Phase A)

**A1 — Name-matcher duplication is already happening.** Decision #5 ("no shared libs") forbids `../../lib/*` imports. But `skills/research-competitor/scripts/name-matcher.ts` already duplicates `src/lib/ad-library/name-matcher.ts` which has a Vitest test suite. At skill #6 (`research-voc`), three divergent copies will exist, only one tested.
- **Decision needed**: either allow `skills/<name>/vendored/` with provenance headers + CI drift-check, OR create `skills/_lib/` and accept intra-skills-tree sharing.

**A2 — Decisions #4 and §8 contradict each other.** Decision #4 says "no Layer 1/2/3 semantics — every skill is a peer." But §8 says "the agent loop enforces the layering: a media-plan skill cannot be dispatched before its upstream research skills have produced Layer 1 output." Plus Decision #3 says "all skills are user-invoked via slash command" — so what happens when user types `/synthesize-media-plan` with no research run?
- **Decision needed**: pick one model. Either layers exist (call them that, update Decision #4) OR composition is the user's problem (delete §8 enforcement language + the `research-cross` entry from §3.2).

### High-priority non-blockers

**A3 — HTML report ceremony for data-only skills.** Runtime §2 says every skill does "render → `scripts/generate-report.ts` writes HTML." But `ingest-identity` produces a 12-field card for a form; there's no natural editorial-HTML shape. Either scaffold empty `generate-report.ts` no one runs, or invent 15 bespoke renderers. **Recommendation**: split runtime into `data-skill` (receive → collect → validate → emit JSON) vs. `report-skill` (adds render + present). Frontmatter flag. 4 ingest-* + research-cross drop `assets/` entirely.

**A4 — Schema rename flattens useful semantic split.** Phase A §9 renames `schemas/ + prompts/` → `references/`. But the reference skill's SKILL.md cites `schemas/` and `prompts/` by name on multiple lines; flattening loses the input/prompts distinction. **Recommendation**: don't flatten. Keep `references/schemas/` + `references/prompts/` + `references/rules.md` sub-dirs. Anthropic's `references/` convention is about load-on-demand, not directory naming.

**A5 — GitHub-repo split has three design leaks.** Decision #7 says skills are a publishable repo. But:
- `.claude/` bridges live in AIGOS repo — at repo split, bridges reference AIGOS paths (broken on clone)
- Per-skill `package.json` + vendored `node_modules/` (each with its own `zod`) — only defensible if each skill is `npm publish`ed standalone
- SKILL.md hardcodes `SEARCHAPI_KEY` sourcing from "AI-GOS repo root `.env.local`" — direct AIGOS coupling

**Recommendation**: decide now — skills as **library** (importable, repo shares deps via pnpm workspaces) or **subprocess contract** (`npx tsx`, JSON in/out, versioned independently). Document one seam only. Lane 2 research already recommended pnpm workspaces — lean into that.

### Forced-choice answers

- **Delete first**: Decision #5 ("no shared libs"). It breaks reference impl behavior and fights Decision #7. Replace with `skills/_lib/` — published alongside skills, zero imports outside `skills/` tree.
- **Unacknowledged assumption**: **Decision #3** (all skills user-invoked, no auto-run). This is a UX guess, not a decision. Current URL-paste → auto-prefill is load-bearing per `MEMORY.md` and `feedback_journey_is_form_driven.md`.
- **Schemas/prompts bifurcation**: ceremony. Keep research-competitor's shipped layout. Don't rename on Day 1 of Phase A.

---

## 12. What this doc is NOT

- **Not a plan** — no atoms, no model assignments. That's Phase A's 02-plan stage.
- **Not code** — no TypeScript written yet. Phase A starts when you approve section 10.
- **Not a CLAUDE.md rewrite** — that comes at Phase A completion, not before.
- **Not immutable** — open questions 1–7 above can change the skill inventory and layout significantly.
