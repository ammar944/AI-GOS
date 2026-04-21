# chat-redesign 03-build — Dispatch Manifest

**Generated**: 2026-04-20 19:55 GMT+5 (rescoped from prior brain-icon-only plan)
**Inputs**: `stages/02-plan/OUTPUT.md` (8-dimension audit) + user gate answers
**Classification**: week+ (beast mode)

## Locked gates

| Gate | Answer |
|------|--------|
| Q1 refine-card mode | Auto-switch on brain-icon/inline-refine; revert on topic change |
| Q2 research_telemetry injection | Raw filtered `extra` payloads for `event='section_complete'` rows (iterate if wasteful) |
| Q3 model routing | Sonnet for `standard` + `refine-card`; Opus for `thinking`; Perplexity for `research` (unchanged) |
| Q4 editable cards | All frontend-editable card fields must be chat-editable via `editCard`/`updateField` tool round-trip |

## Workstream A — Backend / AI eng (sequential)

### Dispatch A1 — Route overhaul (items #1, #2, #3 bundled)
Cohesion: all three touch `src/app/api/chat/unified/route.ts` and must land together for the system prompt to stay coherent.

- **#1 Mode routing layer** — `ChatMode` becomes `'standard' | 'thinking' | 'refine-card' | 'research'`. Config map → prompt fragment + tool set + model. Refine-card auto-activates on brain-context event.
- **#2 Persona + fabrication refusal + tone enforcement** — rewrite `buildSystemPrompt()` with AIGOS behavioral contract (no fluff openers, direct, refuse on uncertain claims, cite sources or state the source).
- **#3 Prompt caching** — restructure `system` as array with `{type: 'text', text, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } }` breakpoint after stable prefix. Log `cacheCreationInputTokens` / `cacheReadInputTokens` in `onFinish`.

### Dispatch A2 — Context-builder (item #4)
Sequential after A1 lands (cache breakpoint placement must be known).

- New `src/lib/workspace/context-builder.ts` — token-budgeted assembly from `research_telemetry` (filtered to section_complete events), `business_profile_documents`, Fathom `meeting_transcripts`. Returns structured blocks consumed by `buildSystemPrompt`.
- Route calls builder before constructing prompt; queries run in parallel.

## Workstream B — Frontend (mostly sequential, #8 independent)

### Dispatch B1 — MessageRow memoization (item #8)
Independent, parallel-safe with A1.

- Wrap `MessageRow` in `React.memo` with explicit comparator on `message.id` + `message.parts.length` + `isStreaming && isLast`.
- Memoize `getReasoningFromParts` extraction.

### Dispatch B2 — Brain-icon + card-citation + updateField (items #5, #6, #7 bundled)
Sequential after A1 lands (refine-card mode must exist before chat handler auto-switches).

- **#5** Simplify `BrainIcon` props to `{cardId, cardTitle, cardContent, sectionKey}`. Chat handler preserves `cardId` — structured message with `[card:${cardId}]` tag that system prompt teaches the model to extract.
- **#6** New `src/components/chat/card-citation.tsx` — embedded card preview in chat thread. Rendered as custom message part, not a text pill.
- **#7** Complete `updateField` tool: `tool()` wrapper + execute returning `{status: 'proposed', key, value, reason}`. Wire into route for `refine-card` + `standard` modes. Add `pendingFieldEdits` state in `unified-chat.tsx` with accept/reject UI parallel to `pendingEdits` (cards).

## Verification (stage 04)

After each dispatch, verification sub-agent (Haiku, 15 min / 40 call cap):
- `npm run build` exits 0
- `npm run test:run` green
- Manual smoke test specific to the dispatch
- Cache hit verification for A1: second-turn `cacheReadInputTokens > 0` logged
- Runner data injection verification for A2: chat can answer "what did industry research find?" with actual telemetry content
- Brain-icon round-trip for B2: click → full card embed → edit → only targeted field updates

## Budgets

| Dispatch | Model | Time cap | Tool-call cap |
|----------|-------|----------|---------------|
| A1 route overhaul | sonnet | 30 min | 80 calls |
| A2 context-builder | sonnet | 35 min | 90 calls |
| B1 memoization | sonnet | 12 min | 30 calls |
| B2 brain-icon + card-citation + updateField | sonnet | 40 min | 100 calls |
| Each verification pass | haiku | 15 min | 40 calls |

## Forbidden for all dispatches

- Touching `research-worker/**` (worker boundary)
- Editing `.env*` (security rule)
- Reintroducing OpenRouter
- `git push`, deploys, Supabase migrations
- Onboarding / profile form UI changes (UnifiedFieldReview stays)
- Voice mode
