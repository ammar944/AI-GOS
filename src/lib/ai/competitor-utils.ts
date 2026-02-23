// Competitor Parsing & Tier Ranking Utilities
// Parses free-text competitor lists and ranks them into full/summary tiers

import type { OnboardingFormData } from '@/lib/onboarding/types';

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_FULL_TIER_LIMIT = 8;
export const MAX_TOTAL_COMPETITORS = 20;

// =============================================================================
// Parser: Free-text → structured name list
// =============================================================================

/**
 * Parse a free-text competitor string into individual competitor names.
 * Handles: commas, semicolons, newlines, " and ", " vs ", " / " as delimiters.
 * Preserves parenthetical notes: "Bizible (Marketo)" stays as one entry.
 * Deduplicates case-insensitively. Caps at MAX_TOTAL_COMPETITORS.
 */
export function parseCompetitorNames(raw: string): string[] {
  if (!raw || !raw.trim()) return [];

  // Step 1: Normalize whitespace but preserve newlines
  let text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Step 2: Split on delimiters: commas, semicolons, newlines, " and ", " vs ", " / "
  // Use regex split with multiple separators
  const parts = text.split(/[,;\n]|\s+and\s+|\s+vs\.?\s+|\s+\/\s+/i);

  // Step 3: Trim, filter empty, deduplicate case-insensitively
  const seen = new Set<string>();
  const names: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Skip entries that are just numbers (e.g., from numbered lists "1. HubSpot")
    const cleaned = trimmed.replace(/^\d+[\.\)]\s*/, '');
    if (!cleaned) continue;

    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(cleaned);
  }

  return names.slice(0, MAX_TOTAL_COMPETITORS);
}

// =============================================================================
// Ranker: Assign competitors to full or summary tier
// =============================================================================

interface RankedCompetitors {
  fullTier: string[];
  summaryTier: string[];
}

/**
 * Rank parsed competitor names and split into full-analysis vs summary tiers.
 *
 * Scoring weights:
 * - listPosition (0.6): Earlier in the list = higher priority
 * - mentionBoost (0.3): Appears in competitorFrustrations, uniqueEdge, or marketBottlenecks
 * - contextFrequency (0.1): Number of mentions across all form fields
 *
 * If total competitors <= fullTierLimit, all are full-tier (no summary needed).
 */
export function rankCompetitorsByEmphasis(
  names: string[],
  formData: OnboardingFormData,
  fullTierLimit: number = DEFAULT_FULL_TIER_LIMIT,
): RankedCompetitors {
  if (names.length === 0) return { fullTier: [], summaryTier: [] };
  if (names.length <= fullTierLimit) return { fullTier: [...names], summaryTier: [] };

  // Build context string from key form fields
  const contextFields = [
    formData.marketCompetition?.competitorFrustrations,
    formData.marketCompetition?.uniqueEdge,
    formData.marketCompetition?.marketBottlenecks,
    formData.productOffer?.productDescription,
    formData.customerJourney?.commonObjections,
    formData.brandPositioning?.brandPositioning,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // High-signal fields for mention boost
  const boostFields = [
    formData.marketCompetition?.competitorFrustrations,
    formData.marketCompetition?.uniqueEdge,
    formData.marketCompetition?.marketBottlenecks,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Score each competitor
  const scored = names.map((name, index) => {
    const nameLower = name.toLowerCase();
    // Extract core name for matching (strip parenthetical, e.g., "Bizible (Marketo)" → "Bizible")
    const coreName = nameLower.replace(/\s*\(.*?\)\s*/g, '').trim();

    // Position score: 1.0 for first, decreasing linearly
    const positionScore = 1 - (index / names.length);

    // Mention boost: 1.0 if name appears in high-signal fields
    const mentionBoost =
      boostFields.includes(coreName) || boostFields.includes(nameLower) ? 1.0 : 0.0;

    // Context frequency: count occurrences across all fields (normalized)
    const occurrences = countOccurrences(contextFields, coreName);
    const contextScore = Math.min(occurrences / 3, 1.0); // cap at 1.0

    const totalScore =
      positionScore * 0.6 +
      mentionBoost * 0.3 +
      contextScore * 0.1;

    return { name, score: totalScore };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return {
    fullTier: scored.slice(0, fullTierLimit).map((s) => s.name),
    summaryTier: scored.slice(fullTierLimit).map((s) => s.name),
  };
}

// =============================================================================
// Helpers
// =============================================================================

function countOccurrences(text: string, search: string): number {
  if (!search || !text) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(search, pos)) !== -1) {
    count++;
    pos += search.length;
  }
  return count;
}
