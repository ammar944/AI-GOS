# Claude Managed Agents P0 Spike Findings

Status: exploratory spike, not an ADR.
Date: 2026-05-18.
Scope: prove whether AI-GOS can move the positioning-audit harness boundary from `research-worker/` into Claude Managed Agents while keeping our app responsible for custom tools, validation, persistence, and repair feedback.

## Verdict

The Managed Agents custom-tool loop works for the AI-GOS migration shape.

The local P0 canary created a Managed Agent, started a session, received an `agent.custom_tool_use` event for `fetch_competitor_ads`, executed the SearchAPI lookup locally, posted `user.custom_tool_result`, and watched the agent resume to a final operator-readable summary.

Harness proof: pass.
Ad-evidence quality: partial. SearchAPI's Google Ads Transparency payload gives useful IDs, creative asset URLs, first/last shown timestamps, and detail links, but not headline/body/landing URL text for the tested advertisers. For messaging-angle clustering, P1 should add Meta/LinkedIn and/or fetch/inspect Google creative detail assets instead of relying on Google transparency rows alone.

## Official Docs Checked

- Claude Managed Agents launched in public beta on 2026-04-08 and requires the `managed-agents-2026-04-01` beta header.
- Agent resources bundle model, system prompt, tools, MCP servers, skills, and multiagent declarations.
- Custom tools are client-executed: the agent emits a structured request, the app executes it, and the app sends a `user.custom_tool_result` event back.
- Sessions are two-step: create the session, then send `user.message` events to start work.
- Webhooks deliver lightweight event IDs, not full payloads; handlers must fetch the resource after signature verification.
- Environment limited networking requires explicit HTTPS hosts. It does not constrain built-in `web_search` / `web_fetch` allowed domains.
- Multiagent sessions are now public beta under the same managed-agents beta header. They support parallel threads, and custom tool results from subagent threads must echo `session_thread_id`.
- Pricing is tokens plus `$0.08` per running session-hour. Idle time waiting on custom tool results does not count toward runtime.

## Repo Findings

- Root `@anthropic-ai/sdk` is `0.78.0`; latest on npm during the spike was `0.96.0`.
- The installed SDK does not expose Managed Agents resources (`beta.agents`, `beta.sessions`, `beta.environments`, webhooks helper). The spike therefore uses raw HTTP in `scripts/managed-agents-ad-canary.mjs` instead of upgrading SDK/package-lock on a dirty branch.
- `ANTHROPIC_API_KEY` is not in root `.env.local`; it is present in `research-worker/.env`. `SEARCHAPI_KEY` is in `.env.local`.
- Existing `/api/research-v2/orchestrate` remains untouched. This spike does not alter the production route.

## Canary Artifact

Script:

```bash
node scripts/managed-agents-ad-canary.mjs --advertiser monday.com --region US --limit 25
```

Reusable resources created by the first run:

- Environment: `env_016QJeB3fdCV9Gz8QB4CMosE`
- Agent: `agent_013f2rBHbwp5kALWMRra1PqM`

Successful proof run:

- Session: `sesn_01K5itkxLGEEYeB9R3j5SCzz`
- Transcript: `tmp/managed-agents-ad-canary-1779121848610.json`
- Custom tool calls handled: `1`
- Tool result: `ok=true`, advertiser `monday.com`, advertiser ID `AR00006920747092017153`, `total_available=8`, `returned=8`
- Event types observed: `user.message`, `agent.custom_tool_use`, `session.thread_status_idle`, `session.status_idle`, `user.custom_tool_result`, `session.status_running`, `agent.message`

Important implementation detail: Anthropic SSE can emit comment frames such as `: connected`. The local parser must ignore comment frames and parse only `data:` frames.

## What This Means For The Migration

The user's core reframe is correct: repair/rescue can become custom-tool feedback instead of a runner phase.

For P1, `save_section_artifact` should return a normal successful custom tool result even when validation fails:

```json
{
  "ok": false,
  "repair_feedback": "competitorSet.competitors must include at least 5 competitors; publicWeaknesses must span at least 2 competitors"
}
```

Do not mark that event as transport-level `is_error`; it is business-level feedback the agent should revise against. Reserve `is_error` for actual tool execution failures.

The production webhook path is still needed, but local P0 is better through SSE because webhooks require HTTPS on port 443 with a public hostname. The app route should eventually support both:

- webhook mode for deployed async runs
- stream-worker mode for local dogfood/debugging

## P1 Design Adjustments

1. Upgrade or isolate SDK usage.

   Either upgrade `@anthropic-ai/sdk` in root and worker together, or keep a raw HTTP adapter under `src/lib/managed-agents/` until the dependency change is safe. Do not casually bump SDK in the middle of unrelated research-v2 UI work.

2. Make the custom tool boundary narrower than the intent doc.

   For P1, use:

   - `fetch_competitor_ads_google` or keep `fetch_competitor_ads` but explicitly mark Google-only.
   - `save_section_artifact` for one section only, likely `positioningMarketCategory`.

3. Keep SearchAPI key out of the container.

   The canary proved the app-executed custom tool shape works. Continue routing SearchAPI through AI-GOS so exact engine strings and identity matching stay deterministic.

4. Treat Google Ads Transparency as asset/timing evidence, not copy evidence.

   Google rows are useful for creative IDs, timestamps, formats, and asset/detail URLs. They are weak for messaging unless we add detail-page/asset inspection.

5. Echo `session_thread_id` in all custom tool results.

   This is required once full six-section fan-out uses Managed Agents multiagent threads.

6. Preserve current UI state model.

   Managed Agents event types can map to current product telemetry:

   - `agent.custom_tool_use` -> tool-start
   - `user.custom_tool_result` -> tool-finish
   - `session.thread_status_running` -> section running
   - `session.thread_status_idle` with `end_turn` -> section idle/complete candidate
   - successful `save_section_artifact` -> durable section commit and Supabase realtime

## Recommended Next Step

Proceed to P1 only as a one-section proof, not a six-section rewrite.

Implement `save_section_artifact` for `positioningMarketCategory` with the existing Zod schema and `validateMarketCategoryMinimums`, run one Managed Agents session, and prove the agent revises after a deliberate validation failure. Once that works, the migration risk becomes mostly telemetry, concurrency, and deletion scope.
