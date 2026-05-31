# What AI-GOS Is (Product + Current Agentic Architecture)

> Anchor doc: what the product does and how the v3 "lab-engine" turns a URL into a cited positioning audit. Ground truth is the codebase survey of branch `feat/v2-lab-section-wire` (the v3 system of record); file:line citations point into `src/lib/lab-engine/**` on that branch. Architecture notes (in-process, atomic-commit) are corroborated by project memory.

## Table of Contents
1. [The Product in One Pass](#1-the-product-in-one-pass)
2. [The Eight Sections](#2-the-eight-sections)
3. [Where It Runs: In-Process on Vercel](#3-where-it-runs-in-process-on-vercel)
4. [The Section-Run Loop](#4-the-section-run-loop)
5. [Skill Injection](#5-skill-injection)
6. [Structured Output → Verifier → Repair/Rescue](#6-structured-output--verifier--repairrescue)
7. [Atomic Commit + Realtime Reader](#7-atomic-commit--realtime-reader)
8. [What This Is Not](#8-what-this-is-not)

---

## 1. The Product in One Pass

AI-GOS produces a strategic positioning audit for a SaaS/GTM business. The flow is **form-driven, not chat-driven**:

1. User enters a company URL (or an approved business link) on `/research-v2`.
2. `deepResearchProgram` dispatches automatically and builds a shared **research corpus** (web + onboarding fields).
3. Corpus completes → a **GTM Brief Review** form opens; the user confirms/edits auto-prefilled fields.
4. Brief submit → `POST /api/research-v2/orchestrate` fans out the six positioning sections in parallel.
5. Each section runs an agentic loop, validates its output, and **commits as a typed artifact draft** independently.
6. The **Audit Reader** renders one typed card per section as each commits, with live per-section progress.
7. Two read-only capstones — **Synthesis** (cross-section wedge + divergent angles) and **Paid Media Plan** — run off the committed positioning artifacts.

The output is six evidence-backed positioning sections plus the two capstones, all with numbered source footers, persisted to the user's profile.

## 2. The Eight Sections

The six positioning sections, in pipeline order, are defined by `POSITIONING_SECTION_IDS` (`src/lib/ai/prompts/positioning-skills/index.ts:16-23`):

`positioningMarketCategory → positioningBuyerICP → positioningCompetitorLandscape → positioningVoiceOfCustomer → positioningDemandIntent → positioningOfferDiagnostic`

Two capstones live outside that array because they synthesize the committed six rather than rolling up into the same parent key (`index.ts:28-33`):

- **`positioningPaidMediaPlan`** (`PAID_MEDIA_PLAN_SECTION_ID`, `index.ts:28`)
- **`positioningSynthesis`** — cross-section capstone: "Reads the six committed positioning artifacts and emits one recommended wedge + 2-3 divergent angles" (`index.ts:31-33`).

Each section has an entry in the section registry (`src/lib/lab-engine/sections/section-registry.ts`) carrying its title, mission, `skillSlug`, `allowedTools`, and external-lookup budget. CompetitorLandscape is the heaviest: it is the only section with ad-library tools (`google_ads`, `meta_ads`) and a reserved ad-lookup budget. Synthesis and Paid Media Plan declare **no external tools** — they read committed artifacts only.

## 3. Where It Runs: In-Process on Vercel

The lab-engine runs **inside the Next.js Node runtime on Vercel — not in the Railway worker**. The Railway worker still exists for the legacy research path, but the v3 positioning sections execute in-process.

- The section route declares `export const runtime = 'nodejs'` and `export const maxDuration = 300` (`src/app/api/research-v2/run-lab-section/route.ts:35-37`).
- It schedules the actual run via `scheduleLabSectionJob`, which invokes `runLabSectionJob` in the same process behind an `AbortController` capped at `LAB_SECTION_JOB_TIMEOUT_MS = 270_000` (`src/lib/research-v2/lab-section-dispatch.ts:14,55`). The route also imports `after` from `next/server` to detach work past the response.

**Practical consequence:** all provider keys the lab-engine needs (e.g. `SEARCHAPI_KEY`) must live in the **Vercel** environment, not only on the worker. (This corrects the worker-centric framing in `bug-triage.md`; see project memory.)

## 4. The Section-Run Loop

All six positioning sections use the **answer-tool path** — an AI SDK v6 `ToolLoopAgent` loop that ends by calling a single `answer` tool whose input is the typed artifact. The set is hardcoded (`src/lib/lab-engine/agents/run-section.ts:721-728`):

```
positioningMarketCategory, positioningDemandIntent, positioningOfferDiagnostic,
positioningBuyerICP, positioningVoiceOfCustomer, positioningCompetitorLandscape
```

The loop: the agent is given the section's research tools (`web_search`, `firecrawl`, ad-library/keyword tools where allowed) plus the `answer` tool. It runs research steps — each tool call returns "ground truth" the next step reasons over — and stops on a successful `answer()` call or when the step ceiling is hit. The model has **no filesystem / bash / read-file tool**; its only inputs are the injected ResearchInput JSON, pre-loaded corpus excerpts, and accumulated tool results.

Loop bounds (`run-section.ts`):

| Bound | Value | Line |
|---|---|---|
| Max loop steps | 12 | `:717` |
| Repair attempts after a failed answer | 2 | `:718` |
| Attempts on a zero-step transport stall | 2 | `:704` |
| First-step watchdog | 120s | `:701` |
| Answer-tool inner timeout | 255s | `:697` |

The timeout hierarchy is explicit and contract-tested: **answer-tool 255s < job 270s < route 300s** (`run-section.ts:688-697`). The inner answer-tool timeout trips first; the 270s job-timeout AbortController is the canonical controlled-failure emitter, firing ~15s later and ~30s before the platform cap so the run records a terminal `section-failed` event instead of orphaning a `running` row.

## 5. Skill Injection

Each section's `SKILL.md` is loaded from disk and **concatenated into the prompt once per attempt** — there is no progressive disclosure, no on-demand file read (the model has no filesystem tool, §4). The skill body is appended after the programmatic instructions under a `"Skill analyst guidance:"` header (`run-section.ts:3078-3079`, loaded at `:2977` via `deps.loadSkill(definition.skillSlug)`).

Prompt assembly order (`src/lib/lab-engine/agents/build-prompts.ts`, `buildAnswerToolInstructions` at `:457`): section title + mission → ResearchInput JSON → normalized ad-evidence block → output emphasis → section-specific minimum-validator guidance → root-shape guidance → corpus-only boundary → answer-tool completion instruction → **then** the SKILL.md body appended in the runner. Boilerplate (capability-gap / anti-slop prose) is not deduplicated at the system level; it appears once per section only if it is in that section's SKILL.md.

The output contract is enforced in three layers: the **Zod schema** (runtime shape, persisted to Supabase), a **`validateMinimums` function** (business-logic gates — source counts, triangulation, force-type coverage), and the **SKILL.md** (the human-readable evidence/instruction contract the model reads).

## 6. Structured Output → Verifier → Repair/Rescue

The answer tool emits one complete typed artifact. Before it can commit, a **lexical (not semantic) structural verifier** runs (`src/lib/lab-engine/agents/verification/`). It extracts claims (URL, numeric, quote, generic text) from the body and matches each against the tool-result transcript and corpus excerpts:

- **URL claims** — exact match against tool results / corpus.
- **Numeric claims** — textual search with variants (no-decimal, magnitude-expanded, monthly alias, bare currency).
- **Quote / text claims** — normalized substring search.

By default, **numeric and URL claims are load-bearing**. Unsupported load-bearing claims produce an evidence-support shortfall that drives a **repair** attempt (up to 2, `run-section.ts:718`). The repair prompt feeds the prior failure back so the model can re-ground or drop the claim; a repair may force answer-only (tools off) to stop the model from re-fetching. If the shortfall persists after the repair ceiling, the section **fails terminally**. The gate's strictness is tunable via `LAB_VERIFIER_MAX_UNSUPPORTED` (default behavior leaves unsupported claims advisory rather than hard-failing — see project memory's fabrication-gate note).

**Confidence is replaced, not averaged.** When a verification report exists, the committed `confidence` is `deriveGroundedConfidence(verification)` = `verified / (verified + unsupported)`; it falls back to the model's self-reported value only on corpus-only paths with no report (`run-section.ts:314-320`). The comment is blunt: the model's self-report "is uncorrelated with grounding."

## 7. Atomic Commit + Realtime Reader

Sections **commit atomically**, not token-by-token. The `ToolLoopAgent` streams research-step *events* (tool started/finished, validation/repair, sub-section committed) for liveness, but the artifact itself is the single typed object produced by the final `answer()` call and written to Supabase in one write. This atomicity is load-bearing: the verifier (§6) needs a complete, valid artifact to check claims against, so switching to mid-stream token streaming of the content would orphan the fabrication gate (see project memory).

The Audit Reader is the canonical surface. It polls `/api/research-v2/audit-state?run_id=…` (~2.5s) for committed artifacts and per-section events, then dispatches each section to a typed renderer (per-section custom layouts with a generic fallback) plus a numbered, deduped sources footer. While a section is `running` it shows a phase-iconned live activity feed (preparing → searching → drafting → checking → refining → committing); event titles/details pass a customer-safe allowlist that strips raw schema paths and internal jargon before display.

## 8. What This Is Not

- **Not chat-driven research.** Forms and button clicks dispatch sections; the chat sidebar is post-research editing only and never triggers research.
- **Not sequential single-section dispatch.** Fan-out via `/api/research-v2/orchestrate` is the canonical flow; the old per-section "Run section" click was retired.
- **Not worker-hosted (for v3).** The positioning sections run in-process on Vercel (§3).
- **Not progressive-disclosure skills.** SKILL.md is injected wholesale per attempt; there is no runtime filesystem for L2/L3 lazy loading (§5).
- **Not content-streamed.** Section content commits atomically to preserve the verifier gate (§7).
