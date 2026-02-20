// Keyword Relevance Classifier
// Uses Claude Haiku to score keyword relevance in batches.
// Fail-open: on error, passes all keywords through.

import { generateObject } from 'ai';
import { anthropic, MODELS, estimateCost } from './providers';
import { keywordClassificationSchema } from './schemas/keyword-classification';
import type { KeywordOpportunity } from '@/lib/strategic-blueprint/output-types';
import type { KeywordBusinessContext } from './keyword-intelligence';

// =============================================================================
// Types
// =============================================================================

export interface ClassifierResult {
  relevant: KeywordOpportunity[];
  discarded: { keyword: KeywordOpportunity; score: number; reason: string }[];
  cost: number;
}

// =============================================================================
// Constants
// =============================================================================

const BATCH_SIZE = 50;
const RELEVANCE_THRESHOLD = 6;

// =============================================================================
// Prompt Builder
// =============================================================================

function buildClassifierPrompt(
  keywords: string[],
  context: KeywordBusinessContext,
): string {
  return `You are a keyword relevance classifier for a paid media strategy tool.

## Client Context
- **Company**: ${context.companyName}
- **Industry**: ${context.industry}
- **Product**: ${context.productDescription}
- **Competitors**: ${context.competitorNames.join(', ') || 'None specified'}

## Your Task
Score each keyword's relevance to this client's business on a 1-10 scale:

### Scoring Guide
- **1-3 (Irrelevant)**: Wrong industry entirely, consumer/local business queries, entertainment, recipes, unrelated products
- **4-5 (Tangential)**: Adjacent topic but not direct buyer intent — general business terms, loosely related concepts
- **6-7 (Relevant)**: Related to client's product category or industry, potential buyer research queries
- **8-10 (Highly Relevant)**: Direct purchase intent, exact product category, competitor comparisons, solution-seeking queries

### Important Rules
- Keywords mentioning competitor names (${context.competitorNames.join(', ')}) in a comparison context score 7+
- Generic business terms ("best software", "top tools") without industry context score 4-5
- Keywords about the client's specific problem domain score 6+
- Consumer/local queries (restaurant names, reservations, menus) score 1-2

## Keywords to Classify
${keywords.map((kw, i) => `${i + 1}. "${kw}"`).join('\n')}

Classify ALL ${keywords.length} keywords. Return the exact keyword string for each.`;
}

// =============================================================================
// Main Classifier Function
// =============================================================================

/**
 * Classify keyword relevance using Claude Haiku.
 * Batches keywords in groups of ${BATCH_SIZE}.
 * Fail-open: on error per batch, passes all keywords through.
 */
export async function classifyKeywordRelevance(
  keywords: KeywordOpportunity[],
  context: KeywordBusinessContext,
): Promise<ClassifierResult> {
  if (keywords.length === 0) {
    return { relevant: [], discarded: [], cost: 0 };
  }

  const relevant: KeywordOpportunity[] = [];
  const discarded: ClassifierResult['discarded'] = [];
  let totalCost = 0;

  // Build keyword-to-opportunity lookup
  const kwMap = new Map<string, KeywordOpportunity>();
  for (const kw of keywords) {
    kwMap.set(kw.keyword.toLowerCase().trim(), kw);
  }

  // Batch processing
  const batches: KeywordOpportunity[][] = [];
  for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
    batches.push(keywords.slice(i, i + BATCH_SIZE));
  }

  // Run all batches in parallel (fail-open per batch)
  const batchResults = await Promise.allSettled(
    batches.map(async (batch) => {
      const keywordStrings = batch.map(kw => kw.keyword);
      const prompt = buildClassifierPrompt(keywordStrings, context);

      const { object, usage } = await generateObject({
        model: anthropic(MODELS.CLAUDE_HAIKU),
        schema: keywordClassificationSchema,
        prompt,
        temperature: 0.1,
        maxOutputTokens: 4096,
      });

      return { object, usage, batch };
    }),
  );

  for (let i = 0; i < batchResults.length; i++) {
    const result = batchResults[i];
    const batch = batches[i];

    if (result.status === 'rejected') {
      // Fail-open: on any error, pass entire batch through
      console.error(
        `[Keyword Classifier] Batch failed, passing ${batch.length} keywords through:`,
        result.reason instanceof Error ? result.reason.message : result.reason,
      );
      relevant.push(...batch);
      continue;
    }

    const { object, usage } = result.value;

    // Track cost
    const batchCost = estimateCost(
      MODELS.CLAUDE_HAIKU,
      usage.inputTokens ?? 0,
      usage.outputTokens ?? 0,
    );
    totalCost += batchCost;

    // Build a set of classified keyword strings for unmatched detection
    const classifiedSet = new Set<string>();

    // Process classifications
    for (const classification of object.classifications) {
      const kwLower = classification.keyword.toLowerCase().trim();
      classifiedSet.add(kwLower);
      const opportunity = kwMap.get(kwLower);

      if (!opportunity) continue; // LLM returned a keyword not in our list

      if (classification.score >= RELEVANCE_THRESHOLD) {
        relevant.push(opportunity);
      } else {
        discarded.push({
          keyword: opportunity,
          score: classification.score,
          reason: classification.reason,
        });
      }
    }

    // Fail-open for any keywords the LLM missed in its response
    for (const kw of batch) {
      const kwLower = kw.keyword.toLowerCase().trim();
      if (!classifiedSet.has(kwLower)) {
        relevant.push(kw); // Fail-open: unclassified keywords pass through
      }
    }
  }

  console.log(
    `[Keyword Classifier] ${keywords.length} input → ${relevant.length} relevant (${discarded.length} discarded), cost: $${totalCost.toFixed(4)}`,
  );

  return { relevant, discarded, cost: totalCost };
}
