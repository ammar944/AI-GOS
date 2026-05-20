# Managed Agents Migration — Validated Plan

> **Status:** APPROVED via office-hours review on 2026-05-19.
> **Supersedes:** `docs/2026-05-18-claude-managed-agents-migration-intent.md` (intent doc), which remains the source of architectural mapping.
> **Branch:** `codex/claude-managed-agents-work`
> **Author:** Ammar (validation pass by Claude Opus 4.7 office-hours)
> **Related:** `docs/handoffs/2026-05-19-managed-agents-multiplatform-ad-creatives.md` (active P2 work)

## Phase Status (2026-05-19)

| Phase | Status | Completed | Notes |
|---|---|---|---|
| P0 — canary | ✅ SHIPPED | 2026-05-18 | Reference session `sesn_01CrNYjjfzSg5CKoHv5Fzmbo` + commit `c6b0d3b9`. |
| P1 — webhook + first section | 🟡 CODE-COMPLETE — static gates pass; live canary blocked on environment | 2026-05-19 | All code shipped (migration, schemas mirror, raw-HTTP client, webhook handler with R1/R3/R5/R6, agents, kickoff, canary script). 25/25 focused unit tests pass; `npx tsc --noEmit` clean on new paths; `npm run lint` 0 errors. `npm run build` blocked by pre-existing Clerk env-var issue at prerender (not caused by P1 code). Live canary requires `ANTHROPIC_API_KEY` + a reachable webhook URL, blocked in this shell. |
| P2 — hardening + observation | ⛔ BLOCKED | — | Mandates 7-day live observation window before exit. Cannot satisfy in one session. |
| P3 — six specialists + path swap | ⛔ BLOCKED | — | Depends on P2 exit. |
| P4 — decommission | ⛔ BLOCKED | — | Depends on P3 exit. |

---

## 1. Decision

**Approach A — Full migration with multi-agent coordinator.**

One Anthropic-hosted coordinator agent + 6 specialist section agents per audit, running in a single session. Replaces `research-worker/src/runners/positioning-audit-orchestrator.ts` (738 lines) plus its abort/signal/timeout plumbing. deepResearchProgram corpus generation stays on Railway worker.

This locks in the P0→P4 plan from the intent doc with a sharpened scope and a risk register that wasn't in the original.

---

## 2. Why A (validated against alternatives)

Office-hours forced comparison against three other options:

| Option | Code deleted | Beta-tier risk | Effort | Vendor lock-in |
|---|---|---|---|---|
| **A. Multi-agent coordinator (chosen)** | ~1,000 LOC | High (research-preview multiagent) | ~3 wks | Deepest |
| B. Sessions-per-section | ~400 LOC | Low (GA primitives only) | ~1.5 wks | Moderate |
| C. Hybrid (P2 ads only) | ~0 LOC | Low | Ongoing | Light |
| D. Don't migrate; fix Opus latency | 0 LOC | None | ~3 wks | None |

A wins on **code deletion + cleanest end-state**, given:
- Internal-only use eliminates customer-facing beta exposure.
- Multi-agent feature is GA-in-beta (`managed-agents-2026-04-01` header), not research preview the way Outcomes is. Max 25 concurrent threads per session, 20 unique agents in roster, depth-1 delegation — easily fits the 6-section shape.
- Single session per audit → one webhook endpoint, one resource hierarchy, one ID to monitor.
- P0 canary (session `sesn_01CrNYjjfzSg5CKoHv5Fzmbo`) already proved the runtime + custom-tool round-trip works.

The cost is the deepest vendor lock-in and a research-preview-adjacent dependency. Both acceptable for internal-only.

---

## 3. Validated premises (from intent doc, with corrections)

| # | Premise | Verdict | Correction |
|---|---|---|---|
| 1 | "Managed Agents replaces the orchestration layer" | ✅ | Confirmed — multi-agent coordinator handles fan-out natively. |
| 2 | "Custom tool boundary preserves Zod gates" | ✅ | Confirmed — webhook receives custom-tool call, validates, returns `{ok:false, repair_feedback}` to drive retry. |
| 3 | "Cost is rounding error" | ⚠️ | Actual estimate: ~$8/mo on coordinator pattern (one ~10-min session per audit × 100/day). Trivial, but not the $32/mo the intent doc estimated. |
| 4 | "Beta header is fine for internal" | ✅ | True today. Subscribe to Anthropic changelog. Pin agent versions to avoid surprise behavior shifts. |
| 5 | "Worker keep-alive burden goes away" | ⚠️ partial | deepResearchProgram corpus stays on Railway. ~1,000 LOC deleted, but Railway still in the picture. |
| 6 | "Ship in hours" | ❌ misleading | Hours for the canary (already done). Days for P1. **~3 weeks total** for P3+P4. |
| 7 | "Migration solves slowness pain" | ❌ false premise | Recent failures (S571-S573, observations 14092-14110) were missing `ANTHROPIC_API_KEY` in Next.js env + Opus genuinely slow. Managed Agents doesn't change either. **The win is operational, not latency.** |

---

## 4. Locked architecture

```
Form submit → POST /api/research-v2/orchestrate (Next.js, unchanged)
            → POST /v1/sessions (Anthropic, one session per audit)
              ↓
              Coordinator agent (Opus 4.7)
              ├── delegates to 6 specialist section agents (parallel threads, isolated context)
              │     ├── positioningMarketCategory
              │     ├── positioningBuyerICP
              │     ├── positioningCompetitorLandscape
              │     ├── positioningVoiceOfCustomer
              │     ├── positioningDemandIntent
              │     └── positioningOfferDiagnostic
              └── Each specialist uses:
                    ├── agent_toolset_20260401 (bash, fs, web_search, web_fetch)
                    ├── MCP servers: firecrawl, perplexity (declarative, vault-auth)
                    └── custom tools:
                          ├── fetch_competitor_ads      → SearchAPI (multi-platform per P2 handoff)
                          ├── save_section_artifact     → Zod gate + Supabase write
                          └── (deferred) request_research → explicit research routing
              ↓
              session.status_idled webhook
              ↓
            POST /api/managed-agents/webhook (Next.js)
              ├── Verify whsec_ signature (within 5-min freshness window)
              ├── Dedupe on event.id (Redis or Supabase, TTL > retry window)
              ├── For each pending custom-tool call:
              │     ├── Zod-validate against SECTION_SCHEMAS[section_type]
              │     ├── Cardinality minimums via validateMinimums()
              │     ├── On pass: insert research_artifacts; POST user.custom_tool_result {ok:true}
              │     └── On fail: POST user.custom_tool_result {ok:false, repair_feedback:"…"}
              └── Hard ceiling: max N retries per section_run_id, force-archive on overflow
              ↓
            Supabase realtime → AgentArtifactSurface / SectionNarrativeRenderer (unchanged)
```

Key shape decisions:
- **One session per audit, not per section.** Multi-agent coordinator inside.
- **No mid-session model swap.** Rescue → spawn fresh session OR accept Opus-only and tighten primary prompts.
- **Existing React UI unchanged.** Agent output → Supabase → realtime → existing components.
- **`research-worker/` stays** for deepResearchProgram corpus generation only.

---

## 5. Risk register (the hidden ones)

These were NOT in the intent doc. All must be addressed before P2 exit.

| # | Risk | Mitigation | Owner |
|---|---|---|---|
| R1 | **Webhook idempotency.** Anthropic at-least-once delivery, no idempotency-key header. Duplicate `save_section_artifact` calls would double-write Supabase. | Dedupe on `event.id` in Supabase (`webhook_events` table) with TTL > retry window (~24h). Every side effect at the destination uses unique constraints or upserts. | P1 |
| R2 | **Webhook auto-disable.** Endpoint silently disabled after ~20 consecutive failures. Re-enable is manual in Console. | Synthetic probe + Slack alert on disable event. Manual runbook for re-enable. | P2 |
| R3 | **Event ordering not guaranteed.** `session.status_idled` may arrive before the `agent.tool_use` that triggered it. | Sort by `created_at` on the event envelope; never trust delivery order. Worker telemetry projection rebuilds wave state from sorted events. | P2 |
| R4 | **MCP `permission_policy: always_ask` is default.** Every MCP tool call wedges the agent. | Explicitly set `permission_policy: never_ask` per declared MCP toolset for firecrawl, perplexity. | P1 |
| R5 | **Custom-tool retry runaway.** Webhook returns `{ok:false}` repeatedly → session runs forever → $0.08/hr keeps accruing + tokens. | Count retries per `section_run_id` in the webhook handler; on overflow (default 3), POST `user.interrupt` + mark section error. | P1 |
| R6 | **Signature freshness window is 5 minutes.** Async queue between HTTP receipt and signature verification breaks it. | Verify signature at HTTP receipt, before enqueueing. Store verified flag with the event. | P1 |
| R7 | **No mid-session model swap.** Rescue-on-Sonnet pattern dies inside a single session. | Spawn fresh rescue session via separate POST /v1/sessions, OR accept Opus-only for P1-P2 and revisit. Lean toward Opus-only + tighter prompts. | P3 |

Plus the original open questions from intent doc §9 carried forward:
- Per-section concurrency parity with current `ORCHESTRATOR_CONCURRENCY=3` (multi-agent allows up to 25 threads, well above need).
- Streaming UX shape (SSE event granularity vs current "Wave X of Y" telemetry).
- Session-level timeout vs current per-section 10-min ceiling.
- Whether deepResearchProgram moves (decision: NO for P0-P4).

---

## 6. Phase plan (honest sizing)

| Phase | Scope | Honest effort | Exit criterion | Status |
|---|---|---|---|---|
| **P0** | Spike: one agent + one custom tool (`fetch_competitor_ads`) + canary on Notion/monday.com | Hours | Competitor ads rendered on a profile from MA session, not from research-worker | ✅ DONE (session `sesn_01CrNYjjfzSg5CKoHv5Fzmbo`) |
| **P1** | One section end-to-end (`positioningMarketCategory`) with `save_section_artifact`, Zod + minimums, repair loop, R1+R4+R5+R6 mitigations | **3-5 days** | Single-section audit produces byte-comparable artifact to current worker output, with idempotent webhook | NOT STARTED |
| **P2** | `networking: limited` allowlist, R2+R3 mitigations, retry semantics, telemetry adapter, multi-platform ad evidence work-in-flight (per `docs/handoffs/2026-05-19-managed-agents-multiplatform-ad-creatives.md`) | **5-8 days** | One section's worker code deleted with zero regression; webhook reliability proven via 1 week of internal use | NOT STARTED (P2 ad-evidence handoff is partially overlapping) |
| **P3** | Remaining 5 sections via multi-agent coordinator. Fan-out via thread spawn, not parallel sessions. Telemetry parity ("Wave X of Y / N running / N queued"). | **7-10 days** | All 6 sections produced by MA in one session; chip telemetry shows section-commit granularity | NOT STARTED |
| **P4** | Delete `research-worker/src/runners/positioning-audit-orchestrator.ts` + section runners + Railway routing for positioning. Keep corpus generation. | **3-5 days** | Railway worker no longer in positioning path; `git log --grep "delete worker"` shows clean removal | NOT STARTED |

**Total honest estimate: ~3 weeks of focused work after P1 starts.** The "in hours" framing applies only to the canary that already shipped.

---

## 7. Success criteria

Measurable, not aspirational:

1. **Code deletion**: `positioning-audit-orchestrator.ts` (738 lines) + section orchestration code from `index.ts` removed at P4. Net `git diff` should show ≥1,000 LOC deleted.
2. **Operational simplicity**: Zero Railway env vars required for positioning audit. Webhook is the only ingress. `RAILWAY_WORKER_URL` removed from positioning path.
3. **Webhook reliability**: Webhook handler survives 1 week of internal use without manual intervention. Auto-disable never triggered. Duplicate event.ids deduped successfully (verified in logs).
4. **Audit quality unchanged**: Byte-comparable section artifacts to today's output. SectionNarrativeRenderer renders the same shapes. AgentArtifactSurface unchanged.
5. **Cost ceiling**: $50/mo all-in for internal use. Real cost likely $8-15/mo on coordinator pattern.

---

## 8. Out of scope (carried from intent doc §10, reaffirmed)

- Customer-facing exposure of Managed Agents (re-evaluate ZDR + data residency before).
- AI SDK v6 chat sidebar at `/api/journey/stream` — different concern, stays.
- Multi-model orchestration (sticking with Anthropic).
- Auto-scaling / fleet management (internal traffic doesn't justify).
- Persistent cross-session memory ("remember last week's audit for Notion") — possible later, not now.

---

## 9. The Assignment

**Start P1 in a fresh session this week.** Concretely:

1. Write the P1 handoff doc at `docs/handoffs/2026-05-XX-managed-agents-p1-market-category.md` modeled on the existing P2 handoff. Scope it to `positioningMarketCategory` only.
2. Stand up `/api/managed-agents/webhook` in Next.js with R1+R4+R5+R6 mitigations baked in from the start (not retrofitted).
3. Create one agent: `Positioning Section — MarketCategory (v0)` with `agent_toolset_20260401` + `save_section_artifact` + MCP for Firecrawl/Perplexity with `permission_policy: never_ask`.
4. Run end-to-end: one Section, one round-trip, byte-comparable artifact to today's worker output.
5. Exit gate: PR landed with one section migrated, R1+R4+R5+R6 all verifiable, P3 plan written.

The P2 multi-platform ad-evidence work (the active handoff) can run in parallel because it touches the canary script, not the production path.

---

## 10. What I noticed (validation observations)

- You called the trade correctly in the intent doc — internal-only use is what makes the beta-header + research-preview-adjacent dependencies acceptable.
- The "in hours" framing was wrong; you'd have hit week-two surprise on telemetry parity and felt burned. Now it's set up honestly.
- The intent doc §9 "Open questions" treated multi-agent coordinator as uncertain. It's GA-in-beta with clean fan-out semantics — the architecture is more decided than the doc suggested.
- The instinct to keep `deepResearchProgram` on Railway (intent doc §9 + §10) is correct. Corpus generation is structurally different from the positioning fan-out and shouldn't share the migration.
- The hidden risks (R1-R7) are all real but all known-solvable. None of them are showstoppers; all of them would burn a day each if found in production instead of upfront.
