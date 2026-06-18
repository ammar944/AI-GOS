# Agency Intelligence Console — Execution Plan

> Branch: `feat/agency-intelligence-console` (worktree: `~/.config/superpowers/worktrees/AI-GOS/agency-intelligence-console`).
> Base: `origin/main` (`32cc78c4`) + cherry-picked SaaSLaunch landing analytics (`3143301d`, content-identical to `5d551084`).
> Date: 2026-06-18. Status: **first execution slice in progress** — proof spine only, not the final console.

## 1. Product thesis

AI-GOS today produces per-client research blueprints but has no operator-facing view that
fuses **two independent truths**:

1. **Tracker truth** — what the SaaSLaunch landing analytics subsystem actually observed
   (live events, rejections, tracker install state per site), in Supabase.
2. **Corpus truth** — what the SaaSLaunch engagement corpus knows about each client
   (risk tier, churn/gap scores, promises, actions, gaps, fathom meetings), on disk at
   `/Users/ammar/Dev-Projects/saaslaunch/corpus/`.

The Agency Intelligence Console is the surface that joins these two truths per client and
emits **evidence-backed internal insights** (e.g. "tracker installed but zero conversion
events in 14 days; corpus shows 3 open promises and a churn_score of 3 → at-risk launch").
The first slice proves the spine end-to-end with one real insight and one internal UI
surface — it does not build the full dashboard.

## 2. Confirmed existing analytics subsystem

Cherry-picked onto this branch and verified present (15 files, 3603 insertions):

- `public/sl-analytics.v1.js` — 513-line self-contained browser tracker with built-in PII defense.
- `src/app/api/landing-events/route.ts` — event ingest route (+ `__tests__/route.test.ts`).
- `src/lib/saaslaunch/` — `events.ts`, `event-contract.ts`, `dashboard.ts`, tracker/events tests.
- `src/app/internal/saaslaunch/` — Overview page + `clients/[slug]/` detail page.
- `src/middleware.ts` — internal route allowlist entry.
- `supabase/migrations/20260611_saaslaunch_landing_analytics.sql` — six tables + RLS.

DB schema (authoritative, from the migration):

| Table | Key columns | Notes |
|---|---|---|
| `agency_clients` | `slug` (unique), `display_name`, `status` | top-level client |
| `agency_client_sites` | `client_id`→FK, `slug`, `tracker_status`, `tracker_last_seen_at` | `unique(client_id,slug)`; `tracker_status ∈ {planned,installed,verified,disabled,error}` |
| `landing_event_definitions` | `site_id`→FK, `event_key`, `category`, `is_conversion` | per-site event registry |
| `landing_event_property_definitions` | `event_definition_id`→FK, `property_key`, `property_type` | per-event props |
| `landing_events` | `client_id`→FK, `site_id`→FK, `event_definition_id`→FK, `event_key`, `occurred_at`, utm_*, `properties` | the observed facts |
| `landing_event_rejections` | `client_slug`, `site_slug`, `event_key`, `reason`, `created_at` | **keyed by slug strings, not FKs** |

`journey_sessions.meeting_transcripts` exists (renamed from `fathom_calls` in
`20260414_rename_fathom_to_meetings.sql`); jsonb array of meeting entries.

## 3. Corpus two-step refresh contract

The SaaSLaunch corpus at `/Users/ammar/Dev-Projects/saaslaunch` is rebuilt by a two-step
contract (confirmed: `join_fathom_to_corpus.py`):

1. **Build digests** from four live intake sources → `corpus/digests/` + `corpus/actions.jsonl`
   (Slack, ClickUp, Drive docs, Fathom). Produces `corpus/clients/*.json` (42 clients) and
   `corpus/index.json` / `corpus/_manifest.json` (`client_count: 42`).
2. **Join Fathom meetings** to each client file via domain/title matching → the
   `fathom_meetings` array on every client (verified 42/42 coverage).

Per-client file shape (all 42 carry these keys): `actions`, `promises`, `gaps`,
`fathom_meetings`, `calls`, `risk{tier,churn_score,gap_score,...}`, `media_plan`,
`provenance`, `sentiment`, `scope_as_discussed`, `delivery`, `timeline`, …
`index.json` per-client entry carries `risk_tier`, `churn_score`, `gap_score`,
`source_counts`, `sources_total`.

**Console refresh contract:** the console never reads intake sources directly. It reads
(1) Supabase tracker tables live, and (2) a snapshot of `corpus/index.json` + the relevant
`corpus/clients/*.json` captured into Supabase by a refresh run (Phase 2+). The on-disk
corpus is rebuilt out-of-band by the two-step script; the console snapshots its output.

## 4. First-slice scope (this branch, this pass)

Prove the spine with code + tests + verification. **Not the full console.**

1. **Phase 0 — Ground-truth probe** ✅ written: `scripts/zz-probe-agency-state.mjs` +
   `npm run agency:probe`. Read-only. Reports the 6 analytics-table counts, per-client/site
   tracker truth, `journey_sessions.meeting_transcripts` non-empty count, and corpus sanity
   (index/manifest/clients counts, fathom_meetings coverage, Checkle detail). Missing
   tables/columns/files are reported, not fatal; only DB-connection failure is fatal.
2. **Phase 1 — This plan doc.**
3. **Phase 2 — First-slice schema** (`supabase/migrations/20260618_agency_intelligence.sql`):
   `sl_corpus_snapshots`, `sl_corpus_client_snapshots`, `sl_insights`, `sl_refresh_runs`
   (and `sl_corpus_clients_current` if useful). Scoped to what the first slice needs —
   no single mega-table. *(spec truncated mid-Phase-2; see §7 blockers)*
4. **Phase 3+ — Refresh run + one evidence-backed insight + one internal UI surface.**
   *(not yet specified; see §7)*

## 5. Non-goals (this slice)

- No full dashboard / no multi-insight feed / no alerting / no scheduling.
- No new tracker, no new ingest path — reuse the existing analytics subsystem as-is.
- No mutation of the on-disk corpus or the two-step rebuild script.
- No changes to `refactor/architecture-deepening` (this branch is isolated).
- No reintroduction of deleted routes (`/research-v2` page, `/journey` page).
- No weakening of RLS on the analytics tables.

## 6. Proof commands

```bash
# From the agency worktree:
WT=~/.config/superpowers/worktrees/AI-GOS/agency-intelligence-console

# Phase 0 probe (read-only; needs .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
cd "$WT" && npm run agency:probe
# → prints full JSON to stdout, human summary to stderr.

# Syntax / graceful-failure check (no creds needed):
env -u NEXT_PUBLIC_SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY \
  node "$WT/scripts/zz-probe-agency-state.mjs"
# → exit 0, DB section reports FATAL missing-keys (no crash), corpus section fully populated.

# DB schema sanity (after Phase 2 migration):
# psql / Supabase studio: confirm sl_* tables created; run affected app/worker contract tests.

# Build + tests (DOX verification gate):
cd "$WT" && npm run lint && npm run test:run
```

## 7. Known blockers

- **Spec truncation.** The Phase 2 schema spec was cut off mid-sentence
  ("Do not use a single sl_corpus…"); Phases 3+ were not delivered. Phase 2+ implementation
  is blocked on the rest of the spec.
- **Live DB verification of the probe.** The probe's DB-query path (counts, per-site truth,
  meeting_transcripts count) requires `SUPABASE_SERVICE_ROLE_KEY` in the worktree's
  `.env.local`. Copying the secrets file was blocked by the session safety classifier.
  Verified so far: syntax (`node --check`), graceful missing-config handling, and the full
  corpus section (index=42, manifest=42, clients_dir=42, fathom_meetings 42/42, Checkle
  risk=green/churn=3/gap=0/actions=19/promises=24/gaps=0/fathom_meetings=2). To verify the
  DB path, copy env and run:
  `cp ~/.env.local-equivalent "$WT/.env.local"` then `cd "$WT" && npm run agency:probe`.
- **Analytics subsystem not yet applied to the live Supabase project.** The migration
  `20260611_saaslaunch_landing_analytics.sql` exists on this branch but must be applied to
  the target Supabase project before the probe's DB counts are non-zero/meaningful.
  Confirm with `mcp__supabase__list_tables` / `list_migrations` before relying on tracker truth.

## 8. Next phases (placeholders, pending spec)

- **Phase 2** — first-slice schema (`sl_corpus_snapshots`, `sl_corpus_client_snapshots`,
  `sl_insights`, `sl_refresh_runs`). Blocked on truncated spec §7.
- **Phase 3** — refresh run: snapshot `corpus/index.json` + per-client `corpus/clients/*.json`
  into the `sl_corpus_*` tables (one row per refresh run; current view materialized).
- **Phase 4** — one evidence-backed insight: join tracker truth (per-site events/rejections/
  tracker_status) + corpus truth (risk/churn/gap/promises/gaps/fathom_meetings) for one
  client (e.g. Checkle) → one `sl_insights` row with cited evidence pointers.
- **Phase 5** — one internal UI surface at `src/app/internal/agency/` rendering that insight
  with its evidence chain (tracker facts + corpus facts both visible and sourced).
- **Phase 6** — verification: probe green on live DB, migration applied, insight renders,
  `npm run lint` + `npm run test:run` clean on touched paths; DOX closeout pass.