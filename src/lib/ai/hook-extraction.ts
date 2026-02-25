// Hook Extraction Function
// Lightweight function to extract ad hooks from competitor ads
// Replaces full re-synthesis for ~80% cost/time reduction
// Uses tier-based quotas to prevent single-competitor hook domination

import { generateObject } from 'ai';
import { MODELS, GENERATION_SETTINGS, estimateCost } from './providers';
import { groq, GROQ_SYNTHESIS_MODEL } from './groq-provider';
import { hookExtractionResultSchema } from './schemas/ad-hook-extraction';
import type { AdHook } from './schemas/cross-analysis';
import { computeAdDistribution, getHookQuotas } from './hook-diversity-validator';

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
  reviewData?: {
    trustpilot?: {
      reviews?: Array<{ rating: number; text: string }>;
    } | null;
    g2?: {
      rating?: number | null;
      reviewCount?: number | null;
    } | null;
  };
}

export interface HookExtractionContext {
  targetSegment: string;
  icpDescription: string;
  valueProp: string;
  industryVertical: string;
  brandPositioning: string;
  uniqueEdge: string;
}

export interface ExtractAdHooksResult {
  hooks: AdHook[];
  cost: number;
  adsAnalyzed: number;
  extractedCount: number;
  inspiredCount: number;
  generatedCount: number;
}

// =============================================================================
// Hook Extraction Function
// =============================================================================

/**
 * Extract ad hooks from competitor ads (lightweight alternative to full re-synthesis)
 *
 * @param competitors - Enriched competitors with adCreatives
 * @param existingHooks - Generated hooks from initial synthesis (fallback + merge)
 * @param clientContext - Optional client context for segment-aware extraction
 * @returns Hooks array with tier-based quotas applied
 */
export async function extractAdHooksFromAds(
  competitors: CompetitorWithAds[],
  existingHooks: AdHook[],
  clientContext?: HookExtractionContext,
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
      generatedCount: 0,
    };
  }

  // Compute tier-based quotas
  const distribution = computeAdDistribution(competitors);
  const quotas = getHookQuotas(distribution);

  console.log(`[Hook Extraction] Ad distribution: ${distribution}, quotas: extracted=${quotas.extracted}, inspired=${quotas.inspired}, original=${quotas.original}, maxPerCompetitor=${quotas.maxPerCompetitor}`);

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

  // Gather competitor review complaints (1-2 star) for hook inspiration
  const complaintsData: Array<{ competitor: string; text: string; rating: number }> = [];
  for (const competitor of competitors) {
    const reviews = competitor.reviewData?.trustpilot?.reviews ?? [];
    const complaints = reviews.filter(r => r.rating <= 2).slice(0, 2);
    for (const review of complaints) {
      complaintsData.push({ competitor: competitor.name, text: review.text.slice(0, 200), rating: review.rating });
    }
  }
  // Cap at 10 complaints for token efficiency
  const cappedComplaints = complaintsData.slice(0, 10);
  const complaintsText = cappedComplaints.length > 0
    ? cappedComplaints.map(c =>
      `${c.competitor}: ${'★'.repeat(c.rating)}${'☆'.repeat(5 - c.rating)} "${c.text}"`
    ).join('\n')
    : '';

  // Build client context block
  const clientContextBlock = clientContext ? `
## CLIENT CONTEXT (YOUR CLIENT — the business these hooks are FOR)
- Target Segment: ${clientContext.targetSegment}
- ICP Description: ${clientContext.icpDescription}
- Value Proposition: ${clientContext.valueProp}
- Industry Vertical: ${clientContext.industryVertical}
- Brand Positioning: ${clientContext.brandPositioning}
- Unique Edge: ${clientContext.uniqueEdge}

CRITICAL: Every hook you write MUST resonate with the CLIENT's target segment above.
Competitor ads are REFERENCE MATERIAL ONLY. Do NOT write hooks about the competitor's audience.
If a competitor targets "fast casual pizza restaurants" but the client targets "fine dining restaurants",
extract the PATTERN (e.g., urgency, social proof) but rewrite the hook for FINE DINING.
` : '';

  const prompt = `Analyze these competitor ads and extract attention-grabbing hooks.
${clientContextBlock}
## Competitor Ads
${adsText}

## MANDATORY TIER QUOTAS (ad data tier: ${distribution})
You MUST produce exactly these counts:
- EXTRACTED hooks (verbatim from ads, source.type = "extracted"): exactly ${quotas.extracted}
- INSPIRED hooks (patterns adapted for client, source.type = "inspired"): exactly ${quotas.inspired}
- GENERATED hooks (original, from client data only, source.type = "generated"): exactly ${quotas.original}
- MAX ${quotas.maxPerCompetitor} hooks per competitor (across extracted + inspired)
- TOTAL: exactly 8 hooks

## Instructions
1. Extract hooks that are verbatim from ads (source.type = "extracted") — max ${quotas.extracted}
2. Create inspired hooks based on observed ad PATTERNS but rewritten for the client's segment (source.type = "inspired") — exactly ${quotas.inspired}
3. Generate original hooks from client data, ICP pain points, and positioning (source.type = "generated") — exactly ${quotas.original}
4. For each hook, identify:
   - The pattern interrupt technique used (controversial, revelation, myth-bust, status-quo-challenge, curiosity-gap, story, fear, social-proof, urgency, authority, comparison)
   - The target awareness level (unaware, problem-aware, solution-aware, product-aware, most-aware)
   - Source attribution (competitor name and platform)

${complaintsText ? `
## Customer Complaints from Competitor Reviews
${complaintsText}

When review complaints are available:
- Create 2-3 "inspired" hooks from customer pain language (source.type = "inspired", source.competitor = the competitor name + " Reviews")
- Turn complaints into positioning hooks (e.g., complaint about "unethical billing" → hook about transparent pricing)
- Verbatim customer words make powerful hooks — quote or closely mirror complaint language
` : ''}
Focus on hooks that stop the scroll - look for:
- Controversial claims or statistics
- Pattern interrupts that break expectations
- Emotional triggers (fear, curiosity, FOMO)
- Specific numbers or timeframes
- Direct challenges to status quo

Return exactly 8 high-quality hooks matching the tier quotas above.`;

  try {
    const startTime = Date.now();

    const { object, usage } = await generateObject({
      model: groq(GROQ_SYNTHESIS_MODEL),
      schema: hookExtractionResultSchema,
      prompt,
      temperature: GENERATION_SETTINGS.synthesis.temperature,
      maxOutputTokens: 2500,
      providerOptions: { groq: { structuredOutputs: true, strictJsonSchema: false } },
    });

    const cost = estimateCost(
      MODELS.KIMI_K2,
      usage.inputTokens ?? 0,
      usage.outputTokens ?? 0
    );

    console.log(`[Hook Extraction] Completed in ${Date.now() - startTime}ms, cost: $${cost.toFixed(4)}, extracted: ${object.hookSummary.extractedCount}, inspired: ${object.hookSummary.inspiredCount}, generated: ${object.hookSummary.generatedCount}`);

    return {
      hooks: object.extractedHooks,
      cost,
      adsAnalyzed: object.hookSummary.totalAdsAnalyzed,
      extractedCount: object.hookSummary.extractedCount,
      inspiredCount: object.hookSummary.inspiredCount,
      generatedCount: object.hookSummary.generatedCount,
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
      generatedCount: 0,
    };
  }
}
