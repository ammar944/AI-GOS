# Managed Agents cutover — milestone park (2026-05-20)

State of the world at park time. Pick up from here on the other machine.

## Decisions locked today

1. **Cutover to Managed Agents is the chosen path** — Anthropic-hosted sessions replace the Vercel AI SDK orchestration of positioning sections.
2. **Two-step rollout**: PR A activates (this commit), PR B deletes the ~3,600 LOC legacy runner later.
3. **Server-side activation** — `/api/research-v2/orchestrate` defaults `executionMode` to `'managed'` when `MANAGED_AGENTS_POSITIONING_ENABLED=true` is set. Frontend wasn't sending `executionMode` anyway; no UI change needed.
4. **Both pipelines stay in the repo** for now — the AI SDK code (positioning-audit-orchestrator + positioning-subagent-runner, ~3,600 LOC) is **parked, not actively maintained**. The known streamObject hang (P0 from May 16) is NOT being fixed. If we ever flip back, we fix it then.
5. **AI SDK is the preferred long-term home** — once internal team has battle-tested Managed Agents in prod, we may rebuild on AI SDK. Park the AI SDK code accordingly.
6. **`/research-v2/managed-agents-prototype` is a dev/inspection page**, not the production audit reader. Production stays on `/research-v2` → `agent-artifact-surface.tsx`.
7. **UI direction: lean one-pager, not command center** — see `feedback_lean_one_pager_not_dashboard.md`. When building the 5 missing typed section renderers, bias toward editorial layouts over dashboards.

## What this commit contains

| File | What |
|---|---|
| `src/app/api/research-v2/orchestrate/route.ts` | **PR A** — defaults `executionMode` to `'managed'` when env flag set. `effectiveExecutionMode` constant replaces three usages of `body.executionMode` in the dispatch logic. |
| `research-worker/src/runners/positioning-audit-orchestrator.ts` | Minor worker-side changes (5 lines) |
| `src/components/research-v2/agent-artifact-surface.tsx` | 230 lines changed — surface picks renderer per section |
| `src/components/research-v2/section-narrative-renderer.tsx` | NEW — generic markdown + sources renderer for sections lacking a bespoke renderer |
| `src/components/research-v2/primitives/` | NEW — 8 building blocks: bar-breakdown, data-table, inline-stats, milestone-timeline, narrative-block, positioning-axis-stack, quote-callout |
| `src/components/research-v2/section-renderers/` | NEW — 1 of 6 bespoke renderers (`competitor-landscape.tsx`). The other 5 still to build. |
| `src/lib/research-v2/audit-artifact-view.ts` | 116 lines added |
| `src/components/research-v2/__tests__/agent-artifact-surface.test.tsx` | Test updates |
| `docs/2026-05-18-claude-managed-agents-migration-intent.md` | Migration intent doc |
| `docs/architecture/2026-05-19-arc-split-execution-plan.md` | Phase plan |
| `docs/architecture/2026-05-19-managed-agents-migration-validated-plan.md` | Validated plan |
| `docs/handoffs/2026-05-19-arc-completion-plan.md` | Arc completion |
| `docs/handoffs/2026-05-19-managed-agents-multiplatform-ad-creatives.md` | Ad creatives handoff |
| `docs/handoffs/2026-05-19-typed-artifact-ui-simplification.md` | UI simplification handoff |
| `docs/handoffs/2026-05-20-managed-agents-cutover-milestone.md` | This file |

**Intentionally NOT in the commit:**
- `.claude/settings.local.json` — local-only Claude Code state
- `.mcp.json` — contains a `shadcnio` token; will leak if pushed. Add the token via secret management on the other machine.
- `tmp/*` — canary outputs, transient. Multiple competitor + section canaries from yesterday and today live there.

## Verification done today

- Canary `node scripts/managed-agents-section-canary.mjs --section positioningCompetitorLandscape --advertiser "monday.com" --domain monday.com` passed first attempt locally on Ammar's machine — ~2 min total, schema OK, real competitive intelligence (8 competitors with status-quo alternatives, 5 pricing data points with packaging detail, 3 positioning axes with competitor mapping, 6 verbatim public weaknesses, 5 narrative arcs).
- All 6 sections previously canary-validated earlier same day (see `tmp/canary-*-validate-*.log`). 3 passed attempt 1, 3 passed attempt 2 via the schema repair retry (R5).
- Route change applied; no typecheck errors caused by the change (pre-existing node_modules type noise unrelated).

## Picking up on the other machine

```bash
# 1. Clone or pull
git clone https://github.com/ammar944/AI-GOS.git
cd AI-GOS
git checkout codex/claude-managed-agents-work
git pull

# 2. Install
npm install
cd research-worker && npm install && cd ..

# 3. Env setup — copy your .env.local from the source machine OR re-create:
cat >> .env.local <<EOF
MANAGED_AGENTS_POSITIONING_ENABLED=true
MANAGED_AGENTS_WEBHOOK_SECRET=$(openssl rand -hex 32)
EOF
# Also need: ANTHROPIC_API_KEY, GROQ_API_KEY, SEARCHAPI_KEY, NEXT_PUBLIC_SUPABASE_URL,
# NEXT_PUBLIC_SUPABASE_ANON_KEY, CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

# 4. Re-add the .mcp.json token by hand (it was excluded from the commit on the source machine)

# 5. Smoke test — canary one section
node scripts/managed-agents-section-canary.mjs \
  --section positioningCompetitorLandscape \
  --advertiser "monday.com" --domain monday.com

# 6. Dev server (AI-GOS runs on :3002 when port 3000/3001 are in use by other apps)
npm run dev
```

## Next steps (when ready to continue)

1. **Build the 5 missing bespoke section renderers**: `market-category.tsx`, `buyer-icp.tsx`, `voice-of-customer.tsx`, `demand-intent.tsx`, `offer-diagnostic.tsx` in `src/components/research-v2/section-renderers/`. Use `competitor-landscape.tsx` as the reference. **Bias toward the lean one-pager layout** — see memory `feedback_lean_one_pager_not_dashboard.md`.
2. **Rework the Audit Reader to feel like a one-page document**, not the current command-center layout (progress chips, wave counter, multiple buttons stacking above content). Sketch from a writer's perspective before touching code.
3. **PR B (legacy delete)** — when comfortable Managed Agents is reliable in production: delete `research-worker/src/runners/positioning-audit-orchestrator.ts` (738 LOC), `positioning-subagent-runner.ts` (2,898 LOC), the `kickoffWorker` branch in `orchestrate/route.ts`, and the worker `POST /orchestrate` handler. ~3,600 LOC removed.
4. **Webhook end-to-end test** — managed-agents canary works without a public URL (polling). The route → startManagedAudit → webhook return path needs a tunnel (ngrok/cloudflared) to test locally, or just deploy and test against the public Railway URL.
5. **Railway env** — when ready to deploy: `MANAGED_AGENTS_POSITIONING_ENABLED=true` needs to be set on the production Railway service (the local `.env.local` value does not propagate). Webhook secret was already set on Railway this afternoon (memory 15144).

## Open questions parked

- Whether the corpus runner (`deepResearchProgram`) eventually also moves to Managed Agents or stays on Platform Skills as designed.
- Long-term: rebuilding the orchestration on Vercel AI SDK once internal team has validated the product (Ammar's stated preference). Today's commit doesn't lock us out of that — both pipelines coexist.
