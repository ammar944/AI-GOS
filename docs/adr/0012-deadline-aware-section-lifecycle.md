---
status: accepted
date: 2026-06-10
---

# Deadline-aware section lifecycle: salvage-commit over strand, review detached from the section clock

The checkle live run `9a9412a2` (2026-06-10) exposed two failure classes in the section job lifecycle:

1. **positioningBuyerICP died at the 285s job ceiling** after burning its clock on a doomed sequence: external-lookup budget exhausted → body fails validation → structured repairs retried against the same starved context → the final repair started near the deadline and was killed mid-flight → all partial work rolled back → run stranded at 5/6 (paid media never dispatches) until a human clicked rerun. The manual rerun committed cleanly in half the time, because it ran alone — free lanes, recovered rate limits.
2. **The post-commit agentic review failed on 2 sections** with `Failed to process successful response`. Root mechanism: the review runs inline in the same route invocation as the section job (route `maxDuration` 300s, job ceiling 285s), so a slow section leaves the 45s review only the residual seconds; the abort cuts the response body mid-stream and the AI SDK reports the truncated 200 as a processing failure. No inline timeout value fixes this arithmetic.

## Decision

**A section run is deadline-aware end to end, degrades to an honest thin commit instead of failing, retries once under better conditions, and never makes the tier review compete for its clock.**

- **Explicit deadline, gated phases.** The job deadline (`LAB_SECTION_JOB_TIMEOUT_MS`, unchanged at 285s) is threaded as an explicit `remaining()` everywhere the run chooses its next move. The answer loop's stop condition includes "remaining < emit floor → stop researching, emit now". A repair attempt may only START if `remaining()` covers a calibrated repair floor. Every model call carries `abortSignal: AbortSignal.any([jobSignal, AbortSignal.timeout(perCallCap)])` so one hung provider call cannot eat the section clock.
- **Repairs get cheaper, never louder.** Repair 1 is the existing full structured repair. Repair 2 is schema-minimal salvage: no tools, small output cap, unfillable fields become explicit evidence-gap markers (the honest-gap shape VoC already commits).
- **Salvage-commit.** If validation still fails and the clock cannot fund another repair, the best parseable body is coerced to the honest-gap shape and **committed** with `insufficient` tier and a gap rationale — instead of erroring and rolling back. This intentionally changes error semantics: a timeout now produces a committed-but-thin section, not an error card. Nothing fabricated is added; the truthgate, evidence gates, and `LAB_VERIFIER_MAX_UNSUPPORTED` semantics are untouched.
- **Auto-rerun once, after the wave.** If a section still hard-fails (crash, provider outage, nothing parseable), the orchestrator schedules exactly one fresh rerun after the fan-out wave drains — deliberately reproducing the free-lane condition that made the manual rerun succeed. Capped at 1 per section per run, event-logged.
- **Agentic review detached.** The tier review becomes its own dispatched job after section commit — own invocation, ~120s budget, non-thinking fast model — writing the tier upgrade and rationale to the section row; realtime pushes the badge update. `review unavailable` now means the review model genuinely failed, not that the parent invocation ran out of clock.

## Invariants

- The job ceiling stays 285s; route `maxDuration` stays 300s. Evidence says fresh attempts under better conditions beat longer clocks.
- A salvage-committed section is always visibly thin: `insufficient` tier, explicit gap markers, rationale naming the timeout path. The objective gate may still distinguish it; it must never read as a healthy section.
- Salvage-commit never invents content — it only narrows to what already parsed plus declared gaps.
- A run can no longer strand short of the paid-media dispatch because one section timed out, unless the auto-rerun also failed.
- The detached review remains badge-only enrichment: it can upgrade a tier, never block or mutate the committed body.

## Why not strict errors or a longer ceiling

Strict fail-on-timeout protects error semantics but costs unattended-run survivability — the product's path is client runs without an operator watching, and a stranded 5/6 run with no paid-media section is a worse deliverable than an honestly-badged thin section a strategist can rerun from the UI. Raising the ceiling just moves the cliff: the checkle rerun proved the win comes from retrying under recovered rate limits, not from more clock. Keeping the review inline at any timeout re-creates the residual-clock race every time a section runs long — the parent budget is the bug, so the review leaves the parent.
