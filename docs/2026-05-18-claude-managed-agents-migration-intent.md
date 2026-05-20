# Claude Managed Agents — Migration Intent (Internal AI-GOS)

> **Status:** exploration / intent doc. Not a commitment, not an ADR yet.
> **Author:** Ammar
> **Date:** 2026-05-18
> **Related:** `docs/architecture/2026-05-14-positioning-audit-stack.md` (current locked stack), `docs/adr/0002-single-structured-output-per-section.md`, `docs/adr/0003-backend-only-deployment.md`
> **Companion artifact:** `~/Desktop/2026-05-18-claude-managed-agents-vs-manus.html` (research write-up that motivated this doc)

---

## 1. What I'm trying to do (one paragraph)

I want to stop maintaining a custom Manus-style agent harness (`research-worker/` on Railway + the
hand-rolled `positioning-audit-orchestrator.ts` + Phase-2 ToolLoopAgent scaffolding) and
instead let **Claude Managed Agents** run the agentic loop in Anthropic's hosted infrastructure.
AI-GOS is shifting to **internal-only use** for now, which collapses the risk surface of a
beta-header product (no customer SLA, no multi-tenant auth pressure, no ZDR concern, low
volume so the $0.08 / session-hour overhead is rounding error). The 6-section positioning
audit pipeline stays — the **orchestration layer** is what I want to replace. The unique-to-us
work (Zod schemas, cardinality minimums, repair → rescue, fan-out telemetry) keeps living
as my code, but now it sits inside Anthropic-defined `custom tool` boundaries instead of
inside a self-hosted runner loop.

---

## 2. Why now

1. **Anthropic shipped the harness as a product** (Managed Agents public beta, April 8 2026).
   Everything we built in `research-worker/` — sub-agents, hooks, sandbox, file ops, MCP,
   long-running sessions, steerable mid-execution, checkpoint + recovery — is now a checkbox.
2. **AI-GOS is internal-only for now.** Beta header (`managed-agents-2026-04-01`) is fine.
   Multi-agent + outcomes still being in "research preview" is fine.
   Anthropic-cloud data residency is fine for our own usage.
3. **Operational burden is the biggest drag on velocity.** Worker keep-alive, deploy
   coordination, Railway env vars, signal-handler plumbing, mode-specific timeouts — all
   incidental to the actual product.
4. **Cost at our scale is irrelevant.** Estimate from session-runtime math: ~$0.01 of session
   overhead per audit. 100 internal audits / day ≈ $32 / month. Token spend (Opus) is
   unchanged either way.

---

## 3. What I am NOT trying to do

- Replace the React UI. The agent emits structured data; AdCard / SectionNarrativeRenderer /
  AgentArtifactSurface continue to render exactly as they do today.
- Replace Supabase. Audit artifacts, profiles, realtime — all unchanged.
- Replace Clerk auth. Session creation is server-side from an authenticated Next.js route.
- Migrate the AI SDK v6 chat sidebar (`/api/journey/stream`). That stays — different concern.
- Build a public-facing API or expose Managed Agents to end customers.
- Switch models. Still Claude Opus 4.7 + Sonnet rescue. Vendor lock-in is moot because
  we were already all-in on Anthropic.

---

## 4. The concrete shape of the migration

### Today

```
Form submit → POST /api/research-v2/orchestrate
            → Railway worker /orchestrate
              ├── positioningSubagentRunner × 6  (waves of 3)
              │     primary → repair → rescue
              ├── Zod SectionArtifactSchema validation
              ├── validate*Minimums (cardinality gates)
              └── writes to Supabase, realtime → UI
```

### Target

```
Form submit → POST /api/research-v2/orchestrate
            → POST /v1/sessions (one Managed Agent session per audit)
              ↓ Anthropic-hosted container
              ├── built-in tools: bash, read, write, edit, glob, grep, web_search, web_fetch
              ├── MCP servers: firecrawl, perplexity (declarative)
              └── custom tools (our app executes):
                    ├── fetch_competitor_ads     → SearchAPI
                    ├── save_section_artifact    → Zod gate + Supabase write
                    └── request_repair_feedback  → returns feedback string for retry
              ↓
              session.status_idled webhook
              ↓
            POST /api/managed-agents/webhook
              ├── verify whsec_ signature
              ├── Zod-validate payloads (this is where our discipline lives)
              ├── on pass: persist + POST user.custom_tool_result {ok:true}
              └── on fail: POST user.custom_tool_result {ok:false, repair_feedback:"…"}
              ↓ Claude resumes, applies feedback, retries
              ↓
            Supabase realtime → existing React UI (unchanged)
```

The single most important reframe:
**our repair/rescue loop becomes the response payload to a custom-tool call**,
not a runner phase we hand-roll.

---

## 5. The five integration surfaces (and how each maps)

| Mechanism | Beta header | What it's for in AI-GOS |
|---|---|---|
| **Built-in toolset** `agent_toolset_20260401` | `managed-agents-2026-04-01` | Generic bash / fs / web. Replaces ad-hoc fetch + parse code in runners. |
| **Remote MCP servers** | `mcp-client-2025-11-20` | Firecrawl, Perplexity, future SearchAPI MCP shim. Replaces direct SDK adapters. |
| **Custom tools** | (same as agent) | The interface where AI-GOS business logic lives. See §6 below. |
| **Vaults** | (same as agent) | OAuth credential storage if we ever wire Slack/GH/Drive. Not Phase 1. |
| **Webhooks** | configured in Console | Bridge from Anthropic → our Next.js. Fires on `session.status_idled`. |

### Environment networking — non-negotiable for Phase 2

Default `unrestricted` is fine for our internal spike. Before any production-ish use:
```json
"networking": {
  "type": "limited",
  "allowed_hosts": [
    "www.searchapi.io",
    "api.firecrawl.dev",
    "api.perplexity.ai",
    "<our-app-domain>"
  ],
  "allow_mcp_servers": true,
  "allow_package_managers": false
}
```
Reason: any secret we expose to the container is reachable by anything the container can
egress to. Sandbox is *from* us, not *for* us.

---

## 6. The custom-tool boundary (where our work survives)

Three custom tools cover the whole positioning-audit pipeline:

### `fetch_competitor_ads`
Replaces direct SearchAPI calls in old AI-GOS v2 + the current
`research-worker/src/runners/positioningCompetitorLandscape.ts` ad fetching.

```jsonc
{
  "type": "custom",
  "name": "fetch_competitor_ads",
  "description": "Fetch active ads for a competitor from SearchAPI's Google Ads Transparency Center and/or Meta Ad Library. Returns up to 50 normalized ad cards with headline, body, landing_url, first_seen, last_seen, format, creative_url, and source platform.",
  "input_schema": {
    "type": "object",
    "properties": {
      "advertiser_name": { "type": "string" },
      "platform": { "type": "string", "enum": ["google", "meta", "both"] },
      "region": { "type": "string", "enum": ["US", "CA", "UK", "AU", "ALL"] },
      "limit": { "type": "integer", "default": 25 }
    },
    "required": ["advertiser_name", "platform"]
  }
}
```

**Why custom tool and not direct sandbox curl:** I want our Next.js route to choose the exact
SearchAPI params (engine string, date range, advertiser_id resolution) — Claude tends to
drift on engine-name strings. Also keeps the SearchAPI key out of the container.

### `save_section_artifact`
Where Zod + cardinality gates live. One tool per section type, OR one tool with a
`section_type` discriminator. Leaning toward discriminator to keep the agent surface small.

```jsonc
{
  "type": "custom",
  "name": "save_section_artifact",
  "description": "Persist a completed section artifact to the audit. Returns {ok:true} if the artifact passes Zod schema validation and cardinality minimums (e.g. ≥5 competitors for positioningCompetitorLandscape, ≥4 verbatim weaknesses for positioningVoiceOfCustomer). Returns {ok:false, repair_feedback:'…'} if validation fails; the agent should revise and retry.",
  "input_schema": {
    "type": "object",
    "properties": {
      "section_type": {
        "type": "string",
        "enum": ["positioningMarketCategory","positioningBuyerICP","positioningCompetitorLandscape","positioningVoiceOfCustomer","positioningDemandIntent","positioningOfferDiagnostic"]
      },
      "artifact": { "type": "object" }
    },
    "required": ["section_type", "artifact"]
  }
}
```

Webhook handler logic (pseudo-code):
```ts
const schema = SECTION_SCHEMAS[section_type];        // existing Zod
const parsed = schema.safeParse(artifact);
if (!parsed.success) return repairFeedback(parsed.error);
const cardinality = validateMinimums(section_type, parsed.data);
if (!cardinality.ok) return repairFeedback(cardinality.gaps);
await supabase.insert("research_artifacts", { … });
return { ok: true };
```

### `request_research` (optional, Phase 3)
If we want explicit control over Perplexity vs Firecrawl routing (today this is implicit
in runner code), make it a tool. Otherwise let the agent pick via MCP. Defer this decision
until we see how the agent behaves without it.

---

## 7. The canary: SearchAPI + competitor ads

Before doing all 6 sections, prove the pipeline on the smallest fully-typed slice:

**Half-day spike:**
1. Create one agent: `Positioning Audit (internal v0)` with `agent_toolset_20260401` +
   `fetch_competitor_ads` only.
2. Create one environment: `cloud, networking: unrestricted` (tighten in Phase 2).
3. Stand up `/api/managed-agents/webhook` in Next.js. Verify whsec_ signature. Pretty-print
   the event log for debugging.
4. POST a user event: *"For advertiser 'Notion' in the US, fetch the top 25 active Google
   ads. Cluster them into 3-5 dominant angles. Return a markdown summary plus the raw
   normalized ad list."*
5. Watch the session run end-to-end. Confirm:
   - `fetch_competitor_ads` webhook fires
   - We hit SearchAPI with the right params
   - Normalized response lands back in the session
   - Agent emits the summary + ad list
   - Webhook receives the final event
   - Existing `<AdCard />` grid (or its replacement) renders against the ads we wrote
     to Supabase

**Success criterion:** an internal user opens an AI-GOS profile, sees competitor ads that
came from a Managed Agent run, not from `research-worker/`. End-to-end one round trip.

---

## 8. Phases (rough)

| Phase | Scope | Exit criterion |
|---|---|---|
| **P0 — Spike** | One agent, one custom tool (`fetch_competitor_ads`), unrestricted networking, ad-fetch canary works | We can render competitor ads on a profile from a Managed Agent session |
| **P1 — One section end-to-end** | Add `save_section_artifact` for `positioningMarketCategory` only. Zod + minimums validated through webhook. Repair loop confirmed working. | Single-section audit produces the same artifact shape as today's worker output, byte-comparable |
| **P2 — Hardening** | `networking: limited` with allowlist. Webhook signature verification. Session retry semantics mapped to current runner retry behavior. Telemetry surface for "Wave X of Y / N running" mapped to SSE events. | One section's worker code can be deleted with no regression |
| **P3 — Full fan-out** | Remaining 5 sections. Sub-agent pattern (Anthropic-native) for parallel section runners inside one parent session. | All 6 sections produced by Managed Agents in parallel waves |
| **P4 — Decommission** | Delete `research-worker/positioning-audit-orchestrator.ts`, retire Railway worker for positioning. (deepResearchProgram corpus generation stays unchanged — that's a separate concern.) | Railway worker no longer in the positioning path |

Each phase is sized to fit one focused session with a QA gate after, per the project's
phase-based execution model in MEMORY.md.

---

## 9. Open questions (need answers before P1)

- **Per-section concurrency:** today `ORCHESTRATOR_CONCURRENCY=3` gives two waves of three.
  Can a single Managed Agent session orchestrate six sub-agents in parallel cleanly, or do
  we need six parallel sessions? Sub-agent docs say first-class; need to confirm parallelism
  guarantees + telemetry shape.
- **Streaming UX shape:** today the UI shows live "section verdict snippets" on worker chips
  as each wave commits. Managed Agents streams SSE events on a single session — will the
  granularity (per-tool-call vs per-section-commit) feel as good? Need to prototype the SSE
  → realtime adapter.
- **Timeout model:** worker uses mode-specific section timeouts (4 min draft, 10 min deep).
  Managed Agents has session-level timeouts — need to check if per-tool-call timeouts exist,
  otherwise we enforce in the webhook.
- **Rescue model fallback:** today the rescue phase swaps the section runner to a different
  model. Inside a Managed Agent session, the model is pinned to the agent config. Either we
  spawn a fresh session for rescue, or we accept Opus-only and tighten primary-pass discipline.
- **deepResearchProgram corpus:** does corpus generation also move, or does it stay as a
  pre-step that runs on Railway and feeds the session as a mounted file / initial event?
  Leaning: stays as-is for P0–P3, revisit in P4.

---

## 10. Out of scope (explicit)

- Customer-facing exposure. If/when AI-GOS goes back to multi-tenant, re-evaluate ZDR + data
  residency before pointing customer workloads at Managed Agents.
- Replacing the AI SDK v6 chat sidebar (`/api/journey/stream`). Different problem.
- Multi-model orchestration. Sticking with Anthropic.
- Auto-scaling / fleet management. Internal traffic doesn't justify it.
- Persistent cross-session memory ("remember last week's audit for Notion"). Possible later
  via Managed Agents memory stores, not now.

---

## 11. Next action

Run the P0 spike (§7). Expected output:
- one screenshot of an AI-GOS profile showing competitor ads sourced via Managed Agents
- one paragraph noting any surprises that change the P1 design
- decide whether to proceed to P1 or pause

---

## Appendix: Sources backing the technical claims above

- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)
- [Tools — Managed Agents](https://platform.claude.com/docs/en/managed-agents/tools)
- [Sessions — Managed Agents](https://platform.claude.com/docs/en/managed-agents/sessions)
- [Environments — Managed Agents](https://platform.claude.com/docs/en/managed-agents/environments)
- [Webhooks — Managed Agents](https://platform.claude.com/docs/en/managed-agents/webhooks)
- [MCP connector — Claude API](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)
- [Managed Agents production tutorial — Cookbook](https://platform.claude.com/cookbook/managed-agents-cma-operate-in-production)
- [Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
