# Codex Handoff — Wave 0 (research pipeline: search + grounding + correct engine)

> Dispatch with `model_reasoning_effort=xhigh`, working root = this worktree
> (`feat/v2-lab-section-wire`). Three independent fixes, **three atomic commits**.
> Report only what you changed + build/test output + the 3 commit SHAs.
> Full context: `docs/2026-05-28-pipeline-audit-and-restructure.md` (you do not need to read it to execute this).

## Mission & landing context
This is the DeepSeek **lab-engine** pipeline (`executionMode:'lab'` → `src/lib/lab-engine/`), which is the canonical engine going forward. We are upgrading it in place on this branch (the full app — dashboard, onboarding, research-v2 — lives here too); a later cutover lands it in prod. **Do not touch the legacy Anthropic worker positioning path** (`research-worker/src/runners/positioning/`, `positioning-audit-orchestrator`). Wave 0 = three surgical, high-leverage fixes. No refactors beyond what each task names.

## Global constraints (apply to every task)
- **Surgical.** Change only what each task specifies. Match existing style. Don't "improve" adjacent code.
- **Secrets:** never read/print/commit `.env*`. Reference keys only as `process.env.X`.
- **Zod for model-facing schemas:** do NOT put `.min()`/`.max()` on *number* fields in tool `inputSchema` (Anthropic rejects `minimum`/`maximum`). Use `.describe()` for the range and clamp in code. `.min(1)` on *strings* is fine (used already in `_shared.ts`).
- **Do NOT reintroduce** any `v_current_run_id <> p_section_run_id` guard in `commit_artifact_section`. It was *intentionally* replaced by revision-based CAS in `20260525` (see its header comment). Re-adding it breaks deep-enrichment reruns. (A prior audit mis-flagged this; it is out of scope.)
- **Build/test gate (frontend only — Wave 0 does not touch `research-worker/`):**
  - Capture baseline first: `npm run test:run` (note pass/fail counts) and `npm run build`.
  - Pre-existing TS errors in openrouter tests and chat-blueprint tests are **expected** — do not fix them, just don't add new failures.
  - After each commit, `npm run build` must exit 0 and `npm run test:run` must show no *new* failures.
- **Commits:** three atomic commits on `feat/v2-lab-section-wire` (do not branch, do not push). End each message with the Co-Authored-By trailer the repo uses.

---

## Task 1 — Executable Brave `web_search` (replaces the Anthropic provider tool)
**GOAL:** make `web_search` a real executable tool so it fires under DeepSeek (today it's an Anthropic provider tool that the DeepSeek model literally cannot invoke; it's in all 6 sections' allowed tools, so every section wastes calls on it).

**FILES**
- NEW `src/lib/lab-engine/agents/tools/brave-search.ts`
- `src/lib/lab-engine/agents/tools/index.ts` (catalog + `ToolName`)
- `src/lib/lab-engine/agents/tool-registry.ts` (remove the special case)
- `src/lib/lab-engine/ai/web-search-provider-tool.ts` (likely delete — verify)
- NEW `src/lib/lab-engine/agents/tools/__tests__/brave-search.test.ts`

**STEPS**
1. Read `src/lib/lab-engine/agents/tools/firecrawl.ts` and `_shared.ts` first — mirror that exact shape (`tool({ description, inputSchema, outputSchema, execute })`, `credentialGap`/`apiErrorGap`/`errorToGap`/`timedFetch`, output is a `z.union([... , ToolGapSchema])`).
2. Write `braveSearchAgentTool`:
   - `inputSchema` (`.strict()`): `q: z.string().min(1).describe(...)`, `count: z.number().int().describe("1-20, default 10")`, `freshness: z.enum(["pd","pw","pm","py"]).optional()`, `country: z.string().length(2).default("US")`. Clamp `count` to `[1,20]` in `execute` (no `.min/.max` on the number).
   - `execute`: `const apiKey = process.env.BRAVE_SEARCH_API_KEY;` → `credentialGap("BRAVE_SEARCH_API_KEY")` if missing. `timedFetch` `GET https://api.search.brave.com/res/v1/web/search?q=...&count=...&country=...[&freshness=...]`, header `{ "X-Subscription-Token": apiKey, "Accept": "application/json" }`. Non-ok → `apiErrorGap(\`Brave Search ${status}: ${body.slice(0,200)}\`)`. Parse `web.results[]` → `{ title, url, description?, extra_snippets: [] }`. catch → `errorToGap(e, "Brave Search request failed")`.
   - `outputSchema`: `z.union([ z.object({ type: z.literal("result"), query: z.string(), results: z.array(z.object({ title: z.string(), url: z.string().url(), description: z.string().optional(), extra_snippets: z.array(z.string()) }).strict()) }).strict(), ToolGapSchema ])`.
3. `tools/index.ts`: import `braveSearchAgentTool`; add `web_search: braveSearchAgentTool` to `TOOL_CATALOG`; change `export type ToolName = keyof typeof TOOL_CATALOG;` (drop the `| "web_search"`).
4. `tool-registry.ts`: delete the `if (name === "web_search") { … continue; }` block (lines ~18-24) and the `createWebSearchProviderTool` import (line 3). Now `web_search` flows through `TOOL_CATALOG` + `wrapWithBudget` like every other tool.
5. `web-search-provider-tool.ts`: `rg` the repo — `createWebSearchProviderTool` is used only in `tool-registry.ts`, and `createCodeExecutionProviderTool` appears unused. After step 4, if **both** exports are unused repo-wide, delete the file. If `createCodeExecutionProviderTool` turns out to have a caller, keep the file and remove only `createWebSearchProviderTool`. (Re-grep before deleting.)
6. `section-registry.ts`: **no change** — the model-facing name stays `web_search`, so skills/registry are untouched.
7. Add `__tests__/brave-search.test.ts` mirroring repo Vitest style: mock `global.fetch`; assert (a) results parse from a sample `web.results` payload, (b) missing key → `credentialGap`, (c) non-ok → `apiErrorGap`.

**VERIFY:** `npm run build` exit 0; new test passes; `rg "createWebSearchProviderTool"` returns nothing. (Live search verification needs `BRAVE_SEARCH_API_KEY` in env — note it as a manual follow-up if the key isn't set.)
**COMMIT:** `feat(lab-engine): executable Brave web_search, drop Anthropic provider tool`

---

## Task 2 — Honest evidence→source attribution (stop the silent `sources[0]` mis-attribution)
**GOAL:** every corpus excerpt cites its *own* source. Today `findSourceForEvidence` falls back to `sources[0]` when an evidence URL isn't matched, and `buildSources` only ingests `corpus.sources` — ignoring `corpus.evidence[].url`, even though every evidence item carries its own cited URL. Result: quotes get stamped with an unrelated source. The existing test never exercises the fallback.

**FILES**
- `src/lib/research-v2/corpus-to-research-input.ts` (`buildSources` ~286-341, `findSourceForEvidence` ~343-363, call site ~497/553)
- `src/lib/research-v2/__tests__/corpus-to-research-input.test.ts`

**STEPS**
1. Make evidence URLs first-class sources. In `corpusToResearchInput`, the evidence records are `asRecordArray(corpus.evidence)` (~line 554). Feed evidence-derived sources into the source set: extend `buildSources` to also accept `evidenceRecords` and append a deduped `SourceRef` for each evidence item that has a valid `url`/`sourceUrl` not already present (dedupe by URL). Keep ids stable/slug-based like the existing ones.
2. `findSourceForEvidence` (~362): **remove the `?? sources[0]!` fallback.** New behavior when neither URL nor title matches: if the evidence itself has a valid `url`, synthesize and return a `SourceRef` from the evidence's own `url`/`title` (so the excerpt cites itself, never source 0). Only if the evidence has *no* usable URL at all, return an explicit sentinel (e.g. an `unsourced` ref with no fabricated URL) — never `sources[0]`.
3. Confirm `buildEvidenceExcerpt` still stamps `sourceId`/`sourceUrl` from the returned source (it does, ~391-392) — now correct because the source is the evidence's own.

**VERIFY:** extend `corpus-to-research-input.test.ts` with cases the current fixtures miss: (a) evidence whose `url` is **not** in `corpus.sources` → asserts the excerpt's `sourceUrl` equals the evidence's own url (NOT `sources[0]`), and that url now appears in `sources[]`; (b) evidence with no url → asserts no fabricated/source-0 attribution. `npm run test:run -- src/lib/research-v2/__tests__/corpus-to-research-input.test.ts` green; full `test:run` no new failures.
**COMMIT:** `fix(research-v2): attribute each excerpt to its own source, drop sources[0] fallback`

---

## Task 3 — Kick off audits in `lab` mode (they currently default to tool-free `draft`)
**GOAL:** every frontend call that **starts a new audit** must pass `executionMode: 'lab'`. Today the orchestrate route defaults to `'draft'`/`'managed'` when the body omits `executionMode` (`orchestrate/route.ts:222-224`), and the primary page kickoff omits it — so the audit can run the **tool-free draft engine** instead of lab. The route is idempotent on `run_id`, so whichever kickoff fires first sets the mode for the whole audit. This likely explains thin output more than any tool fix.

**FILES (verify each; there are several kickoff sites — `rg "research-v2/orchestrate"` in `src/`)**
- `src/app/research-v2/page.tsx` (~431-438: raw `fetch('/api/research-v2/orchestrate', { body: { run_id } })` — **no executionMode**)
- `src/app/research-v3/page.tsx` (check — does it kick off, and does it omit executionMode?)
- `src/components/research-v2/audit-reader-shell.tsx` (~610: already sends `executionMode:'lab'` — the guarded recovery)
- `src/lib/research-v2/orchestrate-client.ts` (the helper the raw `page.tsx` fetch bypasses)

**STEPS**
1. Trace which page is the **live reader entry** (research-v2 vs research-v3) and which kickoff actually fires first in the real flow (onboarding-complete → page kickoff; shell is a parent-null recovery that needs existing worker states, so it can't be primary).
2. Enforce the invariant: **every new-audit kickoff sends `executionMode: 'lab'` explicitly.** Minimal must-fix: add `executionMode: 'lab'` to the `page.tsx` kickoff body (~line 435). Apply the same to `research-v3/page.tsx` if it kicks off. Prefer routing kickoffs through `orchestrate-client.ts` (one place sets the mode) if that's a clean, in-scope consolidation; if it widens the diff much, just make each call explicit.
3. Do **not** change the route's default (`route.ts:222-224`) — it's deliberately `managed`/`draft` for the managed-agents flag + tests; explicit body wins, which is what we're setting. (Revisiting the default belongs to the later consolidation wave.)

**VERIFY:** `rg "research-v2/orchestrate" src/` — every frontend POST that starts an audit includes `executionMode: 'lab'`. Run the touching tests: `npm run test:run -- src/app/api/research-v2/orchestrate/__tests__/route.test.ts src/components/research-v2/__tests__/audit-reader-shell.test.tsx`; full `test:run` no new failures; `npm run build` exit 0. (If practical, note in your report whether a fresh run now dispatches lab sections — but don't burn paid API calls looping.)
**COMMIT:** `fix(research-v2): start orchestrate in lab mode (was defaulting to tool-free draft)`

---

## Out of scope for Wave 0 (do not touch)
- Competitor ad engine / relevance-filter port, `google_ads`/`meta_ads` wiring (Wave 1).
- Partial-object streaming, telemetry rollup, source-URL capture, orphan reaper (Wave 2).
- Claim/citation verifier, eval harness (Wave 3).
- Skill↔registry parity, SERP-shim renames, legacy worker deletion (Wave 4).
- The `commit_artifact_section` revision CAS (working as intended — see global constraints).

## Report back
The 3 commit SHAs; baseline vs final `test:run` counts; `build` exit code; whether `web-search-provider-tool.ts` was deleted or trimmed; which kickoff sites you changed for Task 3; anything that didn't match this spec (flag it, don't silently work around it).
