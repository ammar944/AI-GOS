# research-v2 — orchestrator + artifact UI feature flags

These four flags drive the orchestrator + artifact UI rollout described in
`docs/2026-05-13-orchestrator-and-artifact-ui-goal.md`. All default to **false**
until each phase is verified and ready to ship.

| Env var | Read by | Default | What it does |
|---|---|---|---|
| `ENABLE_POSITIONING_ORCHESTRATOR` | `src/app/api/research-v2/chat/route.ts`, `research-worker/src/index.ts` | `false` | Routes chat through the ToolLoopAgent positioning orchestrator instead of the legacy intent router. Flipped on at Phase 5. |
| `NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS` | `src/app/research-v2/page.tsx` | `false` | Legacy browser-side `Promise.allSettled` fan-out across the six positioning sections. Removed entirely at Phase 7. Keep `false` once the worker `/orchestrate` endpoint is live (Phase 2+). |
| `NEXT_PUBLIC_ARTIFACT_UI_V2` | `src/app/research-v2/page.tsx`, `src/components/research-v2/*` | `false` | Mounts the centered `AgentArtifactSurface` instead of the six-card `SectionShell` grid. Flipped on at Phase 4. |
| `RAILWAY_WORKER_URL` | both | unset | Public URL of the Railway research worker. Without it, all research dispatches silently fail. Dev default: `http://localhost:3001`. |

## Capabilities endpoints

Two endpoints expose the live state of these flags so ops can diff frontend
vs worker reality with one command:

- `GET /api/research-v2/_capabilities` — Next.js mirror. Reads the local
  frontend env, then fetches the worker's `/capabilities` (1.5s timeout) to
  surface `worker_version` and `orchestrate_supported`. Returns
  `worker_version="unreachable"` and `orchestrate_supported=false` on failure.
- `GET /capabilities` on the worker (Express). Reads its own env + package
  version. `orchestrate_supported` flips to `true` at Phase 2.

Shared JSON shape:

```json
{
  "orchestrator_enabled": false,
  "parallel_sections_enabled": false,
  "artifact_ui_v2": false,
  "worker_url": "http://localhost:3001",
  "worker_version": "1.0.0",
  "orchestrate_supported": false
}
```

## Local setup

Add to `.env.local` (the file is gitignored — do not commit it):

```
ENABLE_POSITIONING_ORCHESTRATOR=false
NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS=false
NEXT_PUBLIC_ARTIFACT_UI_V2=false
RAILWAY_WORKER_URL=http://localhost:3001
RAILWAY_API_KEY=dev-secret
```

Bounce `npm run dev` after changing `NEXT_PUBLIC_*` vars — Next.js bakes them
into the client bundle at build time, so HMR won't pick them up.
