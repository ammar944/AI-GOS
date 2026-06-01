# AI-GOS Technical Corpus

> The separate, referenceable technical knowledge base for AI-GOS: what the app is, how its agentic engine works today, and the best-practice bar (Anthropic + best-in-class agentic apps) we build to. Read this before doing AI-engineering or AI-design work on the lab-engine, the skills, or the artifact reader.

## Why this exists

AI-GOS turns a URL into a cited positioning audit through agentic loops — the same class of system as v0, Lovable, Cursor, and Manus. To hold that bar deliberately (not by accident), we keep a curated corpus grounded in authoritative sources rather than re-deriving patterns each time. When you change a skill, the section runner, the verifier, or the reader, this is the reference.

## The documents

| # | Doc | Read it when |
|---|-----|--------------|
| 00 | [What AI-GOS Is](00-what-aigos-is.md) | You need the product + current agentic architecture (the section-run loop, skill injection, verifier, atomic commit, reader). The "what the app is" anchor. |
| 01 | [Authoring Lab-Engine Skill Modules](01-skill-authoring-for-lab-engine.md) | You are writing or editing a `SKILL.md`. Anthropic's skill best practices **adapted to our wholesale-injection constraint** (no runtime filesystem → no progressive disclosure → concision is the only valve). |
| 02 | [Agentic Loop Patterns](02-agentic-loop-patterns.md) | You are changing the section runner, tool loop, structured output, verification, or orchestration. Anthropic Agent-SDK patterns + Manus context-engineering, each tied to an AI-GOS application. |
| 03 | [Reference-App Teardown](03-reference-app-teardown.md) | You want the v0 / Lovable / Cursor / Manus pattern for a problem (artifact streaming, planning, provenance, instruction design) and a clear adopt/reject call. Leaked-prompt claims are marked community-sourced. |
| 04 | [Gap Analysis + Roadmap](04-gap-analysis-and-roadmap.md) | You are prioritizing. Honest current-vs-bar scoring with a sequenced roadmap, tied to the research-quality Pass-2 plan. |

## The one load-bearing constraint (read this even if you read nothing else)

**AI-GOS lab-engine "skills" are NOT Claude-discovered Agent Skills.** Each `SKILL.md` body is injected *wholesale* into a section's system prompt by `skillSlug`, and the running model has **no filesystem / Read / bash tool** — only its `allowedTools` (web_search, firecrawl, …). Therefore Anthropic's progressive disclosure (load `SKILL.md` on trigger, fetch `reference/*.md` on demand) **does not transfer**: the body must be self-contained, and conciseness matters *more* than in the Anthropic model because every token loads on every run (and up to 3× per section across repair attempts). The prompt-craft layer (assume-smart concision, calibrated degrees of freedom, concrete examples, feedback loops, goal recitation) transfers fully; the runtime layer (filesystem staging, name/description discovery, bundled scripts) does not. See [01](01-skill-authoring-for-lab-engine.md) and [03 §7](03-reference-app-teardown.md).

## Provenance & freshness

- **Codebase claims** cite `file:line` against the v3 system of record: the `feat/v2-lab-section-wire` worktree. Line numbers drift — verify before relying on a specific line.
- **Web-research claims** cite source URLs. Anthropic docs are authoritative; **community-sourced (leaked system prompt) claims are marked as such** and carry lower confidence.
- Built 2026-05-31 from a 13-agent survey + research + synthesis pass. Refresh when the section runner, verifier, or skill model changes materially.

## How this maps to active work

The corpus roadmap ([04 §5](04-gap-analysis-and-roadmap.md)) and the research-quality Pass-2 plan (`docs/2026-05-29-research-quality-pass2-execution-plan.md`) are reconciled against the 2026-06-01 Phase 1 state: **P1.1** synthesis capstone, **P1.2** stub-skill enrichment + dead-code purge, **P1.3** Demand Intent keyword signal, **P1.4** VoC provenance/quote hardening, corpus G1 shared-preamble dedup, and G6 goal recitation have shipped. Next work starts at Phase 2 (`P2.1-JUDGE` and later items).

SpyFu status: the account/key path is funded for Demand Intent through the registered `keyword_volume` tool (`SPYFU_API_KEY`), but the old direct `spyfu` tool remains absent from `TOOL_CATALOG`. Treat "SpyFu dead key" language in older audits as stale; the remaining issue is per-section tool availability and use, not funding.
