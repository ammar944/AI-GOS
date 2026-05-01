---
title: Landing Page Studio — Local Skill v1
slug: landing-page-studio
prd_number: 002
status: draft
created_date: 2026-05-01
created_by: ammar
research_loaded: true
parent_research: research/summary.md
scope_lock: scope-decisions.md
---

# PRD: Landing Page Studio — Local Skill v1

## Executive Summary

Build the **brain** of the landing-page studio as a self-contained local skill at `skills/landing-page-studio/`. The skill takes a `BrandSpec` JSON and produces 3 disjoint design directions plus single-file HTML artifacts on disk. Invocable via CLI (`npx tsx`), Claude Code slash command (`/landing-page-studio`), or the SKILL.md loader for Claude/Codex agents. Production canvas wiring (BrandSpec form, iframe srcDoc preview, Supabase Storage, GTM dispatch) is **deferred to PRD #003** to ship the brain first and verify it generalizes across 1000+ SaaS before investing in UI/storage plumbing.

This is a **simplicity-first sequencing decision** by the user (2026-05-01): "make a skill for local agents first, replicate the workflow on production after." Eliminates ~70% of the scope originally surfaced in research while preserving the full 4-layer architecture (BrandSpec → Direction Planner → Generation → Tweak loop).

## Goals

1. Ship `skills/landing-page-studio/` as a self-contained skill folder following the canonical skill-first layout (CLAUDE.md v3).
2. Generate 3 named, disjoint design directions per BrandSpec from a fixed 15-direction taxonomy.
3. Generate single-file HTML + Tailwind cdnjs + lucide inlined per chosen direction, passing the existing 12 regex QA gates.
4. Provide a tweak loop with two tools: `patch_text` (Ollama, free) and `regen_section` (Anthropic Sonnet, paid).
5. Run end-to-end on a real `example/brief.json` and commit the resulting HTML as a golden fixture.
6. Make the skill invocable three ways: CLI script, Claude Code slash command, agent-loadable SKILL.md.

## Non-Goals (defer to PRD #003)

- ❌ BrandSpec form UI in the GTM workspace
- ❌ `<iframe srcDoc sandbox>` preview component in `ArtifactCanvas`
- ❌ `gtm_landing_pages` table or `gtm_artifacts` metadata extension
- ❌ Supabase Storage bucket for assets (logos, screenshots)
- ❌ GTM dispatch route registration (`/api/gtm/runs/[runId]/dispatch` for `landing-page-studio`)
- ❌ Tweak via chat orchestrator
- ❌ Vision-model ingestion of inspiration screenshots → use `inspiration_notes: string[]` (text descriptions) for v1
- ❌ Mobile overflow client-side check → existing `mobile_nav_overflow_risk` regex gate covers common cases; full check defers to PRD #003 where iframe exists
- ❌ Playwright / vision verdict / hero asset gen / video hero (already deferred in scope-decisions.md)

## Architecture (4-layer, unchanged from research)

```
┌──────────────────────────────────────────────────────────────┐
│ 1. BrandSpec (JSON, validated by Zod)                        │
│    logo_url, palette (primary+accent hex), font_pair,        │
│    hero (headline, sub, cta), proof[], inspiration_notes[],  │
│    sections[]                                                 │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Direction Planner (Anthropic Sonnet)                      │
│    Reads BrandSpec + 15-direction taxonomy                   │
│    Returns 3 disjoint picks + rationale                      │
│    → output/<run>/directions.json                            │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Generation per direction (Anthropic Sonnet)               │
│    Reuses skills/landing-page/prompts/system.md as base      │
│    Layered with direction-specific style guidance            │
│    Single-file HTML + Tailwind cdnjs + lucide inlined        │
│    Post-gen pass: inject CSP meta, normalize OKLCH           │
│    → output/<run>/direction-{1,2,3}.html                     │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Tweak loop (two tools, optional invocation)               │
│    patch_text  — Ollama, free, text-only edit of section     │
│    regen_section — Anthropic Sonnet, full section regen      │
│    Both write a new versioned file: direction-1.v2.html      │
└──────────────────────────────────────────────────────────────┘
```

## Folder Layout (canonical skill-first)

```
skills/landing-page-studio/
├── SKILL.md                          # YAML frontmatter + agent-facing description
├── README.md                         # Human quickstart + env vars + output structure
├── prompts/
│   ├── system.md                     # Base generation prompt (adapted from skills/landing-page/)
│   └── direction-planner.md          # Direction Planner system prompt
├── contracts/
│   └── brand-spec.ts                 # Zod schema + TS types for BrandSpec
├── references/
│   ├── directions.json               # 15-direction taxonomy (data)
│   ├── directions.md                 # Human-readable docs of the 15 directions
│   └── google-fonts.json             # Curated Google Fonts allowlist (~40 pairs)
├── scripts/
│   ├── generate.ts                   # Top-level orchestrator + CLI subcommands
│   ├── plan-directions.ts            # Direction Planner
│   ├── generate-direction.ts         # Per-direction HTML generator
│   ├── post-process.ts               # CSP injection + OKLCH norm + lucide inline
│   ├── quality-gates.ts              # 12 regex gates (vendored from src/lib/ai/landing-page/)
│   ├── patch-text.ts                 # Ollama text patch tool
│   └── regen-section.ts              # Anthropic section regen tool
├── example/
│   ├── brief.json                    # Real BrandSpec (DealFlow-style)
│   └── output/                       # Golden HTML outputs (committed)
└── output/                           # Generated artifacts (gitignored)
```

Plus bridge:
- `.claude/commands/landing-page-studio.md` — slash command bridge

## Tasks

See `tasks.yaml` for the full task list. Summary: **15 tasks, 43 complexity points, day-sized.**

| ID | Title | Cmplx | Priority | Depends |
|----|-------|-------|----------|---------|
| T1 | Scaffold skill folder + canonical layout | 2 | must | — |
| T2 | BrandSpec Zod schema + TS types | 3 | must | T1 |
| T3 | Direction-vocabulary taxonomy (15 directions) | 3 | must | T1 |
| T4 | Direction Planner script | 4 | must | T2, T3 |
| T5 | Per-direction HTML generator | 5 | must | T2, T3 |
| T6 | Post-gen pass (CSP + OKLCH + lucide) | 3 | must | T5 |
| T7 | QA gates port (12 regex gates) | 2 | must | T1 |
| T8 | patch_text tweak script (Ollama) | 3 | should | T5 |
| T9 | regen_section tweak script (Anthropic) | 3 | should | T5 |
| T10 | Top-level CLI orchestrator | 4 | must | T4, T5, T6, T7 |
| T11 | Slash command bridge | 2 | should | T10 |
| T12 | SKILL.md (Claude Code skill loader) | 3 | must | T10 |
| T13 | Example brief + golden output fixture | 2 | must | T10 |
| T14 | README + Google Fonts + direction docs | 3 | should | T3 |
| T15 | Deprecate skills/landing-page/ (banner only) | 1 | could | T13 |

## Execution Plan (waves)

```
Wave 1 (parallel): T1
Wave 2 (parallel): T2, T3, T7
Wave 3 (parallel): T4, T5, T14
Wave 4 (parallel): T6, T8, T9
Wave 5 (sequential): T10
Wave 6 (parallel): T11, T12, T13
Wave 7 (sequential): T15
```

Longest chain: T1 → T2 → T5 → T6 → T10 → T13 → T15 (7 deep).

## Acceptance Criteria

This PRD is "done" when:

1. ✅ `npx tsx skills/landing-page-studio/scripts/generate.ts plan example/brief.json` produces `output/<timestamp>/directions.json` with exactly 3 directions from disjoint families.
2. ✅ `npx tsx skills/landing-page-studio/scripts/generate.ts full example/brief.json` produces 3 HTML files that all pass the 12 QA gates and open in a browser without console errors.
3. ✅ `/landing-page-studio` slash command invokes the same workflow from inside Claude Code.
4. ✅ A Claude Code agent can load `SKILL.md` and produce a landing page given a BrandSpec in chat (text-only, no real CLI).
5. ✅ Tweak path: `npx tsx scripts/generate.ts tweak text output/<run>/direction-1.html "make headline punchier"` produces `direction-1.v2.html` with the change applied.
6. ✅ Tweak path: `npx tsx scripts/generate.ts tweak regen output/<run>/direction-1.html hero "make hero feel more bento-grid"` produces `direction-1.v2.html` with hero regenerated.
7. ✅ `example/output/` contains committed golden HTML for the example BrandSpec, runnable as a smoke test.
8. ✅ `npm run typecheck` passes with no new errors introduced.
9. ✅ `skills/landing-page/README.md` has a deprecation banner pointing to the new skill.

## Resolved Open Questions

From `scope-decisions.md`:

| Q | Resolution |
|---|------------|
| Q3 — Asset CSP loosening | **N/A v1** — no Supabase Storage; user supplies logo/proof URLs as plain `https://...` strings in BrandSpec. Defers with PRD #003. |
| Q4 — Storage strategy | **N/A v1** — local filesystem (`output/<timestamp>/`). PRD #003 picks `gtm_landing_pages` vs metadata extension. |
| Q5 — Direction-planner model | **Ollama text-only** (default per `ai-sdk-patterns.md`). `inspiration_notes: string[]` replaces vision. Vision lands in PRD #003. |
| Q7 — Skill folder layout | **NEW `skills/landing-page-studio/`** (option 2). `skills/landing-page/` stays operational with deprecation banner; T15 adds banner. |

Plus one new resolution from the user's reframe (2026-05-01):

| Q (new) | Resolution |
|---|------------|
| Q8 — UI vs CLI sequencing | **CLI/skill first, UI in PRD #003.** Validates the brain on real briefs before building production wiring. |

## Risks (from Round 1, ranked)

| # | Risk | Mitigation |
|---|------|------------|
| R1 | 3 directions feel samey (no real variance) | Disjoint design-vocabulary taxonomy; T3 enforces non-overlapping families in the picker logic |
| R2 | Anthropic Sonnet HTML cost balloons | Cap at 3 directions per BrandSpec; CLI rate-limit; default to 1 direction in `tweak` mode |
| R3 | CSP breaks cdnjs Tailwind/lucide | Whitelist cdnjs in `script-src`/`style-src`; T6 includes browser smoke check note |
| R4 | Old `skills/landing-page/` confuses callers | T15 deprecation banner; existing skill code stays operational |
| R5 | "Brain works in CLI but doesn't generalize to canvas later" | PRD #003 reuses these scripts as library functions; contracts/brand-spec.ts is the integration seam |

## Provider Routing

Per `.claude/rules/ai-sdk-patterns.md`:

- **Direction Planner (T4)**: Default Ollama via `generateGtmSkillObject` (text-only, deepseek-v4-flash:cloud). If schema drift surfaces, per-skill Anthropic fallback to Sonnet.
- **HTML Generator (T5)**: **Per-skill Anthropic exemption** — `anthropic(MODELS.CLAUDE_SONNET)` directly via `generateText`. Matches existing `skills/landing-page/scripts/generate.ts` pattern. Add `// TODO(skill-on-ollama): re-evaluate quality on Ollama after Phase 2` comment per the rule.
- **patch_text (T8)**: Ollama via `getGtmSkillLanguageModel()` chokepoint.
- **regen_section (T9)**: Anthropic Sonnet directly (per-skill exemption).

No vision in v1. No Perplexity (this skill doesn't fetch external sources).

## Files Touched

**New** (under `skills/landing-page-studio/`):
- All files in the canonical layout above (~15 new files)

**Modified** (single-line additions only):
- `skills/landing-page/README.md` — deprecation banner (T15)

**Not touched**:
- `src/` (entire directory — no production code change)
- `research-worker/` (entire directory)
- `supabase/migrations/` (no schema change)
- `.claude/rules/` (no rule change)
- `.env.local` / `.env.*` (env vars already exist: ANTHROPIC_API_KEY, OLLAMA_API_KEY)

## Verification Strategy

Per `.claude/rules/verification.md`:

- **Build**: `npm run build` exits 0 (no production code change → should pass trivially)
- **Tests**: `npm run test:run` (no new tests added in v1; smoke test is the example fixture run)
- **Manual**: After T13, run `npx tsx skills/landing-page-studio/scripts/generate.ts full skills/landing-page-studio/example/brief.json` and open the 3 HTML files in a browser. Each must render, look distinct, and have no console errors.
- **Spec check**: All 9 acceptance criteria above must be checked off.

## Research References

- `research/summary.md` — 4-layer architecture consensus
- `research/internal/findings.md` — codebase audit (10 gaps; this PRD closes 1 — the skill itself)
- `research/external/findings.md` — 50+ sources, competitive matrix, 7-levels framework
- `research/external/levels-framework.md` — vocabulary-teaching direction names
- `scope-decisions.md` — locked architecture decisions, cuts, deferrals
- `internal/agent-a-draft-spec.md` — original 3-phase spec (this PRD is Phase 1 only)

## Sequencing

- **PRD #002 (this)**: Local skill brain — ships first
- **PRD #003 (TBD)**: Production canvas wiring — BrandSpec form, iframe preview, Supabase Storage, GTM dispatch route, tweak via chat orchestrator
- **PRD #004 (TBD, deferred)**: Vision direction planner + inspiration screenshot ingestion
- **PRD #005 (TBD, deferred)**: Visual QA loop (Playwright + Anthropic vision verdict)
- **PRD #006 (TBD, deferred)**: Site-teardown ingestion, hero asset generation, video hero

This PRD does not block any of #003-#006; each can ship independently once #002 lands.
