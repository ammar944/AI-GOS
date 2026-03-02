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
