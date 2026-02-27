# Pre-Sprint 2 Fixes

## HIGH — Blockers (tools will silently fail)

| # | Fix | File | Details |
|---|-----|------|---------|
| 1 | Frontend drops non-text parts | `src/app/journey/page.tsx` | `getTextContent()` filters out all tool parts. Sprint 2 tool results will be invisible to users. |
| 2 | No tool result card components | `src/components/journey/chat-message.tsx` | Only renders markdown. Need 5 artifact cards: Deep Research, Edit Proposal, Comparison, Score, Visualization. |
| 3 | No approval flow UI | `src/app/journey/page.tsx` | Edit proposals need `approval-requested → approval-responded` state machine. Pattern exists in v1 `agent-chat.tsx`. |

## MEDIUM — Spec Divergence

| # | Fix | File | Details |
|---|-----|------|---------|
| 4 | Thinking config mismatch | `src/app/api/journey/stream/route.ts` | Uses `{ type: 'enabled', budgetTokens: 10000 }`. DISCOVERY.md D2 says `{ type: 'adaptive' }`. |
| 5 | Thinking blocks not displayed | `src/app/journey/page.tsx` | Claude computes thinking but journey page never renders them. Port `parseThinkingBlocks()` from v1. |
| 6 | No slash command infrastructure | `src/components/journey/chat-input.tsx` | 5 commands (`/research`, `/edit`, `/compare`, `/analyze`, `/visualize`) — no parsing or palette UI. |
| 7 | No multi-step progress streaming | `src/app/api/journey/stream/route.ts` | Deep Research needs 3-step progress (Decompose → Research → Synthesize). Tools return atomically. |

## LOW — Polish

| # | Fix | File | Details |
|---|-----|------|---------|
| 8 | Chat panel width | `src/components/journey/journey-layout.tsx` | Spec says 340px, implementation uses 440px. |
| 9 | Message animations | `src/components/journey/chat-message.tsx` | fadeUp entrance animations specified but not implemented. |

## DONE — Already Resolved

| # | Fix | Details |
|---|-----|---------|
| 10 | Groq model selector removed | Old docs referencing Groq 70B dropdown deleted. V2 is single-model (Opus 4.6). |
| 11 | 5 outdated docs deleted | `AGENT-UPGRADE-PLAN.md`, `EGOOS-AGENT-UI-SPEC.md`, `docs/ai-chat-architecture.md`, `docs/strategic-research-pipeline.md`, `docs/progress.md` |
