# Journey AI Layer Architecture - 2026-05-07

## Decision

`/journey` is the canonical AI product layer for the new workflow.

Do not move this flow to a new `/gtm` runtime. The swap is behind `/journey`: keep the user-facing Journey workspace and replace the older backend assumptions with a skill/tool/API-backed research layer.

## Product Flow

```text
link entry on /journey
  -> deep research starts
  -> research-derived context is created automatically
  -> central Manus/Codex-style workspace opens
  -> Vercel AI SDK chat agent edits and explains artifacts
  -> deep research artifacts are generated from the shared corpus
```

The user should not be forced through the old manual extracted-field review gate before the workspace becomes useful. Context corrections should happen inside the workspace chat when possible.

## Runtime Ownership

### `/journey` app layer

Owns:

- the link-entry surface
- workspace state and artifact display
- chat rail and edit-by-chat UX
- user-visible progress and source/corpus references
- section review, revision, and downstream actions

This layer should remain built around the Vercel AI SDK architecture already in the repo:

- `useChat`
- `DefaultChatTransport`
- `/api/journey/stream`
- UI message streams
- AI SDK tools for workspace actions such as editing cards or updating fields

If this layer becomes a formal AI SDK agent, use the AI SDK v6 `ToolLoopAgent` pattern and stream it with `createAgentUIStreamResponse`. Do not replace the Journey chat/workspace shell with raw worker output.

### Research backend layer

Owns:

- broad company/category research
- use of Anthropic web search, code execution, platform skills, and external APIs
- shared research corpus construction
- section artifact synthesis from the corpus
- writeback to `journey_sessions.research_results`

This backend can keep living in `research-worker/` while it is being swapped. The worker is an implementation detail behind `/api/journey/dispatch`, not a new user-facing product route.

## Agent Architecture

Use a simple two-layer split:

```text
Vercel AI SDK Journey agent
  - talks to the user
  - edits artifacts
  - explains sources and gaps
  - triggers/observes research jobs when needed

Deep Research Agent / worker
  - uses skills, tools, APIs, and web search
  - writes durable corpus and artifacts
  - reports progress in product-facing terms
```

This follows the Anthropic agent guidance: keep the design simple, expose planning/progress clearly, invest in tool descriptions, and persist artifacts instead of passing large research outputs through a coordinator chat transcript.

## Prompt Enforcement For Now

Do not hard schema-force the deep research section cards yet.

For this phase:

- validate API inputs, dispatch envelopes, run IDs, and persistence shapes
- require valid JSON enough for parsing and artifact writeback
- prompt-enforce the section quality, evidence standards, source coverage, and corpus shape
- preserve raw text, telemetry, citations, source gaps, and confidence notes
- fail loudly when the worker cannot produce usable JSON or artifacts

Avoid fake completeness. If a section is thin, the artifact should say what evidence is missing.

Later, after the prompts stabilize, add stricter Zod validation around the shared corpus and section cards. That should be a hardening pass, not the first architecture move.

## Skills And Tools

The research backend should receive access to:

- Anthropic web search for current source discovery
- Anthropic platform skills for GTM section methods
- code execution where it helps inspect or transform evidence
- external APIs where keys exist and the source is appropriate

Tool and skill descriptions matter. Each tool should have a distinct purpose, clear input boundaries, and obvious failure behavior. Do not hide tool failures or silently fill gaps with model guesses.

## Section Contract

Use the workspace boundary keys in the `/journey` UI:

- `industryMarket`
- `icpValidation`
- `competitors`
- `offerAnalysis`
- `keywordIntel`
- `crossAnalysis`
- `mediaPlan`

Canonical stored keys may still exist for compatibility:

- `industryResearch`
- `competitorIntel`
- `strategicSynthesis`

Every cold-start and realtime consumer must normalize canonical keys back to workspace boundary keys before rendering. Do not introduce a second visible section taxonomy.

## Chat Contract

There should be one workspace chat backend contract across desktop and mobile.

Target:

- desktop and mobile chat both use the same Journey workspace chat API
- chat has access to active section, current cards, shared corpus, and run ID
- edit actions update artifacts through explicit tools
- chat does not launch hidden duplicate per-section research jobs

The existing Vercel AI SDK stream route can stay the integration point, but its prompt must match the new product model: workspace assistant, artifact editor, source explainer, and research observer.

## What To Remove Or Bypass

- primary-route manual extracted-field review gate
- stale Journey prompt text that says research is both disabled and tool-triggered
- separate desktop/mobile chat APIs
- old per-section dispatch helpers in the primary link-entry flow
- progress displays that collapse the entire deep research run into one opaque job

## Acceptance

Do not claim this flow is wired until one fresh run proves:

```text
/journey link entry
  -> prefill/deep research starts
  -> workspace opens without manual field-review detour
  -> deep research worker accepts the job
  -> skills/tools/API-backed research completes
  -> shared corpus is persisted
  -> six section artifacts hydrate in the workspace
  -> desktop and mobile chat use the same backend contract
  -> chat can edit the active artifact without losing citations or assumptions
```

## Open Alignment Questions

1. Should `mediaPlan` remain an explicit user-triggered downstream step, or should the deep research run generate an initial media-plan draft after the six research sections?
2. Should the homepage `/` redirect to `/journey`, or should `/` remain marketing while `/journey` stays the authenticated product launcher?
3. Which external APIs are approved for the first backend swap besides Anthropic web search and the uploaded AI-GOS platform skills?
