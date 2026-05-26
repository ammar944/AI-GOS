# AI-GOS v3 — Corpus→Perplexity + ≥3-URL Proof Gate Handoff (Codex)

> Written 2026-05-26. **Executor: Codex at `model_reasoning_effort=xhigh`**, on the **`feat/v2-lab-section-wire` worktree** (`/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire` — the system of record, NOT `/Users/ammar/Dev-Projects/AI-GOS`). Claude plans + reviews. TDD + verification gate per phase.
> Child of `docs/2026-05-26-v3-bg-execution-handoff.md` (parent spec). This doc covers two things: **(1)** migrate the shared corpus off Anthropic onto Perplexity sonar, then **(2)** run the ≥3 fresh-URL proof gate fully off Anthropic. Phases B–E already landed (see parent + the s9–s16 board).

---

## 0. Locked decisions (do not relitigate)

1. **System of record = `feat/v2-lab-section-wire`** (the worktree above). Commit incrementally, build-green.
2. **Corpus moves off Anthropic → Perplexity sonar, kept on the Railway worker** (respects the parent's "keep the Railway corpus path"). **Course-grounded reasoning (locked by user 2026-05-26):** the AIHero AI SDK v6 course's research-agent method (explicit ToolLoopAgent loop over your own search tools + `Output.object` + bounded lifecycle + evals + "no second code path") would *purest*-fit **DeepSeek run as a lab-engine agent unifying corpus + sections** — that was considered and **deliberately deferred**, because it relocates the corpus out of the worker and reverses the parent's locked "keep Railway corpus path" (a much bigger move). Instead we keep the worker corpus and swap its engine to **Perplexity sonar**: citation-native (serves the zero-fabrication bar), already a **proven worker dependency** (`research-worker/src/competitors/sonar-research.ts`), no new provider plumbing. **Accepted divergence from the course:** sonar is a managed research call, not the course's agentic loop — accepted deliberately to honor the parent lock + keep scope tight; the rest of the §06 discipline (see Phase 1) still wraps it. This is a **corpus-engine rewrite, not a config swap** (`RESEARCH_DEEP_PROGRAM_MODEL` only swaps the *Anthropic* model).
3. **Sequencing (locked by user 2026-05-26): Phase 1 corpus rewrite (own gate) → Phase 2 ≥3-URL proof gate.** Both phases run fully off Anthropic.
4. **Sections + paid media stay on DeepSeek** (`LAB_ENGINE_PROVIDER=deepseek-direct`, `deepseek-v4-flash`) with **live in-section tools** per ADR-0006. No model split inside the section loop. This is unchanged from what already landed.
5. **Codex drives the Phase-2 gate runs in its own browser.** Every research-v2 route (`orchestrate`, `dispatch`, `rerun-section`, `run-lab-section`) is **Clerk-gated** (`await auth()` → 401; no dev/worker-key bypass). A raw captured cookie will NOT survive Clerk's ~60s token refresh over a ~13-min run — a **live browser context is required** (it auto-refreshes). See §Phase 2 "Auth" for the exact approach. The one unavoidable human step is a **single interactive login** to seed the session.
6. **Verified baselines (2026-05-26, this worktree, commit `12a79aee`):** frontend `tsc --noEmit` 0 · `npm run test:run` **1079 pass / 1 skip** · `npm run build` exit 0 · `eslint` **0 errors / 65 known warnings**; worker `npm run build` = **exactly 6 known errors** (`express` missing `@types`, 4 implicit-any params in `src/index.ts`, `apify-client` missing in `src/tools/apify-ads.ts`). **Per-phase gate = these unchanged. A 7th worker error fails the gate.**
7. **This reverses the implicit "corpus stays on Platform [Anthropic]" note** in `positioning-subagent-runner.ts` and ADR-0006's framing. **Write `docs/adr/0007-corpus-perplexity-migration.md`** as part of Phase 1.

---

## Step 0 — Env precheck (Codex runs first; NEVER print secret values)

Assert presence only, e.g. `node -e "process.exit(process.env.PERPLEXITY_API_KEY?0:1)" || echo MISSING`. Do **not** `cat`/echo `.env*`.

- **Phase 1 (worker `.env`):** `PERPLEXITY_API_KEY`.
- **Phase 2 (frontend `.env.local`):** `DEEPSEEK_API_KEY`; `LAB_ENGINE_PROVIDER=deepseek-direct`; `LAB_ENGINE_LIVE_TOOLS` must **not** be `false` (the gate returns `[]` only when literally `=== 'false'`, else `undefined` = live); live-tool keys `SEARCHAPI_KEY` (adlibrary/reviews/keyword_ad_probe — Apify is dead) + `FIRECRAWL_API_KEY`; `RAILWAY_WORKER_URL` + `RAILWAY_API_KEY` (worker reachable — `curl $RAILWAY_WORKER_URL/health`); Supabase + Clerk keys (already present — the app runs on `:3100`).
- If any are missing, **stop and report** — do not fabricate or fall back to Anthropic.

---

## Phase 1 — Corpus engine: Anthropic toolRunner → Perplexity sonar

**GOAL:** `runDeepResearchProgram` produces the same corpus contract using Perplexity sonar (native web search + citations) instead of Anthropic's hosted tool loop. Zero Anthropic calls remain on the corpus path.

**NON-GOALS:** the 6 positioning sections + paid-media (already DeepSeek); the worker's old managed/positioning runners (Phase F teardown); any change to `corpus-to-research-input.ts`'s *consumers*.

**FILES:**
- Modify: `research-worker/src/runners/deep-research-program.ts` (the rewrite).
- Reference (proven pattern, do not break): `research-worker/src/competitors/sonar-research.ts` (`createPerplexity` @ `:132`, `model: perplexity('sonar')` @ `:214`).
- Likely orphaned after rewrite: `buildDeepResearchContainerParams` import from `research-worker/src/anthropic-skills.ts` (remove import; leave the export unless fully orphaned).
- Verify-only: `src/lib/research-v2/corpus-to-research-input.ts` (the downstream contract — must keep parsing the output unchanged) and `research-worker/src/supabase.ts` (`ResearchResult` interface @ `:71`).
- Fixtures/tests that assume an Anthropic corpus (sweep `research-worker/src/**/__tests__` + `evals/` for `deepResearchProgram`, `toolRunner`, `hasAnthropicAuth`).

**CONTRACT TO PRESERVE (the corpus JSON the rest of the pipeline consumes):**
```jsonc
{
  "corpus": {
    "company": "string", "category": "string", "researchSummary": "string",
    "sources":  [{ "title": "string", "url": "string", "whyItMatters": "string" }],
    "evidence": [{ "claim": "string", "source": "string", "url": "string", "quote": "string", "confidence": 0-100 }]
  },
  "onboardingFields": { /* ~22 fields, each { value: string|null, confidence: 0-100, sourceUrl: string|null, reasoning: string } */ }
}
```
`runDeepResearchProgram` must still return the worker `ResearchResult` shape, and the parsed object must still satisfy `corpus-to-research-input.ts` (which maps it to `ResearchInput` via `researchInputSchema`). **Sources/evidence URLs must be real sonar citations — no fabrication.**

**COURSE-GROUNDING (AIHero AI SDK v6 — board §06; this is the spine of the rewrite, not optional):**
- **Bounded lifecycle (anti-hang):** the sonar pass(es) run under the explicit `RESEARCH_DEEP_PROGRAM_TIMEOUT_MS` watchdog (< route maxDuration); abort/disconnect are terminal states. "Done" = corpus JSON validated + minimums pass + persisted — never an open-ended call.
- **Structured output (v6):** prefer `generateText` + `Output.object(corpusSchema)` if Perplexity supports structured output for the chosen model; else keep the existing **draft→repair** shape to the contract via `tryExtractJson`. Don't layer `Output.object` on an answer tool (the #411 trap) — N/A to sonar, but holds for any structuring step.
- **Persistence boundary:** persist the corpus only after it validates AND minimums pass (compare-and-swap on revision, per the ArtifactEnvelope discipline).
- **Evals as gates (deterministic-first):** a deterministic minimums check — **≥6 real cited sources, ≥8 grounded evidence excerpts, zero fabricated / `example.com` URLs** — gates BEFORE persist; add/keep a corpus fixture in `research-worker/evals/`.
- **Observability:** trace the sonar call (prompt, model, usage, status, citations) through the existing runner telemetry; keep Langfuse/OTel hooks.
- **Typed events:** keep `emitRunnerProgress` / `emitArtifactProgress` so the corpus phase still streams visible progress (don't regress the progress UX).
- **Accepted divergence:** sonar replaces an explicit ToolLoopAgent search loop with a managed call — deliberate (see §0.2). Everything else here is the course discipline, unchanged.

**STEPS:**
1. Remove Anthropic couplings: `hasAnthropicAuth` gate (`:382`), `createClient({ enableSkillsBeta: true })` (`:392`), `client.beta.messages.toolRunner({...})` (`:417`), the `web_search_20250305` + `code_execution_20250825` tools (`:423-424`), `buildDeepResearchContainerParams` (`:12,:416`), and the Anthropic repair `client.messages.create` (`:342`).
2. Replace with a sonar pass using the proven pattern: `const perplexity = createPerplexity({ apiKey: process.env.PERPLEXITY_API_KEY })`; research call via `generateText({ model: perplexity('sonar-pro'), ... })` (use `sonar-pro` for corpus depth; confirm the id is enabled on the account — fall back to `sonar`). Map the provider's returned citations/`sources` → `corpus.sources` and ground `corpus.evidence` quotes in them.
3. Structure into the contract JSON: prefer AI SDK v6 `generateText` + `Output.object(schema)` **if** perplexity supports structured output for the chosen model; otherwise mirror the existing **draft→repair** shape (sonar prose → a structuring pass → `tryExtractJson`). Keep the existing JSON-extraction robustness; do **not** add `.min()/.max()` to schema numbers sent to a provider (use `.describe()`).
4. Preserve the existing progress emitters (`emitRunnerProgress`/`emitArtifactProgress`), timeouts (`RESEARCH_DEEP_PROGRAM_TIMEOUT_MS`), and `runWithBackoff`. Rename/retune the model env knob to a provider-neutral one (e.g. keep `RESEARCH_DEEP_PROGRAM_MODEL` but default it to `'sonar-pro'`).
5. Update fixtures/tests; delete any test asserting the Anthropic tool loop. Write `docs/adr/0007-corpus-perplexity-migration.md`.

**VERIFY (Phase 1 gate):**
- `cd research-worker && npm run build` → **exactly the 6 baseline errors, no 7th** (capture the list).
- `cd research-worker && npm run test:run` → green (minus pre-existing known failures, if any — record the before/after count).
- Frontend `npx tsc --noEmit` 0 (the corpus contract type is shared via the parsed shape; `corpus-to-research-input.ts` unchanged).
- **Live sonar corpus proof on one URL (`https://ramp.com`):** corpus JSON returns with **≥6 real cited sources + ≥8 grounded evidence excerpts**, completes under the timeout, and `grep`-clean of `toolRunner`/`hasAnthropicAuth`/`web_search_20250305` on the corpus path (proves zero Anthropic). Feed the result through `corpusToResearchInput` and assert `researchInputSchema` parses.
- Commit. Then proceed to Phase 2.

---

## Phase 2 — ≥3-URL authenticated proof gate (off Anthropic end-to-end)

**GOAL:** prove the real engine — Perplexity corpus + DeepSeek live-tool sections + paid-media 7th — on **≥3 distinct fresh real URLs** through the authenticated `/research-v3` flow on `:3100`, with real fetched evidence and zero fabrication.

**URLS (chosen — distinct categories, heavy public ads + reviews + clear competitors so live tools have data):**
- `https://ramp.com` (fintech / spend management)
- `https://vanta.com` (security / compliance automation)
- `https://webflow.com` (no-code web / design)
- *(Linear was the prior single-URL proof — do not reuse it as one of the three.)*

**Auth (the hard part — Codex's own browser):**
- Install Playwright in the worktree (`npm i -D @playwright/test && npx playwright install chromium`) — **not currently installed**. Keep it dev-only.
- Authenticate via a **live browser context** (survives Clerk token refresh): primary = `@clerk/testing` with a dedicated test user (`CLERK_*` keys already present; set `E2E_CLERK_USER_*`); fallback = a **one-time interactive login** the user performs in a headed Playwright run, saved as `.auth/state.json` (`storageState`) and reused for all 3 runs. This single login is the only human step.
- Do **not** build a route-level auth bypass (touches product auth; teardown-adjacent; out of scope).

**STEPS (per URL):**
1. Start services: worker (`cd research-worker && npm run dev`, `:3001`) + app (`npm run dev`, `:3100`). Confirm `LAB_ENGINE_PROVIDER=deepseek-direct`, live tools on, Perplexity corpus live.
2. Drive `/research-v3`: enter URL → wait for the Perplexity corpus → confirm/submit the GTM Brief Review form → `orchestrate` fan-out → wait for 6/6 + the paid-media 7th terminal section.
3. Live-tool budgets per the parent handoff's **"section-tools flip"** table (Competitor is the worst case — must stay < 270s). Do not re-expand the corpus; deep evidence is in-section.

**EVIDENCE per run (capture to a proof doc):** parent run `complete` + `children_complete=6`; all section rows `provider=deepseek-direct` / `model=deepseek-v4-flash`; corpus row via Perplexity (no Anthropic); artifact sweep **0** `Synthetic:` / `example.com` hits; per-section latency, **max < 270s, p95 < 180s**; paid-media terminal (7th tab) renders with its sub-sections; no error boundary; authenticated `:3100`.

**VERIFY (proof-gate conditions — from the parent §Gates):** conditions **1, 2, 4, 6** across the 3 URLs + the **7th section** rendering (condition 3). Condition **5 (≥48h soak)** runs separately after this lands. Green baselines (condition 4) = §0.6 unchanged.

---

## Gates, alignment & follow-ons

- **Soak (condition 5):** after the 3-URL proof, A3 must stay live default ≥48h with zero error-boundary / stuck-`queued` regressions before teardown.
- **Then** parent **Phase F (teardown)** → **Phase G (prod)**. Prod env now needs **`PERPLEXITY_API_KEY` + `DEEPSEEK_API_KEY`** in Vercel/Railway; the Anthropic key can be retired from the v3 path **after** Codex confirms (grep) no remaining v3-path Anthropic consumer outside the teardown-slated managed/positioning runners.
- **Alignment:** this doc amends the parent's "Anthropic corpus" assumption and the "corpus stays on Platform" note → **ADR-0007** records it. Update the ground-truth board `docs/2026-05-25-v2-wire-deepseek-ground-truth.html` (§07 + a session addendum) when each phase lands. The parent `docs/2026-05-26-v3-bg-execution-handoff.md` stays the umbrella spec.
- **Cost:** corpus now Perplexity sonar-pro (cheap) × 3 + DeepSeek sections × 3 + SearchAPI/Firecrawl live tools — materially under the prior ~$1.5–2/URL Anthropic-corpus path, and **$0 Anthropic**.

## Reconciliation with the goal docs (checked 2026-05-26)
- **Corpus off Anthropic → Perplexity sonar** is NEW vs. the parent (which assumed an Anthropic corpus). Where they conflict, this doc + ADR-0007 govern the corpus engine; the parent governs everything else (sections, live-tools flip, paid-media, teardown, gates).
- **Course-grounding + the road not taken:** the corpus rewrite is wrapped in the AIHero §06 discipline (bounded lifecycle, Output.object, persist-after-validate, evals-as-gates, observability). The *purest* course fit — DeepSeek as a unified lab-engine agent (one loop for corpus + sections, no second code path) — was considered and **deferred by decision** to keep the corpus on the Railway worker (parent lock) and hold scope; record this in ADR-0007 so it reads as a choice, not an oversight. Revisit if/when the worker corpus path is itself retired.
- The gate's "authenticated :3100" condition is unchanged; what's new is **Codex drives it via Playwright** (no headless dispatch path exists).
