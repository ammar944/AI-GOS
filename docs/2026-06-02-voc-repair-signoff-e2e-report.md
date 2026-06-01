# VoC Repair Signoff E2E Report - 2026-06-02

## Summary

Result: **STOPPED BEFORE PAID RUN**.

The `ramp.com` browser audit was not started. The preflight gate `npm run test:run` failed with 8 failed tests across 6 files, so the handoff stop rule applies. No source edits, migrations, deploys, retries, or paid audit attempts were made after the failing gate.

## Proof Target

- Worktree: `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`
- HEAD under test: `2c2f8f35`
- Dirty proof target: yes
- Diff stat captured in `tmp/voc-repair-signoff-2026-06-02/git-diff-stat.txt`
- App process: `http://localhost:3000`, PID `3307`
- PID cwd proof: `tmp/voc-repair-signoff-2026-06-02/app-pid-cwd.txt`

Dirty diff under test:

```text
7 files changed, 219 insertions(+), 42 deletions(-)
```

The changed files are the dirty working-tree fixes from the handoff area:

- `src/lib/lab-engine/agents/run-section.ts`
- `src/lib/research-v2/supabase-webhook-adapter.ts`
- related tests and local package/middleware/doc drift shown in the captured diff stat

## Preflight Gates

| Gate | Result | Evidence |
| --- | --- | --- |
| `npx tsc --noEmit` | PASS | `tmp/voc-repair-signoff-2026-06-02/gate-tsc.log` is empty and command exited 0 |
| `npm run lint` | PASS with baseline warnings | `tmp/voc-repair-signoff-2026-06-02/gate-lint.log` reports 66 warnings, 0 errors |
| `npm run test:run` | FAIL | `tmp/voc-repair-signoff-2026-06-02/gate-test-run.log` reports 8 failed tests |
| `npm run build` | NOT RUN | stopped after failed test gate |
| `cd research-worker && npm run build` | NOT RUN | stopped after failed test gate |

Final Vitest summary:

```text
Test Files  6 failed | 159 passed | 1 skipped (166)
Tests       8 failed | 1279 passed | 1 skipped (1288)
Duration    204.46s
```

## Runtime Checks

The app process on `:3000` belongs to this worktree. The raw `lsof -F` output uses `p`, `f`, and `n` field prefixes; the cwd name field resolves to `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`.

```text
APP_URL=http://localhost:3000
APP_PORT=3000
APP_PID=3307
p3307
fcwd
n/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire
```

Unauthenticated `curl -I http://localhost:3000/research-v2` returned Clerk middleware output:

```text
HTTP/1.1 404 Not Found
x-clerk-auth-reason: protect-rewrite, dev-browser-missing
x-clerk-auth-status: signed-out
```

The app-side `_capabilities` curl could not be trusted because the unauthenticated request was Clerk-rewritten to HTML, not JSON. Local worker `/capabilities` returned `status: ok`, `authConfigured: true`, live tool booleans, and `orchestrate_supported: false`. Because the test gate failed first, authenticated browser capability verification was not attempted.

## Run Details

- Paid browser run: **not started**
- `run_id`: none
- Screenshots: none
- DB/audit-state extraction: not applicable
- Reason: preflight test gate failed before the paid boundary

## Pass/Fail Table

| Criterion | Result | Evidence |
| --- | --- | --- |
| VoC completes | NOT RUN | blocked before paid audit |
| No stale cards | NOT RUN | blocked before paid audit |
| Repair storm gone | NOT RUN | blocked before paid audit |
| B4 latency | NOT RUN | blocked before paid audit |
| B2 commit | NOT RUN | blocked before paid audit |
| B3 ads | NOT RUN | blocked before paid audit |
| Capstones | NOT RUN | blocked before paid audit |

## Failure Dossier

The blocking failure is the full-suite preflight regression.

Failed tests from `gate-test-run.log`:

1. `src/app/research-v2/__tests__/page-one-pager.test.tsx`
   - `renders the light top bar, active section controls, and eight-section rail`
   - Failure: test timed out in 5000ms

2. `src/components/onboarding/__tests__/onboarding-wizard.test.tsx`
   - `Continue advances to the next step; Back returns`
   - Failure: test timed out in 5000ms

3. `src/components/research-v2/__tests__/audit-reader-shell.test.tsx`
   - `does not surface section confidence in the header or progress strip`
   - Failure: test timed out in 5000ms

4. `src/lib/journey/__tests__/read-research-result.test.ts`
   - `returns null when no session exists`
   - Failure: test timed out in 5000ms

5. `src/lib/journey/__tests__/read-research-result.test.ts`
   - `returns section data when research_results contains the section`
   - Failure: expected a section object, received `null`

6. `src/lib/journey/__tests__/session-state-server.test.ts`
   - `returns { ok: true } on successful write`
   - Failure: test timed out in 5000ms

7. `src/lib/journey/__tests__/session-state-server.test.ts`
   - `returns { ok: false, error } when Supabase returns a non-retryable error`
   - Failure: expected mock RPC to be called once, got twice

8. `src/lib/lab-engine/agents/__tests__/run-section-ad-prepass-verifier.test.ts`
   - `treats deterministic ad-prepass creative URLs as verifier-supported evidence`
   - Failure: test timed out in 5000ms

Subagent failure classification: 6 of 8 failures are default 5000ms timeouts and 2 are assertions. The failures cluster around UI/rendering, journey/Supabase persistence, and one ad-prepass verifier test. The ad-prepass verifier failure is adjacent to B3 competitor/ad evidence, but it is not a direct VoC repair criterion.

VoC-specific tests in the same full run passed:

- `src/lib/lab-engine/agents/__tests__/run-section-voice-of-customer-candidates.test.ts`, line 138
- `src/lib/lab-engine/agents/__tests__/voice-of-customer-candidates.test.ts`, line 557
- `src/lib/lab-engine/artifacts/schemas/__tests__/voice-of-customer.test.ts`, line 601
- `src/lib/lab-engine/agents/__tests__/build-prompts.test.ts`, line 602

Regardless of direct relation, the handoff requires the full test gate to pass before the paid run.

## Calibration Data

No live calibration data was produced because the paid audit did not start.

Not captured:

- VoC prepass wall-clock
- per-section repair counts
- VoC elapsed
- CompetitorLandscape elapsed
- PaidMedia schema/Zod repair behavior

## Evidence Index

- `tmp/voc-repair-signoff-2026-06-02/git-status.txt`
- `tmp/voc-repair-signoff-2026-06-02/git-head.txt`
- `tmp/voc-repair-signoff-2026-06-02/git-diff-stat.txt`
- `tmp/voc-repair-signoff-2026-06-02/app-url.txt`
- `tmp/voc-repair-signoff-2026-06-02/app-pid-cwd.txt`
- `tmp/voc-repair-signoff-2026-06-02/port-3000.txt`
- `tmp/voc-repair-signoff-2026-06-02/port-3001.txt`
- `tmp/voc-repair-signoff-2026-06-02/preflight-notes.md`
- `tmp/voc-repair-signoff-2026-06-02/research-v2-head.txt`
- `tmp/voc-repair-signoff-2026-06-02/capabilities.json`
- `tmp/voc-repair-signoff-2026-06-02/worker-capabilities.json`
- `tmp/voc-repair-signoff-2026-06-02/gate-tsc.log`
- `tmp/voc-repair-signoff-2026-06-02/gate-lint.log`
- `tmp/voc-repair-signoff-2026-06-02/gate-test-run.log`

## Limitations

- No authenticated browser checks were performed because the test gate failed first.
- No Supabase DB evidence was collected because no new run was created.
- App `_capabilities` could not be validated via unauthenticated curl due Clerk middleware rewrite.
- The live VoC repair signoff remains unproven until the full gate passes and the one-run audit is executed.
