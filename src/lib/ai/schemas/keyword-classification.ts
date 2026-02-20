import { z } from 'zod';

/**
 * Schema for LLM keyword relevance classification.
 * Each keyword gets a 1-10 relevance score and a short reason.
 */
export const keywordClassificationSchema = z.object({
  classifications: z.array(z.object({
    keyword: z.string().describe('The exact keyword string being classified'),
    score: z.number().min(1).max(10).describe(
      'Relevance score: 1-3 = irrelevant (wrong industry, consumer query, unrelated), ' +
      '4-5 = tangentially relevant (adjacent topic but not direct buyer intent), ' +
      '6-7 = relevant (related to client product/industry, potential buyer), ' +
      '8-10 = highly relevant (direct purchase intent, exact product category, competitor comparison)'
    ),
    reason: z.string().max(80).describe('Brief explanation of the score'),
  })),
});

export type KeywordClassification = z.infer<typeof keywordClassificationSchema>;
