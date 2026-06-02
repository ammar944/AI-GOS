# Codex Handoff — Task 8: Env-gated verifier hard-fail threshold

> **Executor:** Codex (`-c model_reasoning_effort=xhigh -s workspace-write`). Edit files only — do NOT run git. Claude gates + commits.
> **Worktree:** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`.
> **Builds on:** the verifier-teeth commit `8d547baf` (force-repair + non-terminal commit-with-badge).

## GOAL
Wire an OPTIONAL hard-fail gate so the operator can, when ready, refuse to commit sections with too many unsupported load-bearing claims — WITHOUT changing today's default behavior. Default (env unset) = current non-terminal commit-with-honest-badge. This makes the capability exist + tested; the operator activates it after seeing live repair-success rates.

## DESIGN
- New env knob read at runtime: `LAB_VERIFIER_MAX_UNSUPPORTED` — integer = the maximum unsupported load-bearing claims a section may still COMMIT with. **Unset/empty/NaN ⇒ Infinity (today's behavior; always commit-with-badge).**
- In `evidence-support.ts`: add a pure helper `getMaxUnsupportedAllowed(env?: Record<string,string|undefined>): number` (returns parsed int or Infinity) — pure + injectable for tests (don't read process.env directly inside the hot path; read once + pass in, mirroring existing config patterns in run-section.ts e.g. `getPositiveIntegerEnvValue`).
- In `run-section.ts` `runSectionViaAnswerTool` terminal logic (the block after the repair loop where `bestCommittableAttempt` is chosen): after repairs, if the chosen committable attempt's `evidenceSupportShortfall.unsupportedLoadBearing.length > maxAllowed`, treat it as a section FAILURE (record `section-failed` with reason, throw `SectionRunnerError`) INSTEAD of committing. If within `maxAllowed` (or maxAllowed is Infinity), commit-with-badge exactly as today.
- Emit a distinct `validation-failed`/`section-failed` reason like `evidence-gate: N unsupported load-bearing claims exceed max M` so it's debuggable.

## CONSTRAINTS (critical)
- **Default behavior MUST be byte-identical to today** when the env is unset. The existing verifier-teeth tests (run-section-corpus-only.test.ts: "commits with the honest badge when unsupported load-bearing claims survive repairs") MUST still pass unchanged — that test runs with no env set, so it must still COMMIT.
- No change to `evaluateEvidenceSupport` output shape. tsc 0, lint 0, full `test:run` green.
- Do NOT run git.

## TESTS (add to run-section-corpus-only.test.ts or a new evidence-gate test)
1. env unset + 1 residual unsupported → section COMMITS (badge) — i.e. default unchanged.
2. `LAB_VERIFIER_MAX_UNSUPPORTED=0` + 1 residual unsupported after repairs → section FAILS (no commit, section-failed emitted).
3. `LAB_VERIFIER_MAX_UNSUPPORTED=2` + 1 residual unsupported → COMMITS.
Use dependency injection for the env (pass the threshold into the runner/helper) rather than mutating process.env if the existing test harness supports it; otherwise set/restore process.env around the test.

## VERIFY (Claude re-runs)
```bash
cd /Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire
npx tsc --noEmit && npm run lint
npm run test:run -- src/lib/lab-engine/agents
npm run test:run        # full green; default-behavior tests unchanged
```
## DONE WHEN
The threshold gate works when the env is set, default behavior is provably unchanged when unset, and all gates are green.
