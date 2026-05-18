# Managed Agents Full Migration Handoff (P1 → P4)

## Goal Launcher

```text
/goal Execute Managed Agents Full Migration from /Users/ammar/Dev-Projects/AI-GOS/docs/handoffs/2026-05-19-managed-agents-full-migration.md.

Treat that handoff as the source of truth. Complete phases P1 → P4 in order, obey all hard rules, run every verification gate, update docs where required, and return the final implementation report requested in the handoff. The goal is complete only when all phases pass their exit gates or an explicit blocker is reported with evidence.
```

## Execution Contract

### Objective

Replace the AI-GOS custom positioning audit orchestrator with Claude Managed Agents using a multi-agent coordinator pattern, one Anthropic-hosted session per audit. Delete `research-worker/src/runners/positioning-audit-orchestrator.ts` (738 lines), retire `research-worker/src/runners/positioning-subagent-runner.ts` from the positioning path, and remove the abort/signal/timeout plumbing around that path at the end of P4. Preserve byte-comparable section artifact output, the existing React UI (`AgentArtifactSurface`, `SectionNarrativeRenderer`), Supabase persistence, Clerk auth, and the `deepResearchProgram` corpus pipeline on Railway.

This is the full migration referenced in:
- `docs/architecture/2026-05-19-managed-agents-migration-validated-plan.md` (validated plan, source of truth)
- `docs/2026-05-18-claude-managed-agents-migration-intent.md` (intent doc with architectural mapping)

P0 (canary) is **already complete** — session `sesn_01CrNYjjfzSg5CKoHv5Fzmbo` proved the runtime + custom-tool round-trip works. This handoff starts at P1.

### Source Of Truth Hierarchy

When docs, current code, and assumptions disagree, use this order:

1. This handoff.
2. `/Users/ammar/Dev-Projects/AI-GOS/docs/architecture/2026-05-19-managed-agents-migration-validated-plan.md` (validated plan).
3. `/Users/ammar/Dev-Projects/AI-GOS/docs/2026-05-18-managed-agents-p0-spike-findings.md` (event API, webhook, and custom-tool transport facts).
4. `/Users/ammar/Dev-Projects/AI-GOS/docs/2026-05-18-managed-agents-competitor-section-p1-findings.md` (one-section canary + P2 ad evidence proof).
5. `/Users/ammar/Dev-Projects/AI-GOS/docs/2026-05-18-claude-managed-agents-migration-intent.md` (intent doc).
6. `/Users/ammar/Dev-Projects/AI-GOS/AGENTS.md`.
7. `/Users/ammar/Dev-Projects/AI-GOS/CLAUDE.md` and `.claude/rules/*.md`.
8. `/Users/ammar/Dev-Projects/AI-GOS/docs/handoffs/2026-05-19-managed-agents-multiplatform-ad-creatives.md` (completed canary contract for multi-platform ad evidence).
9. Current code and tests in this checkout.

Do not follow older Journey docs that describe `/journey` as the active product surface. `/research-v2` is canonical.

### Cwd And Branch

- Cwd: `/Users/ammar/Dev-Projects/AI-GOS`.
- Branch: inspect with `git status --short --branch`. Expected: `codex/claude-managed-agents-work`.
- Dirty worktree is expected. Do not revert or modify unrelated files (see Hard Rules).

### Completion Definition

This migration is complete when ALL of the following hold:

- `research-worker/src/runners/positioning-audit-orchestrator.ts` is deleted from the codebase.
- All six positioning sections are produced by a single Managed Agents session per audit, driven by a coordinator agent that delegates to six specialist section agents (one per section).
- Each section artifact is byte-comparable (structurally) to today's worker output: the matching `*ArtifactSchema.safeParse()` and `validate*Minimums()` checks pass, `commit_artifact_section` receives the same renderable normalized patch shape, and `SectionNarrativeRenderer` plus `AgentArtifactSurface` render unchanged.
- `/api/webhooks/managed-agents/route.ts` is the deployed ingress for Managed Agents webhooks; signature verification, event-resource fetching, idempotency, retry ceilings, `session_thread_id` echoing, and ordering tolerance are all implemented (R1, R3, R5, R6 below).
- `permission_policy: never_ask` is set on every declared MCP toolset (R4).
- `RAILWAY_WORKER_URL` is no longer required for positioning audits (only for `deepResearchProgram` corpus generation, which stays on Railway).
- All verification gates in the matrix below pass, or a blocker is reported with exact command output and file evidence.
- `docs/architecture/2026-05-19-managed-agents-migration-validated-plan.md` is updated with a "Status: SHIPPED" stamp and per-phase completion timestamps.

## Current State

### What P0 Proved (Already Shipped)

- `scripts/managed-agents-competitor-section-canary.mjs` — canary script.
- `research-worker/src/tools/managed-agents-ad-evidence.ts` — 436-line custom tool implementation for bounded multi-platform ad evidence.
- `src/app/research-v2/managed-agents-prototype/page.tsx` — 1213-line local replay surface (dev-only, not production).
- Saved transcripts in `tmp/managed-agents-*.json` proving end-to-end round-trip.
- Session `sesn_01CrNYjjfzSg5CKoHv5Fzmbo` is the reference success run.

### What P1/P2 Canaries Proved

- P1 Section 03 canary passed after schema-boundary hardening. Reference session: `sesn_01CrNYjjfzSg5CKoHv5Fzmbo`; accepted artifact: `tmp/managed-agents-competitor-section-canary-1779132163305-artifact.json`.
- P2 multi-platform ad evidence canary passed on current branch commit `c6b0d3b9 Add Managed Agents multi-platform ad evidence`. Reference session: `sesn_01Fjrz7FW76tBdGEhGWxCb6L`; transcript: `tmp/managed-agents-competitor-section-canary-1779137764782.json`; accepted artifact: `tmp/managed-agents-competitor-section-canary-1779137764782-artifact.json`; ad sidecar: `tmp/managed-agents-competitor-section-canary-1779137764782-ad-evidence.json`.
- `fetch_competitor_ads` now accepts `all`, `google`, `linkedin`, and `meta`. The accepted P2 run gathered ads for `monday.com`, `Asana`, `ClickUp`, and `Smartsheet`, preserving raw counts separately from displayable creative counts.
- Platform skill attachment was proven for the P2 canary only after the Managed Agent enabled the read-capable `agent_toolset_20260401`. Production code still needs a stable create/reuse policy for platform skill IDs and read-tool requirements.

### Completed Parallel Handoff

- `docs/handoffs/2026-05-19-managed-agents-multiplatform-ad-creatives.md` is no longer future work in this branch. It is the historical execution contract for the canary/prototype proof that landed in `c6b0d3b9`. This full migration consumes its `fetch_competitor_ads` contract; production persistence and redaction for raw ad sidecars remain part of this migration's Section 03 integration.

### What Must Not Be Touched Until P4

Until P4 explicitly deletes them, the following must keep working:

- `research-worker/src/runners/positioning-audit-orchestrator.ts` (738 lines).
- `research-worker/src/runners/positioning-subagent-runner.ts` (the 6 section runners share this).
- `research-worker/src/index.ts` express routes for orchestration.
- `src/app/api/research-v2/orchestrate/route.ts` (kickoff endpoint).
- `src/lib/journey/server/dispatch-research.ts` (single-section dispatch helper).
- `src/lib/research-v2/orchestrate-db.ts` (Supabase RPCs).

P1 stands up the new ingress next to the existing one. P3 swaps the kickoff to use it. P4 deletes the old code.

## Scope

### In Scope

- One coordinator agent + six specialist section agents per audit (multi-agent pattern).
- Custom tools: `save_section_artifact`, `fetch_competitor_ads` (reused from the completed P2 ad-evidence proof).
- Webhook handler at `/api/webhooks/managed-agents/route.ts` with full mitigation set (R1-R7).
- MCP server declarations for firecrawl, perplexity with `permission_policy: never_ask`.
- Vault management for MCP credentials.
- Telemetry adapter mapping Managed Agents primary-thread + session-thread events to existing Supabase realtime channel for the React UI.
- Schema mirror: create a Next.js-server-safe section artifact schema registry under `src/lib/managed-agents/section-artifact-schemas.ts` by mirroring the six worker-side schema/minimum-validator contracts from `research-worker/src/agents/subagents/schemas/*.ts`. Do not use `src/lib/research-v2/onboarding-v2-types.ts:174`; that `SECTION_SCHEMAS` registry is only for onboarding wizard steps.
- Documentation updates.

### Out Of Scope

- `deepResearchProgram` corpus generation — stays on Railway worker.
- AI SDK v6 chat sidebar (`/api/journey/stream`) — stays as-is.
- Customer-facing exposure of Managed Agents — internal-only for now.
- Multi-model orchestration — Anthropic Opus 4.7 default, Sonnet rescue via fresh session if needed.
- Auto-scaling / fleet management.
- Persistent cross-session memory.
- Re-litigating the P2 ad-evidence canary work. This migration consumes the landed `fetch_competitor_ads` contract and decides its production persistence path.
- Six-section migration via parallel sessions (Approach B from the validated plan was rejected in favor of multi-agent coordinator).

### Assumptions To Verify Before Editing

- `ANTHROPIC_API_KEY` available to the app-side Managed Agents adapter. It may live in root `.env.local` or `research-worker/.env`; verify before running canaries.
- `SEARCHAPI_KEY`, `FIRECRAWL_API_KEY`, `PERPLEXITY_API_KEY` available in `.env.local`.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CLERK_SECRET_KEY` all present.
- `RAILWAY_WORKER_URL` available for the still-living `deepResearchProgram` path.
- `managed-agents-2026-04-01` beta header is enabled on the account (it is by default per Anthropic docs).
- The six positioning skill prompts in `research-worker/platform-skills/ai-gos-{market-category-intelligence,buyer-icp-validation,competitive-positioning,voc-objection-evidence,demand-intent-signals,offer-performance-diagnostic}/SKILL.md` are current. `ai-gos-gtm-synthesis` and `ai-gos-activation-plan` are not section-specialist prompts for this migration.
- No current Next.js production module exposes all six typed section artifact schemas. The executor must create the `src/lib/managed-agents/section-artifact-schemas.ts` mirror before the webhook handler validates artifacts.

If any assumption is false, preserve the objective and adapt with the smallest implementation path. Do not ship a stub on the production path. A stub is acceptable only inside a local canary or test fixture and must be reported explicitly.

## Architecture References

### Read First

- `AGENTS.md`
- `CLAUDE.md`
- `docs/architecture/2026-05-19-managed-agents-migration-validated-plan.md`
- `docs/2026-05-18-managed-agents-p0-spike-findings.md`
- `docs/2026-05-18-managed-agents-competitor-section-p1-findings.md`
- `docs/2026-05-18-claude-managed-agents-migration-intent.md`
- `docs/handoffs/2026-05-19-managed-agents-multiplatform-ad-creatives.md`

### Current Production Path

- `src/app/api/research-v2/orchestrate/route.ts`
- `src/lib/research-v2/orchestrate-db.ts`
- `supabase/migrations/20260514_research_artifact_normalized.sql`
- `supabase/migrations/20260520_orchestrate_parent_child.sql`
- `supabase/migrations/20260525_commit_artifact_section_allow_revision_supersede.sql`
- `research-worker/src/index.ts`
- `research-worker/src/runners/positioning-audit-orchestrator.ts`
- `research-worker/src/runners/positioning-subagent-runner.ts`
- `research-worker/src/runners/section-context-pack.ts`
- `src/lib/research-v2/chat-write-through.ts`

### Managed Agents Canary Path

- Commit `601a689c Add Managed Agents ad canary spike`
- Commit `9f5df9aa Add Managed Agents competitor canary`
- Commit `e394e8af Harden Managed Agents competitor canary`
- Commit `c6b0d3b9 Add Managed Agents multi-platform ad evidence`
- `scripts/managed-agents-ad-canary.mjs`
- `scripts/managed-agents-competitor-section-canary.mjs`
- `research-worker/src/tools/managed-agents-ad-evidence.ts`
- `src/app/research-v2/managed-agents-prototype/page.tsx`
- `src/middleware.ts`

### Section Schemas And Minimums To Mirror

- `research-worker/src/agents/subagents/schemas/market-category.ts`
- `research-worker/src/agents/subagents/schemas/buyer-icp.ts`
- `research-worker/src/agents/subagents/schemas/competitor-landscape.ts`
- `research-worker/src/agents/subagents/schemas/voc-objection-evidence.ts`
- `research-worker/src/agents/subagents/schemas/demand-intent-signals.ts`
- `research-worker/src/agents/subagents/schemas/offer-performance-diagnostic.ts`
- Existing tests under `research-worker/src/agents/subagents/schemas/__tests__/`

### Product UI Surface

- `src/app/research-v2/page.tsx`
- `src/components/research-v2/agent-artifact-surface.tsx`
- `src/components/research-v2/section-narrative-renderer.tsx`
- `src/components/research-v2/__tests__/agent-artifact-surface.test.tsx`
- `src/lib/research-v2/use-audit-state.ts`
- `src/app/api/research-v2/audit-state/route.ts`

## Hard Rules

These are non-negotiable. Violating any one of them must trigger a BLOCKED report.

- **R1 mitigation must be in place from P1, not retrofitted.** The webhook handler MUST dedupe on `event.id` against a Supabase table (`managed_agents_webhook_events`) with a TTL >= 24h. No "we'll add dedupe later." A duplicate `save_section_artifact` commit through `commit_artifact_section` is a P0 bug because it corrupts the normalized audit projection.
- **R3 mitigation must be in place from P1.** Webhooks deliver lightweight event IDs, not full payloads. Verify the webhook signature first, fetch the full event/session resource after verification, then sort all fetched events by the envelope `created_at`; never trust delivery order. Build telemetry projections from sorted events.
- **R4 mitigation: every MCP toolset declaration MUST set `permission_policy: never_ask`, and any attached platform skill MUST have the read tool enabled in `agent_toolset_20260401`.** Default of `always_ask` will wedge the agent silently; missing read tool blocks skill attachment.
- **R5 mitigation: hard retry ceiling on custom-tool repair loops.** The webhook handler MUST count retries per `(session_id, session_thread_id, section_run_id)` and force-archive after N=3 failures (configurable via `MANAGED_AGENTS_MAX_CUSTOM_TOOL_RETRIES`). On overflow, POST `user.interrupt` to the same session thread and mark the section `error` in Supabase.
- **R6 mitigation: signature verification at HTTP receipt, before any async work.** No "queue first, verify on dequeue." Reject with 401 if signature is invalid OR `created_at` is more than 5 minutes old.
- **No customer-facing exposure.** Internal-only flag must gate the new path. Either a feature flag (`MANAGED_AGENTS_POSITIONING_ENABLED=true`) or middleware check on the Clerk user's org.
- **No fabricated section content.** If a specialist agent returns empty or sparse content, persist `{ok:false, error}` with the actual reason. Do not invent placeholder competitors, ICPs, claims, sources, or pricing.
- **Do not import from `research-worker/` into Next.js production code.** The worker boundary is intact. Schemas may be duplicated (mirroring is the cost of this boundary).
- **Do not modify `deepResearchProgram` or any of the corpus generation code.** Out of scope.
- **Do not change the six section artifact shapes.** Mirror the current worker schemas exactly enough for validation; schema evolution is a separate exercise.
- **Custom-tool repair feedback is business feedback, not transport failure.** Return `user.custom_tool_result` with `{ok:false, repair_feedback:"..."}` and do not set transport-level `is_error` unless the tool execution itself failed.
- **Echo `session_thread_id` on every custom-tool result.** The P0 findings show this is required once full fan-out uses Managed Agents multiagent threads.
- **No skipping verification gates.** Each phase has a gate. Each gate must pass with evidence before moving to the next phase. A "looks fine, moving on" report is a BLOCKED report.
- **Do not skip the build gate after P3 or P4.** A successful build is the minimum bar.
- **Use `rg`, non-interactive commands, and minimal diffs.** No `find /`, no `git add -A`, no destructive git operations.

## Execution Order

1. P1: Webhook scaffolding + first specialist agent (`positioningMarketCategory`) end-to-end.
2. P2: Hardening (R2, R7 mitigations; telemetry adapter; `networking: limited` allowlist; 1-week observation window).
3. P3: Remaining 5 specialist agents + coordinator; swap kickoff path.
4. P4: Decommission old orchestrator; verify clean removal.

## Per-Phase Checklist

### Phase 1: Webhook + First Section End-To-End

**Goal:** Single section (`positioningMarketCategory`) produced by a Managed Agents session, byte-comparable to today's worker output. All R1, R3, R4, R5, R6 mitigations live and verifiable.

#### Deliverables

1. **Database migration:** `supabase/migrations/<date>_managed_agents_webhook_events.sql` creating:
   - Table `managed_agents_webhook_events` with columns `event_id text primary key`, `session_id text not null`, `session_thread_id text`, `artifact_id uuid`, `section_run_id uuid`, `section_type text`, `event_type text not null`, `created_at timestamptz not null`, `verified_at timestamptz`, `processed_at timestamptz default now()`, `payload jsonb not null`.
   - Indexes on `(session_id, session_thread_id, section_run_id)` and `(section_run_id, event_type)` for retry-count queries.
   - Cleanup function or scheduled job to delete rows older than 7 days (TTL).
2. **Webhook signature secret env var:** add `MANAGED_AGENTS_WEBHOOK_SECRET` to the repo's env template if one exists. This checkout currently has no `.env.local.example`; at minimum document it in `CLAUDE.md`'s Environment Variables section.
3. **Webhook handler:** `src/app/api/webhooks/managed-agents/route.ts` that:
   - Verifies the Managed Agents webhook signature on the raw body (R6). Reject 401 on mismatch or stale `created_at` (>5 min old).
   - Reads the lightweight webhook `event.id`, upserts into `managed_agents_webhook_events`, and returns 200 immediately with no side effects if that event was already processed (R1).
   - After signature verification and idempotency guard, fetches the full Managed Agents event/session resource through the app-side Managed Agents client.
   - For `agent.custom_tool_use` events with `tool_name == "save_section_artifact"`, calls a section-handler that:
     - Looks up the Zod schema and minimum validator in `src/lib/managed-agents/section-artifact-schemas.ts` keyed by the section type.
     - Validates the artifact. If valid, commits through the existing `commit_artifact_section` RPC with a normalized patch containing `status`, `title`, `markdown`, `data`, `claims`, `sources`, and `error`. Do not insert directly into `research_artifacts`.
     - Mirrors to `journey_sessions.research_results` only through the existing dual-write helper/pattern (`merge_journey_session_research_result`) if the current UI path still requires it.
     - POSTs `user.custom_tool_result {ok:true}` back to the same session and `session_thread_id`.
     - If invalid, counts retries via `select count(*) from managed_agents_webhook_events where section_run_id = ? and event_type = 'save_section_artifact_rejected'`. Under threshold: insert a rejected row, POST `{ok:false, repair_feedback: <zod error summary>}`. At threshold (R5): POST `user.interrupt` for the section thread, mark section error, log a sentinel event.
   - Sorts incoming events by `created_at` (R3) when projecting state for the React UI.
4. **Section artifact schema mirror:** `src/lib/managed-agents/section-artifact-schemas.ts` exporting a registry for all six section IDs:
   - Mirrors `MarketCategoryArtifactSchema` + `validateMarketCategoryMinimums`.
   - Mirrors `BuyerICPArtifactSchema` + `validateBuyerICPMinimums`.
   - Mirrors `CompetitorLandscapeArtifactSchema` + `validateCompetitorLandscapeMinimums`.
   - Mirrors `VoiceOfCustomerArtifactSchema` + `validateVoiceOfCustomerMinimums`.
   - Mirrors `DemandIntentArtifactSchema` + `validateDemandIntentMinimums`.
   - Mirrors `OfferPerformanceArtifactSchema` + `validateOfferPerformanceMinimums`.
   - Add focused tests proving the mirror accepts the worker fixtures or equivalent copied fixtures. Do not import `research-worker/` from Next production code.
5. **Managed Agents client + coordinator + first specialist agent definitions** via new helper modules under `src/lib/managed-agents/`:
   - `client.ts` should use raw HTTP unless a safe SDK upgrade is deliberately scoped and tested. Root `@anthropic-ai/sdk` is currently `0.78.0`; previous canaries used raw HTTP because the installed SDK did not expose Managed Agents resources.
   - `createMarketCategoryAgent()` — uses `research-worker/platform-skills/ai-gos-market-category-intelligence/SKILL.md` as prompt source material copied/read at build/runtime by the app adapter. Tools: `agent_toolset_20260401` with read enabled when platform skills are attached, `mcp_toolset` for firecrawl + perplexity (both `permission_policy: never_ask`, R4), custom tool `save_section_artifact`.
   - `createCoordinatorAgent()` — placeholder roster with just MarketCategory for P1; will be extended to all 6 in P3. System prompt: "You are an AI-GOS audit coordinator. Delegate each positioning section to its specialist agent. Wait for all delegations to return artifacts. Do not synthesize or modify their outputs."
6. **Session kickoff helper:** `src/lib/managed-agents/start-audit.ts` that creates/reuses an environment, creates/reuses agents, starts a session referencing the coordinator, sends the starting `user.message` event, and stores the session/thread mapping in `research_section_runs.telemetry` and/or a new `managed_agents_sessions` table if a table is needed. Return `session_id`, `session_thread_id`, and the existing `parent_audit_run_id`/`section_run_ids` from `seed_orchestration`.
7. **Feature-flagged kickoff path:** in `src/app/api/research-v2/orchestrate/route.ts`, extend `RequestSchema.executionMode` to accept `'managed'`. When `MANAGED_AGENTS_POSITIONING_ENABLED=true` and `body.executionMode === 'managed'`, call the new `start-audit` helper instead of `kickoffWorker`. Default flag value: `false`; the current default `deep` worker path must keep working.
8. **End-to-end test:** new script `scripts/managed-agents-section-canary.mjs` that runs one positioning audit through the new path and writes the resulting artifact to `tmp/managed-agents-section-canary-<session>.json`. Verifies that the artifact passes the mirrored Zod schema and minimum-cardinality validator.

#### Commands

```bash
cd /Users/ammar/Dev-Projects/AI-GOS

# Verify the old onboarding SECTION_SCHEMAS is not used as the section artifact registry
rg -n "export const SECTION_SCHEMAS" src/lib/research-v2/onboarding-v2-types.ts
rg -n "MarketCategoryArtifactSchema|validateMarketCategoryMinimums|sectionArtifactSchemas" src/lib/managed-agents research-worker/src/agents/subagents/schemas

# Find the section type enum / IDs
rg -n "POSITIONING_SECTION_IDS\|positioningMarketCategory" src/lib/ai/prompts/ research-worker/src

# Verify SKILL.md exists for first specialist
ls research-worker/platform-skills/ai-gos-market-category-intelligence/

# Apply migration locally using the project's standard Supabase flow.
# Do not reset a shared database.
npx supabase migration up --local

# Run focused tests
npm run test:run -- src/app/api/webhooks/managed-agents
npm run test:run -- src/lib/managed-agents

# Run the new canary
set -a; source .env.local; set +a
node scripts/managed-agents-section-canary.mjs --section positioningMarketCategory --advertiser "monday.com" --domain monday.com

# Verify byte-comparable artifact
diff <(jq -S . tmp/managed-agents-section-canary-*.json) \
     <(jq -S . tmp/old-worker-market-category-reference.json)
# Empty diff = byte-comparable.
```

#### Pass Conditions

- The webhook handler rejects a forged signature with 401 and a valid signature with 200 (test in CI).
- A replayed event (same `event.id`) returns 200 without a second `commit_artifact_section` call (test in CI).
- A `save_section_artifact` call with an invalid artifact triggers exactly one `user.custom_tool_result {ok:false, repair_feedback:...}` reply, increments the retry count, and survives until the threshold.
- At retry count N=3, the session thread receives `user.interrupt` and the `research_artifact_sections` row is marked `error`.
- One full audit on `monday.com` via `MANAGED_AGENTS_POSITIONING_ENABLED=true` produces a `positioningMarketCategory` artifact that is byte-comparable to a recent successful worker run (allowable diffs: timestamps, IDs, source URLs that legitimately re-resolved).
- `SectionNarrativeRenderer` renders the new artifact in the AI-GOS profile UI with no console errors and no visual regression vs current output.
- All R1, R3, R4, R5, R6 mitigations are reachable by a unit test that exercises the failure mode.

### Phase 2: Hardening And Observation

**Goal:** R2 and R7 mitigations live; networking allowlist tightened; telemetry adapter operational; one week of internal use proves webhook reliability.

#### Deliverables

1. **Synthetic webhook health probe (R2):** GitHub Actions workflow `.github/workflows/managed-agents-webhook-probe.yml` running every 15 minutes that POSTs a synthetic event with a valid signature and a fresh `event.id`. On failure, posts to a Slack webhook (URL in repo secret `SLACK_OPS_WEBHOOK_URL`). Document the manual re-enable runbook in `docs/runbooks/managed-agents-webhook-recovery.md`.
2. **Rescue session strategy (R7):** Decide and implement one of:
   - (a) Spawn a fresh session with a Sonnet-tier coordinator on rescue path. Helper `startRescueSession(parentAuditRunId, sectionType)`.
   - (b) Accept Opus-only; tighten the specialist agent system prompt and remove rescue. Document the decision in `docs/architecture/2026-05-19-managed-agents-migration-validated-plan.md` under the open-questions table.
   Pick (b) unless there is concrete evidence that the primary pass is producing too many R5 retries. Default to (b).
3. **Networking allowlist:** Update the environment definition in `src/lib/managed-agents/environment.ts` to use:
   ```json
   {
     "networking": {
       "type": "limited",
       "allowed_hosts": [
         "www.searchapi.io",
         "api.firecrawl.dev",
         "api.perplexity.ai",
         "<APP_DOMAIN>"
       ],
       "allow_mcp_servers": true,
       "allow_package_managers": false
     }
   }
   ```
   `<APP_DOMAIN>` is the production app domain for webhook callbacks; read from `APP_DOMAIN` env var.
4. **Telemetry adapter:** `src/lib/managed-agents/telemetry-adapter.ts` that subscribes to the session event stream (server-sent events on `/v1/sessions/:id/events/stream`), ignores comment frames such as `: connected`, maps `agent.custom_tool_use` -> tool-start, `user.custom_tool_result` -> tool-finish, `agent.message` -> activity preview, and `session.thread_status_idle`/`session.status_idle` -> completion candidates. Write the projection into `research_section_events` so the existing React `WorkerChip` telemetry ("Wave X of Y / N running / N queued") keeps working unchanged.
5. **Observation window:** Run the migration path on every internal audit (`MANAGED_AGENTS_POSITIONING_ENABLED=true`) for 7 days. Collect:
   - Webhook auto-disable triggered? (count, dates)
   - Duplicate `event.id` deliveries deduped? (count, if any; synthetic replay must prove the guard even if real duplicates are zero)
   - Custom-tool retry distribution per section (histogram)
   - Mean session runtime per audit
   - Mean cost per audit (token + session-hour math)
6. **P2 ad-evidence integration prep:** The multi-platform ad-evidence proof has merged. Use the existing `fetch_competitor_ads` contract from `research-worker/src/tools/managed-agents-ad-evidence.ts` and `scripts/managed-agents-competitor-section-canary.mjs` as the production contract input for P3. Decide where raw ad sidecars persist before Section 03 is enabled in production.

#### Commands

```bash
cd /Users/ammar/Dev-Projects/AI-GOS

# Validate health probe runs end-to-end in dry-run
gh workflow run managed-agents-webhook-probe.yml --ref codex/claude-managed-agents-work

# Inspect 7-day metrics
psql "$DATABASE_URL" -c "
  select
    section_type,
    count(*) filter (where event_type = 'save_section_artifact_committed') as committed,
    count(*) filter (where event_type = 'save_section_artifact_rejected') as rejected,
    avg(extract(epoch from processed_at - created_at)) as avg_latency_s
  from managed_agents_webhook_events
  where created_at > now() - interval '7 days'
  group by section_type;
"

# Verify networking allowlist is covered by focused tests
npm run test:run -- src/lib/managed-agents/environment
```

#### Pass Conditions

- Health probe runs 96+ times over 24h with zero false-positive Slack alerts.
- Auto-disable never triggered during observation week.
- Synthetic replay proves duplicate-event dedupe; real duplicate count is reported if observed.
- Custom-tool retry distribution shows >95% of artifacts committing on first attempt.
- Telemetry adapter writes phase rows to `research_section_events` and the React UI shows live progress equivalent to today's chip behavior.
- One full audit (single section, MarketCategory) costs <$0.10 in token + session-hour terms.
- Doc updated with chosen rescue strategy (R7).

### Phase 3: Six Specialist Agents + Coordinator + Path Swap

**Goal:** All six positioning sections produced by Managed Agents in a single session per audit. Production kickoff path defaults to the new flow.

#### Deliverables

1. **Five remaining specialist agents** in `src/lib/managed-agents/agents.ts`:
   - `createBuyerICPAgent()` — uses `research-worker/platform-skills/ai-gos-buyer-icp-validation/SKILL.md`.
   - `createCompetitorLandscapeAgent()` — uses `research-worker/platform-skills/ai-gos-competitive-positioning/SKILL.md`. Custom tools: `save_section_artifact` + `fetch_competitor_ads` (from the completed P2 ad-evidence proof).
   - `createVoiceOfCustomerAgent()` — uses `research-worker/platform-skills/ai-gos-voc-objection-evidence/SKILL.md`.
   - `createDemandIntentAgent()` — uses `research-worker/platform-skills/ai-gos-demand-intent-signals/SKILL.md`.
   - `createOfferDiagnosticAgent()` — uses `research-worker/platform-skills/ai-gos-offer-performance-diagnostic/SKILL.md`.
2. **Updated coordinator roster:** `createCoordinatorAgent()` now lists all six specialists. System prompt updated to: "Delegate each of the six positioning sections to its specialist agent in parallel. Each delegation should include the GTM brief snapshot, the corpus excerpt, and the section-specific context pack. Wait for all six to return committed artifacts before reporting completion. Do not synthesize, edit, or comment on specialist outputs."
3. **Context pack mirror:** Build a Next.js-side equivalent of `research-worker/src/runners/section-context-pack.ts` in `src/lib/managed-agents/section-context-pack.ts`, OR port the existing one and share via a third package. Decide based on lift; default to mirroring (consistent with the worker boundary rule).
4. **Coordinator-to-specialist delegation contract:** Each specialist receives a structured input message containing `gtm_brief`, `corpus_excerpt`, `section_context_pack`, and any prior-section dependencies (e.g., `positioningOfferDiagnostic` may need outputs from `positioningBuyerICP` and `positioningCompetitorLandscape`). Map dependencies explicitly; do not rely on the coordinator's judgment.
5. **Parent rollup logic:** When all six specialist threads emit committed artifacts and the session reaches idle, the coordinator emits a final `agent.message` with a per-section summary. The webhook handler maps this to `research_artifacts.status = 'complete'` and updates `children_complete`.
6. **Telemetry parity:** Six concurrent threads must surface as six chips with live `phase` / `latestActivity` / `latestTool` fields, matching today's behavior. The adapter from Phase 2 must handle this.
7. **Feature flag flip:** Change the default of `MANAGED_AGENTS_POSITIONING_ENABLED` to `true`. Document the flip in `docs/architecture/2026-05-19-managed-agents-migration-validated-plan.md`.
8. **Kickoff path swap:** In `src/app/api/research-v2/orchestrate/route.ts`, make the Managed Agents path the default and the Railway worker path an explicit fallback (`executionMode === 'worker'`). The worker path stays callable until P4.

#### Commands

```bash
cd /Users/ammar/Dev-Projects/AI-GOS

# Run the multi-section canary
set -a; source .env.local; set +a
node scripts/managed-agents-audit-canary.mjs --advertiser "monday.com" --domain monday.com --all-sections

# Compare to worker output for the same advertiser
diff <(jq -S 'del(.created_at, .updated_at, .ids[]?)' tmp/managed-agents-audit-canary-*.json) \
     <(jq -S 'del(.created_at, .updated_at, .ids[]?)' tmp/worker-reference-audit.json)

# Targeted tests
npm run test:run -- src/lib/managed-agents
npm run test:run -- src/app/api/research-v2/orchestrate
npm run test:run -- src/app/api/webhooks/managed-agents

# Build gate
npm run build
```

#### Pass Conditions

- All six section artifacts produced by a single Managed Agents session pass the mirrored `sectionArtifactSchemas[section_type].schema.safeParse()` and matching minimum validator.
- Section artifacts are byte-comparable to recent worker output for the same advertiser (allowable diffs: timestamps, IDs, re-resolved source URLs).
- React UI renders six chips with live phase updates, six committed artifacts, and no console errors.
- One full six-section audit completes in <15 minutes and costs <$0.50.
- Build, lint, and test gates all pass.

### Phase 4: Decommission

**Goal:** Delete the old orchestrator and its surrounding infrastructure. Railway worker remains for `deepResearchProgram` only.

#### Deliverables

1. **Delete files:**
   - `research-worker/src/runners/positioning-audit-orchestrator.ts`
   - `research-worker/src/runners/positioning-subagent-runner.ts`
   - Positioning-only runner entrypoints under `research-worker/src/runners/positioning/` if they are no longer used by any retained `deepResearchProgram` path.
   - `research-worker/src/runners/__tests__/positioning-audit-orchestrator.test.ts`
   - `research-worker/src/runners/__tests__/positioning-subagent-runner-*.test.ts`
   - Any positioning-section-specific test files that target the deleted runners.
2. **Remove references from `research-worker/src/index.ts`:**
   - `POST /orchestrate` express route for positioning fan-out.
   - Imports from the deleted runner modules.
   - Any positioning-specific env var reads not also used by `deepResearchProgram`.
3. **Remove `kickoffWorker` call from `src/app/api/research-v2/orchestrate/route.ts`** for the positioning path. The worker fallback (`executionMode === 'worker'`) is removed entirely — no more dual-path code.
4. **Remove env vars** that are no longer load-bearing: if `RAILWAY_API_KEY` is only used for the deleted positioning path, remove it from the repo env template if one exists and from `CLAUDE.md`. If `deepResearchProgram` still uses it, leave it alone.
5. **Documentation updates:**
   - Update `CLAUDE.md` "Research-v2 Flow" section to describe the Managed Agents path.
   - Stamp `docs/architecture/2026-05-19-managed-agents-migration-validated-plan.md` with `Status: SHIPPED 2026-MM-DD` and fill in the phase completion timestamps.
   - Update `docs/2026-05-18-claude-managed-agents-migration-intent.md` header with `Status: SHIPPED — see validated-plan doc`.
6. **Verify clean removal:**
   - `git log --oneline | head -20` should show one or more "feat(managed-agents): " and "chore(managed-agents): decommission worker orchestrator" commits.
   - `rg "positioning-audit-orchestrator\|positioningSubagentRunner\|runPositioningMarketCategory\|runPositioningBuyerICP\|runPositioningCompetitorLandscape" --type ts` returns zero hits unless the match is in an intentionally retained historical doc.
   - `npm run build` passes.
   - `npm run test:run` passes (or all failures are clearly unrelated pre-existing issues per `.claude/rules/learned-patterns.md`).

#### Commands

```bash
cd /Users/ammar/Dev-Projects/AI-GOS

# Verify no remaining references before deleting
rg "positioning-audit-orchestrator\|positioningSubagentRunner\|kickoffWorker\|runPositioningMarketCategory\|runPositioningBuyerICP\|runPositioningCompetitorLandscape" --type ts

# After deletion, build and test
npm run build
npm run test:run

# Worker-side build check (per .claude/rules/learned-patterns.md handoff hygiene)
cd research-worker && npm run build && cd ..

# Final dirty-check
git status --short
```

#### Pass Conditions

- Build, lint, and test gates all pass on both Next.js and worker sides.
- `rg "positioning-audit-orchestrator"` returns zero TypeScript hits.
- A fresh audit via the production path produces six section artifacts via Managed Agents only.
- No tests rely on the deleted runners or their helpers.
- Documentation reflects the final state.

## Verification Matrix

| Gate | Phase | Command | Expected Pass Condition |
|---|---|---|---|
| Branch and dirty state | All | `git status --short --branch` | Branch matches; unrelated changes preserved. |
| Migration applied | P1 | `psql -c "\d managed_agents_webhook_events"` | Table present with all columns and index. |
| Schema mirror | P1 | `npm run test:run -- src/lib/managed-agents/section-artifact-schemas` | All six mirrored schemas and minimum validators pass fixture tests. |
| Signature verification | P1 | `npm run test:run -- src/app/api/webhooks/managed-agents/__tests__/signature.test.ts` | 401 on forged, 200 on valid, 401 on stale (>5 min). |
| Event fetch | P1 | `npm run test:run -- src/app/api/webhooks/managed-agents/__tests__/event-fetch.test.ts` | Webhook verifies lightweight event, then fetches/processes full Managed Agents resource. |
| Idempotency | P1 | `npm run test:run -- src/app/api/webhooks/managed-agents/__tests__/idempotency.test.ts` | Replayed event.id returns 200 with no second `commit_artifact_section` call. |
| Retry ceiling | P1 | `npm run test:run -- src/app/api/webhooks/managed-agents/__tests__/retry-ceiling.test.ts` | 4th retry triggers `user.interrupt` + section error mark. |
| Thread echo | P1 | `npm run test:run -- src/lib/managed-agents/client` | `user.custom_tool_result` includes the originating `session_thread_id`. |
| Permission policy | P1 | `rg "permission_policy|agent_toolset_20260401|read" src/lib/managed-agents/` | Every MCP toolset declaration is `never_ask`; platform-skill agents enable read. |
| First section canary | P1 | `node scripts/managed-agents-section-canary.mjs --section positioningMarketCategory --advertiser monday.com` | Artifact written; passes Zod + minimums; byte-comparable to worker reference (allowable diffs). |
| UI render | P1 | Manual: open AI-GOS profile for monday.com | `SectionNarrativeRenderer` shows MarketCategory section; no console errors. |
| Webhook probe | P2 | `gh run list --workflow managed-agents-webhook-probe.yml --limit 10` | 10/10 successful runs over 24h. |
| Observation week | P2 | SQL aggregation per Phase 2 deliverables | Synthetic dedupe replay passes; real duplicate count reported; retry distribution mostly first-attempt success. |
| Networking allowlist | P2 | Inspect environment config in Console or via API | `networking.type == "limited"` with documented allowlist. |
| Six-section canary | P3 | `node scripts/managed-agents-audit-canary.mjs --advertiser monday.com --all-sections` | All 6 artifacts written, all pass Zod, runtime <15min, cost <$0.50. |
| Telemetry parity | P3 | Manual: watch chips during a live audit | All 6 chips show live phase/activity/tool updates. |
| Production swap | P3 | `curl /api/research-v2/orchestrate ...` | Default path returns Managed Agents session; worker fallback returns 200 only when `executionMode === 'worker'`. |
| Old orchestrator deleted | P4 | `rg "positioning-audit-orchestrator" --type ts` | Zero hits. |
| Lint clean | P4 | `npm run lint` | Passes, or unrelated pre-existing ignored-subtree warnings are documented. |
| Build clean | P4 | `npm run build` AND `cd research-worker && npm run build` | Both pass. |
| Test suite | P4 | `npm run test:run` | Passes or all failures are pre-existing per `.claude/rules/learned-patterns.md`. |
| Validated plan stamped | P4 | `grep "Status: SHIPPED" docs/architecture/2026-05-19-managed-agents-migration-validated-plan.md` | Stamp present with date and per-phase timestamps. |

## Final Report Format

Return this structure (one section per phase, expanded at the end):

```markdown
## Result
- Status: passed | blocked | partial
- Branch:
- Phases completed: P1 ✅ / P2 ✅ / P3 ✅ / P4 ✅
- Summary (2-3 sentences):

## Files Changed (across all phases)
- path: change summary

## Phase 1 Evidence
- Migration file:
- Webhook handler:
- Managed Agents client/event fetch:
- Section schema mirror:
- Section canary transcript:
- Session ID(s):
- Cost (tokens + session-hours):
- Mitigation tests: R1 ✅ / R3 ✅ / R4 ✅ / R5 ✅ / R6 ✅ / thread echo ✅
- UI screenshot/DOM evidence:

## Phase 2 Evidence
- Health probe workflow:
- Observation week metrics (dedupe rate, retry distribution, cost):
- Rescue strategy chosen (R7):
- Telemetry adapter location:
- Networking allowlist content:

## Phase 3 Evidence
- All-sections canary transcript:
- Session ID:
- Per-section runtime + cost:
- Section 03 ad-evidence persistence path:
- UI screenshot of 6 chips live + 6 artifacts committed:
- Feature flag flip commit:
- Path swap commit:

## Phase 4 Evidence
- Deleted files (with line counts):
- `rg` confirmation of zero references:
- Final build + test output:
- Validated plan stamp:

## Verification Matrix Results
| Gate | Phase | Result | Evidence |
|---|---|---|---|

## Deviations Or Blockers
- None, or exact blocker with command output, file/API evidence, and proposed unblock.

## Costs Captured
- Total Anthropic spend during migration:
- Total session-hours:
- Mean cost per audit (post-migration):
- Cost ceiling check: under $50/mo for internal use? Yes/No.

## Doc Updates
- `CLAUDE.md`: updated sections
- `docs/architecture/2026-05-19-managed-agents-migration-validated-plan.md`: SHIPPED stamp + per-phase timestamps
- `docs/2026-05-18-claude-managed-agents-migration-intent.md`: SUPERSEDED stamp
- `docs/runbooks/managed-agents-webhook-recovery.md`: created

## What Surprised The Executor
- 1-3 bullets on anything that didn't match the validated plan's expectations.
- These feed back into a follow-up architecture review.
```
