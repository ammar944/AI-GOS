# PRIMER.md

## Current Focus
Post-deployment bug fixes and polish — hyper-agent, ads, CTA, generation time.

## What Was Just Done (2026-03-24 session)

### Fixes Shipped (commit `21d9c677`)
1. **"Looks Good" CTA removed** — Approval button removed from all research sections. Sections now auto-approve when user navigates to another section.
2. **Duplicate ads fixed** — Dedup logic in `adlibrary.ts` split into separate ID and fingerprint sets. Real IDs no longer skip fingerprint check. Case-normalized matching.
3. **Hyper-agent progress for synthesis + media plan** — Both runners use `generateObject()` (no streaming). Added periodic progress emissions every 4-5s so the hyper-agent view stays alive during generation.

### Deployed
- **Vercel**: Auto-deploy on push to `redesign/v2-command-center`
- **Railway**: `railway up` from research-worker/

### Previous Session (2026-03-22)
- Unified Chat System planned (design doc APPROVED, eng review done)
- Full pipeline optimization: token budgets, tool iteration caps, wave parallelism
- 3 hotfixes deployed: z.enum relaxation, empty string defaults, token budget reverts

## Known Issues (Not Fixed This Session)

### Chat Edit Verification
The `editBlueprint` tool exists in `AgentChat` component but isn't wired into the workspace/journey flow. The workspace uses `RightRail` (simple chat without tool calling). Full edit capability requires the unified chat implementation (Phase 1-2 from previous PRIMER).

### Firecrawl API Key Swap
No code changes needed. Swap `FIRECRAWL_API_KEY` env var in:
- Vercel dashboard → Environment Variables
- Railway dashboard → Variables
User needs to provide the SaaSLaunch account API key.

### Generation Time
Token budgets and tool iteration caps already optimized in previous session. Further gains require `streamObject` migration for synthesis + media plan (blocked on `stripNumericConstraints` compatibility spike).

## Active Files

| File | Change |
|------|--------|
| `src/components/workspace/artifact-canvas.tsx` | Removed approve footer for research sections |
| `src/components/workspace/workspace-provider.tsx` | Auto-approve on navigate away |
| `research-worker/src/tools/adlibrary.ts` | Fixed dedup logic |
| `research-worker/src/runners/synthesize.ts` | Added progress interval |
| `research-worker/src/runners/media-plan.ts` | Added per-block progress interval |

## Next Steps
1. Swap Firecrawl API key (user action — env vars)
2. Run 1 full pipeline test to verify all 7 sections complete cleanly
3. Unified Chat implementation (Phase 0-4 from design doc)
4. `streamObject` spike for synthesis + media plan (generation time)
