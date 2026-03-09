import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type { z } from 'zod';
import {
  JOURNEY_SECTION_DATA_SCHEMAS,
  type JourneySectionDataMap,
} from '@/lib/journey/schemas';

const EXTRACTION_MODEL = anthropic('claude-haiku-4-5-20251001');

/**
 * Extract structured data from section prose using Haiku 4.5.
 * Called after each section runner completes, before Supabase persistence.
 * Retries once on validation failure.
 */
export async function extractStructuredData<
  K extends keyof JourneySectionDataMap,
>(sectionId: K, prose: string): Promise<JourneySectionDataMap[K] | null> {
  const schema = JOURNEY_SECTION_DATA_SCHEMAS[sectionId];
  if (!schema) {
    console.warn(`[extract] No schema found for section: ${String(sectionId)}`);
    return null;
  }

  const systemPrompt = `You are a data extraction specialist. Given a research report, extract all structured data fields that match the provided schema. Be thorough — fill every field you can find evidence for in the text. If the text doesn't contain information for an optional field, omit it. Never fabricate data.`;

  const userPrompt = `Extract structured data from this research report:\n\n${prose}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await generateObject({
        model: EXTRACTION_MODEL,
        schema: schema as unknown as z.ZodSchema<JourneySectionDataMap[K]>,
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: 4096,
      });
      return result.object;
    } catch (error) {
      if (attempt === 0) {
        console.warn(
          `[extract] Attempt 1 failed for ${String(sectionId)}, retrying...`,
          error,
        );
        continue;
      }
      console.error(
        `[extract] Both attempts failed for ${String(sectionId)}:`,
        error,
      );
      return null;
    }
  }

  return null;
}
