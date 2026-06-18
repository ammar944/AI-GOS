---
name: agency-sync-corpus
description: Sync the SaaSLaunch client corpus into Supabase (deterministic, idempotent). Channel type — pull/batch.
---

# Agency Sync — Corpus

**Purpose:** Re-runnable batch sync of the SaaSLaunch client corpus into Supabase. Deterministic, idempotent (manifest/content-hash guarded — unchanged clients are skipped), no LLM.

## Channel type

Pull/batch corpus channel. One convention: `/agency-sync-corpus` (this runbook). Adding a new source means adding a sibling skill, never editing this one.

## Command

```bash
# Plan only — read-only, no DB writes, no creds needed
npm run agency:sync-corpus -- --dry-run

# Real sync (needs creds — see below)
npm run agency:sync-corpus

# Optional: rebuild the on-disk corpus (python pipeline) first, then sync
npm run agency:sync-corpus -- --rebuild
```

Point at a non-default checkout with `SAASLAUNCH_REPO=/path npm run agency:sync-corpus -- --dry-run`.

Wraps `scripts/zz-sync-saaslaunch-corpus.mjs`.

## What it writes

- **`sl_corpus_clients_current`** — upserts one row per client in the corpus.
- **`sl_refresh_runs`** — one provenance row, `run_kind = 'corpus_sync'` (or `'corpus_rebuild'` with `--rebuild`), `status = 'succeeded'` on success. On any sync-time failure a single row with `status = 'failed'` is written instead.

Idempotent: only changed clients are rewritten; unchanged ones are skipped via the content hash.

## Dry-run note

`--dry-run` prints the plan (run kind + the `sl_corpus_clients_current` upsert count) and touches the DB zero times — no creds required. `--rebuild` mutates the corpus on disk regardless of `--dry-run`.

## Creds (real run only)

Needs `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `REPO_ROOT/.env.local`. Secret values are never logged. Supabase project ref: `sidrtuxpqftyzwdusdha`.
