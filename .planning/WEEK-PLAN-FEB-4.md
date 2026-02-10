# Week Plan: Feb 4-7, 2026

## Goal
Migrate SaasLaunch research generation from OpenRouter to Vercel AI SDK for better quality outputs.

---

## What's Done (Prep Work)

✅ **Migration plan created:** `.planning/VERCEL-AI-SDK-MIGRATION.md`

✅ **Provider setup:** `/lib/ai/providers.ts`
- Perplexity, Anthropic, Google providers configured
- Model constants and task mappings defined

✅ **Enhanced schemas with `.describe()` hints:**
- `/lib/ai/schemas/industry-market.ts`
- `/lib/ai/schemas/icp-analysis.ts`
- `/lib/ai/schemas/offer-analysis.ts`
- `/lib/ai/schemas/competitor-analysis.ts`
- `/lib/ai/schemas/cross-analysis.ts`

✅ **New research functions:** `/lib/ai/research.ts`
- `researchIndustryMarket()`
- `researchICPAnalysis()`
- `researchOfferAnalysis()`
- `researchCompetitors()`
- `synthesizeCrossAnalysis()`

---

## What's Left

### Tuesday (Feb 4) - Complete Migration

1. **Install packages:**
   ```bash
   cd /Users/ammar/Dev-Projects/AI-GOS-main
   pnpm add ai @ai-sdk/perplexity @ai-sdk/anthropic @ai-sdk/google
   ```

2. **Update environment variables:**
   - Add `PERPLEXITY_API_KEY` (if not already set)
   - Add `ANTHROPIC_API_KEY` (if not already set)
   - `OPENROUTER_API_KEY` can be removed after migration

3. **Update `strategic-blueprint-generator.ts`:**
   - Replace old research imports with new `/lib/ai/research.ts`
   - Update orchestration to use new function signatures
   - Keep streaming progress events

4. **Test end-to-end:**
   - Run generation with sample data
   - Verify all 5 sections complete
   - Check citation/sources in output

### Wednesday (Feb 5) - Chat + Product-Market Fit

1. **Chat migration:**
   - Update `/lib/chat/agents/` to use `streamText`
   - Migrate qa-agent, edit-agent, explain-agent
   - Update chat API routes

2. **Add Product-Market Fit:**
   - Already added `positioningStrategy` and `messagingFramework` to Section 5 schema
   - These are the "deeper positioning/messaging" fields

### Thursday (Feb 6) - SpyFu Integration (if API available)

1. **SpyFu keyword intel** (optional):
   - Add `keywordIntel` field to competitor schema
   - Integrate SpyFu API or use Firecrawl to scrape

2. **Quality refinement:**
   - Review output quality
   - Tune `.describe()` hints based on actual results
   - Adjust prompts as needed

### Friday (Feb 7) - Testing & Polish

1. **E2E testing:**
   - Full pipeline test with multiple inputs
   - Compare quality vs old OpenRouter system

2. **Performance:**
   - Measure latency improvement
   - Track token usage

3. **Cleanup:**
   - Remove old `/lib/openrouter/` code
   - Update any remaining references

---

## Key Architecture Changes

### Before (OpenRouter)
```
OnboardingData → OpenRouterClient (manual fetch + JSON extraction) → ResearchAgent → Manual validation
```

### After (Vercel AI SDK)
```
OnboardingData → generateText + Output.object(schema) → Typed output + sources
```

### Schema-Driven Quality

The key improvement is `.describe()` hints on every schema field:

```typescript
// OLD: Prompt-based guidance
"painPoints.primary": "string array - 5-7 most critical pain points"

// NEW: Schema-based guidance
painPoints: z.object({
  primary: z.array(z.string())
    .min(5).max(7)
    .describe('5-7 most critical, urgent pain points that drive immediate buying action. Source from G2 reviews, Reddit threads, and industry forums.')
})
```

This guides the model at the field level, not just in the system prompt.

---

## Output Schema Changes

### New fields in Section 5 (Cross-Analysis):

```typescript
positioningStrategy: {
  primary: string;           // Main positioning statement
  alternatives: string[];    // 2-3 alternatives to test
  differentiators: string[]; // Defensible advantages
  avoidPositions: string[];  // What NOT to do
}

messagingFramework: {
  coreMessage: string;         // The one thing to remember
  supportingMessages: string[]; // 3-5 supporting points
  proofPoints: string[];        // Evidence and social proof
  tonalGuidelines: string[];    // Voice and tone direction
}
```

These replace the simpler `recommendedPositioning` string with actionable strategy.

---

## Files to Touch

| File | Action |
|------|--------|
| `package.json` | Add `ai`, `@ai-sdk/*` packages |
| `.env.local` | Ensure API keys are set |
| `/lib/ai/providers.ts` | ✅ Created |
| `/lib/ai/schemas/*.ts` | ✅ Created |
| `/lib/ai/research.ts` | ✅ Created |
| `/lib/strategic-blueprint/pipeline/strategic-blueprint-generator.ts` | Update imports, use new functions |
| `/lib/strategic-blueprint/pipeline/*-research.ts` | DELETE (replaced by `/lib/ai/research.ts`) |
| `/lib/openrouter/client.ts` | DELETE after migration |
| `/lib/research/agent.ts` | DELETE after migration |
| `/lib/chat/agents/*.ts` | Migrate to streamText |
| `/app/api/strategic-blueprint/generate/route.ts` | Minor updates for new types |

---

## Success Criteria

| Metric | Target |
|--------|--------|
| JSON parse errors | 0% (was ~5%) |
| Generation time | <60s (was ~90s) |
| Citation quality | Full metadata (was URL-only) |
| Output quality | Schema-guided, more specific |
| Code lines | -600 lines (remove custom client code) |
