// research-worker/src/competitors/review-cross-analysis.ts
// Cross-competitor review pattern analysis — identifies complaint themes that appear
// across MULTIPLE competitors so media buyers can exploit shared market weaknesses.
// One generateObject() call, 8s timeout, Haiku model.

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type { ReviewResult, NegativeReview } from '../tools/reviews';
import { MODELS } from '../models';

// ── Schema (API-facing — no .min()/.max() on numbers) ──

const commonWeaknessSchema = z.object({
  theme: z.string().describe('Short label for the shared complaint theme (e.g. "Poor onboarding", "Slow support response")'),
  affectedCompetitors: z.array(z.string()).describe('Names of competitors affected by this theme — must match input names exactly'),
  frequency: z.number().describe('How many competitors share this theme (integer, 2 or more)'),
  exampleQuote: z.string().describe('A verbatim review quote that best illustrates this theme'),
  leverageAngle: z.string().describe('How the client can position against this shared weakness — one sentence, actionable'),
});

const reviewCrossAnalysisOutputSchema = z.object({
  commonWeaknesses: z.array(commonWeaknessSchema).describe('Top 3 complaint themes that appear across multiple competitors'),
});

// ── Types ──

export interface CommonWeakness {
  theme: string;
  affectedCompetitors: string[];
  frequency: number;
  exampleQuote: string;
  leverageAngle: string;
}

export interface ReviewCrossAnalysis {
  commonWeaknesses: CommonWeakness[];
}

// ── Constants ──

const CROSS_ANALYSIS_TIMEOUT_MS = 8_000;
const MAX_REVIEWS_PER_COMPETITOR = 4;
const MAX_TOTAL_REVIEW_CHARS = 6_000;
const MIN_COMPETITORS_WITH_REVIEWS = 2;

// ── Main ──

/**
 * Analyze negative reviews across all competitors to identify shared complaint
 * themes. Returns null if fewer than 2 competitors have negative reviews or on timeout.
 */
export async function analyzeReviewCrossPatterns(
  reviews: ReviewResult[],
): Promise<ReviewCrossAnalysis | null> {
  // Collect competitors that actually have negative reviews
  const reviewsByCompetitor = new Map<string, NegativeReview[]>();
  for (const r of reviews) {
    if (r.negativeReviews && r.negativeReviews.length > 0) {
      reviewsByCompetitor.set(r.competitorName, r.negativeReviews);
    }
  }

  if (reviewsByCompetitor.size < MIN_COMPETITORS_WITH_REVIEWS) {
    console.log(`[cross-analysis] only ${reviewsByCompetitor.size} competitor(s) have negative reviews — need ≥2, skipping`);
    return null;
  }

  const userPrompt = buildCrossAnalysisPrompt(reviewsByCompetitor);

  console.log(`[cross-analysis] analyzing ${reviewsByCompetitor.size} competitors for shared complaint themes`);

  try {
    const result = await generateObject({
      model: anthropic(MODELS.FAST),
      schema: reviewCrossAnalysisOutputSchema,
      system: `You are identifying shared complaint patterns across competing software products for a paid media strategist.
Use ONLY the supplied review excerpts. Do NOT invent complaints, competitors, or evidence.
A theme is only valid if it appears in reviews for AT LEAST 2 different competitors.
Return exactly 3 themes, ranked by how many competitors are affected (most first).
The leverage angle must be a concrete, actionable positioning statement — not generic.`,
      prompt: userPrompt,
      abortSignal: AbortSignal.timeout(CROSS_ANALYSIS_TIMEOUT_MS),
    });

    const weaknesses = result.object.commonWeaknesses;
    console.log(`[cross-analysis] success — ${weaknesses.length} shared themes identified`);
    for (const w of weaknesses) {
      console.log(`[cross-analysis] theme="${w.theme}" affectedCompetitors=${JSON.stringify(w.affectedCompetitors)} frequency=${w.frequency}`);
    }
    return result.object;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`[cross-analysis] failed (graceful degradation): ${msg}`);
    return null;
  }
}

// ── Helpers ──

function buildCrossAnalysisPrompt(
  reviewsByCompetitor: Map<string, NegativeReview[]>,
): string {
  let totalChars = 0;
  const sections: string[] = [];

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

  sections.push('Given these negative reviews across competitors, identify the TOP 3 complaint themes that appear across MULTIPLE competitors.');
  sections.push('For each theme: provide the theme name, which competitors are affected, count of affected competitors, one example review quote, and a leverage angle for the client.');

  return sections.join('\n');
}

function truncateReviews(
  reviews: NegativeReview[],
  currentTotalChars: number,
): NegativeReview[] {
  // Sort by rating ascending (worst reviews first)
  const sorted = [...reviews].sort((a, b) => a.rating - b.rating);
  const capped = sorted.slice(0, MAX_REVIEWS_PER_COMPETITOR);

  const result: NegativeReview[] = [];
  let chars = currentTotalChars;
  for (const r of capped) {
    if (chars + r.text.length > MAX_TOTAL_REVIEW_CHARS) {
      if (result.length >= 2) break;
    }
    result.push(r);
    chars += r.text.length;
  }

  return result;
}
