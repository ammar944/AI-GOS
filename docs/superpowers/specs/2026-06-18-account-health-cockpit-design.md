# Engineering Spec — Account-Health Cockpit (SaaSLaunch Agency Intelligence, slice 2)

> **Status:** spec draft for review (brainstorming step 6). Produced by a Fusion panel
> (Opus 4.8 + GPT-5.5, independent + judged) and grounded in the real corpus/Fathom data, not the
> handoff's drafts. After self-review + user approval → `superpowers:writing-plans` → build.
> **Branch / worktree:** `feat/agency-cockpit` at `/Users/ammar/.config/superpowers/worktrees/AI-GOS/agency-cockpit`.
> **Never touch the main repo** (it's on `refactor/architecture-deepening` with uncommitted files).

---

## 0. Problem statement (proven from data, not assumed)

`/internal/agency` is an alphabetical 42-row table whose risk columns come straight from the
corpus. Three measured facts make it actively misleading:

1. **`risk.tier` is constant** — all 42 corpus clients carry `risk.tier = "green"`. Information-free.
2. **`churn_score` is bimodal and capped low** — across all 42 clients `churn_score ∈ {0, 3}` only
   (20 score 0, **22 score 3**). No client scores ≥5, so the shipped console's `CHURN_HIGH_FLOOR = 5`
   warning path in `client-health.ts` **never fires**. Every churning account renders green.
3. **The real escalations are verbal and live only in Fathom** — discovery
   (`tmp/agency-insight-discovery-full.json`) proved Zuppler (CEO termination threat, Fathom
   recording **`146193190`**, ~May 13), PathfinderCRO ("wasted ~$10K", recording **`124463291`**),
   and RapportScore/PocketMarketer churning at `churn_score = 0`.

A fourth measured fact constrains the design:

4. **`risk.incidents` is polluted with extraction false-positives** — 26/42 clients carry ≥1
   incident (113 total; `cross_client_data_leak`×53, `security_or_account`×37, `account_compromise`×17).
   PocketMarketer has 7 `account_compromise` at `churn_score=0`; PathfinderCRO has 11 leak incidents
   pulled from product marketing copy. **Raw `risk.incidents` cannot be a standalone CRITICAL
   override** — it would paint 26/42 red. (This tightens the handoff's draft "or a high-severity
   `risk.incident`" rule.)

**Goal:** turn the overview into a deterministic, ranked **fleet risk-radar** sorted by a *true-risk
tier* computed from corpus signals **plus** verified verbal escalations from the 442 Fathom calls,
so Zuppler/PathfinderCRO surface as **CRITICAL** despite `churn_score = 3`, and the console stops
painting churning accounts green. Extends the existing console — not a new surface.

---

## 1. Verified data map

| Source | State / shape (verified) | Location |
|---|---|---|
| Corpus per-client (42) | top-level keys: `actions, aliases, calls, clickup_lists, client, delivery, drive_folder, fathom_meetings, gaps, media_plan, owner, promises, provenance, risk, schema_version, scope_as_discussed, sentiment, slack_channels, stage, status, timeline`. In Supabase as `sl_corpus_clients_current.client_json` (jsonb) + on disk. | `…/saaslaunch/corpus/clients/<slug>.json` |
| Corpus index | `{ clients:[{slug, client, client_id, risk_tier, churn_score, gap_score, source_counts, sources_total}], schema_version }`. All `risk_tier="green"`. | `…/saaslaunch/corpus/index.json` |
| Fathom raw (442) | **Local only — NOT in Supabase.** This is what slice 2 ingests. **109 of 442 recording_ids are client-attributed; 333 unattributed; 0 duplicate attributions** (re-confirm in `--dry-run`). | `…/saaslaunch/intake/fathom/meetings/<recording_id>.json` |

### 1.1 Corpus field shapes the engine reads (exact — most scalars are `{quote, source_id, value}` envelopes; unwrap `.value`)
- `risk = { churn_score:int(0|3), gap_score:int, incidents:Incident[], signals:[...], scoring_note:string }`.
  `risk.tier` does **not** exist in `client_json`; tier lives in the index/`sl_corpus_clients_current.risk_tier` column (all "green") — **non-load-bearing**.
- `risk.incidents[] = { quote, source_id, type:{value: cross_client_data_leak|security_or_account|account_compromise|slack_incident} }`. **Low-trust** (§6.4). Incidents generally do **not** expose a usable `severity`.
- `risk.signals[] = enveloped`; may carry churn-relevant `quote`/`value`. **Severity reliability UNVERIFIED — see §6.4.2; treat conservatively.**
- `delivery = { clickup_status:string, launched:boolean (raw bool, not enveloped), deliverables:Deliverable[], time_tracked_ms:number }`.
- `delivery.deliverables[] = { item:{value}, quote, source_id, status:{value} }`. `status.value` is frequently `""` or `"complete"`. **Done** = normalized `status.value ∈ {complete, completed, done, closed, live, launched}` (case-insensitive, after stripping leading emoji/whitespace). Everything else (incl. `""`) = not-done.
- `sentiment.latest = { value: "pos"|"neg"|"neutral" }`. Exact vocab across 42: pos(8), neg(10), neutral(24). **Match `"neg"` exactly** (not "negative").
- `actions[] = { action:{value}, owner:{value}, priority:string, clickup_ready:bool }`. **`(owner.value ?? '').trim() === '' ⇒ unowned`.**
- `fathom_meetings[] = { recording_id:string, call_type:"sales"|"cs_checkin"|"onboarding"|"other", date:ISO8601, title, source_path, matched_by:"domain"|"title" }`. **This is the attribution index.** `recording_id` here is a **string**; in the raw Fathom file it is an **integer** — normalize both to `String(...)` at the join boundary.
- `timeline = []` everywhere → no onboarding date in corpus → use **earliest `fathom_meetings[].date` as the onboarding proxy** (§9).

### 1.2 Fathom raw JSON shape (exact)
```
{ recording_id:int, title, meeting_title, meeting_type:null (always — ignore),
  url, share_url, created_at, recording_start_time, recording_end_time,
  scheduled_start_time, scheduled_end_time: ISO8601,
  calendar_invitees:[{email,email_domain,is_external,name,...}],
  calendar_invitees_domains_type:string, recorded_by:{email,email_domain,name,team},
  default_summary:{ template_name, markdown_formatted:string },
  action_items:[{ assignee:{email,name,team}, completed:bool, description, recording_playback_url, recording_timestamp, user_generated:bool }],
  transcript:[{ speaker:{ display_name, matched_calendar_invitee_email }, text, timestamp:"HH:MM:SS" }],
  transcript_language:"en" }
```
Call type comes from the corpus `fathom_meetings[].call_type` join (raw `meeting_type` is null).

---

## 2. Scope

**In (5 components):** (1) Fathom ingestion pipeline `scripts/zz-sync-fathom.mjs` + `npm run agency:sync-fathom`; (2) two new tables `sl_fathom_transcripts`, `sl_fathom_signals`; (3) deterministic true-risk engine `src/lib/agency-intelligence/insights/account-health.ts` (NO LLM in scoring); (4) cockpit overview (risk-sorted) + per-client "Verbal signals" section; (5) extends the existing console — `client-health.ts`/`computeClientHealth` stays untouched, account-health is additive.

**Out (v1 / YAGNI):** Promise-vs-Delivery SLA auditor, Meta-efficiency reconciler (only Checkle has Meta data), landing-tracker debug, revenue/MRR loop, live Fathom API sync, semantic search over transcripts (raw stored *for* future search; none built now).

---

## 3. Architecture & data flow

```
  OFFLINE (scripts, service_role, run only on explicit user OK)
  intake/fathom/meetings/*.json ─(deterministic)─► sl_fathom_transcripts (raw, 442 rows)
        └─ attribution join (corpus fathom_meetings index) → client_slug (nullable)
  attributed transcripts (109) ─(LLM extract, sonnet, bounded)─► sl_fathom_signals
        └─ anti-fabrication gate: normalized quote ⊂ transcript turn text  (script-side, not the model)
  RUNTIME (Next.js server component, RLS internal-only SELECT)
  loaders → sl_corpus_clients_current (42) + sl_fathom_signals (grouped by slug)
        └─► computeAccountHealth(client_json, signals[]) per client  [pure, deterministic, no LLM, no I/O]
        └─► sort by (tier, score desc, lastSignalDate desc, slug) → cockpit table
```
The raw sync (phase A) is deterministic + cheap; extraction (phase B) is the only LLM step, manifest-guarded. Scoring is re-derived on every page load from stored signals — signals are *inputs*, never re-extracted at request time.

---

## 4. Database schema (new migration)

**File:** `supabase/migrations/20260619_account_health_cockpit_fathom.sql` — dated **after** `20260618_agency_intelligence.sql` so it applies later (required: it ALTERs `sl_refresh_runs`, created there). Follow that migration's conventions exactly (`pgcrypto`, `create table if not exists`, RLS on, internal-user SELECT policy, service_role write grants, table comments).

### 4.1 `sl_fathom_transcripts` (raw)
```sql
create extension if not exists pgcrypto;

create table if not exists public.sl_fathom_transcripts (
  recording_id text primary key check (recording_id ~ '^[0-9]+$'),  -- normalized String of the Fathom int; natural key + join key
  client_slug  text,                                                -- nullable: null = unattributed (kept, excluded from cockpit)
  title        text,
  meeting_title text,
  call_type    text not null default 'unknown'
               check (call_type in ('sales','cs_checkin','onboarding','other','unknown')),  -- from corpus join; 'unknown' if unattributed
  call_date    timestamptz not null,                                -- recording_start_time, fallback created_at
  transcript   jsonb not null default '[]'::jsonb check (jsonb_typeof(transcript) = 'array'),
  summary      text,                                                -- default_summary.markdown_formatted
  action_items jsonb not null default '[]'::jsonb check (jsonb_typeof(action_items) = 'array'),
  share_url    text,
  call_url     text,                                                -- raw .url
  transcript_turns integer not null default 0 check (transcript_turns >= 0),
  raw_sha256   text not null check (raw_sha256 ~ '^sha256:[a-f0-9]{64}$'),  -- content hash for idempotent re-sync
  source_metadata jsonb not null default '{}'::jsonb,  -- { source_repo, source_path, recorded_by, calendar_invitees_domains_type, transcript_language, matched_by, attribution_status, attribution_collision? }
  ingested_at  timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_sl_fathom_transcripts_client_date
  on public.sl_fathom_transcripts (client_slug, call_date desc) where client_slug is not null;
create index if not exists idx_sl_fathom_transcripts_call_type
  on public.sl_fathom_transcripts (call_type, call_date desc);
```

### 4.2 `sl_fathom_signals` (compact extracted signals)
```sql
create table if not exists public.sl_fathom_signals (
  id uuid primary key default gen_random_uuid(),
  client_slug text not null check (client_slug <> ''),              -- NOT NULL: only attributed calls produce signals
  recording_id text not null references public.sl_fathom_transcripts(recording_id) on delete cascade,
  signal_type text not null check (signal_type in ('churn_escalation','going_dark','payment_risk','verbal_promise','upsell_intent')),
  severity    text not null check (severity in ('low','medium','high')),
  quote       text not null check (length(quote) between 12 and 1200),  -- VERBATIM transcript substring (anti-fab gate)
  quote_sha256 text not null check (quote_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  speaker     text,                                                 -- transcript speaker.display_name of the quoted turn
  call_date   timestamptz not null,
  extracted_at timestamptz not null default now(),
  source_metadata jsonb not null default '{}'::jsonb,  -- { extractor:'zz-sync-fathom', extraction_version:'account-health-v1', model, extraction_run_id, quote_match:{transcript_index,timestamp,speaker,normalized_quote_sha256}, rationale, suggested_action }
  unique (recording_id, signal_type, quote_sha256)                  -- idempotency backstop
);
create index if not exists idx_sl_fathom_signals_client_sev_date
  on public.sl_fathom_signals (client_slug, severity, call_date desc);
create index if not exists idx_sl_fathom_signals_type_date
  on public.sl_fathom_signals (signal_type, call_date desc);
create index if not exists idx_sl_fathom_signals_recording
  on public.sl_fathom_signals (recording_id);
```

### 4.3 RLS + grants (copy the verified block from `20260618_agency_intelligence.sql`, substituting table names)
```sql
alter table public.sl_fathom_transcripts enable row level security;
alter table public.sl_fathom_signals     enable row level security;

create policy "internal users select sl fathom transcripts" on public.sl_fathom_transcripts
  for select to authenticated using (
    exists (select 1 from public.user_profiles up
            where up.id = auth.jwt() ->> 'sub'
              and up.account_status = 'active'
              and up.app_role in ('admin','internal')));
create policy "internal users select sl fathom signals" on public.sl_fathom_signals
  for select to authenticated using (
    exists (select 1 from public.user_profiles up
            where up.id = auth.jwt() ->> 'sub'
              and up.account_status = 'active'
              and up.app_role in ('admin','internal')));

grant select on public.sl_fathom_transcripts to authenticated, service_role;
grant select on public.sl_fathom_signals     to authenticated, service_role;
grant insert, update, delete on public.sl_fathom_transcripts to service_role;
grant insert, update, delete on public.sl_fathom_signals     to service_role;
```

### 4.4 Extend `sl_refresh_runs` for Fathom provenance
```sql
alter table public.sl_refresh_runs drop constraint if exists sl_refresh_runs_run_kind_check;
alter table public.sl_refresh_runs add constraint sl_refresh_runs_run_kind_check
  check (run_kind in ('corpus_sync','corpus_rebuild','fathom_sync','fathom_extract'));
```

---

## 5. Fathom ingestion pipeline (`scripts/zz-sync-fathom.mjs`)

Mirror `zz-sync-saaslaunch-corpus.mjs` exactly: `loadEnvFile(REPO_ROOT/.env.local)`, `--dry-run` (no DB/creds/LLM), `SAASLAUNCH_REPO` default `/Users/ammar/Dev-Projects/saaslaunch`, `sl_refresh_runs` running→succeeded/failed lifecycle. **Never print key values.** `package.json` adds `"agency:sync-fathom": "node scripts/zz-sync-fathom.mjs"`.

**CLI modes:** `--dry-run` (plan only) · default (phase A raw sync) · `--extract` (A then B) · `--extract-only`/`--signals-only` (B only) · `--limit=N` · `--client=<slug>` · `--force` (re-extract unchanged).

### 5.1 Phase A — raw transcript sync (deterministic)
**Guards (fail closed, zero partial writes):** intake dir has ≥1 `*.json`; corpus index + clients parse; each Fathom file parses with `recording_id` + `transcript[]`.
**Attribution map:** iterate every `corpus/clients/<slug>.json`, read `fathom_meetings[]`, build `Map<String(recording_id) → {client_slug, call_type, date, matched_by, source_path, title}>`. **If one recording_id maps to >1 slug → fail the guard phase, zero writes** (verified 0 dups today, so a collision means corpus drift worth stopping for).
**Per-row build:** `recording_id=String(raw.recording_id)`; `client_slug = map.get(id)?.client_slug ?? null`; `call_type = map.get(id)?.call_type ?? 'unknown'`; `call_date = raw.recording_start_time ?? raw.created_at`; `transcript=raw.transcript`, `transcript_turns=raw.transcript.length`; `summary=raw.default_summary?.markdown_formatted ?? null`; `action_items=raw.action_items ?? []`; `share_url`, `call_url=raw.url`; `raw_sha256 = 'sha256:'+sha256(canonical raw JSON)`; `source_metadata` per §4.1.
**Write:** upsert on `recording_id`, skip rows whose stored `raw_sha256` matches (idempotent). Write a `sl_refresh_runs` row `run_kind='fathom_sync'` with `{total_calls, attributed, unattributed, manifest_hash}`.
**`--dry-run` output (JSON, no DB/creds):** `{ meetings_total:442, attributed:109, unattributed:333, duplicate_attributions:0, would_write_raw:442, would_extract_from:109, per_client_counts:{...} }`. **Assert these counts** — a missed int↔string normalization silently zeroes attribution.

### 5.2 Phase B — signal extraction (the only LLM step)
Operates only over attributed transcripts (`client_slug IS NOT NULL`). **Provider:** `@ai-sdk/anthropic`, model = the repo's current sonnet id (confirm via `src/lib/ai/providers.ts`; do not hardcode a stale id). AI SDK v6 `generateText` + `Output.object()` (repo rule: no new `generateObject()`). `maxOutputTokens` bounded (~1500). No web tools, no multi-step loop. Concurrency ≤3 (promise pool). Skip a recording whose `raw_sha256` is unchanged AND already has signal rows, unless `--force`.
**Input per call:** transcript flattened to `<timestamp> <speaker>: <text>` lines + the corpus `call_type` + summary as *context only* (quotes may NOT come from the summary). If the transcript exceeds the context budget, chunk by turn ranges and union (each chunk gated independently). Do not pre-summarize.
**Output schema (Zod `Output.object`, no `.min/.max` on the Anthropic schema — bound post-hoc):**
```ts
const ExtractedFathomSignals = z.object({
  signals: z.array(z.object({
    signal_type: z.enum(['churn_escalation','going_dark','payment_risk','verbal_promise','upsell_intent']),
    severity:    z.enum(['low','medium','high']),
    quote:       z.string(),       // MUST be verbatim from a single transcript turn
    speaker:     z.string().nullable(),
    rationale:   z.string(),
    suggested_action: z.string().nullable(),
  })),
});
```
Cap `signals` to 5 after the call. **Prompt contract:** extract only escalation/commitment signals a CSM would act on; return [] if none. `severity:high` only for explicit relationship-threatening language (termination, refund demand, "wasted $X"). **`quote` MUST be copied verbatim from one transcript turn** — no paraphrase, no cross-turn concatenation, no ellipsis; if you can't quote verbatim, omit.

### 5.3 Anti-fabrication gate (deterministic, in the script — MANDATORY)
For every candidate signal, the same liar-catcher discipline as the research pipeline's `verification/provenance-gate.ts`:
1. **Normalize** quote and each transcript turn's `text`: Unicode NFKC → curly quotes/dashes → ASCII → lowercase → collapse whitespace → trim.
2. **Accept only if** the normalized quote is a substring of **one** raw `transcript[i].text` (or its flattened `<timestamp> <speaker>: <text>` line). **Reject if it only appears in `default_summary`.** Reject cross-turn matches.
3. Reject if `quote.length < 12` (already a DB check; enforce in-script too).
4. Resolve `speaker`, `call_date`, `transcript_index`, `quote_sha256` deterministically from the matched turn (overwrite the model's `speaker`). Store `source_metadata.quote_match.matched=true`.
5. Count rejections per recording_id; if >50% of a call's candidates reject, **log loudly** (prompt/model regression signal). Write the rejection total to the `fathom_extract` run row.
**Idempotent write:** `delete from sl_fathom_signals where recording_id=$1`, then insert gated survivors. Write a `sl_refresh_runs` row `run_kind='fathom_extract'` with `{model, calls_processed, signals_emitted, signals_rejected, manifest_hash}`.
**Cost safety:** `--limit`/`--client` exist so the FIRST live extraction runs on one client (`--client=zuppler --extract-only`) and is eyeballed before the full ~109-call sweep (honors "paid APIs never loop without an abort condition"; the abort is the finite attributed set).

---

## 6. True-risk engine (`src/lib/agency-intelligence/insights/account-health.ts`)

**Deterministic. No LLM. No I/O. Pure function.** Lives beside `client-health.ts` (unmodified).

### 6.1 Types
```ts
export type RiskTier = 'critical' | 'warning' | 'healthy';
export interface FathomSignalLite { signal_type:'churn_escalation'|'going_dark'|'payment_risk'|'verbal_promise'|'upsell_intent';
  severity:'low'|'medium'|'high'; quote:string; speaker:string|null; call_date:string|null; recording_id:string; share_url?:string|null; }
export interface AccountHealthInput { client_slug:string; client_display_name:string|null; churn_score:number|null;
  risk_tier:string|null; client_json:Record<string,unknown>; fathom_signals:FathomSignalLite[]; generated_at:string; /* deterministic as-of for tests */ }
export interface HealthDriver { code:string; label:string; severity:'critical'|'warning'|'info'; points:number; evidence:Evidence[]; }
export interface AccountHealth { client_slug:string; tier:RiskTier; score:number; drivers:HealthDriver[]; topUnblockAction:string;
  churn_score:number|null; launched:boolean|null; unowned_open_actions:number;
  last_signal:{type:string;severity:string;call_date:string|null}|null; }
```

### 6.2 Pure corpus readers (exported for unit test; unwrap `.value` defensively)
`readLaunched`→`delivery.launched`|null · `readDeliverableProgress`→{done,total,ratio|null} (done per §1.1 normalization incl. emoji strip) · `readSentiment`→'pos'|'neg'|'neutral'|null · `readUnownedOpenActions`→count `actions[]` with empty `owner.value` · `readOnboardingDate`→earliest `fathom_meetings[].date`|null · `weeksSince(date, generated_at)` · `readCorpusRiskSignalsHigh` (§6.4.2, conservative) · `readCorpusIncidents` (low-trust, §6.4).

### 6.3 Driver-severity model (each driver carries its own severity; tier = max driver severity; score = Σ points)
Compute the applicable drivers, then:
```ts
tier  = drivers.some(d => d.severity==='critical') ? 'critical'
      : drivers.some(d => d.severity==='warning')  ? 'warning' : 'healthy';
score = clamp(drivers.reduce((s,d)=>s+d.points,0), 0, 999);   // sort key only; tier dominates sort
```

**CRITICAL drivers** (any → tier critical):
- `high_verbal_churn_escalation` (120) — a high-sev Fathom `churn_escalation`.
- `high_verbal_going_dark` (115) — high-sev Fathom `going_dark`.
- `high_verbal_payment_risk` (110) — high-sev Fathom `payment_risk`.
- `stalled_launch_six_weeks` (90) — `launched===false` AND `weeksSinceOnboarding>=6` AND `(ratio===null || ratio<0.20)`.
- `neg_sentiment_corroborated` (85) — `sentiment==='neg'` AND (any high-sev Fathom signal OR any **medium**-sev Fathom churn/dark/payment signal). *(Opus's nuance: medium verbal + neg → critical.)*
- `corpus_risk_signal_high` (105) — **conservative, verification-gated (§6.4.2):** a `risk.signals[]` entry with an explicit high severity AND a churn-language regex match. **If the `risk.signals[]` severity field is not reliably present (verify at build time), demote this to a WARNING driver.**

**WARNING drivers** (any, only if no critical):
- `medium_verbal_risk` (60) — medium Fathom churn/dark/payment signal.
- `unowned_action_backlog` (45) — `unownedOpenActions>=3`.
- `stalled_launch_four_weeks` (40) — `launched===false` AND `weeksSinceOnboarding>=4`.
- `neg_sentiment` (35) — `sentiment==='neg'` (uncorroborated).
- `corpus_incident_corroborated` (20) — `corpusHighSevIncidentCount>=2` AND `sentiment==='neg'`. *(Incidents NEVER critical, NEVER alone — §6.4.)*

**`verbal_promise` / `upsell_intent` never promote tier** (info drivers only; small points for sort).

**churn_score does NOT drive tier** (synthesis — §6.4.1). It adds to score for sort only: `score += (churn_score ?? 0) * 2` (0 or 6 here), and is shown as a de-emphasized column.

#### 6.4.1 Why churn_score is non-tier-driving
Verified `churn_score ∈ {0,3}`, 22 clients at 3. A warning floor of 5 (the shipped bug) never fires; a floor of 3 would flood **52% of the fleet** into WARNING from churn alone, destroying the radar. The whole premise is that `churn_score` is unreliable — so it must not set the tier. The genuine escalations (Zuppler/PathfinderCRO, both churn=3) are promoted by **verbal Fathom signals**, not churn.

#### 6.4.2 Why corpus incidents are demoted; corpus risk-signals are conservative
`risk.incidents` is polluted (26/42 clients, 113 incidents, false-positives from product copy). Admissible only as corroboration (`corpus_incident_corroborated`, warning, + neg sentiment), never standalone, never critical. `risk.signals[]` *may* carry real churn language ("wasted $10K") and is offered as a corpus-side critical fallback (so a client can flag CRITICAL from corpus text even before Fathom extraction runs) — **but** neither panelist verified `risk.signals[]` reliably exposes a high `severity`; **at build time, confirm the field; if absent, the `corpus_risk_signal_high` driver becomes a WARNING.** The churn-language regex (hedge):
```
/(cut our losses|stop wasting|wasted|break the contract|part ways|terminat|cancel|no longer interested|turn (them|it) off|throwing (cash|money)|not happy|billing|payment bounced|refund|going dark|no response)/i
```

### 6.5 Drivers + topUnblockAction
Each `HealthDriver.evidence` reuses `contracts.ts` `Evidence`: Fathom drivers → a **non-UUID** signal locator (§6.6); corpus drivers → `corpusFileLocator('corpus/clients/<slug>.json', '/delivery' | '/actions' | '/sentiment' | '/risk')`. `topUnblockAction` derived from the worst driver: critical-verbal → "Escalate to owner — verbal churn signal on <date>"; stalled → "Recover launch — <done>/<total> done after <weeks>w; assign owner+date"; backlog → "Assign owners — <n> open actions unowned"; else → "Maintain cadence — no open escalations."

### 6.6 `contracts.ts` additions
- `EvidenceKind` += `fathom_transcript`, `fathom_signal`, `corpus_risk_signal`, `corpus_delivery`.
- **Non-UUID locator** (because `sl_fathom_transcripts` is keyed by `recording_id`, and the existing `DbRowLocator` requires a UUID):
  ```ts
  export const DbKeyLocator = z.object({ type: z.literal('db_key'), table: z.string().min(1),
    key_column: z.string().min(1), key_value: z.string().min(1), column: z.string().min(1).optional() });
  ```
- `FathomSignalType`, `FathomSignalSeverity`, `FathomTranscriptRow`, `FathomSignalRow` Zod schemas (validate script→DB and DB→engine; not sent to Anthropic, so `.min/.max` are fine here).
- Optional: `InsightKind += 'account_health'` only if persisting; the cockpit computes **live** (like `client-health.ts`), so persistence is **not** required for v1.

---

## 7. Test fixtures (`__tests__/account-health.test.ts`, TDD, `generated_at='2026-05-20T00:00:00Z'`)

The override cases (F1/F2/F3) are the acceptance criterion: they must be **CRITICAL** despite low churn.

| # | Fixture | Key inputs | churn | EXPECTED | Why |
|---|---|---|---|---|---|
| F1 | **Zuppler** | high Fathom `churn_escalation`, rec `146193190`, quote substring "absolutely not happy with the responsiveness from your team"; launched=false; neutral | **3** | **critical** | `high_verbal_churn_escalation`. Headline test. |
| F2 | **PathfinderCRO (verbal)** | high Fathom `payment_risk`, rec `124463291`, quote substring "13K was for you guys to build out"; launched=false; ratio 0.0; sentiment neg | **3** | **critical** | verbal payment_risk (also stalled + neg). |
| F3 | **PathfinderCRO (corpus fallback)** | NO Fathom signals; `risk.signals[]` high + "wasted $10K" (per discovery findings.jsonl:L153) | **3** | **critical** | `corpus_risk_signal_high` *(warning if severity field unverified — see §6.4.2)*. |
| F4 | **RapportScore** | medium `going_dark`; launched=false; earliest fathom ≫6w; ratio 0.0; pos | **0** | **critical** | `stalled_launch_six_weeks`. churn=0 must NOT make it healthy. |
| F5 | **PocketMarketer** | no high/med verbal; launched=false; ~5w; ratio 0.31; pos; `corpusHighSevIncidentCount=7` | **0** | **warning** | `stalled_launch_four_weeks`; incidents alone don't escalate. |
| F6 | churn=3, launched, healthy | no verbal; launched=true; neutral; unowned 1 | **3** | **healthy** | churn=3 alone is NOT a tier driver. |
| F7 | clean healthy | launched=true; ratio 0.9; pos; unowned 1 | **0** | **healthy** | no driver fires. |
| F8 | unowned backlog | launched=true; unowned 4; neutral | **0** | **warning** | `unowned_action_backlog`. |
| F9 | neg + medium verbal | medium `churn_escalation`; neg; launched=true | **0** | **critical** | `neg_sentiment_corroborated`. |
| F10 | neg alone | no verbal; neg; launched=true | **0** | **warning** | `neg_sentiment`. |
| F11 | incidents + neg, no verbal | `corpusHighSevIncidentCount=3`; neg; launched=true | **0** | **warning** | `corpus_incident_corroborated` (never critical). |
| F12 | upsell only | high `upsell_intent`; launched=true | **0** | **healthy** | upsell never promotes. |
| F13 | no fathom calls | signals=[]; no fathom_meetings; launched=false | **0** | **healthy** | onboarding date null → stalled rules can't fire (gap §9). |

**Gate tests** (extract gate to pure `src/lib/agency-intelligence/fathom/gate.ts`): G1 verbatim substring → kept · G2 paraphrase → rejected · G3 cross-turn concat → rejected · G4 len<12 → rejected · G5 whitespace/curly-quote variant → kept after normalization · G6 quote only in summary → rejected.

**Calibration / sort tests:** tierRank dominates score (a critical@score 30 sorts above a warning@score 90); F1 above F4 above any warning. **Tier-distribution sanity:** running the engine over all 42 corpus clients (with empty signals, pre-extraction) must yield a **small** critical set, not half-red — assert `critical_count <= ~6` pre-extraction (incidents/churn non-tier-driving is what keeps this true).

---

## 8. Cockpit surface (UI — extend existing components, Tailwind tokens, server components)

**`loaders.ts`:** `getAccountHealthOverview()` selects `sl_corpus_clients_current.*` + all `sl_fathom_signals` (one query, grouped client-side), runs `computeAccountHealth` per client, returns rows **pre-sorted by (tierRank, score desc, lastSignalDate desc nulls last, slug)**. Wrap `sl_fathom_signals` in the existing `safeSelect` so a not-yet-provisioned table degrades to "Not provisioned" instead of crashing. Extend `getClientDetail` to `safeSelect` this client's signals (call_date desc).

**Overview table** (`src/app/internal/agency/page.tsx`), sorted true-risk desc: **Tier** badge (critical=red, warning=amber, healthy=emerald) · **Client** (→ detail) · **Top driver** (`drivers[0].label`) · **Next action** (`topUnblockAction`) · **Last verbal signal** (`type · severity · date` or —) · **Churn (raw)** *de-emphasized* · **Launched** ✓/✗/— · **Unowned tasks** · **Signal count** · **Score** *de-emphasized, for audit* · **Updated**. Raw `risk_tier`/`churn_score` stay visible but no longer order rows. Add a **"Critical accounts"** stat block (count of `tier==='critical'` — the at-risk-dozen headline).

**Detail** (`[slug]/page.tsx`): add a **"Verbal signals (from calls)"** section after "Corpus truth" — rows of severity badge + `signal_type` + verbatim `quote` + speaker + `call_date` + recording link (`source_metadata.share_url ?? call_url`) + locators (`sl_fathom_signals.id`, `recording_id`). Empty → "No attributed Fathom risk signals extracted for this client." Tables absent → reuse the verified-absence "Not provisioned" pattern. Existing live `client-health` section unchanged.

---

## 9. Known data gaps (state honestly; surface in UI)
1. **No onboarding date in corpus** (`timeline=[]`) → "weeks since" uses earliest attributed Fathom date; clients with no calls can't trigger stalled-launch rules (F13 → healthy). Surface a "no call history — risk not assessable from calls" note.
2. **`risk.incidents` low-trust** (26/42, 113, mostly false-positive) → corroboration-only, never a cockpit risk column.
3. **`deliverable.status.value` often `""`** → treated not-done; mitigated by requiring `weeks>=6` AND `launched===false` together for the critical stalled rule.
4. **`recording_id` type mismatch** (corpus string vs raw int) → normalize to String at the join; covered by the dry-run attribution-count assertion.
5. **Attribution: 109/442 attributed, 333 unattributed** — unattributed stored raw (`client_slug=null`), produce no signals, never in the cockpit. Collisions fail the guard.
6. **`risk.signals[]` severity reliability UNVERIFIED** — confirm at build time; if absent, `corpus_risk_signal_high` is a WARNING not CRITICAL (§6.4.2).
7. **Landing `landing_events=0`** — not a cockpit risk source in v1.
8. **Meta ads = Checkle only** — out of scope.

---

## 10. Verification gates (`.claude/rules/verification.md` + DOX)
Build in the worktree (`npm install` + `.env.local` first); **never touch the main repo.**
1. `npm run test:run -- src/lib/agency-intelligence` — all fixtures green. **F1 Zuppler, F2 PathfinderCRO, F4 RapportScore must be CRITICAL** (acceptance criterion). Tier-distribution sanity passes.
2. `node --check scripts/zz-sync-fathom.mjs` · `npx tsc --noEmit` (ignore documented pre-existing openrouter/chat-blueprint errors) · `npm run lint` · `npm run build` exit 0.
3. `npm run agency:sync-fathom -- --dry-run` → `{meetings_total:442, attributed:109, unattributed:333, duplicate_attributions:0}`, no DB/creds. Eyeball Zuppler includes rec `146193190`.
4. **Prod writes gated on explicit user "yes"** (auto-mode blocks them; "build it" ≠ consent). Pause before: (a) applying the migration to `sidrtuxpqftyzwdusdha`, (b) phase-A sync, (c) phase-B extraction. First extraction = `--client=zuppler --extract-only`, eyeball the quote is a real transcript substring, before the full sweep.
5. **Live eyeball** (authenticated browse / chrome-devtools MCP — `/internal/*` returns 404 to anon, do NOT route-poll): on `aigos.saaslaunch.com/internal/agency`, Zuppler + PathfinderCRO are **NOT green** — top of the table as CRITICAL with a verbal-signal driver; raw churn still shows 3.
6. **DOX closeout:** update `docs/source-map.md` (new Fathom subtree + 2 tables); add memory `project_account_health_cockpit_*` once the spec lands.

---

## 11. Build sequence (for `superpowers:writing-plans`)
1. Migration `20260619_account_health_cockpit_fathom.sql` (+ `sl_refresh_runs` run_kind alter).
2. `contracts.ts` additions (DbKeyLocator, Fathom schemas, evidence kinds).
3. `zz-sync-fathom.mjs` phase A → `--dry-run` verify (109/333/0).
4. Anti-fab gate `fathom/gate.ts` + tests G1–G6.
5. `zz-sync-fathom.mjs` phase B (sonnet, `Output.object`, gate-applied) → `--client=zuppler` probe.
6. `account-health.ts` engine + readers (TDD) → fixtures F1–F13 + gate/sort/calibration tests green.
7. `loaders.ts` extensions + wiring.
8. `page.tsx` cockpit table + `[slug]/page.tsx` verbal-signals section.
9. tsc/lint/build → (user OK) migration apply → (user OK) prod sync + extract → live eyeball.
