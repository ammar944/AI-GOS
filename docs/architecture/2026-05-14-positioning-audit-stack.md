# Pre-Pitch Positioning Audit — Technical Approach (2026-05-14)

Source of truth for the runtime stack, agent architecture, and skills harness for the Pre-Pitch Positioning Audit. Consolidates ADR-0002 (single structured output per Section), ADR-0003 (backend-only, model-swappable deployment), and the May 14 prior-art research across Claude artifacts / Vercel v0 / Manus / OpenAI Canvas / Anthropic multi-agent research / coreyhaines (28.5k★), alirezarezvani (14.8k★), asgard-ai-platform.

This doc is read first before code changes touching subagents, schemas, skills, or the Workspace artifact UI.

---

## Stack

| Layer | Tech | Where it lives |
|---|---|---|
| Workspace UI | Next.js 16 + shadcn/ui (new-york) + Tailwind CSS v4 | `src/app/research-v2/`, `src/components/research-v2/` |
| Agent loop | **AI SDK v6 — `ToolLoopAgent`** | `research-worker/src/agents/subagents/index.ts` |
| Structured output | **AI SDK v6 — `streamObject(schema)`** with Zod schemas | invoked from runner for ported Sections |
| Provider | Anthropic Claude (`claude-opus-4-6` currently); **swappable** via provider config | `src/lib/ai/providers.ts`, `research-worker/src/agents/subagents/index.ts` |
| Skill harness | **Local `SKILL.md` files**, loaded into Subagent system instructions at worker boot | `research-worker/platform-skills/<skill>/SKILL.md`, loaded by `_skill-loader.ts` |
| Research tools | `web_search`, `firecrawl`, `reviews` (per-Section tool map) | `research-worker/src/agents/subagents/index.ts` |
| Streaming to UI | activity events plus committed Section projection | runner -> Supabase -> `/api/research-v2/audit-state` -> client poll |
| Persistence | Supabase tables `research_artifacts` (parent run), `research_section_runs` (per-Section), `research_artifact_sections` (per-Section projection), `research_section_events` (live activity log) | worker writes via `research-worker/src/db/artifact-runs.ts` and `research-worker/src/supabase.ts` |
| Workspace pane | `AgentArtifactSurface` polls `/api/research-v2/audit-state` | `src/components/research-v2/agent-artifact-surface.tsx` |
| Auth | Clerk (workspace), `RAILWAY_API_KEY` (worker dispatch) | `src/middleware.ts`, `src/app/api/research-v2/dispatch/route.ts` |

---

## Agent shape (per Section)

Each of the 6 Sections is produced by exactly one Subagent — a `ToolLoopAgent` instance. The accepted target shape for a ported Section is:

1. **Boot:** `_skill-loader.ts` reads its `SKILL.md` from local disk; content is injected into the Subagent's `system` instructions
2. **Run:** Receives `businessContext` + (optional) `sharedCorpus` from the orchestrator
3. **Gather:** Calls research tools (`web_search`, `firecrawl`, `reviews`) to build evidence — these are normal AI SDK tools in the Subagent's tool map
4. **Emit:** Produces ONE structured Artifact via runner-owned `streamObject(SectionArtifactSchema)`. Provider-agnostic. Schema enforced at the AI SDK + provider boundary
5. **Validate:** Runner post-validates cardinality minimums (the rules SKILL.md describes in prose). On failure: ONE retry with the validator's errors fed back as a feedback message; persistent failure → emit-with-gaps flagged in the relevant sub-section's prose
6. **Commit to UI projection:** final Artifact is projected into `research_artifact_sections`; activity events stream separately through `research_section_events`

No new `code_execution` tool. No `validate.py` in-loop. No per-brick artifact-builder tools. Structure comes from the schema, not from tool calls.

## Current implementation status (2026-05-15)

The architecture is mid-port, not fully landed across all 6 Sections.

| Section | Runtime status | Schema / Skill status |
|---|---|---|
| 01. Market & Category Intelligence | Ported evidence loop -> `streamObject(MarketCategoryArtifactSchema)` | `market-category.ts`, rewritten local Skill, `eval:pilot:market-category` |
| 02. Buyer & ICP Validation | Ported evidence loop -> `streamObject(BuyerICPArtifactSchema)` | `buyer-icp.ts`, rewritten local Skill, `eval:pilot:buyer-icp` |
| 03. Competitor Landscape & Positioning | Transitional legacy `Output.object(PositioningEnvelopeSchema)` | legacy Skill still references `plan.json` / `scripts/validate.py` |
| 04. Voice of Customer & Objection Evidence | Transitional legacy `Output.object(PositioningEnvelopeSchema)` | legacy Skill still references `plan.json` / `scripts/validate.py` |
| 05. Demand & Intent Signals | Transitional legacy `Output.object(PositioningEnvelopeSchema)` | legacy Skill still references `plan.json` / `scripts/validate.py` |
| 06. Offer & Performance Diagnostic | Transitional legacy `Output.object(PositioningEnvelopeSchema)` | legacy Skill still references `plan.json` / `scripts/validate.py`; tool map still contains `code_execution` |

Do not treat the legacy Envelope path as the architecture. It is migration state while each remaining Section is ported to its own Artifact schema and rewritten Skill.

---

## Artifact shape (per Section)

**Bespoke per Section, driven by `docs/research-sections.md`.**

Every Section's Artifact has the same top-level scalars:
```
sectionTitle, verdict, statusSummary, confidence, sources: SourceSchema[]
```

Below that: a fixed set of **named sub-sections** matching that Section's canonical bullets. Each sub-section is shaped `{ prose: markdown, <cards>: HomogeneousTypedCardArray }`. No global discriminated union of Card types — each sub-section's card array is exactly one type.

### Market & Category Intelligence (Section 01) — 4 sub-sections

| Sub-section | Card / nested type | Canonical bullet |
|---|---|---|
| `categoryDefinition` | `AdjacentCategorySchema[]` | "Category definition and the adjacent categories buyers confuse it with" |
| `marketSize` | `MarketSizeSignalSchema[]` | "Market size and trajectory signals" |
| `structuralForces` | `StructuralForceSchema[]` | "Structural forces moving the market" |
| `categoryMaturity` | `MaturityClassificationSchema` | "Category maturity with evidence" |

Section 01 has the first exception to the homogeneous-card-array pattern:
`categoryMaturity.classification` is one nested classification object, not an
array. The classification object carries `stage`, `evidenceSummary`, and
`supportingSignals`.

Section 01 port validation (2026-05-15): `eval:pilot:market-category -- --company
Fellow --url https://fellow.app` passed in 412.9s with all 4 sub-sections
present, 0 `code_execution` calls, and one post-validate retry. The final
Artifact carried one duplicate-force validation gap inline rather than hiding it.

### BuyerICP (Section 02) example — 5 sub-sections

| Sub-section | Card type | Canonical bullet |
|---|---|---|
| `icpExistenceCheck` | `FirmographicCutSchema[]` | "ICP existence check — account counts by firmographic cut" |
| `personaReality` | `PersonaSchema[]` | "Persona reality — titles, seniority, team size, org-chart position" |
| `awarenessDistribution` | `AwarenessLevelSchema[]` | "Awareness-level distribution (unaware → most-aware)" |
| `buyingContext` | `TriggerSchema[]` | "Buying context — observable triggers" |
| `clusters` | `ClusterVenueSchema[]` | "Where they actually cluster" |

Remaining Section ports should follow the same pattern — sub-sections per their canonical bullets, each with its own homogeneous Card type unless the Section schema explicitly owns a single-object field like `categoryMaturity.classification`.

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
- ❌ **`code_execution` tool / `validate.py` in-loop** — ADR-0002. Replaced by runner-side post-validate in ported Sections.
- ❌ **New `Output.object` work with generic envelope** (`verdict + findings + quotes + risks + moves`) — ADR-0002. Existing unported Sections still use this temporarily.
- ❌ **Per-brick artifact-builder tools** (`add_persona`, `set_verdict`, etc.) — ADR-0002.
- ❌ **Discriminated unions of Card types in arrays** — ADR-0002 consequence. Each sub-section's Card array is homogeneous.
- ❌ **`Output.object` reach-around via `code_execution` stdout parsing** — ADR-0002. Runner reads Subagent output via `streamObject`, period.
- ❌ **Anthropic-specific schema features** (`.min()/.max()` on structured-output Zod) — handled in runner code instead.
- ❌ **Vendor lock to Anthropic** at the framework layer — ADR-0003. AI SDK v6 abstractions throughout; provider config is the swap point.

---

## Execution-ready next moves

1. Port Section 03, Competitor Landscape & Positioning, to a bespoke Artifact schema and rewritten Skill.
2. Remove `plan.json` / `scripts/validate.py` language from each Section as it is ported.
3. Remove Offer Diagnostic's `code_execution` tool when Section 06 is ported.
4. Keep `PositioningEnvelopeSchema` only as a temporary Adapter for unported Sections.
5. After all six Sections are ported, delete the legacy Envelope path and update the Workspace projection to render typed sub-sections and Cards directly.

---

## References

- `CONTEXT.md` — domain glossary (Audit, Section, Subagent, Skill, Artifact, Sub-section, Card)
- `docs/research-sections.md` — canonical sub-section spec for the 6 Sections
- `docs/adr/0001-skill-driven-artifact-builder-pattern.md` — **superseded**, kept for history
- `docs/adr/0002-single-structured-output-per-section.md` — accepted
- `docs/adr/0003-backend-only-deployment.md` — accepted
- `.claude/architecture/refactor-agent-loop-v1-design-2026-04-29.md` — legacy strategic plan, partially superseded by the May 14 stack
