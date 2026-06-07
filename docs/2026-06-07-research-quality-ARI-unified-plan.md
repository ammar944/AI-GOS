# Research Quality → 9/10: the ARI Unified Plan (canonical)

**Date:** 2026-06-07 · **Branch:** `feat/research-quality-truthgate` (base `e0b6bb62`) · **Status:** active, supersedes scattered truthgate handoffs
**Decision record:** `docs/adr/0010-annotated-research-input-quality-architecture.md` · **Glossary:** `CONTEXT.md` → "Research quality vocabulary"

> This is the ONE source of truth. It exists to stop the scattered-Codex drift. Every phase is driven by an isolated handoff, every diff is verified, and every phase is **judge-gated** (a live run scored by the offline judge — unit-green never substitutes for working). If a future change isn't in service of a phase here, it's drift — stop and reconcile this doc first.

---

## 0. The bar (resolved with the user, 2026-06-07)

**9/10 = a strong model (Claude/GPT-5.5) judges the Audit as accurate AND insightful** — built faithfully from Corpus + Onboarding, no hallucination, real grounded metrics (sales cycle, ACV, pricing), with non-obvious strategist reasoning that survives the "I already knew that" sweep. The deterministic gate is a **floor** ("honest enough to judge, safe to show"), never the grade.

Two quality axes, both required:
- **Trust** = accuracy, grounding, no fabrication, honest gaps. *(Already heavily built — this was the last month's work.)*
- **Insight** = non-obvious, decision-grade cross-section reasoning. *(The starved axis. This plan's center of gravity.)*

---

## 1. Verified diagnosis — the disease is lossy hop-by-hop compression

Information that could become insight is destroyed at every hop *before* anything tries to think. All claims below are code-verified.

| Stage | What's wrong | Evidence |
|---|---|---|
| Corpus | gated by **counts only**; no metric/richness judge — bland paraphrases pass as facts | `research-worker/src/runners/deep-research-program.ts:21-24` |
| Onboarding merge | raw JSON blob, zero strategic framing; evidence routed by crude keyword match | `build-prompts.ts:188`, `corpus-to-research-input.ts:672` |
| Sections | fan out **blind to each other**; insight enforced by regex | `orchestrate/route.ts`, `strategic-insight.ts` |
| Per-section review | a **fact-checker**, zero "add insight"; silently commits original on failure | `agentic-section-review.ts:227`, `supabase-run-store.ts:658` |
| Thinker | flash; reads **compressed** artifacts (told to ignore raw evidence); **self-grades**; **throw-and-drop** scores absence as fail; **client-dispatched** (tab-close = never runs) | `strategic-critic.ts`, `cross-section-reasoning/SKILL.md:23`, `use-audit-state.ts:313` |
| Gates | **no runtime caller** (offline diagnostic); measure honesty not insight; `projectionSync`==`projectionTrust` (dup) | `live-quality-gate.ts:1538,1546` |
| Models | prod silently runs review+strategy on **flash** (flash grades flash) | `models.ts:382-420` (collapse when `LAB_REVIEW_MODEL` unset) |
| Persistence | `verification_tier` copied to 3 surfaces that drift | profile / share / artifact |

**Blocker reframe (critical):** of the 3 "blockers" in the latest gate report, **two are not quality problems** — `projectionSync` is a stale-copy plumbing dup, and `researchQuality:insufficient` is mostly the substring verifier stamping `needs_review` on grounded sections. Only **BuyerICP** (corpus depth) and **strategyQuality knew-that** (model + the throw-and-drop bug) are real signal.

---

## 2. The unified architecture — ARI (Annotated ResearchInput)

**Don't build a new store/graph/orchestrator.** Annotate the one object that already flows through every stage.

```
corpus (worker) ─┐
                 ├─► MERGE: annotate Provenance + compute Coverage   ◄── SINGLE WRITER, authored once
onboarding ──────┘        = the Annotated ResearchInput (ARI)
                                  │ experimental_context (READ-ONLY transport, v6-native)
                 ┌────────────────┼────────────────┐
              section 1   …   section 6   (read thin slice + Coverage summary; writes ONLY its own Artifact)
                 └────────────────┼────────────────┘
                     SERVER-triggered THINKER  (deepseek-v4-pro + reasoning; reads FULL ledger + RAW evidence;
                                                 TAIL parse; deepen-once; NEVER throw-and-drop)
                                  │
                     deterministic GATE  (Coverage-backed; real runtime caller; ONE tier source)
                                  │
                     OFFLINE JUDGE  (Claude/Codex skill, read-only) ─► gaps map 1:1 to Coverage ids ─► iterate loop
```

### The shared object (ARI)
The existing `ResearchInput` (`researchInputSchema`, `artifact-envelope.ts`), with three **optional** additions (so old runs parse unchanged):
1. `provenance` on onboarding economics + competitor seeds (`user-supplied`) and corpus items (`source-reported`). Reuse the live enum at `build-prompts.ts:547`.
2. `coverage: { items: { id, status: grounded|thin|missing, source: provenance, evidenceRef? }[] }` — computed deterministically at the merge; onboarding-supplied items pre-marked `grounded`.
3. `belowFloor?: boolean` on the cross-section critique (extend the `.strict()` schema — a required pre-step).

### Correctness rules (non-negotiable)
- **Single writer for durable shared context.** Provenance + Coverage authored once at the merge. Sections never mutate shared run context. Thinker writes only its capstone; each section writes only its own Artifact.
- **`experimental_context` is in-flight transport only.** Durable ARI = run-scoped Supabase JSON. Per-run object, **never a module-level singleton** (races under the 6-section fan-out).
- **JSON, never Markdown** for the persisted ledger (models silently rewrite Markdown).
- **Read-only fan-in.** Cross-section visibility comes from the now-strong server Thinker reading the full ARI, NOT from sections seeing each other live (which would need a re-dispatch controller = rewrite).

---

## 3. AI SDK v6 guardrails — the anti-drift contract (READ BEFORE WRITING CODE)

Every item verified against `node_modules/ai/dist/index.d.ts` (`ai@6.0.178`), `@ai-sdk/deepseek@2.0.35`, and the local v6 crash-course. **These are the traps that cause "new high-quality app" drift.**

**DO NOT USE:**
- `generateObject()` / `streamObject()` for new sites → use `generateText` + `Output.object` (repo has zero `generateObject` sites).
- `result.object` for the `Output.object` path → read **`result.output`**. *(The course 01.03 README snippet is wrong; 01.11 solution is right.)*
- `maxSteps` → `stopWhen: stepCountIs(n)`. `isStepCount` **does not exist** in 6.0.178 (context7 served a stale example).
- `runtimeContext` / `toolsContext` / `contextSchema` → **AI SDK 7 only, absent here** → use `experimental_context`.
- `parameters:` on `tool()` → `inputSchema`. `maxTokens` → `maxOutputTokens`.
- `system:` on `ToolLoopAgent` → agents use **`instructions`** (mixing silently drops the prompt). `telemetry` → `experimental_telemetry`.
- Provider-native `Output.object` on `deepseek-v4-flash/-pro` as the **trusted** structured path → DeepSeek JSON mode is NOT strict-schema. Keep answer-tool + Zod-safeParse repair, and the `<tag>{json}</tag>` regex-TAIL for critic/thinker/judge.
- `@ai-sdk/gateway` / `@ai-sdk/anthropic` in the **prod request path** → offline/dev only (`createGateway` hard-throws without auth).
- `.min()/.max()` on Zod numbers in **Anthropic** (offline judge) schemas → use `.describe()` + post-validate.
- Module-level mutable ledger singleton; Markdown ledger; `convertToModelMessages` without `await` (it's async in v6).

**MUST DO:**
- `ToolLoopAgent` default `stopWhen` is `stepCountIs(20)` → set an **explicit lower cap** (the section path caps at 12; `run-section.ts:1701`) or it burns up to 20 DeepSeek calls.
- New in-loop tools (e.g. claim-record) **consume steps** alongside `Output.object` → bump the `stepCountIs` budget or the final answer starves.
- `stopWhen` custom predicates only evaluate **after a step that produced tool results** — gate any coverage predicate off a tool result, not a text step.
- Pro model id rides `DeepSeekChatModelId`'s `(string & {})` escape hatch → no type validation; centralize as a const and **live-probe once** before trusting (matches the repo's "verify the credential with one probe" rule).
- Pro thinker needs its **own** `providerOptions`: `{ deepseek: { thinking: { type: 'enabled' }, reasoningEffort: 'high' } }` (section path hardcodes `thinking:{type:'disabled'}` at `section-agent.ts:506/581`). A reasoning model may fail single-shot structured output → use the TAIL idiom / two-pass.
- Forward `abortSignal` into every long/thinker/judge call — a cancelled `deepseek-v4-pro` run leaks tokens (cost-sensitive prod).
- Preserve the timeout ladder: `answerToolTimeoutMs 255s < LAB_SECTION_JOB_TIMEOUT_MS 270s < route maxDuration 300s`.

---

## 4. Context-management strategy (bounded by slicing, never dumping)

| Stage | Reads | Budget |
|---|---|---|
| Section | existing `corpus.sectionExcerpts[id]` slice (`build-prompts.ts:309-325`) + **thin** Coverage summary + a `readLedger` query tool (just-in-time, gated via `prepareStep activeTools`) — NOT the full ledger | ~flat vs today (+~1 token/fact for provenance) |
| Per-section review | existing `MAX_CORPUS_EXCERPTS` / `MAX_EXCERPT_CHARS` caps + provenance labels | unchanged ceiling |
| **Thinker** (1 call) | full committed artifacts (~25k) + raw `corpus.excerpts` (~10–30k) + Coverage summary (~0.5k) → **~50–60k into deepseek-v4-pro** | the one call where full evidence earns its cost; deepen-once re-sends only failing items |
| Gate | persisted artifact + Coverage (deterministic, no model call) | n/a |
| Offline judge | everything, on Claude/GPT-5.5 offline | unconstrained, zero prod cost |

Compaction for the ~27-min run: `prepareStep` `messages` swap / `pruneMessages` (exported in 6.0.178) — replay distilled ledger claims, not raw transcripts.

---

## 5. Execution phases (each shippable + judge-gated)

> Sequencing rule: **Phase 0 stands up the ruler before anything changes.** Pro is **thinker-only** (resolved). Live ~$2 Ramp E2E + offline judge is the gate for behavior-changing phases.

### Phase 0 — Make it measurable (no prod behavior change)
- Wire the offline judge skill to read saved artifacts + gate report; run it on the existing Ramp 8/10 to capture a **numeric baseline + fact-mapped gap list**.
- Fix the 2 free bugs: `live-quality-gate.ts:1538` `projectionTrust=projectionSync` dedup; give `evaluateLiveQualityGate` a server-side caller that persists a (initially partial, on 6/6) report.
- **Ships alone. Measure:** `tmp/research-quality-review/<runId>-REVIEW.md` with baseline score.

### Phase 1 — Cheap verified wins (the unanimous harvest)
- **Throw-and-drop fix** (`strategic-critic.ts`): extend the `.strict()` critique schema with `belowFloor?`, then on floor-miss return the upgraded body + partial critique + `belowFloor:true`; deepen-once before fallback. *(Stops scoring absence as failure.)*
- **Provenance on onboarding** at the merge (`corpus-to-research-input.ts`, via `buildEconomicsBriefFields:336`); thread into the per-section review prompt so the operator's own ACV is no longer flagged unsupported. *(Fixes the TruthGate root cause.)*
- **`buildOnboardingStrategicFrame()`** replacing the raw-JSON onboarding dump in the section prompt.
- **Ships independently + reversibly. Measure:** re-run judge — expect knew-that to clear and user-economics false-fails to vanish.

### Phase 2 — Server-owned, evidence-fed, pro Thinker
- Move thinker trigger **server-side** from `run-lab-section` on last-section commit (idempotent via dispatch-zones guard); keep client trigger as fallback.
- Relax `cross-section-reasoning/SKILL.md:23` to permit reasoning over `researchInput.corpus.excerpts`.
- Route thinker+critic to `deepseek-v4-pro` via a **second `deepseek(DEEPSEEK_PRO_MODEL_ID)` instance threaded into `strategyModel` ONLY** (sections+repair stay flash); pro gets `thinking:{type:'enabled'}` + reasoning effort; live-probe the id once.
- **Gate = LIVE ~$2 Ramp E2E + offline judge. Measure:** thinker runs on tab-close; tensions cite raw evidence; knew-that above floor; cost ≈ +1 pro call/run.

### Phase 3 — Coverage floor + gate teeth (additive)
- `buildCoverage(researchInput)` at the merge (deterministic, onboarding pre-grounded); attach to ARI; the Phase-0 gate caller consumes it.
- Convert `live-quality-gate` structural-presence checks to **coverage-backed** checks. Add optional Sonar `metricValue/metricUnit` ask.
- Persist Coverage + gate report once on the artifact; **collapse the 3-copy `verification_tier`** to read-from-one.
- **Observe-only first** (log + `needs_review` badge), enforce only after the judge confirms coverage is reliably met. **Measure:** bland-paraphrase fixture → `thin/missing`; real run → `grounded`.

### Phase 4 — Corpus richness (worker, separate deploy, OPTIONAL — defer)
- Only if Phase 3 shows present-but-bland metrics still passing: self-contained `gradeCorpusRichness()` in the worker (no `src/lib` import) + ONE bounded, abort-conditioned targeted re-fetch (anti-fabrication citation check still applies).
- **Capture the worker's OWN build baseline first** (worker has pre-existing `@types` errors). Skip entirely if Phase 3 clears the accuracy bar.

---

## 6. What to STOP doing (verified dead-ends)
- ❌ New ledger table/graph with concurrent section write-back (lost-update race; `e0b6bb62`/`d86abe54`).
- ❌ 2-wave "await section commit" fan-out (`orchestrate` only awaits an ACK; work runs in `after()`).
- ❌ ToolLoopAgent coverage-orchestrator control plane (fights serverless `after()`).
- ❌ Constant-flip model upgrade (sends the WHOLE pipeline to pro — costliest change).
- ❌ Entity/claim collision graph promoting cross-origin tensions to thinker threads (blocked by `validateNoNewSourceSectionRefs:370`).
- ❌ Replacing the keyword excerpt router wholesale (live routing spine; leave as fallback).
- ❌ Adding a 4th persisted `verification_tier` copy; hardening gates that don't run at runtime.

---

## 7. Resolved decisions
- **Bar / judge:** strong model (Claude/GPT-5.5), **offline only** via the read-only Claude/Codex skill; drives the iterate loop; zero prod API cost.
- **Prod:** DeepSeek-only, no gateway, no Anthropic at runtime.
- **Pro scope:** thinker+critic only (Phase 2). A/B pro-on-drafting only if blandness persists after Phase 3.
- **Deepen-once re-prompt:** yes, capped at exactly once, then commit best-effort with `needs_review`. Never throw-and-drop.
- **Thinker trigger:** server primary + client idempotent fallback.
- **Execution:** canonical doc (this) + ADR-0010 → drive Codex phase-by-phase with isolated handoffs, verify each diff, judge-gate each phase.

---

## 8. Seam map (file pointers)
- Corpus: `research-worker/src/runners/deep-research-program.ts`
- Merge (ARI author point): `src/lib/research-v2/corpus-to-research-input.ts` (`buildEconomicsBriefFields:336`, `topicSectionMap:106`, `excerptMatchesKeywords:672`)
- Prompts / provenance enum / onboarding dump / section slicer: `src/lib/lab-engine/agents/build-prompts.ts` (`:547`, `:188`, `:309-325`)
- Section agents (v6 ToolLoopAgent): `src/lib/lab-engine/agents/section-agent.ts` (runners `294/332/375/416`, providerOptions `506/581`, structured caller `1170/1210`)
- Section runner / graft point / step cap: `src/lib/lab-engine/agents/run-section.ts` (`answerToolMaxStepCount:1701`, capstone graft `~3345`, `applyStrategicCriticIfNeeded:8781`)
- Answer tool: `src/lib/lab-engine/agents/answer-tool.ts`
- Per-section review: `src/lib/research-v2/supabase-run-store.ts` (`attachAgenticReview:243/658`), `src/lib/lab-engine/agents/review/agentic-section-review.ts` (`:227/290`)
- Thinker / critic: `src/lib/lab-engine/agents/strategic-critic.ts` (`generateText:469`, throw `~330`, `validateNoNewSourceSectionRefs:370`, fallback `~500`); schema `src/lib/lab-engine/artifacts/schemas/cross-section-reasoning.ts`; `cross-section-reasoning/SKILL.md:23`; client trigger `use-audit-state.ts:313`
- Gate: `src/lib/research-v3/live-quality-gate.ts` (`evaluateLiveQualityGate:1546`, dup `:1538`)
- Models: `src/lib/lab-engine/ai/models.ts` (`DEEPSEEK_SECTION_MODEL_ID:11`, `createDeepSeekDirectSelection:382`, `LAB_REVIEW_MODEL` channel)
- Coverage gate clone target: `src/lib/lab-engine/sections/required-evidence.ts`
- `experimental_context` proof-of-use: `src/lib/ai/tools/research/dispatch.ts:43`
- Offline judge skill: `/Users/ammar/.agents/skills/ai-gos-research-quality-review/SKILL.md`
- Strategic rubric / knew-that floor: `src/lib/lab-engine/artifacts/strategic-rubric.ts` (`STRATEGIC_KNEW_THAT_PASS_FLOOR = 0.4`)

---

## 9. Sources behind this plan
- `docs/adr/0010-annotated-research-input-quality-architecture.md`
- Architecture design pass: 4 grounded proposals + adversarial critique + synthesis (ARI).
- AI SDK v6 grounding pass: local v6 crash-course + live context7 `ai@6` docs + Anthropic context-engineering ("Effective context engineering", "Building Effective Agents", "Effective harnesses for long-running agents") + repo idioms.
