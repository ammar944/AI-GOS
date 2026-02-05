// Hook Extraction Function
// Lightweight function to extract ad hooks from competitor ads
// Replaces full re-synthesis for ~80% cost/time reduction

import { generateObject } from 'ai';
import { anthropic, MODELS, GENERATION_SETTINGS, estimateCost } from './providers';
import { hookExtractionResultSchema, type HookExtractionResult } from './schemas/ad-hook-extraction';
import type { AdHook } from './schemas/cross-analysis';

// =============================================================================
// Types
// =============================================================================

interface AdCreativeInput {
  headline?: string;
  body?: string;
  platform: string;
  advertiser?: string;
}

interface CompetitorWithAds {
  name: string;
  adCreatives?: AdCreativeInput[];
}

export interface ExtractAdHooksResult {
  hooks: AdHook[];
  cost: number;
  adsAnalyzed: number;
  extractedCount: number;
  inspiredCount: number;
}

// =============================================================================
// Hook Extraction Function
// =============================================================================

/**
 * Extract ad hooks from competitor ads (lightweight alternative to full re-synthesis)
 *
 * @param competitors - Enriched competitors with adCreatives
 * @param existingHooks - Generated hooks from initial synthesis (fallback + merge)
 * @returns Merged hooks array with extracted/inspired hooks taking priority
 */
export async function extractAdHooksFromAds(
  competitors: CompetitorWithAds[],
  existingHooks: AdHook[]
): Promise<ExtractAdHooksResult> {
  // Gather all ads with content
  const allAds: Array<{ competitor: string; ad: AdCreativeInput }> = [];

  for (const competitor of competitors) {
    if (competitor.adCreatives && competitor.adCreatives.length > 0) {
      for (const ad of competitor.adCreatives) {
        // Only include ads with meaningful text content
        if (ad.headline?.trim() || ad.body?.trim()) {
          allAds.push({ competitor: competitor.name, ad });
        }
      }
    }
  }

  // If no ads with content, return existing hooks unchanged
  if (allAds.length === 0) {
    console.log('[Hook Extraction] No ads with content found, returning existing hooks');
    return {
      hooks: existingHooks,
      cost: 0,
      adsAnalyzed: 0,
      extractedCount: 0,
      inspiredCount: 0,
    };
  }

  // Build focused prompt
  const adsText = allAds
    .slice(0, 20) // Limit to 20 ads for token efficiency
    .map((item, i) => {
      const parts = [`Ad ${i + 1} (${item.competitor}, ${item.ad.platform}):`];
      if (item.ad.headline) parts.push(`  Headline: "${item.ad.headline}"`);
      if (item.ad.body) parts.push(`  Body: "${item.ad.body.slice(0, 300)}${item.ad.body.length > 300 ? '...' : ''}"`);
      return parts.join('\n');
    })
    .join('\n\n');

  const prompt = `Analyze these competitor ads and extract attention-grabbing hooks.

## Competitor Ads
${adsText}

## Instructions
1. Extract hooks that are verbatim from ads (source.type = "extracted")
2. Create inspired hooks based on observed patterns (source.type = "inspired")
3. For each hook, identify:
   - The pattern interrupt technique used (controversial, revelation, myth-bust, status-quo-challenge, curiosity-gap, story)
   - The target awareness level (unaware, problem-aware, solution-aware, product-aware, most-aware)
   - Source attribution (competitor name and platform)

Focus on hooks that stop the scroll - look for:
- Controversial claims or statistics
- Pattern interrupts that break expectations
- Emotional triggers (fear, curiosity, FOMO)
- Specific numbers or timeframes
- Direct challenges to status quo

Return 5-12 high-quality hooks. Quality over quantity.`;

  try {
    const startTime = Date.now();

    const { object, usage } = await generateObject({
      model: anthropic(MODELS.CLAUDE_SONNET),
      schema: hookExtractionResultSchema,
      prompt,
      temperature: GENERATION_SETTINGS.synthesis.temperature,
      maxOutputTokens: 2000, // Focused extraction needs fewer tokens
    });

    const cost = estimateCost(
      MODELS.CLAUDE_SONNET,
      usage.inputTokens ?? 0,
      usage.outputTokens ?? 0
    );

    console.log(`[Hook Extraction] Completed in ${Date.now() - startTime}ms, cost: $${cost.toFixed(4)}, extracted: ${object.hookSummary.extractedCount}, inspired: ${object.hookSummary.inspiredCount}`);

    // Merge hooks: extracted/inspired take priority over generated
    const mergedHooks = mergeHooks(object.extractedHooks, existingHooks);

    return {
      hooks: mergedHooks,
      cost,
      adsAnalyzed: object.hookSummary.totalAdsAnalyzed,
      extractedCount: object.hookSummary.extractedCount,
      inspiredCount: object.hookSummary.inspiredCount,
    };
  } catch (error) {
    console.error('[Hook Extraction] Failed, returning existing hooks:', error);
    // Graceful fallback: return existing hooks on any failure
    return {
      hooks: existingHooks,
      cost: 0,
      adsAnalyzed: allAds.length,
      extractedCount: 0,
      inspiredCount: 0,
    };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Merge extracted/inspired hooks with generated hooks
 * - Extracted and inspired hooks take priority (come first)
 * - Generated hooks fill remaining slots
 * - Total capped at 12 hooks
 */
function mergeHooks(extractedHooks: AdHook[], generatedHooks: AdHook[]): AdHook[] {
  const MAX_HOOKS = 12;

  // Extracted/inspired hooks first
  const priorityHooks = extractedHooks.filter(
    h => h.source?.type === 'extracted' || h.source?.type === 'inspired'
  );

  // Fill remaining slots with generated hooks (or any without source)
  const generatedOnly = generatedHooks.filter(
    h => !h.source || h.source.type === 'generated'
  );

  const remainingSlots = MAX_HOOKS - priorityHooks.length;
  const merged = [
    ...priorityHooks,
    ...generatedOnly.slice(0, remainingSlots),
  ];

  return merged;
}
