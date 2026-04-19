# Stage 04 — Verify

## Inputs

- Completed build from 03-build.

## Process

Run the full verification gate from `.claude/rules/verification.md`:

1. **Build**: `npm run build` exits 0.
2. **Tests**: `npm run test:run` passes (or the specific test file for the feature).
3. **Manual check**: UI → screenshot; API → curl; logic → test output.
4. **Spec match**: Re-read the 01-discover ask and success criteria. Does the code do what was asked?

## Checkpoints

- [ ] Build green.
- [ ] Tests green.
- [ ] Manual check produced a concrete artifact (screenshot, curl output, test log) captured in notes.
- [ ] Every success criterion from 01-discover is checked off.

## Audit

Record:
- Build time
- Test count + pass/fail
- Any deviations from spec (and whether they're acceptable / need a new feature)

## Outputs

- Verification report appended to `notes/<feature-slug>.md`.
- Handoff to `stages/05-ship/`.

## Forbidden

- "Should work" without running the build.
- Testing only part of the feature.
- Shipping before every success criterion is checked.
