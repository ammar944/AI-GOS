// Hook Diversity Validator
// Deterministic validation + quota logic to prevent single-competitor hook domination
// and ensure hooks match the client's target segment

import { generateObject } from 'ai';
import { MODELS, estimateCost } from './providers';
import { groq, GROQ_EXTRACTION_MODEL } from './groq-provider';
import { z } from 'zod';
import type { AdHook } from './schemas/cross-analysis';

// =============================================================================
// Types
// =============================================================================

export type AdDistributionTier = 'zero' | 'sparse' | 'standard';

export interface HookQuotas {
  extracted: number;
  inspired: number;
  original: number;
  maxPerCompetitor: number;
}

export interface HookViolation {
  type: 'source-concentration' | 'per-competitor-cap';
  detail: string;
  hookIndex: number;
}

export interface HookRelevanceResult {
  hookIndex: number;
  hook: string;
  relevant: boolean;
  reason: string;
}

export interface HookSegmentValidationResult {
  results: HookRelevanceResult[];
  cost: number;
}

interface CompetitorWithAds {
  name: string;
  adCreatives?: Array<{ headline?: string; body?: string }>;
}

// =============================================================================
// Ad Distribution Classification
// =============================================================================

/**
 * Classify the ad data richness based on how many competitors have actual ads.
 * Only counts competitors with at least one ad that has text content.
 */
export function computeAdDistribution(competitors: CompetitorWithAds[]): AdDistributionTier {
  const competitorsWithAds = competitors.filter(c => {
    if (!c.adCreatives || c.adCreatives.length === 0) return false;
    return c.adCreatives.some(ad => ad.headline?.trim() || ad.body?.trim());
  });

  const count = competitorsWithAds.length;

  if (count === 0) return 'zero';
  if (count <= 2) return 'sparse';
  return 'standard';
}

// =============================================================================
// Hook Quotas
// =============================================================================

/**
 * Returns hook type quotas based on ad data distribution tier.
 * Total always equals 8. maxPerCompetitor always 2.
 */
export function getHookQuotas(distribution: AdDistributionTier): HookQuotas {
  switch (distribution) {
    case 'zero':
      return { extracted: 0, inspired: 4, original: 4, maxPerCompetitor: 2 };
    case 'sparse':
      return { extracted: 2, inspired: 3, original: 3, maxPerCompetitor: 2 };
    case 'standard':
      return { extracted: 3, inspired: 3, original: 2, maxPerCompetitor: 2 };
  }
}

// =============================================================================
// Hook Diversity Validation
// =============================================================================

/**
 * Check hooks for source concentration and per-competitor cap violations.
 * Returns an array of violations (empty = all good).
 */
export function validateHookDiversity(
  hooks: AdHook[],
  maxPerCompetitor: number = 2,
): HookViolation[] {
  const violations: HookViolation[] = [];

  // Count hooks per competitor
  const competitorCounts = new Map<string, number[]>();
  hooks.forEach((hook, index) => {
    const competitors = hook.source?.competitors ?? [];
    for (const comp of competitors) {
      const normalized = comp.toLowerCase().trim();
      if (!competitorCounts.has(normalized)) {
        competitorCounts.set(normalized, []);
      }
      competitorCounts.get(normalized)!.push(index);
    }
  });

  // Check source concentration: any competitor > 50% of hooks
  const totalHooks = hooks.length;
  for (const [competitor, indices] of competitorCounts) {
    const share = indices.length / totalHooks;
    if (share > 0.5) {
      for (const hookIndex of indices) {
        violations.push({
          type: 'source-concentration',
          detail: `"${competitor}" accounts for ${Math.round(share * 100)}% of hooks (${indices.length}/${totalHooks})`,
          hookIndex,
        });
      }
    }
  }

  // Check per-competitor cap
  for (const [competitor, indices] of competitorCounts) {
    if (indices.length > maxPerCompetitor) {
      // Flag hooks beyond the cap
      for (const hookIndex of indices.slice(maxPerCompetitor)) {
        // Avoid duplicate entries if already flagged by concentration
        if (!violations.some(v => v.hookIndex === hookIndex && v.type === 'per-competitor-cap')) {
          violations.push({
            type: 'per-competitor-cap',
            detail: `"${competitor}" has ${indices.length} hooks, exceeds cap of ${maxPerCompetitor}`,
            hookIndex,
          });
        }
      }
    }
  }

  return violations;
}

// =============================================================================
// Hook Remediation
// =============================================================================

/**
 * Fix hook diversity violations by replacing excess hooks from over-represented
 * competitors with hooks from the synthesis pool.
 *
 * Strategy:
 * - Keep first `maxPerCompetitor` hooks from each competitor
 * - Replace excess hooks with synthesis-generated alternatives
 * - Always returns exactly 8 hooks (or fewer if not enough alternatives)
 */
export function remediateHooks(
  hooks: AdHook[],
  violations: HookViolation[],
  synthesisPool: AdHook[],
  maxPerCompetitor: number = 2,
): AdHook[] {
  if (violations.length === 0) return hooks.slice(0, 8);

  // Determine which hook indices to remove
  const violatedIndices = new Set(violations.map(v => v.hookIndex));

  // But keep the first maxPerCompetitor from each competitor
  const competitorKeptCount = new Map<string, number>();
  const keepIndices = new Set<number>();

  for (let i = 0; i < hooks.length; i++) {
    const competitors = hooks[i].source?.competitors ?? [];
    if (!violatedIndices.has(i)) {
      keepIndices.add(i);
      continue;
    }

    // Check if we've already kept maxPerCompetitor from all associated competitors
    let shouldKeep = false;
    for (const comp of competitors) {
      const normalized = comp.toLowerCase().trim();
      const kept = competitorKeptCount.get(normalized) ?? 0;
      if (kept < maxPerCompetitor) {
        shouldKeep = true;
        competitorKeptCount.set(normalized, kept + 1);
      }
    }

    if (shouldKeep) {
      keepIndices.add(i);
    }
  }

  // Build kept hooks
  const kept = hooks.filter((_, i) => keepIndices.has(i));

  // Fill remaining slots from synthesis pool (generated hooks only)
  const slotsNeeded = 8 - kept.length;
  const fillers = synthesisPool
    .filter(h => !h.source || h.source.type === 'generated')
    .slice(0, slotsNeeded);

  return [...kept, ...fillers].slice(0, 8);
}

// =============================================================================
// Segment Relevance Validation (Haiku-based)
// =============================================================================

const hookRelevanceSchema = z.object({
  results: z.array(z.object({
    hookIndex: z.number().describe('0-based index of the hook'),
    relevant: z.boolean().describe('true if the hook is relevant to the client segment'),
    reason: z.string().describe('Brief explanation of why the hook is or is not relevant'),
  })),
});

/**
 * Use Claude Haiku to validate that hooks match the client's target segment.
 * Catches segment mismatches like "pizza night" hooks for a fine dining client.
 *
 * Cost: ~$0.001 per call (12 hooks = ~200 input + ~300 output tokens)
 */
export async function validateHookSegmentRelevance(
  hooks: AdHook[],
  clientSegment: string,
  icpDescription: string,
): Promise<HookSegmentValidationResult> {
  if (hooks.length === 0) {
    return { results: [], cost: 0 };
  }

  const hooksText = hooks
    .map((h, i) => `${i}. "${h.hook}" [${h.source?.type ?? 'unknown'}${h.source?.competitors?.length ? ` from ${h.source.competitors.join(', ')}` : ''}]`)
    .join('\n');

  const prompt = `You are validating ad hooks for segment relevance.

CLIENT TARGET SEGMENT: ${clientSegment}
CLIENT ICP: ${icpDescription}

HOOKS TO VALIDATE:
${hooksText}

For each hook, determine if it would resonate with the client's target segment.
A hook is IRRELEVANT if:
- It references a different industry segment (e.g., "pizza night" for fine dining)
- It uses language specific to a different audience (e.g., "QSR operators" for enterprise SaaS)
- It addresses pain points that don't exist for the client's ICP

A hook is RELEVANT if:
- It addresses the client's ICP pain points, even if inspired by a competitor
- The pattern/technique works for the target segment, regardless of source
- It could credibly appear in an ad for the client's business`;

  try {
    const { object, usage } = await generateObject({
      model: groq(GROQ_EXTRACTION_MODEL),
      schema: hookRelevanceSchema,
      prompt,
      maxOutputTokens: 1000,
    });

    const cost = estimateCost(
      MODELS.GPT_OSS_20B,
      usage.inputTokens ?? 0,
      usage.outputTokens ?? 0,
    );

    return {
      results: object.results.map(r => ({
        ...r,
        hook: hooks[r.hookIndex]?.hook ?? '',
      })),
      cost,
    };
  } catch (error) {
    console.error('[Hook Segment Validation] Failed, treating all hooks as relevant:', error);
    return {
      results: hooks.map((h, i) => ({
        hookIndex: i,
        hook: h.hook,
        relevant: true,
        reason: 'Validation failed, defaulting to relevant',
      })),
      cost: 0,
    };
  }
}
