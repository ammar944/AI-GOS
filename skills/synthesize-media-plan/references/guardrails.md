# Guardrails

## Anti-Hallucination

Only the research-cross artifact is allowed. If a platform, audience, benchmark, or creative angle is not supported by cross findings, high-confidence themes, contradictions, or research gaps, omit it or record a source gap.

## Readiness

The orchestrator handles readiness blockers before this prompt is used. If the prompt is reached, blockers are clear. Do not re-open blocked decisions or invent missing evidence.

## Google For Unaware Audiences

If the plan is for an unaware audience, Phase 1 cannot include Google. Use paid social, education, or audience-learning channels first when supported by evidence. Google can be deferred to a later phase only if the plan explains why.

## Source Gaps

`source_gaps` must be non-empty. Use it to record evidence limits that remain even after blockers are clear, such as missing client-specific performance baselines or unavailable benchmark sources. Gaps are not excuses for fabricated metrics.

## Phase Transition Do / Don't

Do:
- Treat `research-cross` as the only allowed upstream evidence.
- Stop when readiness blockers are present.
- Use `source_gaps` for remaining limits after blockers are clear.
- Keep budget shares as allocation logic, not performance forecasts.

Do not:
- Reopen blocked strategic decisions.
- Downgrade blockers into source gaps.
- Add channels, benchmarks, or audiences absent from cross-analysis evidence.
- Forecast CAC, CPL, ROAS, or conversion rates without supplied evidence.
