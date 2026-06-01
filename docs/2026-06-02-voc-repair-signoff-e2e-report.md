# VoC Repair Signoff E2E Report - 2026-06-02

## Summary

Result: **STOPPED BEFORE PAID RUN**.

The `ramp.com` browser audit was not started. Fresh preflight gates all passed at HEAD `451062d8`, but the Codex in-app browser could not establish Clerk local-development access. Both `/research-v2` and `/sign-in` returned Clerk's `dev-browser-missing` 404 refresh shell, so the run stopped before entering `ramp.com`.

No source edits, migrations, deploys, retries, or paid audit attempts were made.

## Proof Target

- Worktree: `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`
- HEAD under test: `451062d8`
- Dirty proof target: yes
- Route intended by the handoff: `http://localhost:3000/research-v2`
- App process: `http://localhost:3000`, PID `3307`
- PID cwd proof: `tmp/voc-repair-signoff-2026-06-02/app-pid-cwd.txt`
- Local worker process: `http://localhost:3001`, PID `88063`

Dirty tracked diff under test, excluding the current evidence directory:

```text
 docs/2026-05-25-v2-wire-deepseek-ground-truth.html | 11 ++++++++---
 package-lock.json                                  |  1 -
 src/middleware.ts                                  |  1 +
 3 files changed, 9 insertions(+), 4 deletions(-)
```

The worktree also contains unrelated untracked docs/prototypes/tmp artifacts recorded in `tmp/voc-repair-signoff-2026-06-02/git-status.txt`.

## Preflight Gates

| Gate | Result | Evidence |
| --- | --- | --- |
| `npx tsc --noEmit` | PASS | `tmp/voc-repair-signoff-2026-06-02/gate-tsc.log` is empty and command exited 0 |
| `npm run lint` | PASS with baseline warnings | `tmp/voc-repair-signoff-2026-06-02/gate-lint.log` reports 66 warnings, 0 errors |
| `npm run test:run` | PASS | `tmp/voc-repair-signoff-2026-06-02/gate-test-run.log` reports 1287 passed, 1 skipped |
| `npm run build` | PASS | `tmp/voc-repair-signoff-2026-06-02/gate-next-build.log` reports compiled successfully |
| `cd research-worker && npm run build` | PASS | `tmp/voc-repair-signoff-2026-06-02/gate-worker-build.log` exits 0 |

Vitest summary:

```text
Test Files  165 passed | 1 skipped (166)
Tests       1287 passed | 1 skipped (1288)
```

## Runtime Checks

The app process on `:3000` belongs to this worktree:

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

The Codex in-app browser showed the same blocker for both `http://localhost:3000/research-v2` and `http://localhost:3000/sign-in?redirect_url=http%3A%2F%2Flocalhost%3A3000%2Fresearch-v2`:

```text
missing required error components, refreshing...
```

Evidence:

- `tmp/voc-repair-signoff-2026-06-02/auth-blocker-refresh-shell.png`
- `tmp/voc-repair-signoff-2026-06-02/auth-blocker-dom.txt`
- `tmp/voc-repair-signoff-2026-06-02/research-v2-head.txt`
- `tmp/voc-repair-signoff-2026-06-02/sign-in-response.txt`
- `tmp/voc-repair-signoff-2026-06-02/root-response.txt`
- `tmp/voc-repair-signoff-2026-06-02/root-response-127.txt`

## Run Details

- Paid browser run: **not started**
- `run_id`: none
- DB evidence: not applicable because no new run was created
- Authenticated `_capabilities`: not reached because Clerk dev-browser access failed before sign-in
- Reason: auth/browser access blocker before the paid boundary

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

## Calibration Data

No live calibration data was produced because the paid audit did not start.

Not captured:

- VoC prepass wall-clock
- per-section repair counts
- VoC elapsed
- CompetitorLandscape elapsed
- PaidMedia schema/Zod repair behavior

## Failure Dossier

The blocking failure is browser/auth access in the allowed browser surface, not the application gates.

Fresh gates passed. The in-app browser could not obtain Clerk's local-development dev-browser token (`__clerk_db_jwt` / `Clerk-Db-Jwt`), and Clerk returned `x-clerk-auth-reason: dev-browser-missing`. Because the handoff requires Clerk login before the paid run and forbids retry loops, route edits, or bypassing auth, execution stopped before submitting `ramp.com`.

Recovery options for the next attempt:

1. Provide a working Clerk dev-browser session/token for the Codex in-app browser.
2. Explicitly allow use of the user's authenticated Chrome profile for the browser portion.
3. Adjust the local auth setup outside this signoff run, then rerun the same preflight gates before a paid attempt.

## Evidence Index

- `tmp/voc-repair-signoff-2026-06-02/preflight-notes.md`
- `tmp/voc-repair-signoff-2026-06-02/git-status.txt`
- `tmp/voc-repair-signoff-2026-06-02/git-head.txt`
- `tmp/voc-repair-signoff-2026-06-02/git-diff-stat.txt`
- `tmp/voc-repair-signoff-2026-06-02/app-url.txt`
- `tmp/voc-repair-signoff-2026-06-02/app-pid-cwd.txt`
- `tmp/voc-repair-signoff-2026-06-02/port-3000.txt`
- `tmp/voc-repair-signoff-2026-06-02/port-3001.txt`
- `tmp/voc-repair-signoff-2026-06-02/research-v2-head.txt`
- `tmp/voc-repair-signoff-2026-06-02/sign-in-response.txt`
- `tmp/voc-repair-signoff-2026-06-02/root-response.txt`
- `tmp/voc-repair-signoff-2026-06-02/root-response-127.txt`
- `tmp/voc-repair-signoff-2026-06-02/auth-blocker-refresh-shell.png`
- `tmp/voc-repair-signoff-2026-06-02/auth-blocker-dom.txt`
- `tmp/voc-repair-signoff-2026-06-02/gate-tsc.log`
- `tmp/voc-repair-signoff-2026-06-02/gate-lint.log`
- `tmp/voc-repair-signoff-2026-06-02/gate-test-run.log`
- `tmp/voc-repair-signoff-2026-06-02/gate-next-build.log`
- `tmp/voc-repair-signoff-2026-06-02/gate-worker-build.log`

## Limitations

- No authenticated browser checks were possible in the Codex in-app browser.
- No Supabase DB evidence was collected because no new run was created.
- No `run_id` exists for this attempt.
- This report proves the code gates are green at HEAD `451062d8`; it does not prove the VoC repair behavior live.
