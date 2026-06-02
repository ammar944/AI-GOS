# Managed Agents Competitor Section P1 Handoff

## Goal Launcher

```text
/goal Execute Managed Agents Competitor Section P1 from /Users/ammar/Dev-Projects/AI-GOS/docs/handoffs/2026-05-18-managed-agents-competitor-section-p1.md.

Treat that handoff as the source of truth. Complete phases in order, obey all hard rules, run every verification gate, update docs where required, and return the final implementation report requested in the handoff. The goal is complete only when all listed completion criteria pass or an explicit blocker is reported with evidence.
```

## Execution Contract

### Objective

Prove one real positioning-audit section on Claude Managed Agents: `positioningCompetitorLandscape`.

The goal is not to migrate the six-section pipeline. The goal is to configure one programmatically-created Managed Agent with the right competitor-landscape tools, run it against one known company, validate the artifact against AI-GOS's Section 03 schema and minimums, and decide whether P2 should wire the same shape into `/api/research-v2/orchestrate`.

### Source Of Truth Hierarchy

Use this order when docs, current code, and assumptions disagree:

1. This handoff.
2. `/Users/ammar/Dev-Projects/AI-GOS/AGENTS.md`.
3. `/Users/ammar/Dev-Projects/AI-GOS/docs/2026-05-18-managed-agents-p0-spike-findings.md`.
4. `/Users/ammar/Dev-Projects/AI-GOS/docs/2026-05-18-claude-managed-agents-migration-intent.md`.
5. `/Users/ammar/Dev-Projects/AI-GOS/docs/architecture/2026-05-14-positioning-audit-stack.md`.
6. `/Users/ammar/Dev-Projects/AI-GOS/docs/adr/0002-single-structured-output-per-section.md`.
7. Current code and tests in this checkout.

Do not follow older Journey docs that describe `/journey` as the current surface. `/research-v2` is canonical.

### Cwd And Branch

- Cwd: `/Users/ammar/Dev-Projects/AI-GOS`.
- Branch: inspect with `git status --short --branch`.
- Dirty worktree is expected. Do not revert or modify unrelated files.
- Recent Managed Agents P0 commit to inspect: `601a689c Add Managed Agents ad canary spike`.

### Completion Definition

This goal is complete when:

- A Managed Agents Section 03 canary can be created and run programmatically through Anthropic's API, not manually through the platform UI.
- The agent uses AI-GOS-owned custom tools for deterministic vendor calls and key handling.
- The agent emits or calls a save tool with a `CompetitorLandscapeArtifact` matching `CompetitorLandscapeArtifactSchema`.
- AI-GOS validates the artifact with `validateCompetitorLandscapeMinimums`.
- A deliberate validation failure returns repair feedback as a normal custom-tool result, and the agent retries at least once.
- One successful transcript is saved under `tmp/` and summarized in docs.
- The result clearly says whether to proceed to production route integration, pause, or change the tool boundary.

## Scope

### In Scope

- One section only: `positioningCompetitorLandscape`.
- Programmatic setup for Managed Agents environment, agent, session, events, stream handling, and custom tool results.
- Local canary runner or server adapter that extends the P0 script pattern.
- Competitor-landscape custom tool definitions and execution handlers.
- Schema validation and repair-feedback loop for Section 03.
- Documentation of exact API payloads, event types, transcript path, and surprises.

### Out Of Scope

- Replacing `/api/research-v2/orchestrate` in production.
- Deleting or changing `research-worker/`.
- Six-section fan-out.
- Multiagent subagents unless the one-section canary proves a single agent cannot finish the section.
- Public customer exposure.
- Supabase persistence in the first proof unless the canary has already passed locally.
- Webhook registration unless a deployed HTTPS endpoint is intentionally used. Local proof should use SSE streaming.
- Upgrading `@anthropic-ai/sdk` unless the executor proves the upgrade is isolated and safe.

### Assumptions To Verify Before Editing

- `scripts/managed-agents-ad-canary.mjs` exists and can still run `--help`.
- Root `@anthropic-ai/sdk` may still be behind the Managed Agents API surface. Prefer raw HTTP unless a safe SDK upgrade is explicitly justified.
- `ANTHROPIC_API_KEY` may live in `research-worker/.env`, not root `.env.local`.
- `SEARCHAPI_KEY` lives in root `.env.local`.
- The existing Section 03 schema and validator live in `research-worker/src/agents/subagents/schemas/competitor-landscape.ts`.
- Next.js server code should not import from `research-worker/` as a production dependency. For the canary, scripts can copy or locally bridge validation, but production planning must call out the boundary.

If any assumption is false, preserve the objective and adapt with the smallest implementation path.

## Architecture References

### Read First

- `AGENTS.md`
- `docs/2026-05-18-managed-agents-p0-spike-findings.md`
- `docs/2026-05-18-claude-managed-agents-migration-intent.md`
- `docs/architecture/2026-05-14-positioning-audit-stack.md`
- `scripts/managed-agents-ad-canary.mjs`
- `research-worker/src/agents/subagents/schemas/competitor-landscape.ts`
- `research-worker/src/agents/subagents/schemas/__tests__/competitor-landscape.test.ts`
- `research-worker/src/runners/positioning-subagent-runner.ts`
- `research-worker/src/tools/adlibrary.ts`
- `research-worker/src/tools/apify-ads.ts`
- `research-worker/src/agent-tools/index.ts`

### Current Section 03 Contract

Schema:

- `CompetitorLandscapeArtifactSchema`
- `validateCompetitorLandscapeMinimums`

Minimums to preserve:

- `sources`: >=5
- `competitorSet.competitors`: >=5 total
- competitor types: must include `direct`, `indirect`, `status-quo`, and `diy`
- `positioningTaxonomy.axes`: >=3
- `pricingReality.dataPoints`: >=3 pricing data points across >=3 distinct competitors
- `shareOfVoice.slices`: >=3 surfaces
- `publicWeaknesses.items`: >=4 verbatim weaknesses across >=2 competitors
- `narrativeArcs.arcs`: >=3
- `confidence`: 0-10

Required artifact top-level fields:

- `sectionTitle`
- `verdict`
- `statusSummary`
- `confidence`
- `sources`
- `competitorSet`
- `positioningTaxonomy`
- `pricingReality`
- `shareOfVoice`
- `publicWeaknesses`
- `narrativeArcs`

## Managed Agents Design

### Programmatic API Only

Create/update resources via API. Do not require the platform UI for the canary.

Required headers:

```http
anthropic-version: 2023-06-01
anthropic-beta: managed-agents-2026-04-01
X-Api-Key: $ANTHROPIC_API_KEY
```

Expected API path:

1. `POST /v1/environments`
2. `POST /v1/agents`
3. `POST /v1/sessions`
4. `POST /v1/sessions/{session_id}/events`
5. `GET /v1/sessions/{session_id}/events/stream`
6. `POST user.custom_tool_result` when the agent calls custom tools

Reuse existing canary resources only if appropriate:

- Environment: `env_016QJeB3fdCV9Gz8QB4CMosE`
- Agent: `agent_013f2rBHbwp5kALWMRra1PqM`

For Section 03, creating a new agent is preferred so the system prompt and tools are clean.

### Recommended Agent Configuration

Name:

- `AI-GOS Competitor Landscape P1`

Model:

- Start with `claude-opus-4-7` to maximize correctness.
- Do not introduce multi-model rescue in P1.

Environment:

- P1 local canary: `cloud` with unrestricted networking is acceptable.
- Do not put SearchAPI, Firecrawl, Perplexity, or Supabase secrets in the Managed Agents container.
- If limited networking is used, allow only documented hosts required for built-in browsing and app callbacks. Record the exact allowlist in the final report.

Built-in toolset:

- Enable built-in web research tools only if needed for public source gathering.
- Keep bash/file tools disabled unless the plan explicitly needs them.
- The agent should not need package managers, shell installs, or file writes for P1.

### Custom Tools

Keep the custom-tool surface narrow. Suggested P1 tools:

#### `fetch_competitor_ads`

Purpose:

- App-executed SearchAPI ad-library lookup.
- Supports Google, Meta, LinkedIn, or `both/all` only if the executor wires each platform deterministically.
- Keeps `SEARCHAPI_KEY` out of the Managed Agents environment.

Input:

```json
{
  "advertiser_name": "string",
  "platform": "google|meta|linkedin|all",
  "region": "US|CA|UK|AU|ALL",
  "limit": 25
}
```

Output:

```json
{
  "ok": true,
  "advertiser_name": "string",
  "platform": "google",
  "returned": 8,
  "ads": []
}
```

Rules:

- No invented ad copy.
- Preserve source URLs, creative IDs, timestamps, and detail links.
- If Google transparency rows lack headline/body, report that as a data gap.

#### `fetch_competitor_evidence`

Purpose:

- App-owned deterministic evidence fetch for competitor homepages, pricing pages, review sources, and category surfaces.
- P1 can implement this as a thin wrapper around existing SearchAPI/Firecrawl helpers or as a constrained web-fetch adapter.

Input:

```json
{
  "company_name": "string",
  "known_domain": "string|null",
  "evidence_type": "homepage_positioning|pricing|reviews|share_of_voice",
  "limit": 5
}
```

Rules:

- Return source URLs and date observed.
- Return `ok:false` with a clear message when a source cannot be fetched.
- Do not perform unbounded loops over paid APIs. Every vendor call needs a cap and timeout.

If this tool feels too broad after inspection, split it into `fetch_pricing_evidence`, `fetch_review_evidence`, and `fetch_homepage_positioning`. Prefer split tools if the input/output contract gets fuzzy.

#### `save_competitor_landscape_artifact`

Purpose:

- The validation and repair boundary.
- The agent calls this when it believes Section 03 is complete.
- AI-GOS validates Zod shape plus cardinality minimums.

Input:

```json
{
  "artifact": {}
}
```

Output on pass:

```json
{
  "ok": true,
  "section_type": "positioningCompetitorLandscape",
  "accepted": true
}
```

Output on business validation failure:

```json
{
  "ok": false,
  "section_type": "positioningCompetitorLandscape",
  "repair_feedback": "competitorSet.competitors: have 3, need >=5; publicWeaknesses.items: need weaknesses across >=2 competitors, have 1."
}
```

Important:

- Do not mark business validation failure as transport-level `is_error`.
- The custom tool result should be a normal successful event containing `ok:false`.
- Reserve `is_error` for actual tool execution failures.
- Echo `session_thread_id` in the custom tool result when present.

## Hard Rules

- Do not touch the production `/api/research-v2/orchestrate` path until the standalone canary passes.
- Do not migrate all six sections.
- Do not delete or refactor `research-worker/`.
- Do not put paid API secrets in the Managed Agents container.
- Do not use the platform UI as a required setup step for agents, environments, or sessions.
- Do not claim success from an agent markdown answer alone; success requires schema parse and `validateCompetitorLandscapeMinimums`.
- Do not silently accept a partial artifact. Return repair feedback and prove at least one retry.
- Do not invent market data, pricing, competitor claims, ad copy, or review quotes.
- Do not import `research-worker/` into Next production code without an explicit boundary decision.
- Do not upgrade major dependencies without a focused reason and verification.
- Do not revert unrelated dirty files.

## Execution Order

### Phase 0: Preflight

Deliverables:

- Confirm branch, dirty state, and current P0 canary status.
- Confirm current SDK version and whether raw HTTP is still required.
- Confirm env var locations without printing secret values.

Commands:

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
git status --short --branch
npm run managed-agents:ad-canary -- --help
node -p "require('./node_modules/@anthropic-ai/sdk/package.json').version"
node -e "const fs=require('fs'); for (const f of ['.env.local','research-worker/.env']) if (fs.existsSync(f)) console.log(f, fs.readFileSync(f,'utf8').split(/\n/).filter(Boolean).filter(l=>!l.startsWith('#')).map(l=>l.split('=')[0]).join(','))"
```

Pass condition:

- Executor can state which env vars are available, whether raw HTTP is needed, and what files are safe to edit.

### Phase 1: Tool Boundary Plan

Deliverables:

- A short implementation note, either in the final report or a temporary scratch note, choosing the exact P1 tools.
- Decision on whether `fetch_competitor_evidence` stays broad or is split.
- Decision on where validation code lives for the canary.

Expected decision:

- Start from `scripts/managed-agents-ad-canary.mjs`.
- Add a new script `scripts/managed-agents-competitor-section-canary.mjs` rather than overloading the P0 ad canary.
- Keep validation local to the script for proof, or create a small reusable adapter only if production route integration is also in scope.

Pass condition:

- No code changes before the tool boundary is explicit and narrow.

### Phase 2: Build The Section 03 Canary

Deliverables:

- Programmatic environment/agent/session setup for the Competitor Landscape P1 agent.
- Custom tool definitions for chosen tools.
- Custom tool execution handlers with fixed timeouts and caps.
- SSE stream handling that ignores comment frames and parses `data:` frames.
- Custom tool result sender that echoes `session_thread_id` when present.
- CLI options for company/domain/limit/model/reuse IDs.

Suggested file target:

- `scripts/managed-agents-competitor-section-canary.mjs`

Optional package script:

- `managed-agents:competitor-canary`

Pass condition:

- `node --check scripts/managed-agents-competitor-section-canary.mjs` passes.
- `npm run managed-agents:competitor-canary -- --help` works if a package script is added.

### Phase 3: Add Validation And Repair Loop

Deliverables:

- `save_competitor_landscape_artifact` custom tool handler.
- Zod validation against `CompetitorLandscapeArtifactSchema`.
- Cardinality validation with `validateCompetitorLandscapeMinimums`.
- Repair feedback formatter that lists concise, field-addressable errors.
- A deliberate invalid-artifact test mode or prompt forcing the first save attempt to fail, so retry behavior is proven.

Implementation options:

- If using TypeScript in scripts is available, import the schema directly in a TS runner.
- If using plain `.mjs`, either create a focused JS validator mirroring the existing minimums for the canary or call a small TypeScript validation command as a subprocess.
- Do not weaken the current Section 03 minimums to make the canary pass.

Pass condition:

- One run proves: first `save_competitor_landscape_artifact` returns `ok:false`, agent revises, second save returns `ok:true`.

### Phase 4: Live One-Section Run

Run against a known SaaS with enough competitor data. Recommended first target:

```bash
npm run managed-agents:competitor-canary -- --company "monday.com" --domain monday.com --limit 5
```

Alternative targets if monday.com produces thin review/pricing evidence:

- `Notion` / `notion.so`
- `Fellow` / `fellow.app`
- `Airtable` / `airtable.com`

Required evidence:

- Transcript under `tmp/`.
- Final artifact JSON saved in the transcript or a sidecar under `tmp/`.
- Validation summary in stdout.
- Exact session ID.
- Tool call count by tool name.

Pass condition:

- Artifact parses.
- `validateCompetitorLandscapeMinimums` returns `{ ok: true, errors: [] }`.
- No fabricated data appears in the artifact.
- Paid API calls are bounded and documented.

### Phase 5: Documentation And Go/No-Go

Deliverables:

- Update or add a short findings doc under `docs/`.
- Include:
  - agent ID
  - environment ID
  - session ID
  - transcript path
  - custom tools used
  - validation result
  - repair-loop result
  - data quality surprises
  - recommendation: proceed, pause, or change design

Pass condition:

- The next session can decide whether to integrate into `/api/research-v2/orchestrate` without re-running discovery.

## Verification Matrix

| Command | Cwd | Expected pass signal | On failure |
|---|---|---|---|
| `node --check scripts/managed-agents-competitor-section-canary.mjs` | `/Users/ammar/Dev-Projects/AI-GOS` | exit 0 | Fix syntax before any live API calls |
| `npm run lint -- scripts/managed-agents-competitor-section-canary.mjs` | `/Users/ammar/Dev-Projects/AI-GOS` | exit 0 | Fix lint or document why eslint does not cover the file |
| `npm run managed-agents:competitor-canary -- --help` | `/Users/ammar/Dev-Projects/AI-GOS` | prints CLI help | Fix package script or CLI arg parser |
| live canary command | `/Users/ammar/Dev-Projects/AI-GOS` | session ends with accepted artifact | Capture exact blocker and transcript |
| validation summary | `/Users/ammar/Dev-Projects/AI-GOS` | `CompetitorLandscapeArtifactSchema.safeParse` success and minimums ok | Return repair feedback; do not mark pass |

Also run targeted existing tests if shared code is touched:

```bash
cd /Users/ammar/Dev-Projects/AI-GOS/research-worker
npm test -- src/agents/subagents/schemas/__tests__/competitor-landscape.test.ts
```

If Next production code is touched, also run:

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
npm run lint
npm run build
```

## Final Report Format

Return:

- Files changed.
- Whether setup was fully programmatic.
- Agent/environment/session IDs.
- Transcript path.
- Custom tools configured.
- Tool calls observed.
- Validation result before and after repair.
- Commands run and pass/fail status.
- Any deviations from this handoff.
- Recommendation for the next phase:
  - proceed to route integration,
  - add/change tools first,
  - pause Managed Agents migration for Section 03.

## Stop Conditions

Stop and report evidence if:

- Anthropic API rejects programmatic agent/environment/session creation.
- Custom tool results do not resume the session.
- The agent cannot produce Section 03 schema after one repair cycle.
- SearchAPI/Firecrawl/other paid tools return too little evidence to meet minimums for two reasonable targets.
- A required fix would touch production `/research-v2` routing before standalone proof passes.
