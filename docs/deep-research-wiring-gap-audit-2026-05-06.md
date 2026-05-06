# AI-GOS Deep Research Wiring Gap Audit - 2026-05-06

## Status

This is a research-only audit. No app runtime fix is part of this document.

2026-05-07 decision update: `/journey` is the canonical AI layer for the new product flow. Do not move this workflow to a new `/gtm` runtime. Keep the Vercel AI SDK workspace/chat architecture on `/journey`, and swap the backend behind it so deep research can use Anthropic skills, tools, web search, code execution, and approved APIs.

The target product flow is:

```text
link entry -> deep research -> auto-filled context -> central Manus/Codex-style GTM workspace -> section synthesis/edit-by-chat
```

Current verdict: partially wired. The one-pass `deepResearchProgram` exists and reaches the Railway worker, but the product is still held together by older Journey assumptions, `journey_sessions`, mixed chat APIs, and inconsistent section-key contracts. Treat this as a gap map before implementation, with `/journey` now explicitly chosen as the route to keep.

2026-05-07 00:38 PKT implementation alignment: desktop and mobile workspace chat now target `/api/journey/stream`, the stream route has an explicit Manus-for-GTM workspace directive, and the Vercel AI SDK tool list includes `runDeepResearchProgram` for user-requested deeper research. The remaining proof gate is runtime E2E with real provider/env credentials.

## What Is Wired

1. `/journey` is the current link-entry surface.
   - `src/app/journey/page.tsx:394` initializes the Journey phase state.
   - `src/app/journey/page.tsx:2225` renders `JourneyManusWelcome`.
   - `src/app/journey/page.tsx:2231` submits the website/LinkedIn prefill request and enters `prefilling`.

2. Website prefill is connected.
   - `src/hooks/use-journey-prefill.ts:67` posts to `/api/journey/prefill`.
   - `src/app/api/journey/prefill/route.ts:32` validates the URL inputs and calls `runCompanyResearch`.

3. Prefill completion can launch the central workspace and deep research.
   - `src/app/journey/page.tsx:1526` switches directly to `journeyPhase='workspace'`.
   - `src/app/journey/page.tsx:1534` builds the research context from accepted fields.
   - `src/app/journey/page.tsx:1561` dispatches `dispatchDeepResearchProgram(...)`.
   - `src/app/journey/page.tsx:1579` auto-accepts link-derived fields after prefill completes.

4. One shared deep-research dispatch exists.
   - `src/lib/journey/dispatch-client.ts:219` sends section `deepResearchProgram`.
   - `src/app/api/journey/dispatch/route.ts:83` maps `deepResearchProgram` to worker tool `runDeepResearchProgram`.
   - `research-worker/src/index.ts:99` registers `runDeepResearchProgram` in `TOOL_RUNNERS`.

5. The worker has a one-pass deep-research runner.
   - `research-worker/src/runners/deep-research-program.ts:58` defines the mission as one evidence-grounded pass across six GTM cards.
   - `research-worker/src/runners/deep-research-program.ts:125` splits the result.
   - `research-worker/src/index.ts:327` writes split section artifacts back to Supabase.

6. Workspace hydration is present but not fully consistent.
   - `src/app/journey/page.tsx:2263` swaps into `WorkspaceProvider` and `WorkspacePage`.
   - `src/components/workspace/workspace-page.tsx:45` fetches persisted session results.
   - `src/lib/journey/research-realtime.ts` normalizes realtime research results to boundary section IDs.

## Section-Key Contract

The deep program currently asks for boundary section keys, then writes canonical section keys:

| Boundary section | Canonical stored section |
| --- | --- |
| `industryMarket` | `industryResearch` |
| `icpValidation` | `icpValidation` |
| `competitors` | `competitorIntel` |
| `crossAnalysis` | `strategicSynthesis` |
| `keywordIntel` | `keywordIntel` |
| `offerAnalysis` | `offerAnalysis` |

This mapping exists in `research-worker/src/runners/deep-research-program.ts:25` and is mirrored in the app-side research section contract. The mismatch is manageable only if every consumer normalizes before lookup.

## Gaps And Blockers

### 1. Homepage is still not the Journey view

`src/app/page.tsx` still renders a separate marketing landing page with a `Start Journey` link. The Manus-style link entry is on `/journey`, not `/`.

Implementation note: this was intentionally not fixed in this audit pass. A future fix should either redirect `/` to `/journey` or render the Journey state machine from `/`, while also resolving auth expectations because `/` is public and `/journey` is protected by middleware behavior.

### 2. This is still Journey, and that is now intentional

The working runtime is still:

```text
Journey page -> /api/journey/prefill -> /api/journey/dispatch -> research-worker /run -> journey_sessions.research_results -> workspace/realtime hydration
```

There should not be a new `/gtm` Manus runtime for this flow right now. The implementation target is to clean up Journey in place: Vercel AI SDK remains the user-facing chat/workspace layer, while the worker behind `/api/journey/dispatch` becomes the replaceable skills/tools/API-backed research layer.

### 3. Vercel AI SDK chat instructions conflict with the new product model

Resolved direction: the top-level prompt now states the current product contract: deep research saves context, fills onboarding/profile context, and powers a Cursor/Codex-style GTM report workspace.

Previously, the prompt said the assistant did not dispatch research:

- `src/lib/ai/prompts/journey-chat-system.ts:35`

The same prompt later still describes progressive research tools and trigger rules:

- `src/lib/ai/prompts/journey-chat-system.ts:200`

The stream route still injects prefill research-trigger directives:

- `src/app/api/journey/stream/route.ts:288`

But the active tool list in the stream route exposes `askUser`, `competitorFastHits`, `scrapeClientSite`, `editCard`, and `updateField`, not the older research tool set:

- `src/app/api/journey/stream/route.ts:661`

The stream route now exposes `runDeepResearchProgram` for explicit user-requested deeper research. Old progressive-research text still exists lower in the prompt for legacy intake compatibility, but workspace requests are guarded by a Manus-for-GTM directive and should not restart the old onboarding sequence.

### 4. Desktop and mobile workspace chat use different APIs

Resolved direction: desktop and mobile should both use `UnifiedChat` against `/api/journey/stream`.

Previously, desktop workspace chat used `UnifiedChat`:

- `src/components/workspace/workspace-page.tsx:524`
- `src/components/chat/unified-chat.tsx:692` posts to `/api/chat/unified`

Mobile workspace chat uses `BottomSheet -> RightRail`:

- `src/components/workspace/bottom-sheet.tsx:29`
- `src/components/workspace/right-rail.tsx:147` posts to `/api/journey/stream`

This was aligned in the implementation pass by routing `UnifiedChat` through `/api/journey/stream` and replacing the mobile `RightRail` drawer with the same `UnifiedChat` component.

### 5. Deep research output is prompt-shaped by design for this phase

The runner prompt defines the desired JSON shape:

- `research-worker/src/runners/deep-research-program.ts:70`

But `normalizeSectionPayload` fills missing arrays, verdicts, summaries, and confidence with defaults:

- `research-worker/src/runners/deep-research-program.ts:106`

Then the app-side contract bypasses the normal section Zod schemas whenever `data.source === 'deepResearchProgram'`:

- `src/lib/journey/research-result-contract.ts:556`

This remains a reliability risk, but the current architectural decision is not to hard schema-force the section cards yet. For this phase, validate inputs, dispatch envelopes, run IDs, persistence shape, and parsable JSON; prompt-enforce evidence standards, section quality, source coverage, confidence notes, and source gaps. Add stricter Zod section/corpus schemas later as a hardening pass once the prompt and artifact shape stabilize.

### 6. Cold workspace hydration can miss canonical deep-program artifacts

The workspace cold-start fetch loops over boundary `SECTION_PIPELINE` keys and reads `results[key]` directly:

- `src/components/workspace/workspace-page.tsx:74`

The worker writes several canonical keys:

- `industryResearch`
- `competitorIntel`
- `strategicSynthesis`

Realtime normalization helps later, but cold-start/cross-device hydration can miss persisted artifacts if it does not normalize canonical to boundary keys before lookup.

### 7. Progress/activity collapses under `deepResearchProgram`

Job activity maps worker tool names through `RESEARCH_TOOL_TO_SECTION_MAP` and boundary projection:

- `src/lib/journey/research-job-activity.ts:16`

`runDeepResearchProgram` maps to `deepResearchProgram`, while the visible workspace pipeline expects section IDs such as `industryMarket`, `competitors`, and `crossAnalysis`. The user may see one opaque job rather than six understandable section statuses.

### 8. `mediaPlan` is outside the one-pass program

The one-pass deep program covers six sections only:

- `industryMarket`
- `icpValidation`
- `competitors`
- `crossAnalysis`
- `keywordIntel`
- `offerAnalysis`

`mediaPlan` remains a separate downstream action in the workspace, so the current link-entry path does not generate the full GTM plan end to end from the initial link.

### 9. Old per-section dispatch helpers remain in the client module

`dispatch-client.ts` still exports the older identity/wave dispatch functions:

- `dispatchAllResearchParallel`
- `dispatchWave2Parallel`
- `dispatchWithIdentity`

The current page imports only `dispatchDeepResearchProgram`, but the old helpers remain live exports and can be reintroduced accidentally by future UI work.

### 10. The claimed duplicate-dispatch guard is weak

`src/app/journey/page.tsx:1558` adds all deep-program sections to `dispatchedSectionsRef`, but the current code path no longer has meaningful reads that enforce this guard. The comment suggests it prevents old per-section orchestration, but the behavior should be verified or the guard removed in a cleanup pass.

### 11. Runtime QA is still incomplete

The dev server launched on `http://localhost:3000`, and `/` and `/journey` returned 200 responses. Runtime logs showed repeated polling to `/api/journey/session?runId=...`.

What was not proven:

- authenticated link submission through `/api/journey/prefill`
- worker dispatch through `/api/journey/dispatch`
- `runDeepResearchProgram` execution with provider credentials
- Supabase writeback of all six split artifacts
- workspace hydration from a fresh browser/session
- mobile chat parity

## Graphify Status

Before this audit, this checkout had no `graphify-out/` and Graphify hooks were not installed. The existing `GRAPH_TREE.html` found in sibling worktrees was not trustworthy for this checkout.

Current Graphify state after the audit:

- `graphify-out/graph.json` generated
- `graphify-out/GRAPH_REPORT.md` generated
- `graphify-out/GRAPH_TREE.html` generated
- `graphify hook status` reports `post-commit: installed` and `post-checkout: installed`

Generation detail:

- `graphify extract . --out .` failed because no LLM API key was available.
- `graphify update . --force` succeeded with elevated filesystem permission and produced a no-LLM AST graph.
- `graphify tree --graph graphify-out/graph.json --output graphify-out/GRAPH_TREE.html --root . --label AI-GOS` succeeded.
- The report says the graph has 7516 nodes, 11151 edges, and was built from commit `8d742be6`.

Implication: Graphify is now usable as a current code-map snapshot, but semantic extraction is not enabled in this shell until an LLM API key is available.

## Recommended Documentation-First Next Steps

1. Treat `/journey` as the source-of-truth runtime for this product. Do not start a new `/gtm` Manus workspace.
2. Preserve the Vercel AI SDK architecture for the workspace chat/agent layer: `useChat`, `DefaultChatTransport`, UI message streams, and AI SDK tool calls. If formalized as an agent, use AI SDK v6 `ToolLoopAgent` / `createAgentUIStreamResponse` patterns.
3. Lock one section-key contract before implementation: use workspace boundary keys in the UI and normalize canonical stored keys before rendering.
4. Write down one chat API for the workspace and remove the desktop/mobile split.
5. Document how `mediaPlan` should be triggered: included in one-pass deep research, automatically after six sections, or explicitly after user approval.
6. Add a QA checklist that starts with a real link and ends with verified Supabase artifacts plus visible workspace cards.

Canonical architecture note: see `docs/journey-ai-layer-architecture-2026-05-07.md`.

## Do Not Claim Yet

Do not claim the Manus/Codex GTM flow is fully wired until these are proven in one run:

```text
fresh browser -> link entry -> prefill success -> workspace opens -> deepResearchProgram accepted -> worker completes -> six section artifacts written -> workspace cards hydrate -> chat edits active card through the same API on desktop and mobile
```
