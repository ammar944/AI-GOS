# chat-redesign 02-audit — rescoped debt register (rewritten 2026-04-20 19:45 GMT+5)

**Budget used**: 14m / 25m | 28/80 calls | 18 files read

## Executive summary

The chat system has a working skeleton — mode switching (normal/thinking/research), editCard tool round-trip, brain-icon bridge, and extended thinking all function — but fails 5 of 8 goals outright and partially passes the other 3. The single highest-leverage fix is prompt caching: currently absent from the unified route, every multi-turn conversation pays full input token cost on every turn (Claude Opus at $5/M input). The second-largest gap is runner-to-chat info flow: zero research data (telemetry, documents, Fathom calls) reaches the chat model, making it unable to reference actual research findings. The third critical gap is persona quality: the system prompt says "senior paid media strategist" but includes no fabrication refusal, no citation requirement, and no tone enforcement matching the AIGOS behavioral contract.

---

## Dimension verdicts

### D1 — Context assembly

**Verdict: YELLOW**

**Evidence:**
- `buildSystemPrompt()` at `route.ts:68-115` assembles: persona line, section name, editCard conventions, profile context, and card summaries (id + title + firstParagraph + fields).
- `buildProfileContext()` at `business-profiles.ts:199-224` injects 16 business profile fields (company name, product, ICP, competitors, goals, etc.).
- `cardContext` arrives from frontend via `UnifiedChatProps.cardContext` — lightweight summaries only (id, title, firstParagraph, field keys).
- Brain-context bridge at `unified-chat.tsx:701-712` receives `{cardId, cardTitle, fieldName, currentValue, fieldSchema}` but **discards cardId and fieldSchema** before sending to model — sends only a text message: `"📎 cardTitle → fieldName\n\nCurrent value:\n...\n\nRefine this field."`.
- `CardContextSchema` at `route.ts:29-34` accepts `id`, `title`, `firstParagraph`, `fields` — no `schema`, no `fullContent`, no `researchEvidence`.

**Gap:**
1. Brain-context sends structured data (cardId, fieldSchema) but the chat handler at `unified-chat.tsx:706-709` flattens it to an unstructured text message. The model loses the card ID needed for `editCard` calls and the field schema needed for type-correct edits.
2. Card context is firstParagraph-only — the model cannot see the full card content when refining, only a summary.
3. No research evidence is injected (see D5).

**Remediation (medium):**
- Refactor brain-context handler to include `cardId` in the text or as a structured attachment so the model can reference it in `editCard` calls.
- Optionally expand `CardContextSchema` to accept `fullContent` for the targeted card (not all cards — token budget).
- Build `src/lib/workspace/context-builder.ts` to assemble card + research + profile context with token budgeting.

**Out-of-scope:** Chat history summarization/compaction, multi-session memory.

---

### D2 — Performance

**Verdict: RED**

**Evidence:**
- Prompt caching: **completely absent** from the unified chat route. `streamText()` at `route.ts:374-397` passes `system` as a plain string. Anthropic prompt caching requires the system prompt to be passed as an array of `{type: 'text', text, cacheControl: {type: 'ephemeral'}}` parts via `providerOptions.anthropic.cacheControl`. No such structure exists.
- Grep for `cacheControl`, `cachedSystem`, `cache_control`, `prompt.cache` across `src/` returned **zero matches**. Prompt caching is not wired anywhere in the Next.js app (only the research-worker uses it internally per telemetry schema column `cache_read_tokens`).
- `providerOptions` at `route.ts:381-388` is used only for extended thinking config, not caching.
- Blocking work before first token: `getActiveProfile()` + `currentUser()` at `route.ts:298-301` run in parallel via `Promise.all` — good. `convertToModelMessages()` is async but lightweight. No blocking DB queries for research data. First-token latency is dominated by API round-trip, not server-side work.
- Frontend re-render: `MessageRow` at `unified-chat.tsx:444-544` is **not memoized** (`React.memo` not applied). Every streaming update re-renders all message rows. `ThinkingBlock` extraction at line 447 runs on every render.
- Thinking budget: hardcoded at `route.ts:357` — 5K normal, 10K thinking. No adaptive budgeting. Not a bug, but inflexible.

**Gap:**
1. **Critical**: No prompt caching. Multi-turn conversations re-send the full system prompt + all prior turns at full price every time. For a 10-turn conversation with a ~2K token system prompt + profile, this wastes ~18K tokens of cacheable input per turn.
2. **High**: MessageRow not memoized — every streaming chunk re-renders the entire message list.

**Remediation (medium):**
1. Convert `system` param in `streamText()` from a string to an array with cache breakpoints:
   ```
   system: [
     { type: 'text', text: personaBlock, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } },
     { type: 'text', text: cardContextBlock },
   ]
   ```
   The persona + profile block is stable across turns (cacheable). Card context changes per interaction (not cacheable). Place the breakpoint after the stable prefix.
2. Wrap `MessageRow` in `React.memo` with a comparator on `message.id` + `message.parts.length` + `isStreaming && isLast`.
3. Log `usage.cacheCreationInputTokens` and `usage.cacheReadInputTokens` in the `onFinish` callback to verify cache hits.

**Out-of-scope:** CDN-level caching, response caching, WebSocket transport.

---

### D3 — Modes

**Verdict: YELLOW**

**Evidence:**
- Three modes defined: `normal`, `thinking`, `research` — `ChatMode` type at `unified-chat.tsx:27`.
- `MODE_CONFIG` at `unified-chat.tsx:114-139` defines UI for all three with icons, labels, colors, and glow styles.
- `ModeBar` at `unified-chat.tsx:274-343` renders a tab-based mode selector with keyboard navigation. **Mode selector IS present and functional.**
- Route handling: `mode=research` branches to Perplexity at `route.ts:306-354`. `mode=normal|thinking` both go to Claude Opus at `route.ts:356-399`, differing only in `budgetTokens` (5K vs 10K).
- System prompt is **NOT mode-aware**: `buildSystemPrompt()` at `route.ts:68-115` produces the same prompt regardless of mode. `buildResearchSystemPrompt()` at `route.ts:117-150` is a separate function for Perplexity only.
- Tool surface is **NOT mode-gated**: `editCard` is available in both `normal` and `thinking` modes whenever the section is in `RESEARCH_SECTIONS`.
- No `refine-card` mode exists. The discover doc specifies `standard / thinking / refine-card` as the canonical set, but current code has `normal / thinking / research`.

**Gap:**
1. System prompt does not vary by mode — thinking mode should encourage deeper analysis, refine-card mode should focus on the targeted card.
2. Tool surface should be mode-gated: `editCard` makes sense in normal and refine-card, but in thinking mode the model should reason without side effects.
3. Missing `refine-card` mode (triggered by brain-icon / inline-refine). Currently these dispatch events that send a text message in whatever mode is active.

**Remediation (medium):**
1. Add mode-specific prompt fragments — e.g., thinking mode gets "Reason step by step before answering. Do not call tools.", refine-card mode gets "Focus on the targeted card. Use editCard to propose changes."
2. Gate `tools` on mode: `refine-card` and `normal` get `editCard`, `thinking` gets no tools (or read-only tools), `research` already has no tools.
3. Either rename `normal` to `standard` and add `refine-card`, or auto-switch to `refine-card` when a brain-context/refine-card event fires.

**Out-of-scope:** Voice mode, multi-model routing per mode (e.g., Sonnet for standard, Opus for thinking).

---

### D4 — Quality & persona

**Verdict: RED**

**Evidence:**
- Persona line at `route.ts:74`: `"You are a senior paid media strategist embedded inside AI-GOS, a strategic research and planning platform."` — correct role but no behavioral enforcement.
- No fabrication refusal. The system prompt does not contain any instruction to refuse when uncertain, cite sources, or avoid making up data.
- No AIGOS behavioral contract enforcement. The prompt says `"Keep responses focused, direct, and grounded in the data"` at line 81 but does not ban fluff openers, does not require the surgical/direct tone from `CLAUDE.md`, and does not instruct source citation.
- Research mode persona at `route.ts:123-129` is better: `"Cite your sources. Be concise and specific — the user is a performance marketer, not a casual reader."` But this only applies to Perplexity mode.
- No anti-hallucination guard. If asked "what's Fellow.ai's MRR?" the model has no instruction to refuse or caveat — it will confabulate.

**Gap:**
1. **Critical**: No fabrication refusal instruction. Success criterion 6 (fabrication-bait test) will fail.
2. **High**: Persona is descriptive ("you are a strategist") but not behavioral ("refuse to guess pricing figures without data").
3. Source citation requirement exists only in research mode, not in normal/thinking modes where the model also makes claims.

**Remediation (small):**
Add to `buildSystemPrompt()`:
- Fabrication refusal: `"If you do not have data to support a claim, say so. Never invent statistics, pricing, revenue figures, or market share numbers. When citing facts, reference the research card or data source."`
- Tone enforcement: `"Be direct. No fluff openers ('Great question!'). Start with the answer or the action. If the user's premise is wrong, say so."`
- Source discipline: `"When asserting facts about a company, market, or competitor, cite the research card ID or state that the information comes from the user's profile."`

**Out-of-scope:** Dynamic persona switching (e.g., different persona per section), multi-language support.

---

### D5 — Runner → chat info flow

**Verdict: RED**

**Evidence:**
- `research_telemetry` table exists (migration `20260417`): columns include `run_id`, `section`, `card`, `phase`, `extra` (jsonb). Written by research-worker at `research-worker/src/supabase.ts:408`.
- **Zero reads** of `research_telemetry` in `src/` — grep returned no matches in the Next.js app.
- `business_profile_documents` is read in the dispatch route at `route.ts:300-329` (journey dispatch, not chat). The chat route does **not** query it.
- Fathom calls (`meeting_transcripts` / `business_profile_documents` with `extracted_fields`) are injected into runner context by the dispatch route at `route.ts:336-360`. The chat route does **not** query them.
- The chat model's only data sources are: (a) card summaries from `cardContext` prop (id, title, firstParagraph, fields), and (b) profile context from `buildProfileContext`.
- When a user asks "what did industry research find about pricing?" the model has no access to the actual research findings — only the card summary text visible in the UI.

**Gap:**
1. **Critical**: `research_telemetry` is invisible to chat. Runner findings, timing data, model choices, and the `extra` jsonb payload (which likely contains per-card research evidence) cannot be referenced.
2. **Critical**: `business_profile_documents` (uploaded docs, parsed markdown) are invisible to chat. If a user uploaded a competitive analysis PDF, the chat cannot reference it.
3. **Critical**: Fathom meeting intelligence is invisible to chat. Meeting insights injected into runners are not available when refining cards.
4. Success criterion 7 (runner data retrieval test) will fail.

**Remediation (large):**
Build `src/lib/workspace/context-builder.ts` that:
1. Accepts `userId`, `runId`, `section`, `cardId` (optional, for refine-card mode).
2. Queries `research_telemetry` for the relevant run+section, extracts key findings from `extra` jsonb.
3. Queries `business_profile_documents` for docs tagged with the current section (reuse the pattern from dispatch route at lines 298-329).
4. Queries `journey_sessions.meeting_transcripts` for Fathom insights (reuse pattern from dispatch route at lines 336-360).
5. Assembles a token-budgeted context block (e.g., 8K tokens max for research evidence, 4K for documents, 2K for meetings).
6. Returns structured blocks that `buildSystemPrompt` can append.
7. Chat route calls this before constructing the system prompt.

Note: This adds async DB queries to the chat route (currently it only does `getActiveProfile` + `currentUser`). The latency impact should be mitigated by running all queries in parallel via `Promise.all`.

**Out-of-scope:** Real-time telemetry streaming, research re-dispatch from chat.

---

### D6 — Skill / tool surface

**Verdict: YELLOW**

**Evidence:**
- `editCard` tool at `src/lib/ai/tools/edit-card.ts:35-49`: correctly defined with `inputSchema`, `execute` returns `{status: 'proposed', ...}`. Wired into route at `route.ts:20, 378`.
- `updateField` tool at `src/lib/ai/tools/update-field.ts:1-41`: schema defined with `UPDATABLE_FIELD_KEYS` allowlist (18 keys). **NOT imported, NOT wired** into the chat route. Only a schema definition — no `tool()` wrapper, no `execute` function.
- Tool gating at `route.ts:60-62, 378`: `hasSectionTools()` checks if the section is in `RESEARCH_SECTIONS`. Tools are available for 7 research sections but not for general chat.
- Other tools in `src/lib/ai/tools/`: `ask-user.ts`, `competitor-fast-hits.ts`, `scrape-client-site.ts` — none wired into chat.
- No `searchResearchContext` or `citeSource` tools exist.

**Gap:**
1. `updateField` needs a `tool()` wrapper with an `execute` function before it can be wired. Currently it's just a Zod schema.
2. Tools are not mode-gated — `editCard` is available in both normal and thinking modes.
3. No research-query tool exists for the model to look up runner findings on demand.

**Remediation (medium):**
1. Complete `updateField`: add `tool()` wrapper with execute function that returns `{status: 'proposed', key, value, reason}`. Frontend needs a parallel `pendingFieldEdits` state + accept/reject UI (similar to `pendingEdits` for cards).
2. Gate tools by mode: `refine-card` → `{editCard, updateField}`, `normal` → `{editCard}`, `thinking` → `{}`, `research` → `{}`.
3. Consider `searchResearchContext` tool (see remediation plan below) — deferred to after context-builder lands, since the static context injection from D5 may be sufficient.
4. `citeSource` tool: **defer**. Citation discipline is better enforced via system prompt instruction than a forced tool call. Adding it creates friction without clear UX for rendering citations.

**Out-of-scope:** `synthesizeCard`, `deleteCard`, `moveCard` tools. Not requested and would bloat the tool surface.

---

### D7 — Wiki integration

**Verdict: GREEN (intentionally)**

**Evidence:**
- `.claude/wiki/` exists with structure: `CLAUDE.md`, `hot.md`, `index.md`, `log.md`, `taxonomy.md`, `retrieval-rules.md`, `review-queue.md`, plus subdirs `raw/` and `wiki/` (containing `analysis/`, `concepts/`, `entities/`, `sources/`, `techniques/`, `tools/`).
- This is a **development-time** knowledge base — Karpathy-pattern wiki for Claude Code sessions. It contains ingested research papers, architecture concepts, and tooling docs.
- It is NOT runtime-queryable by the production chat. There is no API route, no Supabase table, and no MCP tool that exposes wiki content to the chat model.
- The discover doc lists wiki integration as goal 7 with "(optional, not default)".

**Gap:** None critical. The wiki is development infrastructure, not production data. Exposing it to the chat model would inject irrelevant content (meta-harness research papers, Claude Code tooling docs) into a marketing strategist context.

**Remediation (none needed now):**
- If domain-specific wiki content is needed (e.g., "what is ROAS?", "how does attribution work?"), the right path is a curated knowledge base in Supabase (not the dev wiki). This is a separate feature, not part of this sprint.
- If the user wants wiki-query as a chat tool: define a `queryWiki` tool with `{query: string, category: string}` input schema, backed by a Supabase `knowledge_base` table. But this is speculative and not justified by current user needs.

**Out-of-scope:** Runtime wiki query tool, knowledge base feature.

---

### D8 — Brain-icon refactor

**Verdict: YELLOW**

**Evidence:**
- `BrainIcon` at `brain-icon.tsx:7-44`: accepts `{cardId, cardTitle, fieldName, currentValue, fieldSchema}` — **per-field** props.
- Used in `artifact-card.tsx:133-142`: rendered once per card in the header, but with **card-level** data: `fieldName={card.sectionKey}`, `currentValue={JSON.stringify(card.content, null, 2)}`. So it's actually being used per-card already, despite the per-field prop interface.
- Chat-side handler at `unified-chat.tsx:701-712`: receives the CustomEvent, extracts `{cardTitle, fieldName, currentValue}` but **drops `cardId` and `fieldSchema`**. Sends a text-only message: `"📎 cardTitle → fieldName\nCurrent value:\n...\nRefine this field."`.
- No `card-citation.tsx` component exists.
- The chat renders the brain-context as a plain text message — no embedded card render, no structured data attachment.

**Gap:**
1. `BrainIcon` prop interface says per-field but usage is per-card — the interface is misleading but functionally correct.
2. Chat handler drops `cardId` — the model cannot correlate the brain-context message with the card ID needed for `editCard` calls. It must guess the card from the title text.
3. No embedded card render in chat. The discover doc specifies "full embedded card render (not pill)" but current implementation is a text pill.

**Remediation (medium):**
1. Simplify `BrainIcon` props to `{cardId, cardTitle, cardContent}` — drop `fieldName`/`fieldSchema` since it's used per-card.
2. Fix chat handler to include `cardId` in the sent message (e.g., `"[card:${cardId}] ${cardTitle}\n\n..."`) and teach the system prompt to extract it.
3. Build `src/components/chat/card-citation.tsx` — renders an embedded card preview in the chat message thread. Takes `{cardId, title, content, sectionKey}`. Shows a compact card with key fields visible.
4. When brain-context fires, render the card-citation component in the chat instead of a text pill. AI SDK v6 approach: use a data attachment or a custom message part that the `MessageRow` renderer recognizes.

**Out-of-scope:** Per-field brain-icon (design decision is per-card), card diff view (showing before/after), multi-card selection.

---

## Cross-cutting findings

### 1. Prompt cache + context assembly are coupled
Prompt caching (D2) requires structuring the system prompt as an array with cache breakpoints. Context assembly (D1) and runner data injection (D5) both add content to the system prompt. These must be designed together: stable prefix (persona + profile + behavioral rules) goes before the cache breakpoint; dynamic suffix (card context + research evidence) goes after. If D5's context-builder is built without considering D2's cache structure, it will need to be refactored.

### 2. Mode system affects tools, prompts, and context
The mode system (D3) gates which tools are available, which system prompt fragments are included, and potentially which context is injected. Building D3 after D1/D2/D5 would require retrofitting mode-awareness into all three. Building D3 first as a routing layer (mode → prompt template + tool set + context query) gives the other dimensions a stable interface to plug into.

### 3. Brain-icon refactor depends on context assembly
The brain-icon refactor (D8) needs the context-builder (from D1/D5) to assemble the full card + research context when the brain icon is clicked. The `card-citation.tsx` component needs the same card data structure that the context-builder produces. Design them together.

---

## Remediation plan (ordered by dependency)

| # | Item | Owner | Size | Files touched | Depends on | Verification |
|---|------|-------|------|---------------|------------|--------------|
| 1 | **Mode routing layer** — define mode→prompt+tools+context mapping as a config object in the route. Rename `normal`→`standard`, add `refine-card` auto-switch on brain-context events. | AI eng | small | `route.ts` | — | Mode switch changes logged prompt hash; thinking mode has no tools |
| 2 | **Persona + fabrication refusal** — add behavioral instructions to `buildSystemPrompt()`: fabrication refusal, citation requirement, tone enforcement. Mode-specific fragments. | AI eng | small | `route.ts` | #1 (mode-aware prompts) | Fabrication-bait test passes (success criterion 6) |
| 3 | **Prompt caching** — restructure `system` param as array with cache breakpoint after stable prefix. Log cache hit metrics in `onFinish`. | backend | medium | `route.ts` | #1, #2 (stable prompt structure needed first) | Second turn shows `cacheReadInputTokens > 0` in console |
| 4 | **Context-builder module** — new `src/lib/workspace/context-builder.ts`. Queries `research_telemetry`, `business_profile_documents`, meeting intelligence. Token-budgeted. Returns structured blocks. | backend | large | new file + `route.ts` | #3 (must know cache breakpoint placement) | Runner data test passes (success criterion 7) |
| 5 | **Brain-icon prop cleanup + cardId preservation** — simplify BrainIcon props, fix chat handler to include cardId, update system prompt to reference card IDs from brain-context messages. | frontend | small | `brain-icon.tsx`, `unified-chat.tsx`, `route.ts` | #1 (refine-card mode) | Brain-icon click → editCard call uses correct cardId |
| 6 | **Card-citation component** — `src/components/chat/card-citation.tsx`. Embedded card preview in chat thread. Rendered when brain-context fires. | frontend | medium | new file + `unified-chat.tsx` | #5 | Brain-icon click shows card embed, not text pill |
| 7 | **Complete updateField tool** — add `tool()` wrapper + execute function. Wire into route for `refine-card` mode. Add `pendingFieldEdits` state + accept/reject UI in unified-chat. | AI eng + frontend | medium | `update-field.ts`, `route.ts`, `unified-chat.tsx` | #1 (mode-gated tools) | updateField proposal renders, accept updates profile |
| 8 | **MessageRow memoization** — wrap in `React.memo`, memoize ThinkingBlock extraction. | frontend | small | `unified-chat.tsx` | — (independent) | Profile streaming with React DevTools — no full-list re-renders |

**Workstream assignment:**
- **Workstream A (AI eng / backend)**: #1 → #2 → #3 → #4 (sequential — each builds on prior)
- **Workstream B (frontend)**: #8 (independent, can start immediately) → #5 → #6 → #7 (sequential after #1 lands)

---

## Open questions for user (gates before 03-build)

**Q1: Should `refine-card` be an explicit mode tab, or auto-activated when brain-icon/inline-refine fires?**
Current modes are Normal/Thinking/Research in the ModeBar. Adding a 4th tab may clutter. Alternative: auto-switch to refine-card mode when brain-context event fires, revert to previous mode when conversation moves on. Recommendation: auto-switch (less UI surface, more magic). Need user confirmation.

**Q2: Research telemetry scope — full event log or summarized findings only?**
`research_telemetry` has raw events (timing, tokens, costs) plus an `extra` jsonb field. Injecting the full event log is wasteful (token budget). Options: (a) query only `extra` field for `event='section_complete'` rows — likely contains summarized findings, (b) build a summarizer that condenses telemetry into a ~500-token research evidence block. Need to inspect actual `extra` payloads to decide. Recommendation: start with (a), iterate if insufficient.

**Q3: Model choice for refine-card mode — Opus or Sonnet?**
Current: all Claude modes use Opus ($5/$25 per M tokens). Refine-card is high-frequency, low-complexity (edit a field). Sonnet ($3/$15) may be sufficient and 40% cheaper. Recommendation: Sonnet for refine-card, Opus for thinking. Need user confirmation on cost/quality tradeoff.

---

## Budget report

- **Time spent**: ~14 minutes
- **Tool calls used**: 28 / 80
- **Files read**: 18 (route.ts, unified-chat.tsx, brain-icon.tsx, artifact-card.tsx, edit-card.ts, update-field.ts, providers.ts, business-profiles.ts, context-string.ts, dispatch/route.ts, research_telemetry migration, chat-redesign.md, OUTPUT.md prior version, wiki directory listing, inline-refine.tsx via grep, plus grep scans across src/)
- **Key evidence gaps**: Could not inspect actual `research_telemetry.extra` payloads (would require Supabase query). Could not verify prompt cache format against latest AI SDK docs (no `prompt-cache.ts` utility exists in codebase to reference).
