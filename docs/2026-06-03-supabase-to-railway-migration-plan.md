# Supabase → Railway Postgres Migration + Schema Cleanup + Feature Restoration

> Plan of record. Produced via `/grill-me` interview + 8-agent codebase recon, 2026-06-03.
> Status: **DECISIONS LOCKED, execution not started.** Drivers, scope, and per-area
> decisions below were stress-tested against live DB state and the codebase.

## 1. Why (drivers, honestly scored)

User-selected drivers: consolidate on Railway · cut cost · fresh-start/control · "faster".

| Driver | Verdict after grilling |
|---|---|
| Consolidate on Railway | ✅ Real. Worker already on Railway; co-locating the DB cuts worker↔DB latency, one platform/bill. |
| Control / fresh-start | ✅ Real. You barely use Supabase's platform value-add, so owning a thin Postgres stack is cleaner. |
| Cut cost | ⚠️ Weak. You're on Pro (~$25/mo); Railway PG lands in the same ballpark. Cost is ~a wash. |
| "Faster" | ❌ Myth. Same Postgres version (17.6) = same query speed. The win is co-location latency, not raw SQL. |

**Net:** migration justified by consolidation + control, not cost/speed. Proceeding to **full rip-out → Railway Postgres + Drizzle** (user decision).

## 2. Ground truth that shaped the plan (from recon)

- **Auth:** Clerk-only since migration `remove_supabase_auth` (2026-01-21). Zero FKs to `auth.users`. Every ownership column is a plain `text` Clerk id. **"Import users" = `pg_dump`/restore `user_profiles` (21 rows); Clerk untouched.**
- **Realtime:** exactly ONE use — the section-partial live-draft preview (Broadcast API). All load-bearing data already flows over 2s HTTP polling. → **rebuild as first-class SSE** (user wants low-latency agent streaming; treat as a feature, upgrade beyond the cosmetic preview).
- **Storage:** ONE ephemeral `document-uploads` bucket (upload→parse→delete). → **direct upload on Railway, drop the bucket + signed-URL indirection.**
- **RLS:** vestigial — ~37 modules use the service-role key (RLS bypassed); isolation is app-layer `.eq('user_id', userId)`. Only RLS-dependent path = public `/shared`. → **drop RLS, enforce authz in app, serve `/shared` via a server route.** (Audit first that no anon-key read relies on RLS.)
- **Data layer:** ~72 files, ~190 `supabase-js` chains, 17 Postgres RPCs, across `src/` + `research-worker/` (can't share code). Query surface is shallow (no embedded joins). → **port to Drizzle; keep the 17 RPCs as raw SQL.**
- **Platform-only features otherwise:** NONE. No edge functions, pg_cron, queues, Vault. **pgvector installed but unused → drop.**

## 3. Target schema (the cleanup, expressed as Drizzle)

The clean schema **is** the cleanup — we author only the live tables in Drizzle; dead tables simply never cross over.

**KEEP (~11 live tables):**
- `research_artifacts`, `research_artifact_sections`, `research_section_runs`, `research_section_events` (v3 normalized section store — sole home of section output)
- `journey_sessions` — **re-scoped to slim corpus+inputs+session table** (see below)
- `business_profiles`, `business_profile_documents`
- `user_profiles` (auth/roles; ⚠️ base DDL not in migrations — capture live column types before porting)
- `shared_sessions` (rebuilt for v3 share)
- `client_allowlist`, `access_audit_logs`
- `audit_chat_messages` (current post-research chat)

**`journey_sessions` re-scope** (v3 already split storage cleanly — no monolith surgery needed):
- Keep: `id, user_id, run_id, profile_id, phase, metadata, onboarding_data, research_wiki, job_status, meeting_transcripts, created_at, updated_at`
- **Keep `research_results` (name unchanged)** — chat-write-through, the journey-session API, run-view, and client polling all still read it, so renaming is a read-model rewrite, not cleanup (Codex #3). Document the narrowed role in a column comment (corpus + identity + meeting keys only; never sections)
- **Drop columns:** `research_document` (dead writer), `messages` (0/312 rows; chat moved to `audit_chat_messages`), `research_output` (zero refs), `document_saved_at`

**DROP entirely (dead — cold-archive to JSON, never model in Drizzle):**
- V1: `blueprints`, `shared_blueprints`, `blueprint_chunks`, `blueprint_versions`, `media_plans`, `conversations`, `chat_messages`, `chat_conversations`, `script_packs`
- V2 orphan: `managed_agents_webhook_events`
- GTM (never merged to main; docs forbid revival): `gtm_runs`, `gtm_stage_events`, `gtm_artifacts`, `gtm_messages`
- Eval sinks (worker-write-only, no readers; also the 3 RLS-disabled tables): `research_telemetry`, `research_results_shadow`, `research_eval_diffs` — drop + remove their worker write code
- Phantom typegen entries: `users`, `projects`, `reports`

## 4. Data migration scope

**Scope = users + profiles + completed runs** (user decision).
- Migrate: `user_profiles`, `client_allowlist`, `business_profiles` (+`_documents`), and **v3-format completed runs** = `journey_sessions` rows that have committed `research_artifact_sections`, plus their `research_artifact*` rows + `audit_chat_messages` + `shared_sessions`.
- **"Completed" rule (tightened, Codex #10):** parent rollup complete — `research_artifacts.children_complete == children_total` (or all required canonical sections committed). NOT "≥1 committed section" (that migrates abandoned partials as completed). Handle synthesis/paid-media sections if present. Abandoned/incomplete sessions dropped.
- ~36 pre-v3 legacy multi-section rows = **cold-archive to JSON, not carried as a live surface** (V1 viewer retired — see §6).
- Everything dropped in §3 → cold-export to JSON first (nothing truly lost).

## 4b. Architecture decisions (eng-review 2026-06-03)

- **D1 — Execution = strangler-fig.** Phase 1: introduce a repository/data-access interface (DAL) over current supabase-js, no behavior change, fully tested. Phase 2: implement the same interface with Drizzle on Railway. The interface is the **parity-test seam** — run both implementations against their own DBs and diff results before deleting Supabase. No file-by-file in-place rewrite (no safety net for the one-way migration).
- **D2 — Hosting = all-Railway.** Next app moves OFF Vercel to a persistent Node server on Railway, co-located with the worker + Postgres on Railway's **private network**. Rationale: the Next layer is query-heavy (audit-state polls 4 tables/2s, dispatch, orchestrate, profiles, chat) — split hosting means every query crosses the public internet (~30-80ms RTT). Co-location → sub-ms. Split-hosting is *perpetual* latency + ops debt; self-hosting Next is *one-time* setup. Persistent server also makes in-process SSE streaming + bounded connection pools trivial (no serverless footguns).
- **D2b — Agent execution stays in-process in Next FOR NOW**, but services are split (Next + worker + PG) so relocating section execution to the scalable worker later is a clean lift, not a re-platform. Full agent-relocation = deferred phase (see NOT in scope).
- **D3 — Schema source of truth = shared `packages/db`** workspace package (Drizzle schema + DAL types) imported by BOTH `src/` and `research-worker/`. Kills schema drift structurally (ends the repo's 6-place field-sync pain). Worker stays decoupled from `src/lib` (imports the package, not app code). *Prerequisite cost (Codex #11): root + worker are separate npm projects with separate locks + the worker Dockerfile only copies worker files — converting to workspaces is Stage-0 work before any Drizzle code.*
- **D4 — Parity compares canonical DTOs, not raw rows (Codex #4).** Client semantics differ (`.maybeSingle()`, JSON/date normalization, null/order). Assert equality at the repository DTO boundary; for schema-changed paths, compare old-DTO vs new-DTO with documented transforms. Data: sanitized real snapshot + synthetic concurrency fixtures.
- **D5 — Cutover = phased/sequenced (Codex #1/#2/#12), NOT big-bang multi-system.** Ship features + security cleanup on Supabase first; then migrate one axis at a time (DB-access behind DTOs → hosting → streaming), each independently reversible with a tested rollback. See §7.
- **D6 — Drop-RLS = a real authz architecture (Codex #9).** Repository methods are tenant-scoped by construction (userId is a required arg, not an optional `.eq`); ZERO browser DB clients; public `/shared` is server-route-only. Audit every former anon-key read before removing RLS.

## 5. Platform-replacement decisions (locked)

| Area | Decision |
|---|---|
| Hosting | **All-Railway** (Stage 2). Next persistent + worker + Postgres on one private network. Real self-host workstream (Codex #6): root **Dockerfile**, `output: 'standalone'`, **bundle runtime-read files** (SKILL.md/corpus — the known ENOENT risk), image-opt strategy, **Cloudflare** CDN, health checks, **graceful-drain on shutdown** so deploys don't orphan in-flight `after()` runs (`reap_orphaned_section_runs` backstops). Horizontal scale later → Redis ISR cache. |
| Pooling | **Bounded `pg` pools** per persistent service (Next + worker each). No PgBouncer needed (persistent servers, not serverless). Size pools under Postgres `max_connections`. |
| Realtime | **SSE streams from persisted `research_section_events` with a cursor** (catch-up on reconnect) — Codex #8. Postgres `NOTIFY` is only a low-latency *wake-up hint* (it's lossy/non-replayable, never the source of truth). Section partials in-process (Next persistent); worker emits durable events + NOTIFY. Upgrade beyond the cosmetic preview toward genuine agent-activity streaming. |
| Storage | **Direct upload on Railway** (no body limit); parse in-memory, discard. Remove signed-url + upload routes' bucket indirection. |
| RLS | **Drop → app-layer authz architecture (Codex #9).** Repository methods tenant-scoped by construction (userId required, not an optional `.eq`); **ZERO browser DB clients** (remove `client.ts`/`hooks.ts` anon paths); `/shared/[token]` server-route-only. Audit every anon-key read before removing RLS. |
| RPC functions | **Keep as raw SQL** in Drizzle migrations; call via `SELECT fn($1,...)`. Battle-tested CAS/merge logic — do not rewrite in TS. |
| ORM | **Drizzle** + drizzle-kit migrations, single schema in `packages/db` consumed by both codebases. |
| Backups | No managed PITR on Railway → scheduled `pg_dump` to object storage (R2/S3) + periodic restore test; **keep Supabase project paused ~30 days post-cutover as deep rollback.** |

## 6. Feature restoration (the original ask)

- **User roles** → already fully live (RBAC, admin UI, allowlist, impersonation). **No work.**
- **Save profiles** → **auto-persist on completion.** Re-wire the fire-and-forget hook so completed sections + final AI insights write into `business_profiles` automatically (re-activate `POST /api/profiles/insights` path; it's built, just uncalled).
- **Share** → **new v3 share + retire V1 viewer.** Build a share snapshot from `research_artifact_sections` (v3 source of truth) + a Share button in the Audit Reader. Drop the legacy V1 `/research` viewer + old `/api/share` (they only read legacy columns serving the ~36 cold-archived rows).

## 6b. Testing strategy (completeness: full / boil-the-lake)

**Parity data (D4):** restore a **PII-sanitized Supabase snapshot** into a test Railway PG and parity-test every repository method against real-shaped rows; add **synthetic fixtures** only for concurrency/CAS cases a static dump can't reproduce. **Compare canonical DTOs at the repository boundary, NOT raw DB rows** (client semantics, JSON/date normalization, null/order differ); for schema-changed paths, compare old-DTO vs new-DTO with documented transforms.

Mandatory coverage (★★★ = critical, regression-rule applies):
- **Parity** — every DAL repo method, old vs new, identical results. ★★★
- **RPC concurrency** — `claim_section_run` CAS (N parallel claims → exactly 1 wins), `commit_artifact_section` revision supersede (no lost update), atomic `merge_journey_session_*`. ★★★
- **Data migration** — completed-run predicate selects only rows with committed `research_artifact_sections`; `research_results`→`corpus_result` preserves every key; FK integrity, zero orphans, counts match. ★★★
- **RLS-removal audit** — every former anon-RLS read path still enforces tenant isolation in app code. ★★★ (regression)
- **Streaming** — in-process SSE delivers partials; SSE drop → falls back to 2s polling; worker `NOTIFY`→Next bridge delivers corpus events. ★★
- **Features** — save-profiles auto-persist fires on completion + writes correct rows; v3 share snapshot builds from `research_artifact_sections` + public server-route read works. ★★
- **Cutover smoke** — post-flip health checks + one full E2E run on Railway. ★★★

## 7. Execution phases (phased/sequenced — each stage independently reversible, D5)

**Stage 0 — On Supabase, decoupled from the migration (ship now, bugs attributable):**
- Security: enable RLS on the 3 exposed tables now (or drop them early).
- Feature restore: save-profiles auto-persist; v3 share (normalized snapshot + button) + retire V1 viewer. *(These need no migration — shipping them here makes their bugs attributable, Codex #12.)*
- Workspace prerequisite (Codex #11): convert repo to workspaces, create `packages/db`, update the worker Dockerfile to bundle it. Gate before any Drizzle work.

**Stage 1 — DB-access behind stable DTOs (hosting + realtime UNCHANGED on Supabase/Vercel):**
- Introduce the **tenant-scoped repository DAL** over current supabase-js; no behavior change; full tests. The parity seam.
- Author clean Drizzle schema (§3) + extract **LIVE** RPC defs via `pg_get_functiondef` (not migration files — they have superseding rewrites) into raw-SQL migrations; recreate/strip `service_role` grants.
- Provision Railway Postgres (private network); apply schema + RPCs; scheduled `pg_dump` backups + **restore test**.
- Implement the DAL with Drizzle; **parity-test DTO-vs-DTO** (sanitized snapshot + synthetic concurrency); converge to zero diffs; test CAS/`FOR UPDATE NOWAIT`/revision on real PG.
- **Reversible cutover #1 (data move):** freeze writes → dump → restore → verify → flip the DAL impl to Drizzle/Railway. **Rollback:** flip the DAL back to supabase-js (+ reverse-migration for any post-cutover rows). Realtime stays on Supabase Broadcast through this stage.

**Stage 2 — Hosting to Railway (DB already migrated):**
- Next self-host workstream (Codex #6): root Dockerfile, `output: 'standalone'`, **bundle runtime-read files** (SKILL.md/corpus), image-opt + Cloudflare CDN, health checks, **graceful-drain on shutdown** (deploys must not orphan in-flight `after()` runs; `reap_orphaned_section_runs` backstops).
- **Reversible cutover #2:** deploy Next on Railway, flip DNS. **Rollback:** repoint DNS to Vercel (DB unchanged).

**Stage 3 — Streaming to SSE (last; Next is now persistent):**
- SSE streams from persisted `research_section_events` with a **cursor** (catch-up on reconnect); `NOTIFY` is only the wake-up. Worker emits durable events + NOTIFY.
- Retire Supabase Broadcast; direct upload (drop the bucket).
- **Reversible cutover #3:** flip the streaming flag. **Rollback:** revert to Broadcast / polling.

Decommission Supabase only after all 3 stages bake (~30 days). Data lands FK-ordered: `user_profiles` → `business_profiles` → `journey_sessions` → `research_artifact*`.

## 7b. NOT in scope (considered, deliberately deferred)

- **Relocating agent/section execution from in-process-Next to the worker** — the textbook end-state for scale, but a big refactor that reverses the recent in-process decision; topology is provisioned to allow it later without a re-platform. (D2b)
- **Horizontal scaling of the Next server** (multi-instance + Redis ISR cache) — single instance is fine at current scale; flagged so it's not a surprise when you scale.
- **Moving auth off Clerk** — Clerk stays; out of scope entirely.
- **Reviving GTM / blueprint / scripts features** — dead, cold-archived, not modeled.
- **R2/S3 durable file storage** — uploads are ephemeral (parse-and-discard); direct upload suffices until durable storage is a real need.

## 7c. What already exists (reuse, don't rebuild)

- v3 normalized store (`research_artifact*`) is clean and stays as-is — it's the schema target, not a rewrite.
- DB access funnels through a small set of client factories (`src/lib/supabase/{server,client,hooks}.ts`, `research-worker/src/supabase.ts`) — the natural DAL seam; wrap these, don't hunt 190 call sites blind.
- Save-profiles backend (`saveBusinessProfile`/`saveProfileInsights`) is built and tested — restoration is re-wiring the call, not new code.
- Share backend + public page exist — v3 work is a new snapshot builder over `research_artifact_sections` + a button, not a new feature.
- The 17 plpgsql RPCs are portable as-is — carry verbatim, don't reimplement.

## 8. Rollback, ops & risks

- **Rollback is a deliverable, not "pause Supabase" (Codex #2).** Each stage is independently reversible (DAL flip / DNS repoint / streaming flag). Define **RPO/RTO** targets; write + test a **reverse-migration** (Railway→Supabase delta for rows written after cutover #1); keep the prior code deployable. Supabase stays paused until all 3 stages bake (~30 days). The reverse path must be *tested*, not assumed.
- **Backups:** no managed PITR on Railway → scheduled `pg_dump` to object storage + periodic **restore test**. Non-negotiable, Stage 1.
- **Pooling:** bounded `pg` pools per persistent service (no PgBouncer — persistent servers, not serverless). Keep total connections under Postgres `max_connections`.
- **`user_profiles` base DDL** not in source control → capture live types via `pg_dump --schema-only` before authoring the Drizzle model.
- **In-flight runs on deploy (Codex #7):** persistent Next + `after()` jobs die on restart → graceful-drain + `reap_orphaned_section_runs` backstop; deploy in low-traffic windows.
- **`research_section_events` growth** (19k+ rows): keep the activity query indexed + `LIMIT`-bounded; add retention.
- **Security (immediate):** the 3 RLS-disabled tables are anon-readable on live Supabase *today* — fixed in Stage 0 (enable RLS or drop early). No user PII, but `error_message` could leak internals.
- **Effort:** ~3-4 weeks across the 4 stages; Stage 1 (DAL + Drizzle + DTO parity + RPC port) is the long pole.

## 9. Failure modes (new codepaths → realistic prod failure → covered?)

| Codepath | Realistic failure | Test | Error handling | Silent? |
|---|---|---|---|---|
| DAL Drizzle impl | mis-ported query returns wrong/empty data | **DTO parity** | parity gate pre-cutover | would be silent → **parity is the guard, do not skip** |
| RPC CAS on Railway | claim race → duplicate section dispatch | concurrency test | `FOR UPDATE NOWAIT` | visible (dup cards); covered |
| Reverse migration | rollback loses post-cutover rows | **reverse-migration test (MUST build)** | tested delta script | silent if untested → **critical gap unless tested** |
| Next self-host | runtime-read file ENOENT (SKILL.md) | build-includes + smoke E2E | section errors | visible; covered by smoke |
| Completed-rule migration | abandoned partials migrate / completed dropped | predicate test | — | covered |
| In-flight run on deploy | orphaned 270s run | graceful-drain + reaper test | `reap_orphaned_section_runs` | visible (killed run); mitigated |
| SSE cursor reconnect | client misses events | drop→catch-up test | falls back to 2s polling | non-critical (committed data polls) |

**Critical gap to watch:** the **reverse-migration must be built AND tested** in Stage 1 — it's the only thing standing between "phased rollback" and "one-way trap." Everything else has a test + visible failure.

## 10. Parallelization (worktree lanes)

Stages are sequential (1→2→3, each a reversible cutover), but **within** stages there's fan-out:

| Lane | Work | Depends on |
|---|---|---|
| Stage 0-A | Security RLS fix | — |
| Stage 0-B | Feature restore: save-profiles ∥ v3 share | — |
| Stage 0-C | Workspace + `packages/db` + worker Dockerfile | — |
| Stage 1-A | DAL repos: `SessionRepo` ∥ `ArtifactRepo` ∥ `ProfileRepo` ∥ `AuthRepo` | 0-C |
| Stage 1-B | Drizzle schema authoring ∥ RPC extraction (`pg_get_functiondef`) | 0-C |
| Stage 1-C | Drizzle impl + parity | 1-A, 1-B |

- **Launch in parallel:** 0-A, 0-B, 0-C (no shared modules). Then 1-A + 1-B in parallel worktrees. Merge → 1-C.
- **Conflict flag:** 0-B (share) and 1-A (`ArtifactRepo`) both touch `research_artifact_sections` read paths — coordinate the share snapshot builder with the repo interface.
- Stages 2 and 3 are sequential, single-lane each.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | not run |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 4 decisions (D1-D4) + 4 arch (D2/D2b/D3 + cutover) resolved; 1 critical gap (reverse-migration) flagged |
| Outside Voice | `/codex` plan review | Independent 2nd opinion | 1 | issues_found | 12 findings; 10 folded as hardening, 1 strategic tension (cutover shape) → user chose phased, 1 (don't-migrate) noted/overridden by user |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | n/a (infra) |

- **CROSS-MODEL:** Codex + this review agree the phased/sequenced cutover beats big-bang; user accepted. Codex's "don't migrate at all" is overridden by the user's explicit consolidation+control decision.
- **UNRESOLVED:** 0.
- **VERDICT:** ENG CLEARED (with the reverse-migration test as a hard requirement). Ready to implement Stage 0.
