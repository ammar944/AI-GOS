# Codex Prompt — DeepSeek Lab-Engine Research Quality & Technical-Depth E2E Eval

> Paste the block below into Codex (cloud/browser), pointed at branch **`feat/v2-lab-section-wire`**.
> Dispatch with high reasoning effort.

---

You are evaluating the **data quality and technical depth of our DeepSeek research pipeline** (corpus → 6 positioning sections + paid-media plan) on branch `feat/v2-lab-section-wire`. We are about to ship this to production and I need to trust the data. Be a skeptical independent grader: every claim must cite a `file:line`, a DB row, or a real run transcript. No "looks good," no fabrication. Treat anything I assert below as a **hypothesis to verify or refute**, not fact.

## The standard
Grade us against a best-in-class deep-research agent — **Perplexity / Claude research-grade**: real tool use, grounded citations, per-section workflows, iterative refinement, calibrated confidence. The biggest separator between that and a glorified single LLM call is an **executable way to verify its own work against ground truth (real tool results + citations) inside a bounded loop** — not model size. Calibrate "excellent" to that. Reference Anthropic's "Building effective agents," "Effective context engineering for AI agents," and "How we built our multi-agent research system."

## Grade THIS system (and only this one)
- The shipped reader fires `executionMode: 'lab'` → `POST /api/research-v2/run-lab-section` → `runLabSectionJob` (`src/lib/research-v2/lab-section-job.ts`) → the **in-process lab-engine** in `src/lib/lab-engine/`. Section model = `sectionRunnerModel` (DeepSeek `deepseek-v4-flash`, `LAB_ENGINE_PROVIDER=deepseek-direct`). **This is the system to grade.**
- **IGNORE the Anthropic worker path** (`research-worker/src/runners/positioning/`, `research-worker/src/agents/subagents/`, draft/deep modes). It still exists but the reader never fires it. Do not waste effort grading it — except in the competitor-regression comparison vs `main` below.
- Entry points to audit: `src/lib/lab-engine/agents/run-section.ts` (the section agent — model, tool loop, skill load, context), `src/lib/lab-engine/sections/section-registry.ts`, `src/lib/lab-engine/artifacts/artifact-envelope.ts` (input `ResearchInput` + output schemas), `src/lib/research-v2/corpus-to-research-input.ts` (corpus → section input), `src/lib/research-v2/lab-section-dispatch.ts`.

## What I need answered (each with evidence)
1. **Are the tools actually firing?** `run-section.ts` wires a `ToolBudget`, `allowedTools`, and `researchTools`/`externalTools`, but it has a `"No external research tools are available"` fallback (~line 536) and the ~11 tool adapters **fail-soft** to empty on missing keys/errors. So: on a real run, how many real tool calls happen per section, or is the section just LLM synthesis over the corpus? Count them from the run transcript / telemetry. **This is the linchpin — verify it first.**
2. **Are the right skills being used?** Confirm each section loads its `SKILL.md` (`loadSkill` → a `"skill-loaded"` event) and find where the lab-engine's section skills live. Read every section's SKILL.md and judge whether the workflow it defines is genuinely good (task decomposition, evidence standards, tool-usage guidance, IRON LAWs) or shallow boilerplate.
3. **Does each section have a properly defined schema + workflow it writes against?** Read the per-section output schemas in `artifact-envelope.ts` / the section registry. Decision-grade structure, or thin prose with a schema wrapper?
4. **How good is the corpus builder as a research agent, and the context engineering?** Audit how the corpus is built and how it's turned into each section's `ResearchInput` (`corpus-to-research-input.ts`). Is context engineered (scoped, just-in-time, compacted, right-altitude) or dump-everything / naive keyword excerpting? Is the corpus the real bottleneck on quality?
5. **Is there real technical depth?** Grounded + accurate citations, generator→critic refinement, per-claim confidence, bounded loops — or one-shot synthesis dressed as an agent?
6. **Competitor-ad regression vs `main` (I specifically feel this got worse).** `main` produced real ad-library data — `research-worker/src/tools/adlibrary.ts` (~1,429 lines, real `google_ads_transparency_center` + `meta_ad_library` SearchAPI engines, structured ad creatives + active counts + library links). The lab-engine's `artifact-envelope.ts` DOES define a `competitorAdSchema` (headline/body/platform/creativeUrl/angle) — so the question is whether those fields get **populated with real fetched ads**, or come back empty/fabricated because the ad tools fail-soft. Compare the current competitor section output against `main`'s, quantify exactly what was lost (real fetches, fields, parallelism), and quote both sides (`git diff main -- <path>`, `git show main:<path>`).

## How to run it (use multiple agents / parallel passes)
Spawn parallel workstreams where your harness allows; each must emit evidence:
- **WS1 Machinery audit** (static): a truth table for corpus + each of the 6 sections + paid-media — {model, tools actually fired, SKILL.md loaded y/n, schema richness, context inputs}, every cell cited `file:line`.
- **WS2 Live e2e run**: drive ONE real company end-to-end through the `'lab'` path and capture the full behavioral transcript (tool calls, skill-loaded events, phases). The route is Clerk-gated, so run headless by importing `scheduleLabSectionJob`/`runLabSectionJob` (plain lib funcs, no Clerk) with a `ResearchInput` built via `corpusToResearchInput` — **or**, for zero spend, reuse the most recent completed `'lab'` run already in Supabase and grade its persisted artifacts. If live API keys aren't available in this environment, do the full static audit + grade the latest persisted run, and say which parts you couldn't run live.
- **WS3 Per-section grading** on the rubric below (A–D + a quoted-evidence justification per dimension). Use string-grade→number to avoid numeric bias; always include a citation sub-score.
- **WS4 Competitor regression** (item 6) — quantified, quoted, with git refs. Briefly note whether the other 5 sections also lost real fetches vs `main`.
- **WS5 Control experiment**: pull the exact `ResearchInput` one section receives (start with **Competitor Landscape**, then **Buyer ICP**), and YOU write that section to the same schema using whatever real research you can do. Grade your output vs ours on the same rubric — honestly, including where you also fell short. This isolates workflow/prompt quality from corpus quality.
- **WS6 Synthesis**: roll up; bucket every kink into (i) tools-fail-soft/config, (ii) tool depth (e.g. ad-library), (iii) schema/skill quality, (iv) corpus/context engineering, (v) model/provider. Prioritize by impact-on-quality × effort.

## Persistence + telemetry (where to look)
- `research_artifacts` (parent; `id` = uuid `parent_audit_run_id`, also has text `run_id`), `research_artifact_sections` (per `zone`: markdown/data/claims/sources), `research_section_runs` (lifecycle + tool telemetry), `research_section_events` (live events). Also `journey_sessions.research_results` (JSONB). **Gotcha:** users key runs by `run_id`; `research_artifacts.id` is the parent uuid.
- `GET /api/research-v2/audit-state?run_id=<uuid>` → per-section `phase`, `wave`, `latestTool`, `latestSource`, `capabilityGaps` — use it to see whether tools fired.
- Reuse the `research-worker/evals/` harness where useful.

## Rubric (grade corpus + each section A–D; A=4…D=1; evidence + quote each)
1. Real tool use (real retrieval/fetch, not parametric memory; not a SERP shim posing as ad data) — **expect this to be the weak point; prove or refute.**
2. Multi-step tool loop & bounded control flow.
3. Task decomposition & planning.
4. Context engineering (scoped/just-in-time/compacted vs dump or naive excerpting; corpus-as-bottleneck).
5. Evidence grounding & citation discipline (every claim → real, accurate source; no invented pricing/numbers).
6. Iterative refinement & self-critique (generator→evaluator actually improves output).
7. Per-section workflow design (clear objective, scoped tools, distilled return) + SKILL.md quality.
8. Structured, schema-valid, decision-grade output (esp. the competitor ad fields — present AND populated?).
9. Confidence calibration & gap disclosure (verified vs inferred; gaps named, not fabricated).
10. Eval-driven quality & observability (measured, traceable, not "looks good").

## Guardrails
- **Don't refactor or fix anything** — report only. A fix spec comes later.
- **Don't touch `.env*` or print secrets** — reference env var names only.
- **Bounded spend, no API loops:** at most one live run; if running fresh, do Competitor Landscape + Buyer ICP at minimum, the full 6 only if estimated spend stays under ~$5. Reuse any completed run for free first. If a run errors twice, capture the error and STOP.

## Deliverable
Write a report (`docs/2026-05-27-lab-engine-quality-REPORT.md` or output inline) with: (1) **Verdict** + the single biggest lever to reach a Perplexity/Claude-research standard; (2) **Machinery truth table** (WS1); (3) **Per-section scorecards** + heatmap (WS3); (4) **Competitor regression proof** vs main (WS4, quantified + quoted + git refs); (5) **Control experiment** result (WS5); (6) **Prioritized kinks**: kink → category → evidence → impact (H/M/L) → effort (S/M/L) → recommended fix; (7) **Model/provider truth** (confirm DeepSeek `deepseek-v4-flash` for sections + what serves the corpus — Perplexity per ADR-0007? verify); (8) **What you couldn't verify.** Lead with evidence; if any hypothesis above is wrong, say so plainly and show why.
