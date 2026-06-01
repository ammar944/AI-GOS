# VoC Repair Signoff E2E Report - 2026-06-02

## Summary

Result: **STOPPED BEFORE PAID RUN**.

The `ramp.com` browser audit was not started. Fresh preflight gates all passed at HEAD `451062d8`. The first attempt stopped because the stale `:3000` dev server returned Clerk's `dev-browser-missing` 404 refresh shell for both `/research-v2` and `/sign-in`.

On retry, the stale `:3000` process was restarted and the Codex in-app browser rendered the real `/research-v2` form at `http://localhost:3000/research-v2`. The paid run still stopped before entering `ramp.com` because the required preflight capabilities gate failed: `/api/research-v2/_capabilities` returned the app 404 page from the browser, and the local worker `/capabilities` payload reported `orchestrate_supported: false`.

No source edits, migrations, deploys, retries, or paid audit attempts were made.

## Proof Target

- Worktree: `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`
- HEAD under test: `451062d8`
- Dirty proof target: yes
- Route intended by the handoff: `http://localhost:3000/research-v2`
- Original app process: `http://localhost:3000`, PID `3307`
- Restarted app process for retry: `http://localhost:3000`, PID `60423`
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

Retry evidence after restarting `:3000`:

- `tmp/voc-repair-signoff-2026-06-02/dev-server-3000-restarted.log`
- `tmp/voc-repair-signoff-2026-06-02/root-response-3000-restarted.headers`
- `tmp/voc-repair-signoff-2026-06-02/research-v2-3000-restarted-visible.json`
- `tmp/voc-repair-signoff-2026-06-02/01-ready-to-start-3000-restarted.png`

Visible browser state after restart:

```text
http://localhost:3000/research-v2
Resuming research on ramp.com — last updated 6/1/2026, 5:26:47 PM
Resume
·
Start fresh
Pre-Pitch Positioning Audit
```

Required capabilities gate after restart:

```text
GET http://localhost:3000/api/research-v2/_capabilities
contentType: text/html
body: Lost in space?
```

Local worker capabilities retry:

```json
{
  "status": "ok",
  "worker_version": "1.0.0",
  "orchestrate_supported": false
}
```

## Run Details

- Paid browser run: **not started**
- `run_id`: none
- DB evidence: not applicable because no new run was created
- Authenticated `_capabilities`: attempted after `:3000` restart; returned the app 404 page instead of JSON
- Reason: capabilities preflight blocker before the paid boundary

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

The first blocking failure was browser/auth access in the allowed browser surface. The second retry cleared the stale `:3000` UI blocker but exposed a hard preflight capabilities blocker.

Fresh gates passed. Initially, the in-app browser could not obtain Clerk's local-development dev-browser token (`__clerk_db_jwt` / `Clerk-Db-Jwt`), and Clerk returned `x-clerk-auth-reason: dev-browser-missing`. After restarting `:3000`, the visible `/research-v2` form loaded, but `/api/research-v2/_capabilities` still returned the app 404 page, and the local worker's `/capabilities` response reported `orchestrate_supported: false`. Because the written plan requires this gate before the paid run, execution stopped before submitting `ramp.com`.

Recovery options for the next attempt:

1. Fix or intentionally waive the `_capabilities` preflight gate before the paid run.
2. Decide whether `orchestrate_supported: false` is expected for the current in-process lab-engine architecture or should be repaired in the worker capability payload.
3. Clear the stale `ramp.com` resume prompt with `Start fresh` before any approved paid rerun.

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
- `tmp/voc-repair-signoff-2026-06-02/dev-server-3000-restarted.log`
- `tmp/voc-repair-signoff-2026-06-02/root-response-3000-restarted.headers`
- `tmp/voc-repair-signoff-2026-06-02/research-v2-3000-restarted-visible.json`
- `tmp/voc-repair-signoff-2026-06-02/01-ready-to-start-3000-restarted.png`
- `tmp/voc-repair-signoff-2026-06-02/capabilities-browser-3000-restarted.json`
- `tmp/voc-repair-signoff-2026-06-02/worker-capabilities-3001-current.json`
- `tmp/voc-repair-signoff-2026-06-02/gate-tsc.log`
- `tmp/voc-repair-signoff-2026-06-02/gate-lint.log`
- `tmp/voc-repair-signoff-2026-06-02/gate-test-run.log`
- `tmp/voc-repair-signoff-2026-06-02/gate-next-build.log`
- `tmp/voc-repair-signoff-2026-06-02/gate-worker-build.log`

## Limitations

- Authenticated browser UI checks were possible only after restarting `:3000`; the protected capabilities endpoint still returned the app 404 page.
- No Supabase DB evidence was collected because no new run was created.
- No `run_id` exists for this attempt.
- This report proves the code gates are green at HEAD `451062d8`; it does not prove the VoC repair behavior live.
