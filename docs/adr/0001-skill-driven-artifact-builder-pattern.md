---
status: superseded
date: 2026-05-14
superseded-by: 0002
---

> **Superseded by [ADR-0002](./0002-single-structured-output-per-section.md)** (same day). Prior-art research found that no leading product (Anthropic multi-agent research, Vercel v0, Manus, Claude artifacts, OpenAI Canvas) uses per-brick tool calls for sectioned text+cards research artifacts — they converge on one structured output per section. Three of the four blockers cited below are prompt-engineering issues, not architecture issues; only Blocker A is architectural, and it's addressable with a small post-validate. Kept here for historical context.

# Skill-driven artifact-builder pattern for positioning Sections

Each positioning **Subagent** produces its **Section's** output as a live **Artifact** built incrementally via **artifact-builder tools** the agent calls during its loop — not via a Zod `Output.object` final-output schema. The **Skill** (`SKILL.md`) is the spec for which artifact-builder tools the Subagent uses; AI SDK v6's `ToolLoopAgent` + `createAgentUIStreamResponse` is the runtime. We picked this pattern because it's how Manus, Claude artifacts, and Anthropic's own multi-agent research system produce rich live deliverables, and because the four blockers we hit on the prior `Output.object` + per-section Zod schema path (see "Considered Options") are dissolved rather than worked around.

## Considered Options

- **`Output.object(PerSectionZodSchema)` per Subagent** — The agent emits one structured payload at the end of the loop, schema-enforced. Rejected after the May 14 BuyerICP pilot demonstrated four blockers: (A) the agent satisfies cardinality-restricted arrays with `[]` and considers itself done, because Anthropic rejects `.min()/.max()` on structured-output schemas; (B) the agent ignores any in-skill validation workflow because the schema-emit step is the natural stop signal; (C) inner monologue leaks into structured output fields ("Now I have enough data, let me write the validator…" appearing as the verdict); (D) prompt injection demanding non-empty arrays makes results worse, not better. The 27/24-optional-parameter grammar limit also caps schema richness in a way that doesn't apply to per-tool `inputSchema` definitions.

- **`Output.object` envelope + per-section rich-field extension** — The shape we shipped briefly: small `PositioningEnvelopeSchema` as the schema-of-record, plus rich BuyerICP fields harvested from `validate.py` stdout via `code_execution`. Rejected because the agent never invoked `validate.py` (Blocker B), the rich fields landed empty in production, and the dual-contract dance added significant complexity for output that was invisible to the user (the markdown formatter never read the rich fields).

- **Free-form markdown + post-hoc extraction** — Agent emits markdown; a second LLM call extracts structured fields for storage and rendering. Rejected because markdown can't render the rich card content the deliverable needs (competitor ad cards with screenshots, persona cards with linked sourceUrls, awareness funnel charts) without additional structure on top, and the extraction call adds cost without removing the need for a structured artifact format.

- **Markdown with embedded `{{component:Card data={…}}}` blocks** — MDX-style hybrid. Rejected as half-skill-driven, half-structured: still requires a per-component-type schema, still requires a renderer, but loses the live-streaming property and adds a parsing layer.

## Consequences

- The schema-of-record concept is gone. There is no Zod schema that gates a Subagent's "done" state. The Subagent is done when it stops calling tools (governed by `stopWhen: stepCountIs(N)`).
- Tool definitions ARE the schema. Each artifact-builder tool's `inputSchema` is the typed shape of one UI brick. `BuyerICPSectionSchema` is preserved as the spec for which tools BuyerICP needs (its element types `PersonaSchema`, `FirmographicCutSchema`, etc. become tool `inputSchema`s) but no longer used as `Output.object`.
- The activity feed and the Artifact pane are two views of the same stream of tool calls. Research tool calls render as activity events; artifact-builder tool calls render as both activity events AND UI bricks.
- Skill prompt-engineering rule, learned from Blocker D: write skill workflows descriptively ("call `add_persona_card` for each persona with evidence; flag the gap if thin"), never with capitalized threats or "CRITICAL — failure if X" language.
- Implementation order: BuyerICP spike first (~10 artifact tools, no abstractions, pilot eval validates the pattern), then replicate to the other 5 Sections one at a time. Shared primitives factored out only at the second port, not before.
- The `Envelope` term is deprecated; new code does not produce or consume Envelopes. Existing envelope code is removed as each Section is ported to the artifact-builder pattern.
