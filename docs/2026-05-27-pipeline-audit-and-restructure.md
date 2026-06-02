# AI-GOS Research Pipeline — Full-Stack Audit & Restructure

Date: 2026-05-27 · Branch: `feat/v2-lab-section-wire` @ `21f7fd8e`
Method: 3 parallel deep audits (UI/streaming · backend/persistence · tool-layer/ad-engine) + Anthropic agent-paper grounding + AI SDK v6 (context7) + Brave API contract. Read-only. Evidence: `file:line`, DB rows, git refs.
Sub-reports: `docs/audit/2026-05-27-ui-streaming-kinks.md`, `docs/audit/2026-05-27-backend-persistence-kinks.md`, `docs/audit/2026-05-27-tool-layer-ad-engine-kinks.md`. Prior: `docs/2026-05-27-lab-engine-quality-REPORT.md`.

---

## 0. Verdict

The research output isn't research-grade yet, but the engine is closer than the C+ suggests — and the problem is **not DeepSeek and not the corpus.** The root cause is structural:

> **We are shipping the thin half of a forked pipeline.** The live reader runs a *reimplementation* (lab-engine, in Vercel `after()`, DeepSeek) that dropped capabilities the read-model, the DB schema, and the UI were all built for — while the richer original (the Railway worker positioning path, Anthropic) sits unused. Roughly half the kinks below are that one fork leaking through every layer.

Single biggest lever: **finish the migration the lab path started** — bring it to parity with (and past) the worker path, add the one thing *neither* path has (a claim/citation verifier), then delete the legacy path so there's one pipeline.

**Decision required before §4–5 are final:** confirm the consolidation direction. This doc assumes **lab-canonical** (recommended — it's the system of record, the DeepSeek direction, and ADR-0003 backend-only). If you'd rather route the reader back to the worker and retire lab, §4–5 change.

Severity tally: **13 High, 22 Medium, ~8 Low.** None are "rewrite from scratch." The foundations the backend pass verified — `run_id`/`id` handling, RLS hygiene, revision CAS, typed-artifact persistence, the Perplexity corpus — are sound.

---

## 1. The bar (what 100x looks like here)

- **Anthropic — Building Effective Agents / Context Engineering / Multi-Agent Research:** tools used in a *real* loop with tight, unambiguous interfaces; **just-in-time, right-altitude context** (smallest high-signal set, not dump-everything); a **separate citation/verifier pass** that maps every claim back to a real source before output is trusted (their `CitationAgent`); sub-agent context isolation returning condensed results; **eval-driven** (start with ~20 real queries, LLM-as-judge on factual + citation accuracy); **resumable** state, adapt-don't-hard-stop on tool failure.
- **AI SDK v6** (`ai@6.0.0-beta.128`, via context7): `streamObject`→`partialObjectStream` server-side, `experimental_useObject` client-side → typed cards fill **field-by-field**; `ToolLoopAgent` for bounded multi-step loops; `Output.object` with `streamText` for structured streaming inside a tool loop.
- **Cursor / v0 / Claude artifacts:** progressive structured streaming + a **live tool-step trace** so there is never a silent multi-minute gap.

---

## 2. Current architecture & the fork

**Flow:** URL → `deepResearchProgram` corpus (Perplexity `sonar-pro`, Railway worker) → GTM brief → `POST /orchestrate` fans out 6 positioning sections + paid-media → each section runs the **lab-engine agent in Vercel `after()`** (DeepSeek `deepseek-v4-flash`) → `SupabaseRunStore` persists typed artifact → reader **polls** `audit-state` every 2.5s → renders typed cards on `complete`.

**The fork (root cause):**

| | Live path (`executionMode:'lab'`) | Legacy path (worker `positioning-audit-orchestrator`) |
|---|---|---|
| Runtime | Vercel `after()`, in-process | Railway worker |
| Model | DeepSeek `deepseek-v4-flash` | Anthropic |
| Telemetry | `buildLabSectionTelemetry` emits **none** of `latestTool/latestSource/capabilityGaps/wave` | writes them all |
| Source-URL capture | `buildToolEvents` logs `toolName` only | captures URLs |
| Ad engine | thin name-scorer, **no relevance filter**, Google/Meta only | (main's) domain-aware filter, Google/Meta/LinkedIn/Foreplay |
| Partial streaming | 6 sections on answer-tool path → **terminal artifact only** | `partialObjectStream` drained |
| Orphan reaper | none (reaper only runs on worker boot) | worker-resident |

The read-model (`audit-state`), the DB telemetry columns, and the reader were all built against the *worker* path's contract; the lab path silently under-fills them. There's also a **third** competitor schema in play (a leaner "managed-agents" one) that the renderer types against — see E1/E2.

**Three streaming disconnects stack:** (1) the 6 shipped sections never emit partials; (2) the reader is poll-based and ignores the lab-engine UI message stream entirely; (3) `audit-state` only exposes a zone's data once `status==='complete'`. Any one would defeat field-by-field streaming; all three are present.

---

## 3. Kink register

Severity: **H** = blocks trustworthy/shippable output or core UX · **M** = quality/correctness drag · **L** = polish. Each: evidence → bar violated → impact → effort.

### A. AI orchestration & agent loop
- **A1 [H] No claim/citation verifier.** Repair phase repairs schema *shape*, not truth (`run-section.ts:2386-2452`). Neither path has Anthropic's `CitationAgent`. → *Nothing checks that each number/price/quote/competitor maps to a real tool result before persist.* This is the core "can I trust the data" gap. Effort M/L.
- **A2 [H] Sections complete with required evidence missing.** Gaps are recorded (`_shared.ts:3-18`) but never *gate* completion — Competitor shipped with 0 ad evidence and still went `complete`. → Should fail-closed when a required evidence class is absent. Effort M.
- **A3 [M] Confidence is a single top-level decimal** (`artifact-envelope.ts:101-115`); no per-claim verified/inferred/gap. → No calibration. Effort M.
- **A4 [M] Tool-control vs streaming split.** The 6 sections use the answer-tool path (`answerToolSectionIds`, `run-section.ts:604-613`) for tool control; the structured/partial path (`callStructuredStreamAttempt` → `partialOutputStream`, `:2038-2078`) exists but isn't used by them. → Forces the D-tier streaming gap. Effort M/L.

### B. Tool layer
- **B1 [H] `web_search` is an Anthropic provider tool → dead under DeepSeek.** `buildToolMap` special-cases it (`tool-registry.ts:18-24`) → `anthropic.tools.webSearch_20250305` (`web-search-provider-tool.ts:1-18`); sections run DeepSeek (`models.ts:114-137`). It's in **all 6** sections' allowed tools, so every section burns calls on a tool that can't fire. *Easy path: hosted tool instead of an executable one.* Fix = Brave (§4). Effort S/M.
- **B2 [H] Competitor ad probe always returns `[]`.** `runCompetitorAdProbeSteps` needs executable `google_ads`+`meta_ads` (`run-section.ts:1852-1868`); Competitor allows neither (`section-registry.ts:140`) though both are in `TOOL_CATALOG`. Effort S to unblock.
- **B3 [H] `main`'s relevance filter was NOT ported.** Lab = name-score >0.5, no domain input (`adlibrary.ts:155-203`, `:586-592`). Main = domain-aware `isAdvertiserMatch` + `resolveBestCandidate` + domain-first Google/Meta + LinkedIn domain post-filter (`main:.../adlibrary.ts:195-224, 390-599, 601-690, 729-958`). → **Naively enabling the tools produces wrong-company ads** — worse than empty. *This is the engine you specifically valued.* Effort L (full parity) / M (Google+Meta relevance only).
- **B4 [H] Skill↔registry drift, pervasive.** Skills instruct tools the registry forbids: Market→`pagespeed`, Buyer→`reviews`, Competitor→`spyfu`/`google_ads`/`meta_ads`, Offer→`reviews`/`ga4` (table in tool-audit §2). → Prompt tells the model to call tools that aren't in its map; wasted steps, exactly like `web_search`. Effort S.
- **B5 [M] Registered dead capabilities.** `ga4` always returns `credentialGap` with no API (`ga4.ts:18-29`); `spyfu`/`google_ads`/`meta_ads` allowed by no section. → False sense of capability. Effort S.
- **B6 [M] Fail-soft-to-empty instead of typed gaps.** `adlibrary` returns `ads:[]` on no-match (`adlibrary.ts:488-492`); probe returns `[]` on missing tools (`run-section.ts:1863-1868`). → "Not wired" is indistinguishable from "none found." Effort S.
- **B7 [M] SERP shims named like first-party tools.** `reviews` Google-searches for snippets, not G2/Capterra/Trustpilot APIs (`reviews.ts:66-96`); `keyword_ad_probe` reports SERP organic/ad *counts*, not search volume or ad spend (`keyword-ad-probe.ts:51-84`). → The "review evidence" and "demand" signals overclaim their provenance. Effort S (rename + prose honesty).
- **B8 [L] `spyfu` declares an `intent` input it ignores** (`spyfu.ts:59-81`). Effort S.

### C. Corpus & context engineering
- **C1 [H] Source mis-attribution.** `findSourceForEvidence` falls back to `sources[0]` when an evidence URL isn't matched (`corpus-to-research-input.ts:343-363`), and `buildSources` builds only from `corpus.sources`, ignoring `corpus.evidence[].url` though every evidence item carries its own cited URL (`deep-research-program.ts:83-89`). The one test never triggers the fallback. → Quotes get stamped with unrelated sources — silently violates "verified source URLs only." **Smallest high-value fix: merge `evidence[].url` into the source set before mapping.** Effort S.
- **C2 [M] Dump-everything context.** All excerpts → every section (`corpus-to-research-input.ts:399-435, 552-562`); no section-scoped retrieval/compaction. → Violates Anthropic just-in-time/right-altitude. Effort M.

### D. Streaming (backend → frontend)
- **D1 [H] 6 sections emit terminal artifact only** — no `writeArtifactPartial` on the answer-tool path (`run-section.ts:2696-2777`; only partial writer is in the unused structured path). Effort M/L.
- **D2 [H] Reader is 100% poll-based** (`audit-state` every 2.5s) and never consumes the lab-engine UI message stream. Effort M.
- **D3 [H] `audit-state` exposes zone data only on `complete`** (`audit-state/route.ts:396`). → Even a partial body wouldn't surface. Effort S.
- **D4 [M] Event cap starves fast sections** — 60 global / 12 per-zone (`audit-state/route.ts:438`); with 6 parallel sections, early steps evict before the UI polls them. Effort S.

### E. Reader UI / frontend
- **E1 [H] Competitor `adEvidence` rendered nowhere.** `competitor-landscape.tsx:313-321` destructures every field except `adEvidence`; a built `competitor-ad-evidence.tsx` exists, wired only to the *old* renderer. → The headline media-buyer artifact is invisible. *Built, then unplugged.* Effort S.
- **E2 [M] Schema divergence + cast laundering.** Renderer types against the lean (managed-agents) competitor schema and `as unknown as` casts (`typed-artifact-renderer.tsx:485`), so the missing `adEvidence` passes the compiler. Root cause of E1. Effort S/M.
- **E3 [M] Persistent 320px dashboard rail** (`audit-reader-shell.tsx:940`) contradicts the locked "lean one-pager" + DESIGN.md single-column standalone rule. Effort M.
- **E4 [M] Three color vocabularies**; `competitor-landscape.tsx` uses `--text-primary`/`--accent-blue`/`--border-subtle` **not defined in DESIGN.md** (which defines `--text-1..4`/`--accent`) → likely resolve to nothing in one theme. Effort S/M.
- **E5 [M] Paid Media Plan falls to the generic reflection renderer** (`typed-artifact-renderer.tsx:492`) → title-cased raw keys + nested `dl` dumps. Effort M.
- **E6 [M] Copy button** copies only verdict+summary, drops evidence, swallows clipboard errors (`audit-reader-shell.tsx:803`). Effort S.
- **E7 [L] Live default-selection steals focus** — recomputes + scroll-resets every poll until the user clicks (`:680-688, :755-757`). Effort S.
- L: dead-run-polls-forever (`use-audit-state.ts:126`), duplicate Sources on Paid Media, infinite spinners possibly outside reduced-motion rule.

### F. Backend / persistence / worker boundary
- **F1 [H] Lab telemetry structurally incomplete** — `buildLabSectionTelemetry` (`supabase-run-store.ts:54-75`) emits none of what `audit-state` reads (`:215-231`) → always null on the live flow. Progress surfaces dead. Effort M.
- **F2 [H] Visited source URLs never persisted queryably** — `buildToolEvents` keeps `toolName` only (`run-section.ts:307-359`). → No "reading X" feed, no browsed-vs-cited trail. Effort M.
- **F3 [H] Lab orphans hang `running` forever** — `after()` jobs, reaper only on worker boot (`research-worker/src/index.ts:979`); no stale-run guard in `audit-state`. → Permanent spinner if Vercel kills the function. Effort M.
- **F4 [M] Impersonation data-path broken** — routes use raw Clerk `userId`, not `effectiveUserId`/`getJourneyDataUserId` (zero callers). Effort M.
- **F5 [M] `seedOrchestration` not idempotent** vs already-`complete` sections → orphan `queued` rows (`20260520_orchestrate_parent_child.sql:85-103`). Effort S/M.
- **F6 [M] Recent regression: active-run guard dropped.** `20260526_rollup_parent_on_section_commit.sql:118-134` redefines `commit_artifact_section` and removes the `v_current_run_id <> p_section_run_id` stale-writer check three prior migrations had. Last-applied wins. Effort S.
- **F7 [M] `freezeReviewedBriefSnapshot` non-atomic RMW race** on `research_artifacts.thesis` (`orchestrate-db.ts:82-129`). Effort S.
- **F8 [M] `auth()` wrapped `try/catch→401`** in `orchestrate`+`run-lab-section` masks transient Clerk failures; 4 other routes call it unguarded (inconsistent). Effort S.
- **F9 [M] `_capabilities` always 200** — down vs unconfigured indistinguishable (`_capabilities/route.ts:42-58`). Effort S.
- **F10 [M] Double `/orchestrate` kickoff** — `page.tsx:431` and `audit-reader-shell.tsx:603` both POST; shell guard resets on transient non-ok → duplicate fan-out, ~$1.50–2/pull wasted. Effort S.
- L: lab rerun can drop events via active-run join; app-side rollup duplicates in-RPC `roll_up_research_artifact`; dispatch vs lab dedupe gap; DB blips surface as `404 session_not_found`.

### G. Eval & observability
- **G1 [H] No eval gate.** Nothing measures real-tool-success-rate or claim-grounding before persist/ship (ties to A1). → Quality is unmeasured. Effort M (start: ~20-query LLM-judge harness; `research-worker/evals/` exists to extend).
- **G2 [M] No production decision-tracing** of agent paths (Anthropic reliability lesson) — hard to diagnose non-deterministic failures. Effort M.

### H. Where we coded the easy bullshit (cross-cutting highlight)
1. Provider `web_search` instead of an executable search tool (B1).
2. Ad probe returns `[]` instead of wiring tools or emitting an honest gap (B2/B6).
3. Relevance filter dropped — a name-score >0.5 instead of porting the hard matcher (B3).
4. `adEvidence` renderer built, then unplugged; missing field hidden by an `as unknown as` cast (E1/E2).
5. Telemetry + source-URL capture dropped in the lab reimplementation (F1/F2).
6. Streaming machinery exists, but the 6 shipped sections use the non-streaming path (D1).
7. `sources[0]` fallback instead of an honest unmatched-source gap (C1).
8. SERP shims (`reviews`, `keyword_ad_probe`) dressed as first-party data (B7).

---

## 4. Target architecture (assumes lab-canonical)

**One pipeline.** Lab-engine is the only section runner. The worker keeps the Perplexity corpus (ADR-0007); the worker *positioning* path is deleted after parity.

1. **Agent loop** — keep the answer-tool/ToolLoopAgent loop for tool control; add **partial-object streaming** to it (D1) so structure streams field-by-field. Add a **bounded claim/citation verifier** after research, before persist (A1): every numeric/price/quote/ad/competitor claim must cite a real tool result or be marked `inferred`/`gap`. Fail-closed when a required evidence class is missing (A2).
2. **Tools** — replace provider `web_search` with executable **`brave-search.ts`** (B1, design below); register as model-facing `web_search` so skills don't change. Port `main`'s relevance filter + domain plumbing into lab `adlibrary.ts`, wire `google_ads`/`meta_ads` into Competitor, render `adEvidence` (B2/B3/E1). Convert fail-soft-to-empty into typed gaps (B6). Rename SERP shims honestly (B7). Make skill tool-tables == registry, with a test that diffs them (B4).
3. **Context** — merge `evidence[].url` into sources, drop the `sources[0]` fallback for an explicit unmatched gap (C1); add section-scoped excerpt selection (C2).
4. **Streaming vertical** — `partialOutputStream` on the answer-tool path → persist/forward partials → `audit-state` exposes partial zone data (or reader consumes the UI message stream) → `experimental_useObject`-style field-by-field cards + a live tool-step trace driven off real tool events (D1–D4, F2).
5. **Observability/eval** — full telemetry rollup (`latestTool/latestSource/gaps/wave`, F1) + visited-URL capture (F2) + orphan reaper/stale-run guard (F3) + a ~20-query LLM-judge eval gate scoring factual + citation accuracy (G1).

### Brave executable search — design (from Codex §3)
New `src/lib/lab-engine/agents/tools/brave-search.ts`: `GET https://api.search.brave.com/res/v1/web/search`, header `X-Subscription-Token: process.env.BRAVE_SEARCH_API_KEY`, input `{q, count<=20, freshness?, country}`, output `{type:'result', results:[{title,url,description,extra_snippets}]} | ToolGap` (matches `_shared.ts`). Register as `web_search` in `TOOL_CATALOG`; **delete the special-case in `tool-registry.ts:18-24`** so it wraps through `wrapWithBudget` like every other tool → provider-agnostic (DeepSeek + Anthropic). Files: `tools/index.ts` (catalog + `ToolName`), `tool-registry.ts` (remove special-case), `ai/web-search-provider-tool.ts` (drop import), section registry unchanged (name stays `web_search`).

---

## 5. Execution sequence (Codex waves, each with a verify gate)

- **Wave 0 — surgical, decided, low-risk (ship now):** Brave `web_search` (B1) · `evidence[].url` source fix + drop `sources[0]` fallback (C1) · restore the stale-writer guard in a new migration (F6) · de-dupe the double `/orchestrate` kickoff (F10). *Verify:* `npm run build` + `test:run` green; one live section run shows real Brave results in the transcript; no duplicate orchestrate rows.
- **Wave 1 — competitor ads (the regression):** port `main`'s relevance filter + domain plumbing into lab `adlibrary.ts`, wire `google_ads`/`meta_ads` into Competitor, typed gaps on miss, wire the existing `competitor-ad-evidence.tsx` + fix the schema cast (B2/B3/B6/E1/E2). *Verify:* a real competitor returns relevance-filtered ads with no wrong-company creatives; renderer shows them.
- **Wave 2 — streaming + telemetry vertical:** partials on the answer-tool path, `audit-state` partial exposure, reader field-by-field + live tool trace, telemetry rollup + visited-URL capture, orphan reaper (D1–D4/F1–F3). *Verify:* cards fill progressively; no silent gaps; orphaned run reaches a terminal state.
- **Wave 3 — trust layer:** bounded claim/citation verifier + fail-closed gating + ~20-query eval harness (A1/A2/G1). *Verify:* eval gate scores citation accuracy; a section with unsupported claims fails closed.
- **Wave 4 — consolidation + cleanup:** skill↔registry parity + diff test (B4), retire dead capabilities or expose them (B5), rename SERP shims (B7), section-scoped context (C2), UI polish (E3–E7), delete the legacy worker positioning path. *Verify:* one pipeline; build green; design-system clean.

Each wave is a Codex hand-off (xhigh) with the spec template; I review the diff + QA-gate before the next wave.
