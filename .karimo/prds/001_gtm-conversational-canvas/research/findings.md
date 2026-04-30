# Research findings — gtm-conversational-canvas

Synthesized 2026-05-01 from session reconnaissance. Sources: live AIGOS run UI, AionUi codebase, AIGOS source, project memory.

## Reference: AionUi (`/Users/ammar/hermes-workspace/AionUi`)

Electron + Vite + React app. Apache-2.0. Architecture relevant to AIGOS:

- **Layout shell:** `src/renderer/components/layout/Layout.tsx` (top-level chrome).
- **Conversation context providers:** `hooks/context/ConversationContext.tsx`, `ConversationHistoryContext.tsx`, `LayoutContext.tsx` — encapsulate active conversation, history list, sidebar/inspector visibility.
- **Sidebar IA:** `pages/conversation/GroupedHistory/` — grouped, sortable, searchable conversation list.
- **Tabs:** `pages/conversation/components/ConversationTabs.tsx` — multi-conversation tab manager.
- **Workspace concept:** `utils/workspace/workspace.ts` — folder/file context attached per conversation.
- **Multi-LLM support:** Ollama, Gemini CLI, Codex, Claude Code. Provider-agnostic harness; the chat agent calls whichever backend is configured.

**What we lift:** IA pattern, message protocol shape, sidebar grouping logic.
**What we DON'T lift:** Electron/IPC runtime, SQLite storage, main-process orchestrator, settings UI. AIGOS keeps Next.js + Supabase + Clerk.

## Current AIGOS state (verified)

**Working:**
- Worker dispatch pipeline: frontend → `/api/gtm/runs/:id/dispatch` → Railway worker (or local :3001) → `codex exec` invokes skill folder → JSON output written to `gtm_stage_events` (mem 7838).
- `discover-url` skill: produces 19 evidence-bound, confidence-rated fields in ~200s with 5 tool calls. Output quality is production-ready (verified on `airtable.com` run `run_wWShV4oNEO`).
- `ChatShell.tsx` polls `/api/gtm/runs/:id` every 2500ms with `inFlightStagesRef` guard against double-dispatch (mem 7809).
- Stage chain: `discover-url → ingest-identity → research-icp → research-competitor → research-offer` (5 lighthouse skills).

**Broken UX (the actual pain):**
- `ChatShell` input is disabled unless `currentRun.status === "awaiting_user"` — user has no way to converse during a run.
- Skill output renders as full-width vertical scroll of `AgentInvocationBlock` evidence cards. No spatial hierarchy, no inspector, no sidebar of past runs.
- "Orchestrator not yet wired" placeholder in input footer.
- No artifact concept — output JSON is rendered raw via shadcn cards rather than as readable markdown.
- No way to refine output without re-running the whole skill (paid).

## Project memory references

- mem 7587 (2026-04-30 16:32): GTM Run UI Has No Polling or Real-Time Refresh Mechanism — fixed by mem 7809.
- mem 7809 (2026-04-30 20:14): ChatShell Polling: 2500ms Interval with inFlightStagesRef Guard.
- mem 7839 (2026-04-30 21:26): Two Distinct GTM Bugs — worker not running locally + UUID column type mismatch (UUID issue fixed by Apr 30 migration; worker-not-running fixed in this session).
- mem 7856 (2026-04-30 22:29): Both dev servers were already running — pipeline executes via `codex exec` with 600s timeout.

## Vision context (from user, 2026-05-01 session)

User's stated direction (verbatim, condensed):
- "Custom GTM for SaaS shit tons of features"
- "AI McKinsey for marketing"
- "GoHighLevel sort of view to manage clients"
- "Step by step" — verify lighthouse skill quality, then build a frontend that feels like AionUi while preserving AIGOS functionality
- "Single chat session [where] all of these running stuff sequentially / parallel"
- "User can make corrections through the chat just like how chatgpt does it"
- "The output goes in a md file that's presented nicely … or an artifact so it's editable by the agent"

**Decomposed by Claude (and accepted):**
1. **Workspace shell** (this PRD): conversational chat orchestrator + artifacts — Phase 1.
2. **AI McKinsey depth** (synthesis skills): positioning, media plan, scripts — Phase 2.
3. **Multi-client (GoHighLevel) layer**: accounts, RBAC, run-belongs-to-client — Phase 3.

## Locked technical decisions

| Decision | Choice | Rationale |
|---|---|---|
| Artifact storage | Supabase `gtm_artifacts` table, versioned (`parent_id` → previous version) | Edits need durable history; can't be JSON-to-MD on the fly |
| Edit semantics | Hybrid: orchestrator classifies user intent → textual patch (Ollama, free) OR skill re-run (paid) | Cheap edits stay cheap; structural changes preserve evidence-binding |
| Skill ordering | Hardcoded DAG (existing `route-table.ts`) | LLM-decided ordering is out of scope; agent can override on explicit request |
| Orchestrator brain | Ollama (`qwen2.5-coder:32b` local OR Ollama Cloud `deepseek-v4-flash`) | Free/near-free tool-calling; mirrors AionUi's swap-the-LLM pattern |
| Skill bodies | Unchanged (Anthropic Claude Opus + Perplexity Sonar via existing worker) | Skills are working; out of scope to touch |
| Visual language | AIGOS's existing DESIGN.md / Tailwind tokens. Borrow AionUi IA only. | Pixel-matching different stack is a tarpit |

## Provider rule update

`.claude/rules/ai-sdk-patterns.md` line 4 currently reads: *"ALL AI calls use `@ai-sdk/anthropic` and `@ai-sdk/perplexity` directly."*

Narrowing required: skills remain on the existing allowlist; orchestrator chat is allowed `ollama-ai-provider`. Captured as task T3.
