# Claude Handoff: Research V3 Live UX QA Fix Plan

Date: 2026-05-29
Source report: `.gstack/qa-reports/qa-report-localhost-3000-2026-05-29.md`
Worktree: `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`
Branch/HEAD observed by QA: `feat/v2-lab-section-wire` / `b19581e9`
Live QA run: `db41a945-b8d1-4f02-83a7-6481f7d3500e`
Route: `http://localhost:3000/research-v3`

## Mission

Fix the UX kinks exposed by live browser QA without weakening the lab-engine verifier, paid-media sequencing, or artifact honesty. The target product is a SaaS GTM manual builder. Users should feel that a coordinated AI workflow is building a source-backed manual, not that internal logs are leaking into a report viewer.

## Hard Constraints

- Work only in `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`.
- Do not touch main checkout, deploy, push, or modify `.env*`.
- Preserve current in-process lab-engine execution and final committed artifact semantics.
- Do not replace verifier/repair integrity with cosmetic token streaming.
- Keep diffs scoped to onboarding contract/UI, audit activity UX, and tests.

## Official Opus 4.8 / Workflow Grounding

Use these official sources:

- Anthropic Opus 4.8 announcement: `https://www.anthropic.com/news/claude-opus-4-8`
- Claude Code dynamic workflows: `https://code.claude.com/docs/en/workflows`
- Claude Code parallel agents overview: `https://code.claude.com/docs/en/agents`
- Claude Code subagents: `https://code.claude.com/docs/en/sub-agents`

Key practices to apply:

- Opus orchestrates and verifies; bounded workers gather/design/patch/test.
- Dynamic workflows are useful when a task needs dozens to hundreds of agent passes or cross-checked findings.
- Workflow progress should be phase-based, with agent count, elapsed time, and synthesized results.
- Subagents preserve main-context cleanliness and should return concise findings.
- Cross-check results before reporting or landing changes.

## Suggested Claude Workflow

Ask Claude Code to run a workflow or agent-team style pass with these roles:

1. `qa-evidence-reader`
   - Read the QA report and screenshots.
   - Confirm the highest-risk findings against code.
   - Output only issue summaries, file pointers, and acceptance criteria.

2. `onboarding-contract-agent`
   - Inspect `src/lib/research-v2/onboarding-v2-types.ts` and `src/lib/research-v2/onboarding-review.ts`.
   - Propose and implement required/conditional/optional metadata.
   - Add tests proving optional blanks do not pin as urgent or block run.

3. `design-systems-agent`
   - Inspect existing onboarding components and UI tokens.
   - Redesign the GTM Brief Review as a readiness cockpit.
   - Keep the design product-grade, dense, and form-efficient.

4. `streaming-ux-agent`
   - Inspect `src/lib/research-v2/section-activity.ts`, `src/components/research-v2/audit-reader-shell.tsx`, and `src/components/research-v2/corpus-stream.tsx`.
   - Build a customer-safe activity view model.
   - Hide raw JSON, parse failures, validation internals, and duplicate event labels from the default user surface.

5. `verification-agent`
   - Add/adjust focused tests.
   - Run lint, typecheck, and targeted test gates.
   - Use browser QA screenshots for desktop/mobile proof.

Claude should integrate the outputs itself and reject worker suggestions that weaken artifact truth, remove source-gap honesty, or expand scope.

## Priority Findings To Fix

### P0: Required/optional contract

Observed bug:

- Optional fields display as `MISSING` in the pinned rail.
- Wizard can show `100% complete` and enable `Run audit` while those optional fields are still shown as missing.

Likely code:

- `src/lib/research-v2/onboarding-review.ts:76-115`
- `src/lib/research-v2/onboarding-v2-types.ts:430-474`
- `src/components/onboarding/onboarding-wizard.tsx:563-600`

Acceptance criteria:

- Hard-required blanks block progress and appear as blockers.
- Conditional-required blanks block only when their condition is true.
- Optional blanks never appear as red/missing blockers.
- Optional blanks may appear in an `Improve output` queue.
- Tests cover all three classes.

### P0: Streaming/activity UX

Observed bug:

- User-facing stream shows `Validation failed`, `Repairing Artifact`, raw tool JSON, `Invalid input for tool answer`, unsupported URL claim internals, and rate-limit internals.

Likely code:

- `src/lib/research-v2/section-activity.ts:157-278`
- `src/components/research-v2/audit-reader-shell.tsx:503-559`

Acceptance criteria:

- Default activity feed is customer-safe and phase-based.
- Raw event details are behind a debug affordance, not default.
- Repeated section/skill events are deduped.
- Tests assert no raw JSON braces, parser errors, or validation internals appear in default activity item details.

### P1: Onboarding visual redesign

Observed problem:

- `Confirm every field` plus 49 fields and a large `Review first` rail creates a manifest-cleanup feeling.

Likely code:

- `src/components/onboarding/onboarding-wizard.tsx:535-905`

Acceptance criteria:

- Header communicates readiness, not field count anxiety.
- Top rail only shows true blockers.
- Current step has clean hierarchy and no nested-card clutter.
- Optional enrichment is separated from blocker state.
- Accessibility issues for labels/id/name are fixed.

### P1: First 5 seconds after Run audit

Observed problem:

- 0s shows queued state with little context.
- 5s shows raw internal events.

Acceptance criteria:

- Immediate run receipt appears after accepted submit.
- Shows agent count, active stage, next milestone, and paid-media dependency.
- Activity feed is meaningful by 5s without exposing raw internals.

### P1: Competitor ads are not displayed

Observed problem:

- The completed Competitor Landscape section has `AD PRESENCE` and `AD EVIDENCE`, but no competitor ad cards or creatives are shown.
- Competitor rows show `RAW 0 / DISPLAYABLE 0`.
- The user sees Google Ads links and lookup failure/rate-limit messages instead of actual ads or a clear checked/no-ads status.

Acceptance criteria:

- Competitor ad evidence has distinct states for `ads found`, `no active ads found`, `lookup capped`, and `not checked`.
- Successful ad-library results render visible ad cards with platform, advertiser, creative/hook, landing page, and source.
- Rate-limited or capped lookups render as evidence gaps with next-step guidance, not as empty ad sections.
- Tests cover at least one successful ad result and one capped/no-result state.

### P2: Rerun and final reader polish

Observed problem:

- Rerun appears enabled during active work.
- Mobile reader is readable but lacks quick section navigation in first viewport.
- Duplicate React key warning appears repeatedly for `https://saaslaunch.net/`.

Acceptance criteria:

- Rerun disabled/relabelled while active section is non-terminal.
- Mobile has a compact section switcher/status control.
- Duplicate key warning is eliminated.

## Verification Gates

Run these unless a gate is demonstrably unavailable:

- `npm run lint`
- `npx tsc --noEmit`
- Focused onboarding tests.
- Focused section activity/audit reader tests.
- Browser QA on authenticated `http://localhost:3000/research-v3`.

Required browser proof:

- Front door filled.
- Corpus at 1s and 5s.
- Onboarding with missing hard-required fields.
- Onboarding final step with optional blanks showing non-blocking enrichment state.
- Audit at 0s, 5s, and 30s after Run audit.
- Final committed artifact.
- Mobile 390px final artifact/reader.

## Non-Goals

- Do not redesign the lab engine.
- Do not remove evidence gaps or source honesty.
- Do not convert final artifacts to unverified token-streamed prose.
- Do not alter paid-media dependency sequencing unless a failing test proves a state bug.
- Do not deploy.
