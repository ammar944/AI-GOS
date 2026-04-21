# chat-redesign — Stage 01 Discover

**Scope expanded 2026-04-20 19:26 GMT+5** from "brain-icon atom" to full chat rearchitecture. Beast mode activated ("boil the ocean"). Gate answers locked: Q1 per-card, Q2 full embedded card render, Q3 re-opened.

## Ask (rewritten as verifiable goals)

Original ask: make the chat "not dogshit Rags from two years ago" — production-quality refinement surface with proper context, performance, modes, quality, persona, skill, and runner→chat info flow.

Rewritten goals (each becomes an audit question in 02-plan):

1. **Context** — the model receives exactly the data it needs to refine a card, and nothing more. Card schema + current value + relevant research evidence + profile identity + recent chat turns. No junk, no missing fields.
2. **Performance** — streaming feels instant (first token < 800ms p50), prompt caching hits on every turn after the first, thinking mode doesn't block UI, no redundant re-renders.
3. **Modes** — `standard` / `thinking` / `refine-card` are explicit, user-selectable, and each has a matched system prompt + tool surface + model choice. No mode collision.
4. **Quality** — persona is deliberate (senior marketing strategist, not helpful assistant), refuses to fabricate, cites sources when asserting facts, matches AIGOS tone (direct, surgical, no fluff openers).
5. **Runner → chat info flow** — research-worker outputs (`research_telemetry`, per-section Supabase rows, `business_profile_documents`, Fathom calls) are available to the chat system prompt when refining the corresponding card. Currently suspect many are invisible.
6. **Skill / tooling** — `editCard` and `updateField` are wired correctly and only when relevant. No sprawl. New tools (e.g. `searchResearchContext`, `citeSource`) considered.
7. **Wiki integration** — persistent knowledge from `.claude/wiki/` is queryable by the chat when domain expertise is needed (optional, not default).
8. **Brain-icon refactor** — per-card (one icon in card header), chat renders full embedded card (not pill). Ships inside this sprint.

## In scope (files expected to change)

- `src/app/api/chat/unified/route.ts` — system prompt, tool registration, model routing, mode switching, prompt caching
- `src/lib/ai/prompts/` (new or existing) — persona, mode-specific system prompts, context assembly
- `src/lib/ai/tools/edit-card.ts`, `src/lib/ai/tools/update-field.ts` — tool definitions, schemas
- `src/components/chat/unified-chat.tsx` — mode selector, brain-context listener (refactor), pending edits, thinking surface
- `src/components/chat/thinking-block.tsx` — perf audit only
- `src/components/workspace/brain-icon.tsx` — refactor per-field → per-card
- `src/components/workspace/artifact-card.tsx` — integration point for brain-icon
- `src/components/chat/card-citation.tsx` (new) — full embedded card render in chat message
- `src/lib/workspace/context-builder.ts` (new or existing) — assembles card + research + profile context for chat
- `research-worker/src/` — NO CHANGES (worker → Supabase → frontend pattern preserved)

## Out of scope this sprint

- Voice mode entry point (out per A2 original scope; can be a follow-on)
- Research dispatch changes (chat is REFINEMENT, not research trigger — see `feedback_journey_is_form_driven.md`)
- Onboarding / profile field review UI (UnifiedFieldReview stays untouched unless `updateField` wiring needs chat-side UX)
- OpenRouter reintroduction (banned per `.claude/rules/ai-sdk-patterns.md`)
- Railway worker edits (boundary rule per top gotchas)

## Affected surfaces & owners

| Surface | File(s) | Owner | Risk |
|---------|---------|-------|------|
| Chat route | `src/app/api/chat/unified/route.ts` | backend | high — system prompt + tool registry + caching |
| Chat UI | `src/components/chat/unified-chat.tsx` | frontend | medium — listener refactor, mode selector |
| Brain-icon | `src/components/workspace/brain-icon.tsx` | frontend | low — prop surface change |
| ArtifactCard | `src/components/workspace/artifact-card.tsx` | frontend | low — integration point only |
| Card citation | `src/components/chat/card-citation.tsx` (new) | frontend | medium — visual + layout |
| Prompts / persona | `src/lib/ai/prompts/` | AI eng | high — defines voice, tool choice, refusal |
| Context builder | `src/lib/workspace/context-builder.ts` | AI eng | high — decides what the model sees |
| Research telemetry read | `supabase.from('research_telemetry')` | backend | medium — runner→chat info flow |
| Wiki query tool | `src/lib/ai/tools/` (new optional) | AI eng | medium — opt-in surface |

## Known constraints

- `id` vs `run_id` gotcha — queries must use `.eq('run_id', id)`
- Railway worker cannot import from `src/lib/`
- AI SDK v6: `inputSchema` not `parameters`, `maxOutputTokens` not `maxTokens`
- `toUIMessageStreamResponse()` requires `DefaultChatTransport` (keep alignment)
- Zod numbers for `generateObject`: no `.min()/.max()` — but chat uses `streamText`, this applies only to refactored tool inputs
- `MissingToolResultsError`: sanitize incomplete tool parts before `convertToModelMessages`
- Prompt caching wired into `icp.ts`, `offer.ts`, `media-plan.ts` — NOT in unified chat route (observation 3092/3093). Must retrofit.

## Success criteria (verification gate, end of 04-verify)

1. `npm run build` exits 0
2. `npm run test:run` green (add 2–3 chat context tests minimum)
3. Manual: open a card with research data → click brain icon → chat opens with full card embed → ask "rewrite this for a more technical ICP" → thinking fires → edit proposal renders → accept → only that card's targeted field(s) update
4. Manual: switch mode `standard` → `thinking` → `refine-card` → system prompt visibly changes behavior (log the prompt hash to `console.log` for dev verification)
5. Manual: second chat turn in same session → prompt cache hit (check Anthropic billing or response metadata)
6. Manual: ask the chat a fabrication-bait question ("what's Fellow.ai's MRR?") → refuses or cites, does not invent
7. Runner → chat: ask "what did industry research find about pricing?" on media-plan card → model references actual `research_telemetry` data, not guesses

## Budget for 02-plan audit

- Single subagent dispatch, opus model, 25 min / 80 call cap
- Deliverable: rewritten `02-plan/OUTPUT.md` with verdicts + gaps across all 8 goals above
- NO code edits from audit agent — research only

## Budget for 03-build

- Split into workstreams by owner (backend / frontend / AI eng)
- Each workstream: one sub-agent dispatch, sonnet model, 30 min / 80 call cap
- Sequential not parallel — changes to system prompt and tool registry must land before frontend mode selector wires to them

## Gates remaining before 02-plan dispatch

None critical. User gate answers (per-card, full card render) locked. Dispatching audit next turn unless user redirects.
