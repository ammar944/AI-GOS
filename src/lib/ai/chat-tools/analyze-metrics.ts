// Analyze Metrics Tool
// Auto-execute tool (no needsApproval) — calls Groq to score a blueprint section
// across 5 quality dimensions and return structured recommendations.

import { z } from 'zod';
import { tool, generateObject } from 'ai';
import { groq, GROQ_CHAT_MODEL } from '@/lib/ai/groq-provider';
import { SECTION_LABELS } from './utils';

/** Zod schema for the structured scoring response from Groq. */
const MetricsSchema = z.object({
  overallScore: z.number().min(1).max(10),
  dimensions: z.array(
    z.object({
      name: z.string(),
      score: z.number().min(1).max(10),
      reasoning: z.string(),
    })
  ),
  recommendations: z.array(z.string()),
  summary: z.string(),
});

export function createAnalyzeMetricsTool(blueprint: Record<string, unknown>) {
  return tool({
    description:
      'Analyze and score a specific blueprint section across multiple quality dimensions. ' +
      'Use when the user asks to evaluate, score, or assess the quality of a section — ' +
      'like "how strong is my ICP?" or "analyze the offer section".',
    inputSchema: z.object({
      section: z
        .enum([
          'industryMarketOverview',
          'icpAnalysisValidation',
          'offerAnalysisViability',
          'competitorAnalysis',
          'crossAnalysisSynthesis',
        ])
        .describe('The blueprint section to analyze and score'),
      focusArea: z
        .string()
        .optional()
        .describe('Specific aspect to evaluate within the section (e.g. "psychographics", "pricing model")'),
    }),
    execute: async ({ section, focusArea }) => {
      const sectionLabel = SECTION_LABELS[section] ?? section;
      const sectionContent = blueprint[section];

      if (sectionContent === undefined || sectionContent === null) {
        return {
          section: sectionLabel,
          overallScore: 0,
          dimensions: [],
          recommendations: [],
          error: `Section "${sectionLabel}" not found in blueprint`,
        };
      }

      const sectionJson = JSON.stringify(sectionContent, null, 2);

      const focusClause = focusArea ? `Focus especially on: ${focusArea}.` : '';

      const prompt =
        `Analyze this ${sectionLabel} section. ` +
        `Score these 5 dimensions:\n` +
        `1. Specificity — concrete data vs vague claims\n` +
        `2. Data Backing — stats, citations, evidence\n` +
        `3. Actionability — clear next steps\n` +
        `4. Depth of Insight — beyond obvious observations\n` +
        `5. Market Fit — relevance to ICP and positioning\n\n` +
        `Section content:\n${sectionJson}\n\n` +
        `${focusClause}`;

      try {
        const { object } = await generateObject({
          model: groq(GROQ_CHAT_MODEL),
          schema: MetricsSchema,
          system:
            'You are a senior paid media strategist evaluating a strategic blueprint section. ' +
            'Score each dimension from 1-10 where 10 is exceptional. Be critical and specific.',
          prompt,
          temperature: 0.3,
          maxOutputTokens: 2048,
        });

        return {
          section: sectionLabel,
          overallScore: object.overallScore,
          dimensions: object.dimensions,
          recommendations: object.recommendations,
          summary: object.summary,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          section: sectionLabel,
          overallScore: 0,
          dimensions: [],
          recommendations: [],
          error: message,
        };
      }
    },
  });
}
