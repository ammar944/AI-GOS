# Design - VoC Repair Signoff E2E With Failure Investigation

**Date:** 2026-06-02
**Worktree:** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`
**Controlling handoff:** `docs/2026-06-01-voc-repair-signoff-e2e-codex-handoff.md`

## Goal

Execute one report-only `ramp.com` E2E signoff for the VoC repair, repair-storm, stale-card, B2 commit, and B3 ad-regression criteria. The run proves the dirty working-tree fixes on top of `8243ac52`, or captures a failure dossier with screenshots, DB/read-model evidence, and root-cause signals. It does not fix code during the signoff run.

## Scope

The signoff operates only in `v2-lab-section-wire`. It follows the named handoff even where repo docs say `/research-v3` is the current front door; the handoff explicitly uses `http://localhost:3000/research-v2`, and both routes share the same API flow.

The proof target is the current dirty worktree, not a clean commit. The report must record:

- `git status --short --branch`
- `git rev-parse --short HEAD`
- `git --no-pager diff --stat`
- listening processes on `:3000` and `:3001`
- proof that the app URL being tested is served by this worktree, not another sibling checkout

Worktree proof means recording the listening PID and `lsof -a -p <PID> -d cwd -Fn`, or an equivalent process-cwd check, showing the app process cwd is `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`.

No source edits, migrations, push, deploy, rerun loop, or second paid run are allowed during the signoff. If the run fails, the output is a report and failure analysis, not an in-run patch.

## Approach

Use the report-only signoff path with failure investigation attached.

1. Run the handoff gates and stop on any regression.
2. Start or verify the local app. Verify the corpus path separately because the six sections are in-process, but URL-to-corpus may still use the worker-backed deep research path depending on env.
3. Drive exactly one `ramp.com` browser flow.
4. Capture screenshots and state snapshots at each checkpoint.
5. Query or extract evidence for section status, artifact status, repair counts, VoC elapsed/prepass signals, source counts, and CompetitorLandscape ad creatives.
6. Produce a final report with pass/fail per criterion and a failure dossier if any criterion fails.

This is preferred over evidence-only closeout because the handoff asks for proof of the dirty fixes. It is preferred over implementation-first hardening because the handoff explicitly says to stop and report failures instead of fixing them in the same run.

## Execution Units

**Preflight recorder**

Records the exact proof target, existing server state, and gate outputs. It uses `pipefail` so `tee` cannot mask failing gates.

**Browser runner**

Uses the connected browser at `http://localhost:3000/research-v2` only after proving `:3000` is served from this worktree. If `:3000` is occupied by another checkout, stop before the paid run and either restart the correct app on `:3000` or use a documented alternate local port with the same proof. It enters `ramp.com`, waits for corpus completion, submits the GTM Brief, watches the six-section fanout, and captures screenshots. If Clerk requests a code for `ammarv67@gmail.com`, execution pauses and asks the user for the code.

**Evidence collector**

Captures:

- `research_section_runs` terminal state, elapsed timing, telemetry, and error payloads.
- `research_artifact_sections` terminal state, source count, data verification, and error payloads.
- `research_section_events` repair-event counts per section.
- CompetitorLandscape ad creative count.
- Authenticated `/api/research-v2/audit-state?run_id=<RUN_ID>` output as UI-correlated read-model proof.

Supabase MCP is referenced by the handoff but is not exposed in this Codex session. If a direct Supabase query tool becomes available during execution, use it. Otherwise, use the authenticated audit-state endpoint and browser-accessible read model, and explicitly report the DB-tool limitation.

**Failure investigator**

Treats VoC failure as a first-class expected branch, not a generic timeout. It records whether failure is:

- distinct-source cardinality, such as `body.painLanguage.quotes: need >=3 distinct sources, have 1`
- strict VoC `source` enum drift, such as review sites that must map to `other`
- top-level source count below the VoC minimum
- self-domain pain quotes or single-source majority
- 270s timeout
- stale run/artifact terminal mismatch
- repeated artifact-null repairs from real schema/minimum failures

## Data Flow

1. Preflight writes logs to `tmp/voc-repair-signoff-2026-06-02/`.
2. Browser flow creates a new `run_id` for `ramp.com`.
3. Corpus health is verified before the paid run. The six positioning sections run in-process through the lab engine; `:3001` worker state is diagnostic unless the active env points corpus dispatch at local worker.
4. The UI renders from audit-reader state while Supabase/read-model data provides the pass/fail evidence.
5. The run waits through the six base positioning sections and then capstones when they unlock. Synthesis and Paid Media are part of the handoff flow. If a base-section failure prevents capstone unlock, report the block explicitly and do not rerun.
6. Final report ties every criterion to screenshot paths plus state snapshots.

The final report must be written to `docs/2026-06-02-voc-repair-signoff-e2e-report.md`.

## Evidence Matrix

| Criterion | Primary evidence | Fallback evidence | Required fields | If unavailable |
| --- | --- | --- | --- | --- |
| VoC completes or cleanly fails | `research_section_runs` joined to `research_artifact_sections` | authenticated `audit-state` plus UI screenshot | `zone`, run status, artifact status, source count, error, elapsed | Mark evidence gap and stop before declaring pass |
| No stale cards | run/artifact join for all six base sections | `audit-state.sectionsByZone` plus final UI nav screenshot | every section terminal status and rendered phase | Mark criterion inconclusive/fail; do not infer pass from UI only |
| Repair storm gone | `research_section_events` grouped by zone/event type plus adjacent validation metadata | event feed exposed in `audit-state.workerStates` if it includes repair markers and validation issues | `repair-started` count per section and `validation-failed.metadata.issues` or section error text | Mark criterion inconclusive/fail; report DB-tool limitation |
| B4 latency | `research_section_runs.telemetry.elapsedMs` for CompetitorLandscape | `audit-state.workerStates[].elapsedMs` | CompetitorLandscape elapsed milliseconds | Mark criterion inconclusive/fail |
| B2 commit | artifact section data plus UI screenshot | final UI typed-card screenshot | typed card present, partial replaced, section terminal status | Mark evidence gap if only partial state is visible |
| B3 ads | UI screenshot of rendered ad creatives plus CompetitorLandscape artifact data | UI screenshot plus authenticated read-model creative count | visible real creative, creative count > 0, source/ad evidence labels | Mark fail if no real creative is visible; mark evidence gap if count is unavailable |

## Pass/Fail Criteria

The report uses the handoff rubric with explicit comparison rules:

- **VoC completes:** pass if `positioningVoiceOfCustomer` reaches `complete` with source count > 0. If it fails, it is a clean-failure pass only for stale-card coverage when both run and artifact/read-model surfaces show terminal `error` with the same section run; it is still a P0 VoC-completion fail.
- **No stale cards:** pass only if all six base sections have matching terminal run/artifact status. Any run `complete` or `error` with artifact `running`, `queued`, missing, or error-null mismatch fails.
- **Repair storm gone:** pass if every section has `repair-started` count <= 1. If a section has 2-3 repairs, pass only when each adjacent `validation-failed.metadata.issues[]` entry, or the final section error text when event metadata is unavailable, contains one of these schema/minimum markers: `Zod`, `schema`, `invalid_type`, `invalid_enum`, `too_small`, `too_big`, `body.`, `sources`, `need >=`, `must have`, or `answer tool did not return`. Otherwise fail. Any section with >= 4 repairs fails because that matches the old storm pattern.
- **B4 latency:** pass if CompetitorLandscape elapsed is <= 90000ms and repair count <= 1, matching the handoff's projected 50-90s range after the repair multiplier is removed. If elapsed is 90001-179999ms with <= 1 repair, mark "B4 fail, improved but above projected band." Fail if elapsed is >= 180000ms or repair count > 1.
- **B2 commit:** pass if each completed section renders a typed card and any partial JSON/draft is replaced. A failed VoC can still pass stale-card handling if it renders a terminal error card; it does not pass the VoC-completion criterion.
- **B3 ads:** pass only if CompetitorLandscape visibly renders at least one real ad creative in the UI and artifact/read-model data shows creative count > 0. Fail if the UI reports only a no-ads gap, no real creative is visible, or creative count is zero. If UI proof exists but count evidence is unavailable, mark evidence gap rather than full pass.
- **Capstones:** after 6/6 base sections, capture Synthesis and Paid Media terminal states. PaidMedia schema/Zod repairs are calibration data, not a base-section pass/fail criterion. If base sections do not reach 6/6, report capstones as blocked by the failed base section.

## Stop Rules

Stop before the paid run if:

- gstack is missing
- any gate regresses from the handoff baseline
- auth cannot be established
- `:3000` cannot be proven to serve this worktree, or an alternate local port is needed but not recorded
- corpus dispatch health is unclear for the active env
- the user does not accept that the dirty worktree is the proof target

Stop during or after the run if:

- a section hits a hard failure
- run/artifact terminal states diverge
- duplicate/retry pressure appears
- the browser flow would require a second paid run
- any source edit would be needed to proceed

Stopping after a hard failure still includes capturing already-available terminal state, screenshots, and evidence needed for the report. It forbids rerunning or patching inside the signoff.

## Verification

Pre-run gates:

```bash
npx tsc --noEmit
npm run lint
npm run test:run
npm run build
cd research-worker && npm run build
```

Runtime proof:

- screenshots for ready-to-start, corpus, brief ready, audit queued/running, terminal states, final summary, VoC panel, and Competitor ad evidence
- state snapshots for parent artifact, child section runs, artifact sections, repair events, and audit-state read model
- final report with `run_id`, artifact ID when available, pass/fail table, calibration data, and root-cause signals

## Subagent Findings Incorporated

Three read-only subagents were used:

- Failure evidence inventory found that exact `210ee90b` raw DB JSON is not present locally; strongest local DB evidence is later run `f7ce1ccb-24fb-4492-a131-556139704077`, where VoC failed with distinct-source cardinality and a run/artifact mismatch.
- Code-path review confirmed the repair-gate fix reduces unsupported-claim repair storms, but true VoC schema/minimum failures still produce `artifact === null` repairs. Distinct-source cardinality, strict source enum drift, self-domain pain quotes, and output-token truncation remain plausible failure causes.
- Logistics review confirmed gstack is present, current `HEAD` is `8243ac52`, the dirty worktree is the proof target, existing app/worker servers are running, `/research-v2` should be used because the handoff says so, and no Supabase MCP tool is currently callable in this Codex session.

## Non-Goals

- No code hardening during the signoff run.
- No Supabase migration application.
- No push, deploy, or branch cleanup.
- No second paid run.
- No weakening VoC validators or evidence gates.
