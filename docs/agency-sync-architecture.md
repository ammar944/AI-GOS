# Agency Intelligence — Modular Per-Channel Sync Architecture

> **Design spec:** [`docs/superpowers/specs/2026-06-18-account-health-cockpit-design.md`](./superpowers/specs/2026-06-18-account-health-cockpit-design.md)
> **Surface:** `/internal/agency` (the Account-Health Cockpit) reads the `sl_*` tables this framework populates.
> **Worktree:** `feat/agency-cockpit` at `/Users/ammar/.config/superpowers/worktrees/AI-GOS/agency-cockpit`.

---

## 0. The one idea

**Each external data CHANNEL is its own re-runnable skill following ONE convention.**
Adding a source = adding a channel skill. It never means editing the other channels. The cockpit
loaders read whatever `sl_*` tables exist (degrading to "Not provisioned" when one is absent), so a
new channel lights up the moment its table + sync land — no coupling, no flag-day.

A channel is exactly one of two types:

- **Pull / batch** — we go fetch a snapshot on demand (corpus, Fathom, Meta ads, Slack). Implemented
  as `/agency-sync-<channel>` (+ an optional `/agency-extract-<channel>` when offline insight
  extraction is needed). Idempotent and manifest-guarded so re-runs are cheap and safe.
- **Live / stream** — data arrives in real time and is already ingested by an always-on endpoint
  (landing analytics). There is **no sync skill** — it would be wrong to "re-sync" a stream. It is
  documented here so the registry is complete.

---

## 1. The convention (every BATCH channel obeys all of these)

A batch channel's sync script (`scripts/zz-sync-<channel>.mjs`, run via `npm run agency:sync-<channel>`)
MUST:

1. **Be idempotent + manifest-guarded.** Compute a content hash (`sha256:<hex>`) per source record;
   skip any row whose stored hash is unchanged. Re-running a clean sync writes nothing and costs
   nothing. The reference is `scripts/zz-sync-saaslaunch-corpus.mjs` (corpus) and
   `scripts/zz-sync-fathom.mjs` (Fathom).
2. **Load env from `REPO_ROOT/.env.local` only, and NEVER log secret values.** Use the minimal
   `loadEnvFile()` helper that every sync script already carries (it reads `.env.local`, strips
   quotes, and sets `process.env` — it does not print values). No secret ever appears in stdout,
   a `sl_refresh_runs` row, a commit message, or a PR.
3. **Make DETERMINISTIC DB writes only.** The sync script itself does no LLM work. It maps source
   fields to columns by code. Writes are upserts keyed on a natural key, guarded by the content hash.
   **Fail closed:** if any guard fails, write zero rows (no partial sync).
4. **Do any LLM INSIGHT extraction OFFLINE, via local Claude, then upload deterministically.**
   When a channel needs interpreted signals (not just raw records), the extraction runs as an
   **offline local-Claude agent** on the user's CLI subscription — **no metered API calls from a
   script**. The agent stages a JSON file; a deterministic uploader (a script or a `--extract`/
   `--extract-only` phase) **validates** every record against a Zod/SQL contract and an anti-fabrication
   gate (the quote must be a verbatim substring of the source, like
   `src/lib/agency-intelligence/fathom/gate.ts`), then upserts the survivors to the channel's
   `sl_*_signals` table. **Signals are inputs, never re-extracted at request time** — the cockpit
   re-derives health on every page load from the stored signals.
5. **Record a `sl_refresh_runs` row for provenance.** Each run writes one row with a `run_kind`
   (e.g. `corpus_sync`, `fathom_sync`, `fathom_extract`) and a counts/manifest payload, with a
   `running → succeeded | failed` lifecycle. This is the audit trail for "when did this channel last
   refresh and what did it write."
6. **Provide a `--dry-run` that needs no creds.** `--dry-run` prints the plan as JSON (counts, what
   *would* be written, attribution stats) and touches neither the DB nor any credential nor any LLM.
   It is the cheap correctness check (e.g. Fathom's dry-run asserts `attributed:109, unattributed:333,
   duplicate_attributions:0` — a silent int↔string normalization bug would zero attribution and the
   assertion catches it).

A channel that needs offline extraction therefore ships **two** skills: `/agency-sync-<channel>`
(phases A raw + an `--extract` phase that runs the deterministic uploader) and a companion
`/agency-extract-<channel>` runbook that drives the offline local-Claude agent which stages the JSON
the uploader consumes.

---

## 2. Channel-type split

| | Pull / batch | Live / stream |
|---|---|---|
| **How data arrives** | We fetch a local snapshot on demand | Pushed in real time by an always-on endpoint |
| **Skill** | `/agency-sync-<channel>` (+ optional `/agency-extract-<channel>`) | none — re-syncing a stream is meaningless |
| **Idempotency** | content-hash manifest, skip-unchanged | dedupe at ingest (event id) |
| **Provenance** | `sl_refresh_runs` row per run | the event table itself is the log |
| **Examples** | Corpus, Fathom, Meta ads, Slack | Landing analytics |

---

## 3. Channel registry

| Channel | Type | Status | Table(s) | Sync skill | Extract skill | Notes |
|---|---|---|---|---|---|---|
| **Corpus** (SaaSLaunch client corpus) | batch | **DONE** | `sl_corpus_clients_current`, `sl_corpus_*` | `/agency-sync-corpus` (`scripts/zz-sync-saaslaunch-corpus.mjs`) | — (deterministic, no LLM) | Snapshots `corpus/index.json` + `corpus/clients/*.json`. Reference implementation for the convention. `--rebuild` runs the python build first. Migration `20260618_agency_intelligence.sql`. |
| **Fathom** (call transcripts + verbal signals) | batch + offline-extract | **DONE** | `sl_fathom_transcripts` (raw), `sl_fathom_signals` (extracted) | `/agency-sync-fathom` (`scripts/zz-sync-fathom.mjs`; phase A raw + `--extract` uploader) | `/agency-extract-fathom` (offline local-Claude → staged JSON → deterministic gate/uploader) | 442 raw calls, 109 client-attributed. Anti-fab gate `fathom/gate.ts` (verbatim-substring). `run_kind` `fathom_sync` / `fathom_extract`. Migration `20260619_account_health_cockpit_fathom.sql`. |
| **Meta ads** | batch | **STUB — NOT YET IMPLEMENTED** | `sl_meta_*` (planned, no migration yet) | `/agency-sync-meta` (runbook stub, template for future channels) | — (TBD) | Only **Checkle** has Meta data (`/Users/ammar/Dev-Projects/saaslaunch/intake/ads/meta/checkle/`). **Anura is locked** and **no Meta API/MCP is wired** — the only path is the local Checkle baseline JSON. Needs its own migration + a deterministic sync script before it is real. |
| **Slack** | batch + offline-extract | **FUTURE** | `sl_slack_*` (planned) | `/agency-sync-slack` (planned) | `/agency-extract-slack` (planned) | Channel messages → raw table; offline local-Claude extracts escalation/commitment signals → `sl_slack_signals` via the same gate+uploader pattern as Fathom. Not started. |
| **Landing analytics** | **LIVE** | **DONE (live)** | `landing_events` | **none — ingested in real time** | — | Real-time ingest via `POST /api/landing-events` (`src/app/api/landing-events/route.ts`) + the browser tracker `public/sl-analytics.v1.js`. Migration `20260611_saaslaunch_landing_analytics.sql`. A stream, so there is deliberately **no sync skill**; the event table is its own provenance log. |

---

## 4. How to add a new channel

When a new external source appears, do these in order — and **edit no other channel**:

1. **Add the table(s).** New `supabase/migrations/<date>_<channel>.sql` creating `sl_<channel>_*`
   (raw, and `sl_<channel>_signals` if it needs extraction). Copy the RLS + service_role-grant block
   from `20260618_agency_intelligence.sql` / `20260619_account_health_cockpit_fathom.sql` verbatim
   (internal-only SELECT). If the channel writes a new `run_kind`, `ALTER` the
   `sl_refresh_runs_run_kind_check` constraint in the same migration.
2. **Add the deterministic sync script** `scripts/zz-sync-<channel>.mjs` mirroring
   `zz-sync-saaslaunch-corpus.mjs`: `loadEnvFile(REPO_ROOT/.env.local)`, fail-closed guards,
   content-hash manifest / skip-unchanged upserts, a `sl_refresh_runs` `<channel>_sync` row, and a
   creds-free `--dry-run`. Register it in `package.json` as `"agency:sync-<channel>"` and write the
   `/agency-sync-<channel>` runbook in `.claude/commands/`.
3. **(Only if it needs interpreted signals) add the offline extraction pair.** A `/agency-extract-<channel>`
   skill that drives a **local Claude** agent (no metered API) to stage a JSON file, plus a deterministic
   uploader (a `--extract` phase of the sync script or a sibling script) that validates each record
   against a contract, runs the verbatim-substring anti-fab gate, and upserts survivors to
   `sl_<channel>_signals` with a `sl_refresh_runs` `<channel>_extract` row.
4. **Wire it into `/agency-refresh`** so the aggregate refresh runs the new channel alongside the
   others (each channel stays independently re-runnable; the aggregator just fans out).
5. **Register it here** — add a row to the channel registry table in §3 (type, status, tables, skills,
   notes) so this doc stays the single map of the fleet.

Adding a source is therefore additive only: a migration, a script, an optional offline-extract pair,
an `/agency-refresh` entry, and a registry row. No existing channel's code changes.
