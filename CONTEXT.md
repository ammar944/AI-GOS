# AI-GOS Domain Context

AI-GOS is a Manus-for-GTM-SaaS product: a user submits a company URL and receives a deeply researched **Pre-Pitch Positioning Audit** — six positioning **Sections** produced by autonomous **Subagents** and presented in the **Workspace** as a readable **Audit**.

This document is the project glossary. It defines the domain terms that load-bear the codebase. Implementation details belong in `docs/architecture/`; design decisions belong in `docs/adr/`. The canonical sub-section structure for each Section lives in `docs/research-sections.md` and overrides any conflicting interpretation here.

## Technical approach (summary)

Full details in `docs/architecture/2026-05-14-positioning-audit-stack.md`. One-paragraph summary so this file is the single entry point.

**Stack:** Next.js 16 (Workspace UI) -> Railway research-worker (Subagents) -> Anthropic API via **AI SDK v6**. The Workspace polls Supabase tables for live state. Skills are local `SKILL.md` files loaded into Subagent system instructions at worker boot via `_skill-loader.ts`. The accepted target is one structured **Artifact** per Section via **`streamObject(SectionArtifactSchema)`**, schema-enforced at the provider boundary and post-validated for cardinality minimums by the runner. The agent loop is **AI SDK v6's `ToolLoopAgent`** — provider-agnostic. Model swap should be a config change, not a skill rewrite (ADR-0003).

**Current implementation status (2026-05-15):**
- Section 01, **Market & Category Intelligence**, is ported to `MarketCategoryArtifactSchema`, `streamObject`, runner-side minimum validation, and a rewritten local Skill.
- Section 02, **Buyer & ICP Validation**, is ported to `BuyerICPArtifactSchema`, `streamObject`, runner-side minimum validation, and a rewritten local Skill.
- Sections 03-06, **Competitor Landscape & Positioning**, **Voice of Customer & Objection Evidence**, **Demand & Intent Signals**, and **Offer & Performance Diagnostic**, are ported to bespoke Artifact schemas, `streamObject`, runner-side minimum validation, and rewritten local Skills.
- The active Workspace currently polls `/api/research-v2/audit-state` and renders committed Section `title` / `markdown` from `research_artifact_sections`. Typed Card rendering is the target, not yet the live renderer for all Sections.

**Load-bearing pieces:**
- AI SDK v6 `ToolLoopAgent` — agent loop (`research-worker/src/agents/subagents/index.ts`)
- AI SDK v6 `streamObject(schema)` — typed Artifact output for ported Sections; Zod schemas in `research-worker/src/agents/subagents/schemas/`
- Local SKILL.md harness — `research-worker/platform-skills/<skill>/SKILL.md`, loaded by `_skill-loader.ts`
- Runner-side post-validate — enforces cardinality minimums (Anthropic rejects `.min()/.max()` on structured-output schemas); one retry with feedback on failure, then emit-with-gaps
- Per-Section bespoke schemas driven by `docs/research-sections.md` — no new generic envelope work
- Supabase persistence: `research_artifacts`, `research_section_runs`, `research_artifact_sections`, `research_section_events`
- Workspace UI: `AgentArtifactSurface` polls `/api/research-v2/audit-state`

**Anti-stack — accepted target for new work and completed ports:**
- ❌ No Anthropic Platform Skills `.zip` uploads (ADR-0003)
- ❌ No new `code_execution` tool / `validate.py` in-loop (ADR-0002)
- ❌ No new `Output.object` work with generic envelope (`findings + quotes + risks + moves`) (ADR-0002)
- ❌ No per-brick artifact-builder tools (`add_persona`, `set_verdict`) (ADR-0002, supersedes ADR-0001)
- ❌ No discriminated unions of Card types in arrays — each sub-section's array is homogeneous
- ❌ No Anthropic-specific patterns at the framework layer — AI SDK v6 abstractions throughout

Known drift: the Workspace still renders committed Section markdown for the full Audit. Typed Card rendering exists for selected paths and remains the next UI layer after the backend Artifact migration.

## Language

**Audit**:
The full user-facing deliverable for one company URL — six Sections combined into one workspace surface. The thing AI-GOS produces and (eventually) charges for.
_Avoid_: Report, research output, GTM doc

**Section**:
One of the six positioning research units that compose an Audit. The fixed set is: Market & Category Intelligence, Buyer & ICP Validation, Competitor Landscape & Positioning, Voice of Customer & Objection Evidence, Demand & Intent Signals, Offer & Performance Diagnostic. Each Section answers one strategic question and has a fixed set of named **sub-sections** per `docs/research-sections.md`.
_Avoid_: Card (a Card is a typed entry inside a sub-section), report, chunk, module

**Subagent**:
A `ToolLoopAgent` instance (AI SDK v6) that runs one Section. Each Subagent is bound to one Skill and a tool map of research tools. Ported Subagents also bind to one section-specific Artifact schema through the runner's `streamObject` step. Lives in `research-worker/src/agents/subagents/`.
_Avoid_: Agent (too generic — also describes the orchestrator), worker, runner

**Skill**:
A `SKILL.md` file under `research-worker/platform-skills/` that defines a Section's role, operating principles, workflow, anti-slop rules, and the Artifact schema the Subagent emits. The Skill is the spec; the Subagent is the runtime. Skills are loaded into Subagent instructions at worker boot via `_skill-loader.ts`.
_Avoid_: Prompt (skill is broader — includes workflow + schema), system message

**Artifact**:
The structured deliverable a ported Section produces — one typed object containing top-level scalars (`sectionTitle`, `verdict`, `statusSummary`, `confidence`, `sources`) and a set of named **sub-sections** matching the Section's canonical structure (per `docs/research-sections.md`). Each sub-section has its own `prose` markdown narrative and one or more homogeneous typed Card arrays, except explicit schema-owned single-object fields such as Market Category's `categoryMaturity.classification`. The Artifact IS the Section's target output. There is no new "report" or "envelope" contract.
_Avoid_: Report, card collection, markdown blob, envelope

**Sub-section**:
A named field on an Artifact that holds one piece of canonical analysis (e.g., `icpExistenceCheck`, `personaReality`, `awarenessDistribution`). Each sub-section is a typed object with its own `prose` markdown narrative and one or more homogeneous typed Card arrays. The set and ordering of sub-sections per Section is fixed by `docs/research-sections.md` — do not invent new sub-sections or collapse them.
_Avoid_: Block, section (Section is reserved for the 6 top-level units), part

**Prose**:
The free-form markdown narrative inside one sub-section of an Artifact. The Subagent writes paragraphs, headings, bullets, callouts — whatever the analysis calls for — into this field. There is no document-level prose blob; each sub-section has its own. Streams as tokens. Renders via the markdown renderer.
_Avoid_: Body, text, content (too generic)

**Card**:
One typed entry inside a sub-section's typed card array (e.g., `personaReality.personas`, `clusters.venues`). Each sub-section's card array is **homogeneous** — one Card type per array, no discriminated union of card types. Each Card has a typed shape defined by the Section's Artifact schema (e.g., `PersonaSchema`, `FirmographicCutSchema`). Card-level rendering in the Workspace is the target UI shape; the live Workspace still renders committed Section markdown for some flows.
_Avoid_: UI brick (prior name — do not use in new code), block, widget, component (too generic)

**Workspace**:
The user-facing UI surface where Audits are produced and viewed (`/research-v2`). Hosts the live Artifact panes per Section, the activity feed, and the Section-by-Section run controls.
_Avoid_: Dashboard, app, page

**Activity Event**:
A durable runtime fact emitted while a Subagent works on a Section: section start/completion, Skill load, research tool start/finish, structured output, validation, repair, sub-section commit, Artifact save, or failure. Activity Events live in `research_section_events`; the Workspace adapts them into the visible activity feed. They are operational trace, not Artifact content.
_Avoid_: Chat message, log line, progress copy, Artifact Card

**Pre-Pitch Positioning Audit**:
The productized name (per the locked April 29 strategic plan) for the Audit deliverable AI-GOS sells. The Audit IS the Pre-Pitch Positioning Audit; this is just the customer-facing label.
_Avoid_: Pitch deck, strategy doc

**Artifact-builder tool** _(deprecated)_:
Briefly proposed in ADR-0001 (one tool per UI brick), superseded by ADR-0002 (one `streamObject` call per Section). Each Section's Artifact is produced as a single structured output, not via per-brick tool calls. The Subagent's tool map contains only research tools (`web_search`, `firecrawl`, etc.); structure comes from the Artifact schema, not from tools.
_Avoid_: Use **Artifact** + **Sub-section** + **Card** instead.

**Envelope** _(deprecated)_:
Legacy generic `{verdict, statusSummary, findings, quotes, risks, moves, sources}` shape used as an `Output.object` final-output contract before the per-Section Artifact port. It forced every Section into the same flow regardless of its canonical structure. All six positioning Sections now target typed Artifacts; any remaining Envelope code is compatibility/cleanup residue, not a current runtime pattern for positioning output.
_Avoid_: Use Artifact + Sub-section instead.

## Relationships

- One **Audit** contains six **Sections** (fixed set, ordered)
- Each **Section** is produced by exactly one **Subagent**
- Each **Subagent** is bound to exactly one **Skill** and one research tool map
- Each **Subagent** emits **Activity Events** while producing a Section
- Each ported **Subagent** produces exactly one **Artifact** per run via a section-specific Artifact schema
- Each **Artifact** contains top-level scalars (`sectionTitle`, `verdict`, `statusSummary`, `confidence`, `sources`) and a fixed set of named **sub-sections** matching `docs/research-sections.md`
- Each **sub-section** has its own `prose` markdown narrative and one or more **homogeneous** typed Card arrays — no global discriminated union of Card types
- Each **Card** lives in exactly one sub-section's card array
- Ported Sections emit the Artifact via one runner-owned `streamObject(schema)` call after the evidence loop; structure comes from the schema, not from individual tool calls
- The **Workspace** renders one Audit at a time, with one Artifact pane per Section
- Any remaining `PositioningEnvelopeSchema` references are cleanup residue after the six-Section Artifact port; new positioning work should use Section-specific Artifact schemas

## Example dialogue

> **Dev:** "Where do I add a new persona-related field in BuyerICP?"
>
> **Domain expert:** "Depends on what the field is. If it's per-persona info that belongs on the persona card itself, add it to `PersonaSchema` — that's the typed Card used in the `personaReality.personas` array. If it's a new piece of canonical analysis that has its own sub-section in `docs/research-sections.md`, add a new named sub-section to the BuyerICP Artifact schema with its own `prose` and typed card array. Never invent a sub-section that's not in `docs/research-sections.md` — the canonical spec drives sub-section structure."
>
> **Dev:** "What about the verdict at the top of the Section?"
>
> **Domain expert:** "Verdict is a top-level scalar on the Artifact, not a Card and not a sub-section. The Artifact schema has explicit top-level slots for `title`, `verdict`, `confidence`, `sources`. Everything else lives inside a named sub-section."
>
> **Dev:** "What about evidence quotes or risks — there's no quotes sub-section."
>
> **Domain expert:** "Right. The old envelope had cross-cutting `findings/quotes/risks/moves` arrays — that's deprecated. Evidence quotes live inside the sub-section they support (e.g., a verbatim pain quote belongs in `personaReality.prose` as a blockquote or attached to a persona Card). Risks and recommended moves come out of the verdict or inline in sub-section prose. If a Section's canonical spec doesn't call for a separate quotes/risks sub-section, don't invent one."
>
> **Dev:** "And the live activity feed — is that a separate stream?"
>
> **Domain expert:** "Different stream, different view. The activity feed shows research tool calls (`web_search`, `firecrawl`) the Subagent makes while gathering evidence. For ported Sections, the runner then converts the evidence transcript into one typed Artifact with `streamObject`. The current Workspace commits and renders Section markdown; the typed Card renderer is the target next layer."

## Flagged ambiguities

- **"card"** historically meant Section, UI element, AND Workspace UI panels. **Resolved:** **Card** (capitalized) means one typed entry inside a sub-section's typed card array. Sections are "Sections." Sub-sections are "sub-sections." Workspace UI containers are "panes."
- **"UI brick"** was the prior name for Card (ADR-0001). **Resolved:** Use **Card**. Do not use "UI brick" in new code.
- **"report"** historically meant a Section's markdown output. **Resolved:** Deprecated alongside Envelope. Sections produce **Artifacts**, not reports.
- **"agent"** historically meant both Subagents and the parent orchestrator. **Resolved:** **Subagent** for the section-runners. **Orchestrator** for the parent that dispatches and aggregates.
- **"skill"** historically meant Anthropic Platform Skills (uploaded `.zip` packages) AND the local `SKILL.md` files. **Resolved:** **Skill** in this codebase means the local `SKILL.md` file consumed by a Subagent inside the research-worker. Per ADR-0003, Anthropic Platform Skills are NOT a current distribution channel — the `.zip` files under `platform-skills/*.zip` are dead artifacts.
- **"artifact-builder tool"** was a briefly-lived term from ADR-0001. **Resolved:** Deprecated. Use **Artifact** + **Sub-section** + **Card** instead.
- **"envelope"** is deprecated terminology — use **Artifact**. Envelope is documented above only because legacy code still references it during migration.
- **"findings / quotes / risks / moves"** were generic cross-cutting arrays in the old envelope. **Resolved:** Deprecated. Each Section's content is shaped by its canonical sub-sections in `docs/research-sections.md` — generic cross-cutting arrays are no longer used.
