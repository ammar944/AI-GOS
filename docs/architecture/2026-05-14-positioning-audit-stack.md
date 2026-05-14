# Pre-Pitch Positioning Audit — Technical Approach (2026-05-14)

Source of truth for the runtime stack, agent architecture, and skills harness for the Pre-Pitch Positioning Audit. Consolidates ADR-0002 (single structured output per Section), ADR-0003 (backend-only, model-swappable deployment), and the May 14 prior-art research across Claude artifacts / Vercel v0 / Manus / OpenAI Canvas / Anthropic multi-agent research / coreyhaines (28.5k★), alirezarezvani (14.8k★), asgard-ai-platform.

This doc is read first before code changes touching subagents, schemas, skills, or the Workspace artifact UI.

---

## Stack

| Layer | Tech | Where it lives |
|---|---|---|
| Workspace UI | Next.js 16 + shadcn/ui (new-york) + Tailwind CSS v4 | `src/app/research-v2/`, `src/components/research-v2/` |
| Agent loop | **AI SDK v6 — `ToolLoopAgent`** | `research-worker/src/agents/subagents/index.ts` |
| Structured output | **AI SDK v6 — `streamObject(schema)`** with Zod schemas | invoked from runner per Section |
| Provider | Anthropic Claude (Opus 4.7 currently); **swappable** via provider config | `src/lib/ai/providers.ts`, `research-worker/src/agents/subagents/index.ts` |
| Skill harness | **Local `SKILL.md` files**, loaded into Subagent system instructions at worker boot | `research-worker/platform-skills/<skill>/SKILL.md`, loaded by `_skill-loader.ts` |
| Research tools | `web_search`, `firecrawl`, `reviews` (per-Section tool map) | `research-worker/src/agents/subagents/index.ts` |
| Streaming to UI | SSE / partial JSON via `streamObject`'s `partialObjectStream` | runner → Supabase → `/api/research-v2/audit-state` → client poll |
| Persistence | Supabase tables `research_artifacts` (parent run), `research_section_runs` (per-Section), `research_artifact_sections` (per-Section Artifact JSON), `research_section_events` (live activity log) | worker writes via `research-worker/src/db/artifact-runs.ts` |
| Workspace pane | `AgentArtifactSurface` polls `/api/research-v2/audit-state` | `src/components/research-v2/agent-artifact-surface.tsx` |
| Auth | Clerk (workspace), `RAILWAY_API_KEY` (worker dispatch) | `src/middleware.ts`, `src/app/api/research-v2/dispatch/route.ts` |

---

## Agent shape (per Section)

Each of the 6 Sections is produced by exactly one Subagent — a `ToolLoopAgent` instance. The Subagent:

1. **Boot:** `_skill-loader.ts` reads its `SKILL.md` from local disk; content is injected into the Subagent's `system` instructions
2. **Run:** Receives `businessContext` + (optional) `sharedCorpus` from the orchestrator
3. **Gather:** Calls research tools (`web_search`, `firecrawl`, `reviews`) to build evidence — these are normal AI SDK tools in the Subagent's tool map
4. **Emit:** Produces ONE structured Artifact via `streamObject(SectionArtifactSchema)`. Provider-agnostic. Schema enforced at the AI SDK + provider boundary
5. **Validate:** Runner post-validates cardinality minimums (the rules SKILL.md describes in prose). On failure: ONE retry with the validator's errors fed back as a feedback message; persistent failure → emit-with-gaps flagged in the relevant sub-section's prose
6. **Stream to UI:** Partial object streams to Supabase → frontend polls → `AgentArtifactSurface` renders incrementally

No `code_execution` tool. No `validate.py` in-loop. No per-brick artifact-builder tools. Structure comes from the schema, not from tool calls.

---

## Artifact shape (per Section)

**Bespoke per Section, driven by `docs/research-sections.md`.**

Every Section's Artifact has the same top-level scalars:
```
title, verdict { text, confidence }, sources: SourceSchema[]
```

Below that: a fixed set of **named sub-sections** matching that Section's canonical bullets. Each sub-section is shaped `{ prose: markdown, <cards>: HomogeneousTypedCardArray }`. No global discriminated union of Card types — each sub-section's card array is exactly one type.

### BuyerICP (Section 02) example — 5 sub-sections

| Sub-section | Card type | Canonical bullet |
|---|---|---|
| `icpExistenceCheck` | `FirmographicCutSchema[]` | "ICP existence check — account counts by firmographic cut" |
| `personaReality` | `PersonaSchema[]` | "Persona reality — titles, seniority, team size, org-chart position" |
| `awarenessDistribution` | `AwarenessLevelSchema[]` | "Awareness-level distribution (unaware → most-aware)" |
| `buyingContext` | `TriggerSchema[]` | "Buying context — observable triggers" |
| `clusters` | `ClusterVenueSchema[]` | "Where they actually cluster" |

Other Sections (Market & Category, Competitor Landscape, VoC, Demand & Intent, Offer Diagnostic) follow the same pattern — sub-sections per their canonical bullets, each with its own homogeneous Card type.

---

## SKILL.md shape (per skill)

```
---
name: ai-gos-<section-slug>
description: Use this skill when AI-GOS needs to <answer the canonical question>, even if the user says '<verbatim phrase 1>', '<phrase 2>', or '<phrase 3>'.
metadata:
  version: 2.0.0
  updated: YYYY-MM-DD
  author: AI-GOS
  category: GTM/positioning-audit
  tags: [...]
---

# <Section Title>
## When to Use / When NOT to Use
## Role
## Operating Principles
## Pre-flight Check (shared corpus)
## IRON LAW            ← non-negotiable constraints (asgard convention)
## Inputs You May Receive
## Research Tools Available
## Workflow            ← numbered, each step has `**Validation:** <condition>` (alirezarezvani convention)
## Output Format       ← fenced markdown template per sub-section
## Card Schemas        ← typed field list per Card type (our extension)
## Confidence Tagging  ← 🟢 verified / 🟡 medium / 🔴 assumed (alirezarezvani)
## Correct vs Incorrect Examples ← negative examples beat positive (asgard)
## Gotchas
## Anti-Slop Rules
## Handoff
```

Conventions adopted from prior art (May 14 research):
- `description:` starts with "Use this skill when…" + verbatim trigger phrases — coreyhaines + asgard pattern
- `metadata.version` + `updated` in frontmatter — auditable diffs
- `IRON LAW:` blocks — surfaces non-obvious constraints the model would miss
- `**Validation:**` line per workflow step — agent self-checks before moving on
- Confidence emojis inline — `🟢/🟡/🔴` on every claim
- Correct vs Incorrect examples — model needs negative examples to steer
- Pre-flight shared-context read — agent checks for shared corpus before asking

Our extension beyond the public state of the art: typed Card schemas + Zod-enforced output via `streamObject`. No surveyed repo ships typed structured artifacts; everyone outputs freeform markdown with table sub-blocks.

---

## What's NOT in the stack

- ❌ **Anthropic Platform Skills `.zip` uploads** — ADR-0003. The `platform-skills/*.zip` files are dead artifacts.
- ❌ **`code_execution` tool / `validate.py` in-loop** — ADR-0002. Replaced by runner-side post-validate.
- ❌ **`Output.object` with generic envelope** (`verdict + findings + quotes + risks + moves`) — ADR-0002.
- ❌ **Per-brick artifact-builder tools** (`add_persona`, `set_verdict`, etc.) — ADR-0002.
- ❌ **Discriminated unions of Card types in arrays** — ADR-0002 consequence. Each sub-section's Card array is homogeneous.
- ❌ **`Output.object` reach-around via `code_execution` stdout parsing** — ADR-0002. Runner reads Subagent output via `streamObject`, period.
- ❌ **Anthropic-specific schema features** (`.min()/.max()` on structured-output Zod) — handled in runner code instead.
- ❌ **Vendor lock to Anthropic** at the framework layer — ADR-0003. AI SDK v6 abstractions throughout; provider config is the swap point.

---

## Execution-ready next moves (BuyerICP spike)

1. Rewrite `research-worker/src/agents/subagents/schemas/buyer-icp.ts` — new `BuyerICPArtifactSchema` (5 sub-sections, granular Persona enums, fixed Card field gaps); export `validateBuyerICPMinimums` next to it
2. Rewrite `research-worker/platform-skills/ai-gos-buyer-icp-validation/SKILL.md` — new structural template; drop validate.py / Output Contract / plan-validate-emit envelope language
3. Rewrite the BuyerICP Subagent in `research-worker/src/agents/subagents/index.ts` — switch from `Output.object` to `streamObject(BuyerICPArtifactSchema)`, drop the `code_execution` tool from the BuyerICP tool map
4. Wire post-validate into the runner — call after `streamObject` returns; one retry on failure with errors as feedback; then emit-with-gaps
5. Rewrite `research-worker/evals/pilot-buyer-icp.ts` — new pass criteria (streamObject completes, artifact parses, 5 sub-sections present, minimums pass post-validate)
6. Run the pilot, iterate until the artifact lands cleanly on a known company
7. Port to the other 5 Sections one at a time, each driven by its own canonical sub-section list in `docs/research-sections.md`

---

## References

- `CONTEXT.md` — domain glossary (Audit, Section, Subagent, Skill, Artifact, Sub-section, Card)
- `docs/research-sections.md` — canonical sub-section spec for the 6 Sections
- `docs/adr/0001-skill-driven-artifact-builder-pattern.md` — **superseded**, kept for history
- `docs/adr/0002-single-structured-output-per-section.md` — accepted
- `docs/adr/0003-backend-only-deployment.md` — accepted
- `.claude/architecture/refactor-agent-loop-v1-design-2026-04-29.md` — legacy strategic plan, partially superseded by the May 14 stack
