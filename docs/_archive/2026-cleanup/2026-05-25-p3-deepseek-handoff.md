# STAGED — P3 DeepSeek goal + Codex tasks

**DO NOT SEED until the P0–P2 goal is fully achieved** (all 7 P0–P2 conditions hold).
**Seed sequence when ready:** (1) `bus_set_goal(GOAL TEXT below)`; (2) `bus_post_task ×7` (to: codex) from TASKS below.
**Hard prerequisite:** user supplies `DEEPSEEK_API_KEY` (direct DeepSeek, prod) before T3.6.
**Grounded on:** the deepseek-research findings (2026-05-25) — `@ai-sdk/deepseek` 2.x is the v6-compatible line; `deepseek-v4-flash`; the #411 trap is avoided by our tool-output architecture; cost ~$2–4 total.

---

## GOAL TEXT (for bus_set_goal)

# GOAL — AI-GOS V2: DeepSeek integration (P3)

**Repo:** AI-GOS worktree `feat/v2-lab-section-wire`. **Prereq:** P0–P2 goal achieved (wire proven on real data, green tsc, hardened backend). **Scope: P3 only.** Stay corpus-only (live tools/research workflow = later "v3"). Do NOT touch `main`/prod/Railway/Managed Agents until the preview is reviewed.

## Mission
Integrate DeepSeek v4-flash behind a reversible **provider-switch** (two-transport: Ollama local · direct DeepSeek prod), validate corpus-only to parity with Sonnet, deploy to a Vercel preview, then flip the user-facing front door to the lab path.

## Backend standard
Same AI SDK v6 course discipline as P2 (bounded lifecycle, decoupled execution, observability, evals). DeepSeek must run through the SAME answer-tool loop — no second code path.

## Tasks: T3.1 → T3.2 → T3.3 → T3.4 → T3.5 (free Ollama validation) → T3.6 (deploy, needs DEEPSEEK_API_KEY) → T3.7 (flip front door, last).

## ✅ GOAL ACHIEVED when ALL hold
1. **Provider-switch works** — env/flag selects `anthropic` (default) | `deepseek-direct` | `deepseek-ollama`; selected-model metadata exposed; Sonnet path unchanged (regression green).
2. **Anthropic-only coupling removed/guarded** — DeepSeek runs without the Anthropic-specific `prepareStep` (container-id forwarding) and `providerOptions.anthropic` blocks; model type widened.
3. **Schema conformance** — answer-tool `inputSchema` is model-dependent (full strict schema for DeepSeek, loose passthrough kept for Anthropic, execute-side validation for both); DeepSeek conforms (schema + `validateMinimums`) first-try on a REAL corpus for all 6 sections — validated FREE on Ollama.
4. **Deployed preview on direct DeepSeek** — the full corpus-only flow runs end-to-end on `deepseek-direct`; all 6 render in `/research-v3`. Evidence: preview URL + a completed run + cost (~$0.10/run).
5. **Front door flipped** — onboarding completion routes to the lab path; a fresh onboarding lands in `/research-v3` on DeepSeek.
6. **No regressions** — `tsc` green, full `vitest` green, lint ≤ baseline, `next build` compiles; the Anthropic path still works (switch is reversible).
7. **Budget** — DeepSeek-via-Ollama free for dev; direct DeepSeek prod tracked (~$2–4 total); NO new Anthropic spend required (Sonnet only as optional A/B within the remaining $15 cap).

## Constraints
- Requires `DEEPSEEK_API_KEY` (prod, server-only) before T3.6. Default provider stays Anthropic until DeepSeek proves out. Never layer `Output.object` on the answer tool (the #411 trap). Commit per task; no push without approval.

## Key files (under `src/lib/lab-engine/`)
- `ai/models.ts` — `sectionRunnerModel`/`repairModel`; add the provider-switch (T3.2).
- `agents/section-agent.ts` — remove/guard `prepareStep: forwardAnthropicContainerIdFromLastStep` (~371, ~406) + `providerOptions: { anthropic: { structuredOutputMode } }` (~1039, ~1082); widen `ReturnType<typeof anthropic>` (T3.3).
- `agents/answer-tool.ts` — `looseAnswerInputSchema` (:8, bound :33); make model-dependent (T3.4).
- `agents/build-prompts.ts` — `buildAnswerToolInstructions` (~319) prompt-side schema (T3.4).
- `package.json` — add `@ai-sdk/deepseek` (T3.1).

---

## TASKS (for bus_post_task, to: codex, by: claude) — refs: ["<P2 final commit>", "docs/2026-05-25-v2-wire-deepseek-ground-truth.html"]

### T3.1 — Add @ai-sdk/deepseek
Install `@ai-sdk/deepseek` (v6-compatible 2.x line). Model id `deepseek-v4-flash` (free-form id accepted by the provider). VERIFY: installs; `tsc` green.

### T3.2 — Provider-switch in ai/models.ts
Select section model by env/flag: `anthropic` (DEFAULT) | `deepseek-direct` (`createDeepSeek({apiKey: process.env.DEEPSEEK_API_KEY})`) | `deepseek-ollama` (local, via ai-sdk-ollama / OpenAI-compatible to localhost:11434). Expose selected-model metadata. VERIFY: a unit test asserts each flag yields the right provider/model AND default is Anthropic; `tsc` + vitest green.

### T3.3 — Decouple Anthropic-only coupling in section-agent.ts
Guard/remove the 2× `prepareStep: forwardAnthropicContainerIdFromLastStep` (~371, ~406) and 2× `providerOptions:{anthropic:{structuredOutputMode}}` (~1039, ~1082) so non-Anthropic providers run; widen the `ReturnType<typeof anthropic>` model type to accept the deepseek model. Keep these options ACTIVE when the provider IS Anthropic. VERIFY: Sonnet regression green; DeepSeek path runs without Anthropic-only options; `tsc` + vitest green.

### T3.4 — Model-dependent answer-tool inputSchema
In agents/answer-tool.ts: pass the FULL strict section schema as `inputSchema` for DeepSeek; keep the loose `z.object({}).passthrough()` for Anthropic; keep execute-side `safeParse` + `__answerRejected` feedback for BOTH. Start NON-strict (do not reshape `.passthrough()` for /beta strict mode unless conformance lags). VERIFY: Sonnet regression green; DeepSeek conforms first-try (schema + validateMinimums) on a corpus run; `tsc` + vitest green.

### T3.5 — Validate corpus-only on Ollama (FREE)
Run all 6 sections via `deepseek-v4-flash` through Ollama locally (deepseek-ollama transport) against a real corpus. Assert each passes sectionOutputSchema + validateMinimums. VERIFY: 6/6 conform offline; NO Anthropic spend. (This is the parity gate before any paid/prod step.)

### T3.6 — Deploy preview on direct DeepSeek [needs DEEPSEEK_API_KEY]
PRECONDITION: user provides DEEPSEEK_API_KEY (Vercel Preview scope, server-only). Select `deepseek-direct`; ensure Node runtime + maxDuration ≥ watchdog. Deploy preview; run the full corpus-only flow for a real run_id. VERIFY: preview URL; 6 sections complete + render in /research-v3; cost ~$0.10/run logged.

### T3.7 — Flip the front door → lab [LAST]
Only after T3.6 passes: point `src/app/onboarding/page.tsx` completion (currently `redirect("/research-v2")`) at the lab path so users land on the new flow. VERIFY: a fresh onboarding completion lands in /research-v3 on the DeepSeek lab path; Anthropic switch still available for rollback.
