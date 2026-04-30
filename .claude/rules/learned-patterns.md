# Learned Patterns

This file is the self-improvement loop. It is maintained by the agent, not just the human.

## How to use this file

After any session where I got something wrong, before ending the session, ask:

> **Was the mistake because a rule was missing, or because an existing rule was ignored?**

- **Missing**: append a one-line entry here, as concrete as possible. Format: "When X happens, do Y because Z." Never abstract ("be careful with Y") — always actionable.
- **Ignored**: do NOT add a new rule. The existing rule is too long, too vague, or buried. Tighten the original or move it higher in the file that owns it. Adding a duplicate rule is worse than no rule.

If a new learning overlaps with an existing line, tighten the existing one instead of adding a new one. Two lines covering the same failure is noise.

## Pruning

Every 4 weeks (or when this file passes 40 entries), prune. For each line, ask:

> "If I deleted this line, would the agent make a mistake it wouldn't make with the line present?"

If no, delete. Bloated rule files get ignored wholesale, which is worse than a lean file with honest gaps. Remove lines when the underlying issue goes away (model upgrades, refactored code, process changes).

Cap: under 40 entries total. Over 60 and this file is fighting itself.

---

## AI SDK
- When `MissingToolResultsError` fires, sanitize incomplete tool parts from messages BEFORE calling `convertToModelMessages()` — the function is strict about tool call/result pairing
- When transport mismatches cause silent failures, check: `toUIMessageStreamResponse()` needs `DefaultChatTransport`, `toTextStreamResponse()` needs `TextStreamChatTransport`
- When `maxTokens` doesn't work, use `maxOutputTokens` instead — AI SDK v6 renamed this

## Next.js
- When API routes timeout on Vercel, add `export const maxDuration = 300` (requires Pro tier)
- When SSE events aren't received by frontend, check event name casing — backend and frontend must match exactly

## Anthropic API / generateObject
- When Anthropic rejects a schema with `properties maximum, minimum are not supported`, remove `.min()` / `.max()` from Zod number fields in schemas passed to `generateObject()`. Use `.describe()` to communicate the range to the model, and add post-processing validation for enforcement. `.min()` / `.max()` are fine in contracts/validation schemas that don't go to the API.

## Testing
- Pre-existing TS errors in openrouter tests and chat blueprint tests are expected — don't try to fix them
- When Vitest tests fail with import errors, check `vitest.config.ts` path aliases match `tsconfig.json`

## Harness edits (from Meta-Harness, Lee et al. 2026 — [[wiki/sources/meta-harness-lee-2026.md]])
- When changing `.claude/rules/` or `CLAUDE.md`, prefer adding a new file or appending a preamble over mutating existing control flow. Meta-Harness TB2 iterations 1-6 regressed by bundling prompt edits with structural changes; iteration 7 won by being purely additive. Mutations have an interaction surface proportional to downstream callers; additions have near-zero surface. If you must mutate, state why an addition wouldn't achieve the same result before making the change.
- When recording a new learned pattern, include a pointer to the session/transcript that surfaced it so a future session can re-derive the causal chain. Meta-Harness ablation: traces → 50.0 median, scores-only → 34.6. Summaries alone don't carry enough signal. Format: append `(trace: ~/.claude/projects/.../memory/<session>.md)` or `(session: <id>)` to the entry.

## Workflow sizing
- When prescribing a feature workflow, classify size FIRST and scale the pipeline to match. `day` or smaller = ONE session with internal sub-agent dispatch per heavy stage (architect reviews OUTPUT.md files, not conversations). `week+` = multi-session with `/clear` between stages, because context genuinely fills up. CLAUDE.md classification table already says `half-day` skips 01-02 — don't top-load the heaviest pipeline onto every feature. Six sessions with six re-pastes for a day-sized task is ceremony, not rigor, and it makes the pipeline feel stupid to the user. The test: "would the context actually bloat past ~60% if I ran all stages in one session?" If no, stay in one session. (session: 2026-04-20 chat-redesign prescription)

## Skill scaffold status
- When CLAUDE.md says "skills/<name>/ is a stub", verify by reading `skills/<name>/scripts/orchestrate.ts` before relying on the claim. As of 2026-05-01, at least 6 skills (ingest-url, ingest-identity, research-icp, research-competitor, research-market, research-offer) have full deterministic orchestrators despite CLAUDE.md still listing them as stubs. The doc lags reality. Canonical lighthouse pipeline is `LIGHTHOUSE_5` in `src/lib/gtm/dispatch-skill.ts`: `ingest-url, ingest-identity, research-market, research-competitor, research-icp`. (session: 2026-05-01 gtm-conversational-canvas T4)

## Never fabricate from negation
- When enumerating out-of-scope surfaces, list only surfaces whose files you've grep-confirmed exist. Never list a surface by name because a rules file mentions it in a "not X" or "no X" sentence. Negation phrases anchor dead concepts (e.g. "no chat-based onboarding" in ARCHITECTURE.md primed three separate sessions to name a nonexistent "onboarding chat" as out-of-scope). Rule: if the file doesn't exist, the surface doesn't exist — don't name it. (session: 2026-04-20 onboarding-chat leak purge)
- When editing canonical rules files, prefer stating only what IS over what ISN'T. "Journey is URL-form driven" beats "Journey is not chat-driven, no chat-based onboarding" — the negation form plants the forbidden concept in every future Claude's context. The positive form doesn't. (session: 2026-04-20 onboarding-chat leak purge)
