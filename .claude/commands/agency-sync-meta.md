---
name: agency-sync-meta
description: STUB — planned Meta ads channel sync for the Agency Intelligence cockpit. Reads the local Checkle Meta baseline JSON into an sl_meta_* table. NOT YET IMPLEMENTED — needs its own migration + a deterministic sync script. This runbook is the TEMPLATE for future batch channels.
---

# Agency Sync — Meta ads (STUB)

> **STATUS: NOT YET IMPLEMENTED.** There is no `scripts/zz-sync-meta.mjs`, no `sl_meta_*` table,
> and no `"agency:sync-meta"` entry in `package.json` yet. Running this skill today does nothing but
> describe the plan. It is the **template** every future batch channel copies — read it alongside
> [`docs/agency-sync-architecture.md`](../../docs/agency-sync-architecture.md) (the framework) and the
> two reference implementations, `scripts/zz-sync-saaslaunch-corpus.mjs` (corpus) and
> `scripts/zz-sync-fathom.mjs` (Fathom).

## Purpose

Pull each client's Meta (Facebook/Instagram) ads performance baseline into the cockpit so the
account-health engine can reconcile promised spend/efficiency against what actually ran. Meta is a
**batch / pull** channel under the modular per-channel convention: idempotent, manifest-guarded,
`.env.local`-only, deterministic DB writes, `sl_refresh_runs` provenance, creds-free `--dry-run`.

## Why it is still a stub (constraints, all real)

- **Only Checkle has Meta data.** The single source today is the local Checkle baseline export under
  `/Users/ammar/Dev-Projects/saaslaunch/intake/ads/meta/checkle/`. No other client has a Meta intake
  folder, so this channel covers exactly one client until more baselines land.
- **Anura is locked.** The Anura ad-data path is not available to this channel.
- **No Meta API / MCP is wired.** There is no live Meta Marketing API connection and no Meta MCP
  server. The ONLY ingestion path is the local Checkle baseline JSON files — not a live API pull.

Until a migration + sync script exist, this channel has no table and writes nothing.

## Planned mechanism (when implemented)

Mirror `scripts/zz-sync-saaslaunch-corpus.mjs` exactly:

1. **Source:** read the local Checkle Meta baseline JSON under
   `/Users/ammar/Dev-Projects/saaslaunch/intake/ads/meta/<client>/` (today: `checkle/`).
   `SAASLAUNCH_REPO` default `/Users/ammar/Dev-Projects/saaslaunch`.
2. **Env:** `loadEnvFile(REPO_ROOT/.env.local)`; never print key values.
3. **Guards (fail closed, zero partial writes):** intake dir has ≥1 baseline JSON; each file parses;
   each row resolves to a known corpus `client_slug`.
4. **Target:** a new `sl_meta_*` table (e.g. `sl_meta_ad_accounts` / `sl_meta_campaign_metrics`),
   keyed on a natural key (account id + period), with a `raw_sha256` content hash. Upsert; skip rows
   whose stored hash is unchanged (idempotent / manifest-guarded).
5. **Writes:** deterministic field→column mapping only (no LLM in the sync). Record one
   `sl_refresh_runs` row, `run_kind='meta_sync'` (add to the
   `sl_refresh_runs_run_kind_check` constraint in the new migration), with
   `{accounts, campaigns, would_write, manifest_hash}`.
6. **`--dry-run`:** print the plan as JSON (counts, what would be written) — no DB, no creds, no LLM.
7. **Register:** add `"agency:sync-meta": "node scripts/zz-sync-meta.mjs"` to `package.json` and a
   row to the channel registry in `docs/agency-sync-architecture.md`.

If Meta later needs interpreted signals (e.g. "spend running hot vs promise"), add a companion
`/agency-extract-meta` that drives an **offline local-Claude** agent (no metered API) to stage a JSON
file, plus a deterministic uploader that validates + gates + upserts to `sl_meta_signals` — exactly
the Fathom phase-B pattern.

## To implement (checklist — same as "How to add a new channel" in the framework doc)

1. `supabase/migrations/<date>_meta_ads.sql` — `sl_meta_*` table(s), RLS + service_role grants copied
   from `20260618_agency_intelligence.sql`, and the `meta_sync` `run_kind` ALTER.
2. `scripts/zz-sync-meta.mjs` — deterministic batch sync (idempotent, `.env.local`, `--dry-run`,
   `sl_refresh_runs`).
3. (Optional) `/agency-extract-meta` offline skill + deterministic uploader → `sl_meta_signals`.
4. Add the channel to `/agency-refresh`.
5. Add/flip its row in `docs/agency-sync-architecture.md` to **DONE**.

## Rules

- Do NOT call any live Meta API or MCP — none is wired; the only source is the local Checkle baseline.
- Do NOT do LLM extraction inside the sync script; deterministic writes only. Any insight extraction
  is an offline local-Claude step + a deterministic uploader.
- Do NOT touch any other channel's table, script, or skill. Adding Meta is additive only.
