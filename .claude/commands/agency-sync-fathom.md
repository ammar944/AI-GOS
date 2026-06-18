---
name: agency-sync-fathom
description: Sync raw Fathom call transcripts into Supabase (phase A, deterministic, no LLM). Channel type — pull/batch.
---

# Agency Sync — Fathom

**Purpose:** Phase A raw-transcript sync. Pulls Fathom meeting transcripts into Supabase deterministically (no LLM, no metered API). Idempotent — only changed recordings are rewritten via content hash.

## Channel type

Pull/batch Fathom channel. Two-step convention: this runbook does the raw sync; **signal extraction is a SEPARATE offline step** — `/agency-extract-signals` (local Claude agents stage a JSON file) followed by `npm run agency:upload-signals` (deterministic gate + upsert). No metered LLM call ever runs from this script.

## Command

```bash
# Plan only — NO DB, NO creds, NO LLM
npm run agency:sync-fathom -- --dry-run

# Work-list JSON of attributed calls — NO DB, NO creds
npm run agency:sync-fathom -- --list-attributed

# Real phase-A sync (needs creds — see below)
npm run agency:sync-fathom
```

Point at a non-default checkout with `SAASLAUNCH_REPO=/path npm run agency:sync-fathom -- --dry-run`.

Wraps `scripts/zz-sync-fathom.mjs`.

## What it writes

- **`sl_fathom_transcripts`** — upserts one row per Fathom recording (raw transcript + attribution status). Deterministic, no LLM.
- **`sl_refresh_runs`** — one provenance row, `run_kind = 'fathom_sync'`, `status = 'succeeded'` on success / `'failed'` on error.

Does NOT write `sl_fathom_signals` — that table is owned by the offline extraction step (`/agency-extract-signals` + `npm run agency:upload-signals`).

## Dry-run note

`--dry-run` reports the meeting counts (e.g. 442 meetings / 109 attributed / 333 unattributed / 0 would-extract) and touches the DB zero times — no creds, no LLM. `--list-attributed` emits the attributed-call work-list as JSON, also with no DB/creds.

## Creds (real run only)

Needs `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `REPO_ROOT/.env.local`. Secret values are never logged. Supabase project ref: `sidrtuxpqftyzwdusdha`.
