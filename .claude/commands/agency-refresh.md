---
name: agency-refresh
description: Orchestrator — runs every batch channel sync in order, then reports what changed. Channel type — orchestrator over pull/batch channels.
---

# Agency Refresh (orchestrator)

**Purpose:** One command to refresh all batch data channels in order, then report what changed. Each step is idempotent — only changed data is rewritten — so re-running is safe and cheap.

## Channel type

Orchestrator over the pull/batch channels. It does NOT add a channel; it sequences the per-channel skills (one convention each). **Landing analytics is LIVE** (ingested in real time via `/api/landing-events` + `public/sl-analytics.v1.js` → `landing_events`) and is therefore **excluded** — there is no sync skill for it.

## Steps (run in this order)

1. **`/agency-sync-corpus`** — upserts `sl_corpus_clients_current`; `sl_refresh_runs(corpus_sync)`.
2. **`/agency-sync-fathom`** — phase A raw transcripts → `sl_fathom_transcripts`; `sl_refresh_runs(fathom_sync)`.
3. **`/agency-extract-signals`** — offline local-agent signal extraction → staged JSON → `npm run agency:upload-signals` upserts `sl_fathom_signals`. No metered API.

Run each via its own runbook so the per-channel conventions (dry-run, manifest guard, provenance row) are honoured. Stop and surface the error if any step writes a `status = 'failed'` `sl_refresh_runs` row.

## What it writes

Nothing of its own — the deterministic writes belong to the individual channel scripts (`sl_corpus_clients_current`, `sl_fathom_transcripts`, `sl_fathom_signals`, plus one `sl_refresh_runs` row per step).

## Report (after the run)

- **Row deltas** per channel: written vs skipped (corpus clients, fathom transcripts, signals).
- **Tier-distribution note** for the corpus: how the client tier mix shifted after the upsert.
- Which steps were no-ops (idempotent skip) vs which rewrote changed data.

## Dry-run note

Each step supports its own `--dry-run` (no DB, no creds). For a full no-creds preview, run the three channel commands with `--dry-run` rather than a live refresh.

## Creds (real run only)

`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `REPO_ROOT/.env.local`. Secret values are never logged. Supabase project ref: `sidrtuxpqftyzwdusdha`.
