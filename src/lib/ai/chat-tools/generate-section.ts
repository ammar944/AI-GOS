// Generate Section Tool
// Requires approval before execution (needsApproval: true)
// Rewrites or enhances an entire blueprint section based on user instructions.

import { z } from 'zod';
import { tool, generateText } from 'ai';
import { anthropic, MODELS } from '@/lib/ai/providers';
import { generateDiffPreview, SECTION_LABELS } from './utils';

/**
 * Extract JSON from a model response that may be wrapped in a markdown code block.
 */
function extractJson(text: string): unknown {
  const trimmed = text.trim();

  // Try to extract from ```json ... ``` or ``` ... ``` fences
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/m);
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1].trim());
  }

  // Try to find the first JSON object/array in the text
  const firstBrace = trimmed.indexOf('{');
  const firstBracket = trimmed.indexOf('[');
  let start = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
  } else if (firstBracket !== -1) {
    start = firstBracket;
  }

  if (start !== -1) {
    return JSON.parse(trimmed.slice(start));
  }

  // Last resort: parse as-is
  return JSON.parse(trimmed);
}

export function createGenerateSectionTool(blueprint: Record<string, unknown>) {
  return tool({
    description:
      'Generate a complete rewrite or enhancement of a blueprint section based on user instructions. ' +
      'Use when the user wants to regenerate, rewrite, or significantly overhaul a section ' +
      '(not small field edits — use editBlueprint for those).',
    inputSchema: z.object({
      section: z
        .enum([
          'industryMarketOverview',
          'icpAnalysisValidation',
          'offerAnalysisViability',
          'competitorAnalysis',
          'crossAnalysisSynthesis',
        ])
        .describe('The blueprint section to regenerate'),
      instruction: z
        .string()
        .describe('What to change or improve about the section'),
      style: z
        .enum(['enhance', 'simplify', 'rewrite', 'expand'])
        .optional()
        .default('rewrite')
        .describe('How to approach the regeneration'),
    }),
    needsApproval: true,
    execute: async ({ section, instruction, style = 'rewrite' }) => {
      const currentContent = blueprint[section];
      const sectionLabel = SECTION_LABELS[section] ?? section;

      if (currentContent === undefined || currentContent === null) {
        return {
          section,
          instruction,
          style,
          error: `Section "${sectionLabel}" not found in blueprint`,
        };
      }

      const currentJson = JSON.stringify(currentContent, null, 2);

      const prompt =
        `You are rewriting a section of a strategic marketing blueprint.\n\n` +
        `Section: ${sectionLabel}\n\n` +
        `Current content:\n\`\`\`json\n${currentJson}\n\`\`\`\n\n` +
        `User instruction: ${instruction}\n\n` +
        `Style: ${style}\n\n` +
        `Output the complete rewritten section as valid JSON matching the original structure. ` +
        `Do not add fields that do not exist in the original. ` +
        `Respond with only the JSON object — no explanation, no markdown fences.`;

      try {
        const { text } = await generateText({
          model: anthropic(MODELS.CLAUDE_SONNET),
          prompt,
          temperature: 0.4,
          maxOutputTokens: 8192,
        });

        let parsedJson: unknown;
        try {
          parsedJson = extractJson(text);
        } catch {
          return {
            section,
            instruction,
            style,
            error: `Model returned content that could not be parsed as JSON: ${text.slice(0, 200)}`,
          };
        }

        const diffPreview = generateDiffPreview(currentContent, parsedJson);

        return {
          section,
          instruction,
          style,
          oldContent: currentContent,
          newContent: parsedJson,
          diffPreview,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          section,
          instruction,
          style,
          error: message,
        };
      }
    },
  });
}
