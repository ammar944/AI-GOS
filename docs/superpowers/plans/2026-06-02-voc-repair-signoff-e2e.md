# VoC Repair Signoff E2E Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute one report-only `ramp.com` E2E signoff for the VoC repair/stale-card/repair-storm fixes and produce an evidence-backed report.

**Architecture:** Treat `docs/2026-06-01-voc-repair-signoff-e2e-codex-handoff.md` and `docs/superpowers/specs/2026-06-02-voc-repair-signoff-e2e-design.md` as contracts. The execution is split into preflight proof, one browser run, evidence extraction, and report writing. No source edits, migrations, push, deploy, rerun loop, or second paid run are allowed.

**Tech Stack:** Next.js 16 App Router, local browser automation, Supabase-backed audit/read-model state, Clerk auth, shell preflight gates, Markdown report artifacts.

---

## Chunk 1: Preflight And Runtime Proof

### Task 1: Record The Exact Proof Target

**Files:**
- Read: `AGENTS.md`
- Read: `CLAUDE.md`
- Read: `docs/2026-06-01-voc-repair-signoff-e2e-codex-handoff.md`
- Read: `docs/superpowers/specs/2026-06-02-voc-repair-signoff-e2e-design.md`
- Create: `tmp/voc-repair-signoff-2026-06-02/preflight-notes.md`
- Create directory: `tmp/voc-repair-signoff-2026-06-02/`

- [ ] **Step 1: Confirm cwd and gstack**

Run:

```bash
pwd
test -d ~/.claude/skills/gstack/bin && echo GSTACK_OK || echo GSTACK_MISSING
```

Expected: cwd is `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`; output includes `GSTACK_OK`. If not, stop and report.

- [ ] **Step 2: Create the output folder**

Run:

```bash
mkdir -p tmp/voc-repair-signoff-2026-06-02
```

Expected: command exits 0.

- [ ] **Step 3: Record the controlling constraints**

Create `tmp/voc-repair-signoff-2026-06-02/preflight-notes.md` with:

```markdown
# Preflight Notes

- Cwd:
- Handoff read: docs/2026-06-01-voc-repair-signoff-e2e-codex-handoff.md
- Design spec read: docs/superpowers/specs/2026-06-02-voc-repair-signoff-e2e-design.md
- No source edits, migrations, push, deploy, rerun loop, or second paid run.
- Route under test:
- Manual auth needed:
- Corpus dispatch health result:
```

Expected: the file exists and records the no-edit/no-rerun boundary before the paid run.

- [ ] **Step 4: Capture git proof target**

Run:

```bash
git status --short --branch | tee tmp/voc-repair-signoff-2026-06-02/git-status.txt
git rev-parse --short HEAD | tee tmp/voc-repair-signoff-2026-06-02/git-head.txt
git --no-pager diff --stat | tee tmp/voc-repair-signoff-2026-06-02/git-diff-stat.txt
```

Expected: files are written. The report must state that this is a dirty-worktree proof target.

### Task 2: Prove The Local App And Corpus Runtime

**Files:**
- Create: `tmp/voc-repair-signoff-2026-06-02/port-3000.txt`
- Create: `tmp/voc-repair-signoff-2026-06-02/port-3001.txt`
- Create: `tmp/voc-repair-signoff-2026-06-02/app-url.txt`
- Create: `tmp/voc-repair-signoff-2026-06-02/app-pid-cwd.txt`
- Create: `tmp/voc-repair-signoff-2026-06-02/capabilities.json`
- Create if local worker is active: `tmp/voc-repair-signoff-2026-06-02/worker-capabilities.json`
- Create if server restart is needed: `tmp/voc-repair-signoff-2026-06-02/dev-server.log`

- [ ] **Step 1: Record listening processes**

Run:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN | tee tmp/voc-repair-signoff-2026-06-02/port-3000.txt
lsof -nP -iTCP:3001 -sTCP:LISTEN | tee tmp/voc-repair-signoff-2026-06-02/port-3001.txt
```

Expected: `:3000` is listening. If `:3000` is not listening, stop before the paid run. Start the correct app intentionally or choose a documented alternate port, write that URL to `app-url.txt`, and update every browser/API command in execution to use that URL. `:3001` is diagnostic unless the active env points corpus dispatch at the local worker.

If `:3000` is free and the app must be started:

```bash
PORT=3000 npm run dev 2>&1 | tee tmp/voc-repair-signoff-2026-06-02/dev-server.log
printf '%s\n' 'http://localhost:3000' > tmp/voc-repair-signoff-2026-06-02/app-url.txt
```

If `:3000` is occupied by another checkout and an alternate port is intentionally chosen:

```bash
npm run dev -- -p 3002 2>&1 | tee tmp/voc-repair-signoff-2026-06-02/dev-server.log
printf '%s\n' 'http://localhost:3002' > tmp/voc-repair-signoff-2026-06-02/app-url.txt
```

After starting or choosing any app URL, rerun Step 1 and continue through the PID/cwd and route checks below before the paid run.

Run any `npm run dev` command in a persistent terminal/session so the server stays up while the rest of the plan continues.

- [ ] **Step 2: Prove the app PID belongs to this worktree**

Run the `lsof` cwd check for the chosen app PID:

```bash
if [ ! -s tmp/voc-repair-signoff-2026-06-02/app-url.txt ]; then
  printf '%s\n' 'http://localhost:3000' > tmp/voc-repair-signoff-2026-06-02/app-url.txt
fi
APP_URL="$(cat tmp/voc-repair-signoff-2026-06-02/app-url.txt)"
APP_PORT="$(printf '%s\n' "$APP_URL" | sed -E 's#^https?://[^:]+:([0-9]+).*#\1#')"
APP_PID="$(lsof -nP -iTCP:"$APP_PORT" -sTCP:LISTEN | awk 'NR==2 {print $2}')"
test -n "$APP_PID"
{
  printf 'APP_URL=%s\n' "$APP_URL"
  printf 'APP_PORT=%s\n' "$APP_PORT"
  printf 'APP_PID=%s\n' "$APP_PID"
  lsof -a -p "$APP_PID" -d cwd -Fn
} | tee tmp/voc-repair-signoff-2026-06-02/app-pid-cwd.txt
```

Expected: `test -n "$APP_PID"` passes and `app-pid-cwd.txt` includes `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`. If it does not, stop before the paid run.

- [ ] **Step 3: Verify the route responds before the paid run**

Run:

```bash
APP_URL="$(cat tmp/voc-repair-signoff-2026-06-02/app-url.txt)"
curl -I "$APP_URL/research-v2" | tee tmp/voc-repair-signoff-2026-06-02/research-v2-head.txt
```

Expected: HTTP response is not a connection failure. Auth redirects are acceptable; wrong app content is not.

- [ ] **Step 4: Verify corpus dispatch capabilities**

Run:

```bash
APP_URL="$(cat tmp/voc-repair-signoff-2026-06-02/app-url.txt)"
curl -sS "$APP_URL/api/research-v2/_capabilities" | tee tmp/voc-repair-signoff-2026-06-02/capabilities.json
node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync('tmp/voc-repair-signoff-2026-06-02/capabilities.json','utf8')); if (j.worker_reachable!==true || j.orchestrate_supported!==true || j.lastError!==null) { console.error(JSON.stringify(j,null,2)); process.exit(1); } console.log(JSON.stringify({worker_url:j.worker_url, worker_version:j.worker_version, worker_reachable:j.worker_reachable, orchestrate_supported:j.orchestrate_supported, lastError:j.lastError}, null, 2));"
```

Expected: response is JSON with `worker_reachable: true`, `orchestrate_supported: true`, and `lastError: null`. If `worker_url` in `capabilities.json` points to local `:3001`, also run:

```bash
curl -sS http://localhost:3001/capabilities | tee tmp/voc-repair-signoff-2026-06-02/worker-capabilities.json
node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync('tmp/voc-repair-signoff-2026-06-02/worker-capabilities.json','utf8')); if (j.status!=='ok' || j.orchestrate_supported!==true) { console.error(JSON.stringify(j,null,2)); process.exit(1); } console.log(JSON.stringify({status:j.status, worker_version:j.worker_version, orchestrate_supported:j.orchestrate_supported, tools:j.tools}, null, 2));"
```

If capabilities cannot be fetched or these field checks fail, stop before the paid run and report. Fill `Route under test` and `Corpus dispatch health result` in `preflight-notes.md` before moving to Chunk 2.

### Task 3: Run Preflight Gates

**Files:**
- Create: `tmp/voc-repair-signoff-2026-06-02/gate-tsc.log`
- Create: `tmp/voc-repair-signoff-2026-06-02/gate-lint.log`
- Create: `tmp/voc-repair-signoff-2026-06-02/gate-test-run.log`
- Create: `tmp/voc-repair-signoff-2026-06-02/gate-next-build.log`
- Create: `tmp/voc-repair-signoff-2026-06-02/gate-worker-build.log`

- [ ] **Step 1: Run TypeScript with pipefail**

Run:

```bash
set -o pipefail
npx tsc --noEmit 2>&1 | tee tmp/voc-repair-signoff-2026-06-02/gate-tsc.log
```

Expected: exit 0. If nonzero, stop and report; do not run the paid audit.

- [ ] **Step 2: Run lint**

Run:

```bash
set -o pipefail
npm run lint 2>&1 | tee tmp/voc-repair-signoff-2026-06-02/gate-lint.log
```

Expected: exit 0, with baseline warnings acceptable. If errors appear, stop and report.

- [ ] **Step 3: Run tests**

Run:

```bash
set -o pipefail
npm run test:run 2>&1 | tee tmp/voc-repair-signoff-2026-06-02/gate-test-run.log
```

Expected: exit 0. If failures appear, stop and report.

- [ ] **Step 4: Run app build**

Run:

```bash
set -o pipefail
npm run build 2>&1 | tee tmp/voc-repair-signoff-2026-06-02/gate-next-build.log
```

Expected: exit 0. If build fails, stop and report.

- [ ] **Step 5: Run worker build**

Run:

```bash
set -o pipefail
(cd research-worker && npm run build) 2>&1 | tee tmp/voc-repair-signoff-2026-06-02/gate-worker-build.log
```

Expected: exit 0 or a clearly documented pre-existing worker baseline if the repo contradicts the handoff. If it regresses against the handoff expectation, stop and report.

## Chunk 2: One Browser Run

### Task 4: Start The Single Paid Browser Flow

**Files:**
- Create screenshots under: `tmp/voc-repair-signoff-2026-06-02/`
- Read: `tmp/voc-repair-signoff-2026-06-02/app-url.txt`

- [ ] **Step 1: Open the connected browser**

Open `$(cat tmp/voc-repair-signoff-2026-06-02/app-url.txt)/research-v2` in the available browser automation tool.

Expected: Research entry UI or Clerk auth appears.

- [ ] **Step 2: Authenticate if needed**

If Clerk asks for a code for `ammarv67@gmail.com`, pause and ask the user for the code.

Expected: authenticated `/research-v2` is reachable. If auth cannot be established, stop before the paid run and report.

- [ ] **Step 3: Capture ready-to-start screenshot**

Save screenshot:

```text
tmp/voc-repair-signoff-2026-06-02/00-ready-to-start.png
```

Expected: the screenshot shows the URL entry state before starting the run.

- [ ] **Step 4: Enter `ramp.com` and start research**

Type `ramp.com` and submit the URL flow once.

Expected: corpus/deepResearchProgram starts. This begins the one paid run boundary; do not retry.

### Task 5: Drive Corpus And GTM Brief Review

**Files:**
- Create screenshots under: `tmp/voc-repair-signoff-2026-06-02/`
- Create: `tmp/voc-repair-signoff-2026-06-02/gtm-brief-manual-inputs.md`

- [ ] **Step 1: Capture corpus-started state**

Save screenshot:

```text
tmp/voc-repair-signoff-2026-06-02/01-corpus-started.png
```

Expected: the UI shows corpus/research progress.

- [ ] **Step 2: Wait for GTM Brief review**

Poll the UI without restarting or resubmitting.

Expected: GTM Brief review appears. If it errors, capture screenshot and report.

- [ ] **Step 3: Complete required GTM Brief fields and record manual inputs**

Use corpus-prefilled values where present. Fill only required empty fields needed to enable `Run audit`; do not invent market data beyond minimal operator inputs needed by the UI.

Record every manual value entered in `tmp/voc-repair-signoff-2026-06-02/gtm-brief-manual-inputs.md`. Use explicit placeholders such as `not publicly disclosed` or `unknown from corpus` when the UI requires a value and real evidence is unavailable.

Expected: `Run audit` becomes enabled and manual values are recorded.

- [ ] **Step 4: Capture brief-ready screenshot**

Save screenshot:

```text
tmp/voc-repair-signoff-2026-06-02/02-brief-ready-run-audit.png
```

Expected: required fields complete and `Run audit` visible/enabled.

### Task 6: Watch Fanout, Base Sections, And Capstones

**Files:**
- Create screenshots under: `tmp/voc-repair-signoff-2026-06-02/`

- [ ] **Step 1: Click `Run audit` once**

Click the `Run audit` button once.

Expected: six base positioning sections queue/run. Do not click again.

- [ ] **Step 2: Capture queued/running states**

Save screenshots:

```text
tmp/voc-repair-signoff-2026-06-02/03-audit-queued.png
tmp/voc-repair-signoff-2026-06-02/04-fanout-running.png
```

Expected: all six base sections appear queued or running.

- [ ] **Step 3: Watch terminal states**

Poll the UI every 20-30 seconds. Capture terminal changes, especially VoC and CompetitorLandscape.

Expected: screenshots cover each terminal state and any hard failure. Stop watching when all base sections are terminal, the first hard failure creates a terminal or frozen state, or clear stale/frozen state appears. Never retry or click `Run audit` again.

If a hard failure prevents inspecting CompetitorLandscape, VoC, or capstones, record in the report that the screenshot is unavailable because the run reached that terminal/frozen state.

- [ ] **Step 4: Capture final summary screenshot**

Save screenshot after all base sections reach terminal state or after the first hard failure/frozen state:

```text
tmp/voc-repair-signoff-2026-06-02/05-final-summary.png
```

Expected: the screenshot shows the overall section count and nav/status summary.

- [ ] **Step 5: Capture Competitor ad UI proof**

Navigate to CompetitorLandscape ad evidence and save:

```text
tmp/voc-repair-signoff-2026-06-02/competitor-ad-creatives.png
```

Expected: at least one real ad creative is visibly rendered. If none is visible, capture the no-ads state.

- [ ] **Step 6: Capture VoC terminal proof**

Navigate to Voice of Customer and save:

```text
tmp/voc-repair-signoff-2026-06-02/voc-terminal.png
```

Expected: either a completed typed card or a terminal error card. If it is frozen/running after run failure, capture that.

- [ ] **Step 7: Capture capstones if unlocked**

If all six base sections complete and Synthesis/Paid Media unlock, watch and capture terminal states:

```text
tmp/voc-repair-signoff-2026-06-02/synthesis-terminal.png
tmp/voc-repair-signoff-2026-06-02/paid-media-terminal.png
```

Expected: capstone terminal states are captured. If base-section failure blocks capstones, report that they were blocked and do not rerun.

## Chunk 3: Evidence Extraction And Report

### Task 7: Extract Read-Model And DB-Compatible Evidence

**Files:**
- Create: `tmp/voc-repair-signoff-2026-06-02/audit-state.json`
- Create: `tmp/voc-repair-signoff-2026-06-02/evidence-sql.sql`
- Create if available: `tmp/voc-repair-signoff-2026-06-02/db-parent-artifact.json`
- Create if available: `tmp/voc-repair-signoff-2026-06-02/db-section-status.json`
- Create if available: `tmp/voc-repair-signoff-2026-06-02/db-event-counts.json`
- Create if available: `tmp/voc-repair-signoff-2026-06-02/db-event-details.json`
- Create if available: `tmp/voc-repair-signoff-2026-06-02/db-competitor-creative-count.json`

- [ ] **Step 1: Record the `run_id`**

Extract the `run_id` from the UI URL, page state, or API response.

Expected: a concrete run ID is recorded in notes and report.

- [ ] **Step 2: Fetch authenticated audit-state**

From the authenticated browser context, run:

```js
await fetch('/api/research-v2/audit-state?run_id=<RUN_ID>', { credentials: 'same-origin' }).then((response) => response.json())
```

Save the JSON to:

```text
tmp/voc-repair-signoff-2026-06-02/audit-state.json
```

Expected: JSON contains parent status, worker states, and sections by zone. If browser blocks direct fetch, record the exact error. Screenshots alone cannot prove repair counts, run/artifact agreement, elapsed timing, or source counts; mark those criteria as evidence-gap/inconclusive-fail unless DB output or `audit-state` provides the required fields.

- [ ] **Step 3: Prepare SQL evidence queries**

Write these queries with the actual run ID to `tmp/voc-repair-signoff-2026-06-02/evidence-sql.sql`:

```sql
with parent as (
  select id as parent_artifact_id, run_id, status, children_complete, children_total, updated_at
  from research_artifacts
  where run_id = '<RUN_ID>'
)
select * from parent;

with parent as (select id as parent_artifact_id from research_artifacts where run_id = '<RUN_ID>')
select r.zone, r.id as section_run_id, r.status as run_status,
       s.status as artifact_status, r.started_at, r.completed_at,
       r.telemetry, r.error as run_error, s.error as artifact_error,
       jsonb_array_length(coalesce(s.sources, '[]'::jsonb)) as source_count
from parent p
join research_section_runs r on r.artifact_id = p.parent_artifact_id
left join research_artifact_sections s on s.artifact_id = p.parent_artifact_id and s.zone = r.zone
order by r.started_at;

with parent as (select id as parent_artifact_id from research_artifacts where run_id = '<RUN_ID>')
select zone, event_type, count(*) as count
from research_section_events
where artifact_id = (select parent_artifact_id from parent)
group by zone, event_type
order by zone, event_type;

with parent as (select id as parent_artifact_id from research_artifacts where run_id = '<RUN_ID>')
select zone, event_type, message, payload,
       coalesce(payload->'metadata', payload) as event_metadata,
       payload->'metadata'->'issues' as validation_issues,
       created_at
from research_section_events
where artifact_id = (select parent_artifact_id from parent)
  and event_type in ('validation-failed', 'repair-started', 'section-failed', 'section-completed')
order by zone, created_at;

with parent as (select id as parent_artifact_id from research_artifacts where run_id = '<RUN_ID>')
select jsonb_array_length(
  jsonb_path_query_array(coalesce(data, '{}'::jsonb), '$.body.adEvidence.advertiserGroups[*].creatives[*]')
) as competitor_creative_count
from research_artifact_sections
where artifact_id = (select parent_artifact_id from parent)
  and zone = 'positioningCompetitorLandscape';
```

Expected: SQL file is complete. If a direct Supabase tool is available, run the queries and save outputs to `db-parent-artifact.json`, `db-section-status.json`, `db-event-counts.json`, `db-event-details.json`, and `db-competitor-creative-count.json`. If not, report the limitation and use audit-state/UI evidence only for fields it actually contains.

### Task 8: Classify Results Against The Spec

**Files:**
- Read: `docs/superpowers/specs/2026-06-02-voc-repair-signoff-e2e-design.md`
- Read: `tmp/voc-repair-signoff-2026-06-02/audit-state.json`
- Read: screenshots under `tmp/voc-repair-signoff-2026-06-02/`

- [ ] **Step 1: Classify VoC**

Expected output: pass/fail for VoC completion; if failure, exact error string and whether stale-card handling still passed.

- [ ] **Step 2: Classify stale-card behavior**

Expected output: pass/fail based on terminal run/artifact/read-model agreement for all six base sections.

- [ ] **Step 3: Classify repair storm**

Expected output: repair count per section. `<=1` passes; `2-3` passes only with schema/minimum markers; `>=4` fails.

- [ ] **Step 4: Classify B4 latency**

Expected output: CompetitorLandscape elapsed. `<=90000ms` passes; `90001-179999ms` fails as improved but above band; `>=180000ms` fails.

- [ ] **Step 5: Classify B2, B3, and capstones**

Expected output: B2 typed-card replacement pass/fail, B3 visible ad creative pass/fail, capstone terminal or blocked status.

### Task 9: Write The Final Report

**Files:**
- Create: `docs/2026-06-02-voc-repair-signoff-e2e-report.md`

- [ ] **Step 1: Draft report skeleton**

Include sections:

```markdown
# VoC Repair Signoff E2E Report - 2026-06-02

## Summary
## Proof Target
## Preflight Gates
## Run Details
## Pass/Fail Table
## Calibration Data
## Failure Dossier
## Evidence Index
## Limitations
```

Expected: skeleton exists with the actual run ID once known.

- [ ] **Step 2: Fill proof target and gates**

Expected: report includes HEAD, dirty diff stat, app PID cwd proof, server state, gate result summary, and any gate limitation.

- [ ] **Step 3: Fill pass/fail table**

Expected: every handoff criterion has `PASS`, `FAIL`, or `INCONCLUSIVE/FAIL due evidence gap`, with screenshot and state evidence references.

- [ ] **Step 4: Fill calibration data**

Expected: report includes VoC elapsed/prepass signal if available, repair counts and classification, CompetitorLandscape elapsed, PaidMedia schema repair notes if capstone ran.

- [ ] **Step 5: Fill failure dossier**

Expected: if any criterion failed, include exact root-cause signal: DB/read-model row, UI screenshot, log/error text, and no proposed in-run fix.

- [ ] **Step 6: Commit report artifacts if execution is complete**

Run only after the report is complete and after checking the staged set:

```bash
git add docs/2026-06-02-voc-repair-signoff-e2e-report.md tmp/voc-repair-signoff-2026-06-02
git status --short
git diff --cached --name-only
git diff --cached --name-only | awk 'BEGIN { ok=1 } /^docs\\/2026-06-02-voc-repair-signoff-e2e-report\\.md$/ { next } /^tmp\\/voc-repair-signoff-2026-06-02\\// { next } { print "Unexpected staged path: " $0 > "/dev/stderr"; ok=0 } END { exit ok ? 0 : 1 }'
git commit -m "docs: add voc repair signoff e2e report"
```

Expected: `git diff --cached --name-only` contains only `docs/2026-06-02-voc-repair-signoff-e2e-report.md` and files under `tmp/voc-repair-signoff-2026-06-02/`. Do not commit unrelated dirty source files.
