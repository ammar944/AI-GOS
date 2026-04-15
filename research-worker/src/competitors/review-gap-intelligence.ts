// research-worker/src/competitors/review-gap-intelligence.ts
// Analyzes negative reviews across all competitors to produce per-competitor
// exploit angles for media buyers. One generateObject() call, 8s timeout.

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type { ReviewResult, NegativeReview } from '../tools/reviews';
import { MODELS } from '../models';

// ── Schema (API-facing — no .min()/.max() on numbers) ──

const exploitAngleSchema = z.object({
  gap: z.string().describe('The specific weakness identified from reviews'),
  whyItMatters: z.string().describe('Why this gap matters for this competitor, citing review frequency'),
  positioningAngle: z.string().describe('How to position against this weakness'),
  adHook: z.string().max(80).describe('Ad copy hook, max 12 words'),
  confidence: z.enum(['high', 'medium', 'low']),
  evidenceQuotes: z.array(z.string()).describe('Verbatim review excerpts that support this angle'),
});

const competitorGapIntelligenceSchema = z.object({
  recurringComplaints: z.array(z.string()).describe('Top 3 complaint themes'),
  exploitAngles: z.array(exploitAngleSchema).describe('Return exactly 2-3 actionable positioning angles, no more than 3'),
});

// Use array of named objects instead of z.record() — Anthropic rejects propertyNames
const gapIntelligenceOutputSchema = z.object({
  competitors: z.array(z.object({
    name: z.string().describe('Competitor name exactly as provided in the input'),
    analysis: competitorGapIntelligenceSchema,
  })),
});

// ── Types ──

export interface ExploitAngle {
  gap: string;
  whyItMatters: string;
  positioningAngle: string;
  adHook: string;
  confidence: 'high' | 'medium' | 'low';
  evidenceQuotes: string[];
}

export interface CompetitorGapIntelligence {
  recurringComplaints: string[];
  exploitAngles: ExploitAngle[];
}

// ── Constants ──

const GAP_INTELLIGENCE_TIMEOUT_MS = 8_000;
const MAX_REVIEWS_PER_COMPETITOR = 5;
const MAX_TOTAL_REVIEW_CHARS = 8_000; // Rough proxy for ~4k tokens

// ── Main ──

/**
 * Analyze negative reviews across all competitors to produce per-competitor
 * exploit angles. Returns null if no negative reviews exist or on timeout.
 */
export async function analyzeReviewGaps(
  reviews: ReviewResult[],
  subjectCompany: string,
): Promise<Record<string, CompetitorGapIntelligence> | null> {
  // Collect all negative reviews, grouped by competitor
  const reviewsByCompetitor = new Map<string, NegativeReview[]>();
  for (const r of reviews) {
    if (r.negativeReviews && r.negativeReviews.length > 0) {
      reviewsByCompetitor.set(r.competitorName, r.negativeReviews);
    }
  }

  if (reviewsByCompetitor.size === 0) {
    console.log('[gap-intelligence] no negative reviews found, skipping');
    return null;
  }

  // Build the user prompt with truncation
  const userPrompt = buildReviewPrompt(reviewsByCompetitor, subjectCompany);

  console.log(`[gap-intelligence] analyzing ${reviewsByCompetitor.size} competitors, ${countReviews(reviewsByCompetitor)} total reviews`);

  try {
    const result = await generateObject({
      model: anthropic(MODELS.FAST),
      schema: gapIntelligenceOutputSchema,
      system: `You are analyzing verified negative software reviews for paid media strategy.
Use ONLY the supplied review excerpts. Do NOT invent complaints, competitors, or evidence.
Every exploit angle must cite the exact review text that supports it.
Output is per-competitor: each competitor gets their own exploit angles based on THEIR reviews.
Prefer repeated patterns. Ignore pricing complaints unless they describe value failure after purchase.`,
      prompt: userPrompt,
      abortSignal: AbortSignal.timeout(GAP_INTELLIGENCE_TIMEOUT_MS),
    });

    // Convert array to Record keyed by competitor name
    const record: Record<string, CompetitorGapIntelligence> = {};
    for (const entry of result.object.competitors) {
      record[entry.name] = entry.analysis;
    }

    console.log(`[gap-intelligence] success — ${Object.keys(record).length} competitors analyzed`);
    return record;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`[gap-intelligence] failed (graceful degradation): ${msg}`);
    return null;
  }
}

// ── Helpers ──

function buildReviewPrompt(
  reviewsByCompetitor: Map<string, NegativeReview[]>,
  subjectCompany: string,
): string {
  let totalChars = 0;
  const sections: string[] = [];

  sections.push(`Subject company (YOUR client): ${subjectCompany}\n`);
  sections.push('Negative reviews by competitor:\n');

  for (const [name, reviews] of reviewsByCompetitor) {
    const truncated = truncateReviews(reviews, totalChars);
    if (truncated.length === 0) continue;

    sections.push(`## ${name}`);
    for (let i = 0; i < truncated.length; i++) {
      const r = truncated[i];
      const dateStr = r.date ? ` (${r.date})` : '';
      sections.push(`[${i + 1}] ${r.rating}★ [${r.source.toUpperCase()}]${dateStr}: "${r.text}"`);
      totalChars += r.text.length;
    }
    sections.push('');
  }

  sections.push('For each competitor, identify 2-3 exploit angles based on THEIR reviews.');
  sections.push('Each angle must cite evidence from the numbered excerpts above.');

  return sections.join('\n');
}

function truncateReviews(
  reviews: NegativeReview[],
  currentTotalChars: number,
): NegativeReview[] {
  // Sort by rating ascending (worst reviews first)
  const sorted = [...reviews].sort((a, b) => a.rating - b.rating);

  // Cap per competitor
  const capped = sorted.slice(0, MAX_REVIEWS_PER_COMPETITOR);

  // Truncate if total chars would exceed budget
  const result: NegativeReview[] = [];
  let chars = currentTotalChars;
  for (const r of capped) {
    if (chars + r.text.length > MAX_TOTAL_REVIEW_CHARS) {
      // Take only 3 per competitor if we're near budget
      if (result.length >= 3) break;
    }
    result.push(r);
    chars += r.text.length;
  }

  return result;
}

function countReviews(reviewsByCompetitor: Map<string, NegativeReview[]>): number {
  let count = 0;
  for (const reviews of reviewsByCompetitor.values()) {
    count += reviews.length;
  }
  return count;
}
