# AGENTS.md - src/lib/lab-engine/agents

## Purpose

- Owns section agent execution, answer-tool flow, tool orchestration, prompt assembly, repair/rescue paths, telemetry, and cross-section facts.

## Ownership

- `run-section.ts` is the section execution entrypoint.
- `answer-tool.ts`, `section-agent.ts`, `section-tools.ts`, and `tool-registry.ts` own the model/tool loop contract.
- `tools/` owns live data acquisition integrations.
- `verification/` owns deterministic and model-assisted evidence support checks.

## Local Contracts

- Keep deterministic validation and structural verification ahead of any soft judgment path.
- Do not weaken verifier or required-evidence behavior to make a run pass.
- Validate tool results before passing them into generation.
- Preserve section IDs, run IDs, source URLs, and claim/source attribution through the pipeline.
- No catch-all repair path may hide the original error context.
- Executive brief synthesis always composes from surviving evidence when at least one committed section exists; contradictions are deduped, deterministically reconciled where possible, and carried as client-language caveats instead of a blocked client output.

## Work Guidance

- Prefer small helpers over multi-mode functions in the run loop.
- Keep prompt construction, tool execution, artifact validation, and persistence concerns separable.
- Add tests for repairs, verifier changes, and tool-output edge cases.

## Verification

- Run `npm run test:run -- src/lib/lab-engine/agents`.
- For tool changes, include tests for the specific tool or caller.

## Child DOX Index

- `tools/AGENTS.md` - Live tool integrations and normalized tool result contracts.
- `verification/AGENTS.md` - Evidence support, claim extraction, source attribution, and verifier thresholds.
