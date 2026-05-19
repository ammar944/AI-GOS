---
status: accepted
date: 2026-05-14
supersedes: 0001
---

# Single structured output per Section

Each positioning **Subagent** produces its **Section's** **Artifact** as a single structured output via AI SDK v6's `streamObject(schema)` call. The Artifact's typed shape includes top-level scalars (`title`, `verdict`, `confidence`, `sources`) and a set of named **sub-sections matching that Section's canonical structure** (per `docs/research-sections.md`). Each sub-section contains its own `prose` markdown narrative and one or more **homogeneous** typed Card arrays — one Card type per array, no global discriminated union of Card types. The Subagent does not call per-brick "artifact-builder" tools; structure comes from the schema, not from individual tool calls. We picked this pattern because every surveyed product that produces sectioned text+cards research artifacts converges on it (Anthropic's multi-agent research, OpenAI Canvas, Vercel v0, Claude artifacts, Manus), and because the four blockers ADR-0001 cited against this pattern are addressable without changing architecture — three are prompt-engineering issues; one is a small post-validate.

## Considered Options

- **Per-brick artifact-builder tools** (ADR-0001) — The Subagent calls ~12 typed tools (`add_persona`, `set_verdict`, etc.), each emitting one UI brick. Rejected here after prior-art research found no leading product uses this pattern for sectioned research artifacts. ADR-0001's four blocker motivations were largely prompt issues (capitalized threats, inner monologue leaks, validator-skipping) rather than architecture issues; only Blocker A (empty arrays for cardinality-restricted fields) was architectural, and it is addressable with a post-validate inside the runner rather than a re-architecture.

- **MDX-style markdown with embedded `{{component:Card data={…}}}` blocks** — Already rejected by ADR-0001 and still rejected. Requires a custom parser, conflates prose and structure at the string level, can't stream cleanly.

- **Manus-style mutation tool calls** (`updateArtifact({path, value})` events on a state tree) — Each mutation patches a node. Rejected because (a) 4 of 5 surveyed products do this with a single structured output instead, (b) it forces the Subagent to think in terms of "what should I patch next?" rather than "what does this Section contain?", (c) `streamObject` already gives us live-rendering inside one structured call.

- **Free-form markdown + post-hoc extraction** — Already rejected by ADR-0001 and still rejected. Extraction call adds cost without removing the need for a structured shape.

## Consequences

- Each Section's Artifact schema is **bespoke** — its sub-sections come from the canonical spec at `docs/research-sections.md`, not from a generic envelope template. Example for BuyerICP (the 5 bullets in Section 02): `icpExistenceCheck`, `personaReality`, `awarenessDistribution`, `buyingContext`, `clusters`. Each sub-section has its own `prose` (markdown) and one or more homogeneous typed Card arrays (e.g., `personaReality.personas: PersonaSchema[]`).
- The generic envelope fields (`findings`, `quotes`, `risks`, `moves`) are NOT cross-cutting top-level arrays anymore. Content that fits those categories lives inside the relevant sub-section's prose or as a typed Card type defined by that sub-section. If a Section's canonical spec doesn't call for a separate quotes/risks sub-section, do not invent one.
- Every sub-section's Card array is **homogeneous** — one Card type per array (e.g., `clusters.venues: ClusterSchema[]`). There is no global discriminated union of Card types. Anthropic structured-output handles homogeneous typed arrays substantially more reliably than discriminated unions in arrays, which is the empirical motivation for this rule.
- Shared schema primitives across the 6 Sections are intentionally minimal: `SourceSchema` (used in every Section's top-level `sources`), and the shared top-level shape (`title`, `verdict`, `confidence`, `sources`). Each Section's sub-sections and Card types are otherwise bespoke. No shared "Card union" exists.
- The Subagent's tool map contains research tools only (`web_search`, `firecrawl`, `reviews`, etc.). No artifact-builder tools.
- Subagent produces output via `streamObject(SectionArtifactSchema)`. Frontend receives partial objects via SSE and renders incrementally — title first, then each sub-section populates (its prose streams in, then its cards arrive).
- Blocker A (empty arrays for cardinality-restricted fields) is handled by a post-`streamObject` validator in the runner: it checks minimums per sub-section (e.g., `personaReality.personas.length >= 5`) against the same rules SKILL.md describes. If minimums aren't met, the runner either retries the Subagent with a feedback message or flags the gap inline (typically in the sub-section's prose). Cardinality cannot be encoded in the schema because Anthropic structured-output rejects `.min()/.max()` on Zod numbers/arrays passed in; use `.describe()` to communicate the rule to the model and enforce in code.
- Blockers B/C/D (validator-skipping, inner-monologue leaks into fields, capitalized threats) are prompt-engineering concerns and are addressed by SKILL.md rewrites per-Section, not by the architecture. Each Skill must be rewritten to (1) remove plan-validate-emit-envelope language, (2) describe the Artifact's sub-sections and what each one analyzes per `docs/research-sections.md`, (3) describe each Card type used and when to emit it, (4) drop capitalized threats per ADR-0001's prompt-writing rule.
- The "artifact-builder tool" term is deprecated. The "UI brick" term is renamed to **Card**. **Sub-section** is introduced as a named field on an Artifact that groups one piece of canonical analysis. CONTEXT.md updated in the same change as this ADR.
- Implementation order: BuyerICP spike first (one `BuyerICPArtifactSchema` with 5 named sub-sections matching the canonical bullets in Section 02 of `docs/research-sections.md`, one Subagent rewrite, one renderer that walks the 5 sub-sections, one post-validate). Replicate to the other 5 Sections one at a time, each driven by its own canonical sub-section list. Only `SourceSchema` and the top-level `{title, verdict, confidence, sources}` shape are factored as shared primitives at port #1.

## 2026-05-16 Runtime Refinement

This ADR remains accepted for deep/final Section Artifacts, but the latest
Research V2 E2E changes how draft mode should apply it.

Observed failure:

- Draft mode skipped the broad evidence loop but still emitted the full typed
  Section Artifact schema.
- Raising draft timeout to 180 seconds did not make that path reliable.
- All six draft sections timed out in the orchestration test and no draft
  artifact committed.

Refined decision:

- Deep mode keeps this ADR exactly: one full `streamObject(SectionArtifactSchema)` per Section after evidence gathering.
- Draft mode is allowed, and now expected, to use a thinner structured output:
  `streamObject(PositioningSectionDraftSchema)` or thin per-section draft schemas.
- The draft object is still structured and Zod-validated, but it is not the full
  canonical Section Artifact. It should contain a compact thesis, 3-5 findings,
  source refs or source gaps, capability/evidence gaps, confidence, and deep-fill
  targets.
- Deep enrichment later supersedes the draft through revisioned persistence and
  produces the full Section Artifact described by this ADR.

Rationale:

- The product needs first useful committed output before full deep synthesis.
- A full typed Artifact with every sub-section is too large for the first-pass
  runtime contract.
- This is not a reversal to free-form markdown or artifact-builder tools. It is
  a mode split between thin structured draft and full structured deep output.

External references reviewed for the refinement:

- AI Hero Vercel AI SDK Tutorial: https://www.aihero.dev/vercel-ai-sdk-tutorial
- AI Hero Streaming Objects: https://www.aihero.dev/streaming-objects-with-vercel-ai-sdk
- AI Hero Agents With Vercel AI SDK: https://www.aihero.dev/agents-with-vercel-ai-sdk
- AI Hero Evals: https://www.aihero.dev/what-are-evals
- AI Hero Choosing an LLM: https://www.aihero.dev/how-to-choose-an-llm
