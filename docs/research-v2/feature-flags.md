# research-v2 — orchestrator + artifact UI rollout (historical)

**Status (2026-05-13):** Phase 7 collapsed all rollout flags. The orchestrator
and centered artifact UI are the only path. This doc is kept as a historical
record; no code reads any of the flags below.

## Removed flags

| Env var | Was read by | Replaced with |
|---|---|---|
| `ENABLE_POSITIONING_ORCHESTRATOR` | chat route | always on |
| `LEGACY_CHAT_INTENTS` | chat route | removed (orchestrator only) |
| `NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS` | research-v2 page | replaced by worker /orchestrate |
| `NEXT_PUBLIC_ARTIFACT_UI_V2` | research-v2 page, surface | always-on AgentArtifactSurface |

`RAILWAY_WORKER_URL` and `RAILWAY_API_KEY` are still required — without them
all research dispatches silently fail.

## Capabilities endpoints (post-Phase 7 shape)

- `GET /api/research-v2/_capabilities` — Next.js mirror. Returns
  `{ worker_url, worker_version, orchestrate_supported }`.
- `GET /capabilities` on the worker — same three keys plus the existing
  `anthropic` / `tools` ops payloads.

```json
{
  "worker_url": "http://localhost:3001",
  "worker_version": "1.0.0",
  "orchestrate_supported": true
}
```

## Local setup

Add to `.env.local` (gitignored, never commit):

```
RAILWAY_WORKER_URL=http://localhost:3001
RAILWAY_API_KEY=dev-secret
```
