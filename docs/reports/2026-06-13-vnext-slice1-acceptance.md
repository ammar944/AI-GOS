# vNext Slice 1 Acceptance Evidence

Date: 2026-06-13
Branch: `refactor/architecture-deepening`

## Facts

- Tier 1 logic proof is implemented at `scripts/zz-strategy-brief-logic-prove.mjs`.
- Tier 2 DB contract proof is implemented at `scripts/zz-strategy-brief-db-contract.mjs`.
- Tier 3 live proof harness is implemented at `scripts/zz-strategy-brief-prove.mjs`.
- Supabase MCP servers are configured, including `supabase-aigos`, but no callable Supabase MCP tool was exposed to this Codex session by `tool_search`.
- `codex mcp list` showed `supabase-aigos` enabled with OAuth and project ref `sidrtuxpqftyzwdusdha`.
- Tier 2 was attempted against completed parent run `f3993043-b6ce-4b27-a547-7ef02929f3fa` and failed the moat assertion: the committed `strategyBrief` row persisted with `counts_toward_rollup=true`.
- Tier 3 was not run.

## Evidence

Command:

```bash
node scripts/zz-strategy-brief-logic-prove.mjs
```

Observed stdout:

```text
PASS zz-strategy-brief-logic-prove
prompt: section markdown + refinement present
schema: valid brief parsed
support: unsupported angle caught and named
refinement: binding block emitted and empty case suppressed
```

Command:

```bash
npm run test:run -- src/lib/research-v2/strategy-brief src/lib/lab-engine/agents/__tests__/build-prompts.test.ts src/app/api/research-v2/strategy-brief src/app/api/research-v2/chat/__tests__/side-effects.test.ts src/app/api/research-v2/rerun-section src/app/api/research-v2/audit-state/__tests__/route.test.ts src/components/research-v2/__tests__/strategy-brief-card.test.tsx src/components/research-v2/__tests__/audit-chat-panel.test.tsx src/components/research-v2/__tests__/audit-reader-shell.test.tsx
```

Observed summary:

```text
Test Files  12 passed (12)
Tests       112 passed (112)
```

Command:

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Observed stdout:

```text
0
```

Command:

```bash
npm run test:run
```

Observed summary:

```text
Test Files  236 passed | 1 skipped (237)
Tests       2258 passed | 1 skipped (2259)
```

Command:

```bash
npm run build
```

Observed result: exit 0.

Command:

```bash
node scripts/zz-strategy-brief-db-contract.mjs f3993043-b6ce-4b27-a547-7ef02929f3fa
```

Observed stdout/stderr:

```text
FAIL zz-strategy-brief-db-contract
counts_toward_rollup expected false, got true
```

Readback after the failed Tier 2 attempt:

```text
run_id=f3993043-b6ce-4b27-a547-7ef02929f3fa
parent status=complete rollup=6/6
strategyBrief status=complete counts_toward_rollup=true revision=1 updated_at=2026-06-13T05:11:56.244888+00:00
```

## Blocked Gates

- Gate 1: live Supabase migration apply is still blocked in this session because no callable Supabase MCP `apply_migration` tool is exposed, and Supabase CLI auth is not available.
- Tier 2: run once and failed. The live DB still writes `strategyBrief` with `counts_toward_rollup=true`, so the rollup-exclusion migration is not applied or not effective in `commit_artifact_section`.
- Gate 2 / Tier 3: not run. It requires live API spend, a dev server, an authed `/research-v3` tab over CDP, and a completed run id.
- Mr Dre regression probe: not run because Gate 2 is not cleared.

## Judgment

Offline logic proof, targeted tests, TypeScript, full Vitest, and build are green. The DB moat is red: `strategyBrief` is currently rollup-counting in the live project. Do not run Tier 3 until the live Supabase migration is applied and Tier 2 passes.
