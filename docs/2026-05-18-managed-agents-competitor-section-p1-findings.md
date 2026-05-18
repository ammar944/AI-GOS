# Managed Agents Competitor Section P1 Findings

Status: blocked after first Sonnet 4.6 canary.
Date: 2026-05-18.
Scope: one-section Managed Agents proof for `positioningCompetitorLandscape`.

## Verdict

Programmatic Managed Agents setup and custom-tool resume both work for Section 03, but the P1 canary should not proceed to `/api/research-v2/orchestrate` integration yet.

The run hit the handoff stop condition: the agent produced a full save attempt, received schema repair feedback, retried once, and still failed `CompetitorLandscapeArtifactSchema.safeParse`. No accepted `CompetitorLandscapeArtifact` was produced.

## Run

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

## Surprises

- Sonnet 4.6 followed the deliberate invalid-save instruction and handled the custom tool loop, but did not reliably map the final artifact to the exact Section 03 schema after repair.
- The failure was schema adherence, not Managed Agents programmatic setup, SSE parsing, SearchAPI execution, or custom-tool resume.
- The save tool's JSON schema only declares `artifact` as a generic object. That keeps the API boundary simple, but it leaves too much nested shape inference to the agent.
- Google Ads Transparency evidence remained sparse for copy fields, matching the P0 spike: useful IDs/timing/detail links, weak headline/body/landing copy.

## Recommendation

Add or change tools first before route integration.

Do not wire this into `/api/research-v2/orchestrate` yet. The next P1 retry should either:

1. Add a schema skeleton or per-field artifact template to the agent/tool prompt before retrying Sonnet, or
2. Try Opus only after the schema guidance is hardened, so the result separates model capability from prompt/tool-boundary ambiguity.

The production route should wait until a canary run ends with:

- first save rejected by validation,
- second or later save accepted,
- final `CompetitorLandscapeArtifactSchema.safeParse` success,
- `validateCompetitorLandscapeMinimums` success,
- accepted artifact JSON written under `tmp/`.
