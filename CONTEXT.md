# AI-GOS Domain Context

AI-GOS is a Manus-for-GTM-SaaS product: a user submits a company URL and receives a deeply researched **Pre-Pitch Positioning Audit** — six positioning **Sections** plus a terminal paid-media plan Section, produced by autonomous **Subagents** and presented in the **Workspace** as a readable **Audit**.

This document is the project glossary. It defines the domain terms that load-bear the codebase. Implementation details belong in `docs/architecture/`; design decisions belong in `docs/adr/`. The canonical sub-section structure for each Section lives in `docs/research-sections.md` and overrides any conflicting interpretation here.

## Technical approach (summary)

> Current as of 2026-05-29: the runtime is the in-process lab engine in `src/lib/lab-engine/`. The 2026-05-14 worker-subagent / `streamObject` target described in `docs/architecture/2026-05-14-positioning-audit-stack.md` is superseded for the v3 path.

**Stack:** Next.js 16 (Workspace UI) -> in-process lab engine (`src/lib/lab-engine/`) for the six positioning Sections plus `positioningPaidMediaPlan` -> Supabase. The Railway research-worker remains for the shared `deepResearchProgram` corpus (Perplexity sonar, ADR-0007), product identity resolution, and meeting extraction. The Workspace polls Supabase tables and `/api/research-v2/audit-state` for live state.

**Section runtime:** Sections enter through `src/app/api/research-v2/orchestrate/route.ts`, fan out with `Promise.allSettled` over all six positioning IDs, then call `src/app/api/research-v2/run-lab-section/route.ts`. The section runner is `src/lib/lab-engine/agents/run-section.ts` -> `runSectionViaAnswerTool`, with provider-agnostic AI SDK v6 model selection (`LAB_ENGINE_PROVIDER`; current runtime selects DeepSeek), local Skills from `src/lib/lab-engine/skills/`, Brave-backed `web_search`, section allowlisted tools, structural verification, required-evidence gates, and evidence-support repair.

**Current implementation status (2026-05-29):**
- Sections 01-06 and the terminal `positioningPaidMediaPlan` use lab-engine Artifact schemas under `src/lib/lab-engine/artifacts/schemas/`.
- The active reader is `/research-v3` / `AuditReaderShell`, backed by `research_artifacts`, `research_section_runs`, `research_artifact_sections`, and `research_section_events`.
- New audit kickoffs send `executionMode: 'lab'`; `/api/research-v2/orchestrate` only accepts optional `executionMode: 'lab'`.
- There are no waves in the current fan-out. Every positioning Section is kicked off in parallel and reports per-section phase/tool/source activity.
- Managed Agents runtime, webhook, AND the schemas mirror were all removed — no `src/lib/managed-agents/` directory remains. Section schemas live in `src/lib/lab-engine/artifacts/schemas/`.

**Load-bearing pieces:**
- Lab answer-tool path — `src/lib/lab-engine/agents/run-section.ts` -> `runSectionViaAnswerTool`
- Provider selection — `src/lib/lab-engine/ai/models.ts` (`anthropic`, `deepseek-direct`, `deepseek-ollama`)
- Lab Skills — `src/lib/lab-engine/skills/<skill>/SKILL.md`
- Lab Artifact schemas — `src/lib/lab-engine/artifacts/schemas/`
- Lab verification — `src/lib/lab-engine/agents/verification/structural-verifier.ts` and `evidence-support.ts`
- Lab tools — `src/lib/lab-engine/agents/tools/`, including Brave `web_search`
- Worker corpus — `research-worker/src/runners/deep-research-program.ts` on Perplexity sonar
- Supabase persistence: `research_artifacts`, `research_section_runs`, `research_artifact_sections`, `research_section_events`
- Workspace UI: `AuditReaderShell` polls `/api/research-v2/audit-state`

**Anti-stack — accepted target for new work and completed ports:**
- ❌ No Anthropic Platform Skills `.zip` uploads (ADR-0003)
- ❌ No new `code_execution` tool / `validate.py` in-loop (ADR-0002)
- ❌ No new `Output.object` work with generic envelope (`findings + quotes + risks + moves`) (ADR-0002)
- ❌ No per-brick artifact-builder tools (`add_persona`, `set_verdict`) (ADR-0002, supersedes ADR-0001)
- ❌ No discriminated unions of Card types in arrays — each sub-section's array is homogeneous
- ❌ No Anthropic-specific patterns at the framework layer — AI SDK v6 abstractions throughout
- ❌ No worker-owned positioning Subagent runtime on the v3 path — section execution is in-process lab engine
- ❌ No managed-agents runtime, webhook, or schemas mirror — the entire `src/lib/managed-agents/` tree is gone
- ❌ No wave scheduler or wave telemetry — use per-section phase/tool/source activity
- ❌ No ad-scripts product path — ADR-0009 removed scripts from the Audit scope

## Language

**Audit**:
The full user-facing deliverable for one company URL — six positioning Sections plus the paid-media plan combined into one reader surface. The thing AI-GOS produces and (eventually) charges for.
_Avoid_: Report, research output, GTM doc

**Section**:
One of the six positioning research units that compose an Audit. The fixed set is: Market & Category Intelligence, Buyer & ICP Validation, Competitor Landscape & Positioning, Voice of Customer & Objection Evidence, Demand & Intent Signals, Offer & Performance Diagnostic. Each Section answers one strategic question and has a fixed set of named **sub-sections** per `docs/research-sections.md`.
_Avoid_: Card (a Card is a typed entry inside a sub-section), report, chunk, module

**Subagent**:
A lab-engine section agent that runs one Section through the answer-tool path. Each Subagent is bound to one Skill, one section definition, one Artifact schema, and an allowlisted tool map. Current Subagents live in `src/lib/lab-engine/agents/`; the section-specific schemas live in `src/lib/lab-engine/artifacts/schemas/`.
_Avoid_: Agent (too generic — also describes the orchestrator), worker, runner

**Skill**:
A `SKILL.md` file under `src/lib/lab-engine/skills/` that defines a Section's role, operating principles, workflow, anti-slop rules, and the Artifact schema the Subagent emits. The Skill is the spec; the Subagent is the runtime. Skills are loaded by the lab engine when a section run starts.
_Avoid_: Prompt (skill is broader — includes workflow + schema), system message

**Artifact**:
The structured deliverable a Section produces — one typed object containing top-level scalars (`sectionTitle`, `verdict`, `statusSummary`, `confidence`, `sources`) and a set of named **sub-sections** matching the Section's canonical structure (per `docs/research-sections.md`). Each sub-section has its own `prose` markdown narrative and one or more homogeneous typed Card arrays, except explicit schema-owned single-object fields such as Market Category's `categoryMaturity.classification`. The Artifact IS the Section's target output. There is no new "report" or "envelope" contract.
_Avoid_: Report, card collection, markdown blob, envelope

**Sub-section**:
A named field on an Artifact that holds one piece of canonical analysis (e.g., `icpExistenceCheck`, `personaReality`, `awarenessDistribution`). Each sub-section is a typed object with its own `prose` markdown narrative and one or more homogeneous typed Card arrays. The set and ordering of sub-sections per Section is fixed by `docs/research-sections.md` — do not invent new sub-sections or collapse them.
_Avoid_: Block, section (Section is reserved for the 6 top-level units), part

**Prose**:
The free-form markdown narrative inside one sub-section of an Artifact. The Subagent writes paragraphs, headings, bullets, callouts — whatever the analysis calls for — into this field. There is no document-level prose blob; each sub-section has its own. Streams as tokens. Renders via the markdown renderer.
_Avoid_: Body, text, content (too generic)

**Card**:
One typed entry inside a sub-section's typed card array (e.g., `personaReality.personas`, `clusters.venues`). Each sub-section's card array is **homogeneous** — one Card type per array, no discriminated union of card types. Each Card has a typed shape defined by the Section's Artifact schema (e.g., `PersonaSchema`, `FirmographicCutSchema`). Card-level rendering in the reader is the current UI shape for lab Artifacts.
_Avoid_: UI brick (prior name — do not use in new code), block, widget, component (too generic)

**Workspace**:
The user-facing UI surface where Audits are produced and viewed (`/research-v3`, with shared APIs under `/api/research-v2`). Hosts the live Artifact panes per Section, the activity feed, rerun controls, and paid-media terminal section.
_Avoid_: Dashboard, app, page

**Activity Event**:
A durable runtime fact emitted while a Subagent works on a Section: section start/completion, Skill load, research tool start/finish, structured output, validation, repair, sub-section commit, Artifact save, or failure. Activity Events live in `research_section_events`; the Workspace adapts them into the visible activity feed. They are operational trace, not Artifact content.
_Avoid_: Chat message, log line, progress copy, Artifact Card

**Pre-Pitch Positioning Audit**:
The productized name (per the locked April 29 strategic plan) for the Audit deliverable AI-GOS sells. The Audit IS the Pre-Pitch Positioning Audit; this is just the customer-facing label.
_Avoid_: Pitch deck, strategy doc

**Corpus**:
The shared research base produced by the `deepResearchProgram` pass on the Railway worker (Perplexity sonar, ADR-0007) before the six positioning Sections fan out through the lab engine. Holds company facts, category, a research summary, cited sources, and evidence excerpts, plus the auto-prefilled onboarding fields. The Corpus is the common ground every Subagent starts from; the deep, section-specific evidence is gathered live in-section (ADR-0006), not in the Corpus.
_Avoid_: Deep research, pre-research, context dump

**GTM Brief**:
The user-confirmed `OnboardingV2Data` — the canonical answer set (7 GTM question sections, ADR-0008) that the user reviews and edits after the Corpus auto-prefills it, then submits to launch the Audit fan-out. Frozen at submit as `gtmBriefReview` / `researchV2OnboardingReview` and passed to every Subagent.
_Avoid_: Onboarding data (the Brief is the confirmed result), form, questionnaire

**Onboarding**:
The single corpus-fed front door of an Audit (ADR-0008): the rich multi-step wizard shell rendering `OnboardingV2Data`, asking exactly the canonical GTM questions, with file/transcript upload at entry. There is one Onboarding — the prior split between the rich `OnboardingFormData` wizard and `OnboardingWizardV2` is collapsed. Produces the GTM Brief.
_Avoid_: Wizard (one UI of it), sign-up, account onboarding

**Media Plan Setup**:
A dedicated Onboarding step, separate from the 7 GTM question sections, that collects the paid-media inputs — `salesProcessDocs`, `salesLoomUrl`, `creativeCapacity`, `leadListAvailable` — that feed the 7th `positioningPaidMediaPlan` synthesis Section (ADR-0005), not the 6 positioning Sections.
_Avoid_: Media plan (that is the output Section), ad setup

**Artifact-builder tool** _(deprecated)_:
Briefly proposed in ADR-0001 (one tool per UI brick), superseded by ADR-0002 and then by the current answer-tool lab path. Each Section's Artifact is produced as a single structured output, not via per-brick tool calls. The Subagent's tool map contains only research tools (`web_search`, `firecrawl`, etc.); structure comes from the Artifact schema, not from tools.
_Avoid_: Use **Artifact** + **Sub-section** + **Card** instead.

**Envelope** _(deprecated)_:
Legacy generic `{verdict, statusSummary, findings, quotes, risks, moves, sources}` shape used as an `Output.object` final-output contract before the per-Section Artifact port. It forced every Section into the same flow regardless of its canonical structure. All six positioning Sections now target typed Artifacts; any remaining Envelope code is compatibility/cleanup residue, not a current runtime pattern for positioning output.
_Avoid_: Use Artifact + Sub-section instead.

## Relationships

- One **Audit** contains six positioning **Sections** plus the terminal `positioningPaidMediaPlan` Section
- Each **Section** is produced by exactly one **Subagent**
- Each **Subagent** is bound to exactly one **Skill** and one research tool map
- Each **Subagent** emits **Activity Events** while producing a Section
- Each **Subagent** produces exactly one **Artifact** per run via a section-specific Artifact schema
- Each **Artifact** contains top-level scalars (`sectionTitle`, `verdict`, `statusSummary`, `confidence`, `sources`) and a fixed set of named **sub-sections** matching `docs/research-sections.md`
- Each **sub-section** has its own `prose` markdown narrative and one or more **homogeneous** typed Card arrays — no global discriminated union of Card types
- Each **Card** lives in exactly one sub-section's card array
- Sections emit the Artifact via the lab answer-tool path after the evidence loop; structure comes from the schema, not from individual tool calls
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
> **Domain expert:** "Different stream, different view. The activity feed shows research tool calls (`web_search`, `firecrawl`) the Subagent makes while gathering evidence. The lab runner then converts the evidence transcript into one typed Artifact through the answer-tool path and verifier/repair loop. The current reader renders typed Cards from committed Artifacts."

## Flagged ambiguities

- **"card"** historically meant Section, UI element, AND Workspace UI panels. **Resolved:** **Card** (capitalized) means one typed entry inside a sub-section's typed card array. Sections are "Sections." Sub-sections are "sub-sections." Workspace UI containers are "panes."
- **"UI brick"** was the prior name for Card (ADR-0001). **Resolved:** Use **Card**. Do not use "UI brick" in new code.
- **"report"** historically meant a Section's markdown output. **Resolved:** Deprecated alongside Envelope. Sections produce **Artifacts**, not reports.
- **"agent"** historically meant both Subagents and the parent orchestrator. **Resolved:** **Subagent** for the section-runners. **Orchestrator** for the parent that dispatches and aggregates.
- **"skill"** historically meant Anthropic Platform Skills (uploaded `.zip` packages) AND the local `SKILL.md` files. **Resolved:** **Skill** in this codebase means the local `SKILL.md` file consumed by a lab-engine Subagent. Per ADR-0003, Anthropic Platform Skills are NOT a current distribution channel — the `.zip` files under `platform-skills/*.zip` are dead artifacts.
- **"artifact-builder tool"** was a briefly-lived term from ADR-0001. **Resolved:** Deprecated. Use **Artifact** + **Sub-section** + **Card** instead.
- **"envelope"** is deprecated terminology — use **Artifact**. Envelope is documented above only because legacy code still references it during migration.
- **"findings / quotes / risks / moves"** were generic cross-cutting arrays in the old envelope. **Resolved:** Deprecated. Each Section's content is shaped by its canonical sub-sections in `docs/research-sections.md` — generic cross-cutting arrays are no longer used.
