# Verification Gate (MANDATORY)

NEVER deliver code without passing ALL of these:

1. **Build passes**: `npm run build` exits 0
2. **Tests pass**: `npm run test:run` (or specific test file for the feature)
3. **Manual check**: UI → screenshot. API → curl. Logic → test output.
4. **Matches spec**: Re-read the task. Does the code do what was asked?

## Forbidden
- Delivering code you haven't tested
- Saying "should work" without confirming
- Testing only part of the feature
- Skipping the verification report

## Bug Fix Protocol
Before writing ANY fix, answer these 3 questions:
1. **Root cause**: Why does the architecture allow this bug?
2. **Reproduction**: Under what conditions does it occur?
3. **Regression risk**: What could break this fix later?

## Vague-Ask Rewriting (MANDATORY before starting)

Vague asks produce vague code. Before writing any code, rewrite the ask into a verifiable goal. Concrete examples:

| Vague ask | Rewritten verifiable goal |
|---|---|
| "Add validation" | "Write tests for invalid inputs (empty, malformed, oversized), then make them pass." |
| "Fix the bug" | "Write a failing test that reproduces the reported symptom, then make it pass." |
| "Refactor X" | "Ensure the existing test suite passes before and after, and no public API changes." |
| "Make it faster" | "Benchmark the current hot path, profile the bottleneck, change it, show the benchmark is faster." |
| "Clean this up" | "Name the specific code smell, the metric that will improve (file length, cyclomatic complexity, import count), and the before/after numbers." |
| "Improve the UX" | "Write the success criteria as a user-visible check — e.g. 'clicking Submit with an empty form shows inline error within 100ms'." |

Rule: the first line of the verification section (step 4 "Matches spec") must reference the rewritten goal, not the original ask. If the rewritten goal doesn't have a concrete check, go back and sharpen it before writing code.

## Run verification, don't guess at it

Prefer running the code to reasoning about it. If a test suite, linter, or type checker exists, run it. Never report "done" based on a plausible-looking diff alone — plausibility is not correctness. When debugging, fix the cause, not the symptom. Suppressing an error is not fixing it. When reading stack traces, read the whole thing — half-read traces produce wrong fixes.
