# Managed Agents Competitor Section P1 Findings

Status: passed after schema-boundary hardening; not production-integrated.
Date: 2026-05-18, updated 2026-05-19.
Scope: one-section Managed Agents proof for `positioningCompetitorLandscape`.

## Verdict

Programmatic Managed Agents setup, custom-tool resume, validation feedback, and final Section 03 artifact acceptance now work for one `positioningCompetitorLandscape` canary.

The first Sonnet 4.6 run failed because the save tool exposed `artifact` as a generic object. After adding an explicit Section 03 artifact schema/skeleton to the tool boundary, system prompt, user message, and repair feedback, Sonnet produced an artifact that passed both `CompetitorLandscapeArtifactSchema.safeParse` and `validateCompetitorLandscapeMinimums`.

This is still a canary result. Do not replace `/api/research-v2/orchestrate` yet; the next step is a separate Managed Agents app adapter behind a feature flag.

## Run

### Initial Failed Run

Command:

```bash
npm run managed-agents:competitor-canary -- --company "monday.com" --domain monday.com --limit 5
```

Model:

- `claude-sonnet-4-6`

Resources created programmatically:

- Environment: `env_01GDZQUdrwB99zQ7ZaTy2QBc`
- Agent: `agent_01GRwUHHYctiJ98pzydHfGbk`
- Agent version: `1`
- Session: `sesn_013aG72HQkAPhxnFg4DmKokh`

Transcript:

- `tmp/managed-agents-competitor-section-canary-failed-sesn_013aG72HQkAPhxnFg4DmKokh-full.json`

No accepted artifact sidecar was written because final validation never passed.

### Schema-Hardened Passing Run

Command:

```bash
npm run managed-agents:competitor-canary -- --company "monday.com" --domain monday.com --limit 5
```

The local SSE connection terminated after evidence collection while Anthropic still showed the session as `running`, so the canary was reattached with:

```bash
npm run managed-agents:competitor-canary -- --company "monday.com" --domain monday.com --limit 5 --reuse-environment-id env_01D2xYn7quu8MYkQNPT12zay --reuse-agent-id agent_017c8hUXCFD9fQWAXC1gzfPX --reuse-session-id sesn_01CrNYjjfzSg5CKoHv5Fzmbo
```

Resources:

- Environment: `env_01D2xYn7quu8MYkQNPT12zay`
- Agent: `agent_017c8hUXCFD9fQWAXC1gzfPX`
- Agent version: `1`
- Session: `sesn_01CrNYjjfzSg5CKoHv5Fzmbo`

Artifacts:

- Transcript: `tmp/managed-agents-competitor-section-canary-success-sesn_01CrNYjjfzSg5CKoHv5Fzmbo-full.json`
- Accepted artifact: `tmp/managed-agents-competitor-section-canary-1779132163305-artifact.json`

## Custom Tools

Configured:

- `fetch_competitor_ads`
- `fetch_homepage_positioning`
- `fetch_pricing_evidence`
- `fetch_review_evidence`
- `fetch_share_of_voice`
- `save_competitor_landscape_artifact`

Observed tool calls:

| Tool | Count |
|---|---:|
| `save_competitor_landscape_artifact` | 3 |
| `fetch_share_of_voice` | 3 |
| `fetch_homepage_positioning` | 6 |
| `fetch_pricing_evidence` | 5 |
| `fetch_review_evidence` | 3 |
| `fetch_competitor_ads` | 1 |

All SearchAPI-facing tools used the local AI-GOS process and root `.env.local` `SEARCHAPI_KEY`; no paid API key was placed in the Managed Agents environment. Tool calls were bounded by `--limit 5` plus fixed request timeouts.

Schema-hardened run observed tool calls:

| Tool | Count |
|---|---:|
| `save_competitor_landscape_artifact` | 2 |
| `fetch_share_of_voice` | 3 |
| `fetch_homepage_positioning` | 5 |
| `fetch_pricing_evidence` | 5 |
| `fetch_review_evidence` | 2 |
| `fetch_competitor_ads` | 1 |

## Validation Result

Validation used the real worker-side Section 03 module:

- `CompetitorLandscapeArtifactSchema.safeParse`
- `validateCompetitorLandscapeMinimums`

Save attempts:

| Attempt | Result | Notes |
|---|---|---|
| 1 | `ok:false`, `schema_ok:false` | Deliberate invalid first-save probe returned field-addressable schema feedback. |
| 2 | `ok:false`, `schema_ok:false` | Full artifact attempt used wrong nested field names and missed required fields. |
| 3 | `ok:false`, `schema_ok:false` | Repair attempt still missed required fields including `competitorSet.competitors[*].sourceUrl`, `positioningTaxonomy.prose`, and axis fields. |

The repair feedback was returned as a normal `user.custom_tool_result` with `ok:false`, not as a transport-level `is_error`. The session resumed after each failed save, proving the repair loop transport.

Schema-hardened save attempts across the session:

| Attempt | Result | Notes |
|---|---|---|
| Initial probe | `ok:false`, `schema_ok:false` | Deliberate invalid first-save probe returned field-addressable schema feedback plus canonical skeleton. |
| Real save | `ok:true`, `schema_ok:true`, `minimums_ok:true` | Accepted artifact written to `tmp/managed-agents-competitor-section-canary-1779132163305-artifact.json`. |

Accepted artifact summary:

- `sources`: 16
- `competitorSet.competitors`: 6
- competitor types present: `direct`, `indirect`, `status-quo`, `diy`
- `positioningTaxonomy.axes`: 3
- `pricingReality.dataPoints`: 6 across 4 competitors
- `shareOfVoice.slices`: 4
- `publicWeaknesses.items`: 4 across 2 competitors
- `narrativeArcs.arcs`: 4
- `confidence`: 7

## Surprises

- In the first run, Sonnet 4.6 followed the deliberate invalid-save instruction and handled the custom tool loop, but did not reliably map the final artifact to the exact Section 03 schema after repair.
- The first failure was schema adherence, not Managed Agents programmatic setup, SSE parsing, SearchAPI execution, or custom-tool resume.
- A generic `artifact: object` save tool left too much nested shape inference to the agent. The explicit schema/skeleton fixed that.
- Google Ads Transparency evidence remained sparse for copy fields, matching the P0 spike: useful IDs/timing/detail links, weak headline/body/landing copy.
- Managed Agents custom tool schemas rejected `additionalProperties`; the canary now strips that keyword from the API-facing schema while preserving strict local Zod validation.
- Local SSE can terminate while the Managed Agents session continues running. The canary now supports `--reuse-session-id` so an operator can reconnect to the same session and continue handling tool calls.

## Recommendation

Proceed to a separate Managed Agents adapter, but keep it behind a feature flag and do not replace the current worker path.

Recommended next phase:

1. Extract the Managed Agents event loop into `src/lib/managed-agents/` without touching production orchestration behavior.
2. Move Section artifact schemas/minimum validators into a shared server module before Next routes import them.
3. Add a feature flag such as `ENABLE_MANAGED_AGENTS_SECTION_CANARY`.
4. Run only `positioningCompetitorLandscape` through the adapter first.
5. Persist accepted artifacts to the same Supabase projection tables only after standalone adapter tests pass.

The app adapter gate should require:

- first save rejected by validation,
- second or later save accepted,
- final `CompetitorLandscapeArtifactSchema.safeParse` success,
- `validateCompetitorLandscapeMinimums` success,
- accepted artifact JSON written under `tmp/`.
