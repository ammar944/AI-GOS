// Media Plan Generator
// Single-phase generateObject call with Claude Sonnet

import { generateObject } from 'ai';
import { anthropic, MODELS, GENERATION_SETTINGS, estimateCost } from '@/lib/ai/providers';
import { mediaPlanSchema } from './schemas';
import type { MediaPlanOutput, MediaPlanMetadata, MediaPlanGeneratorResult } from './types';

interface GenerateMediaPlanOptions {
  /** Progress callback for SSE events */
  onProgress?: (message: string, percentage: number) => void;
}

/**
 * Generate a media plan from a pre-built context string.
 * Uses a single generateObject call with Claude Sonnet.
 */
export async function generateMediaPlan(
  contextString: string,
  options: GenerateMediaPlanOptions = {},
): Promise<MediaPlanGeneratorResult> {
  const { onProgress } = options;
  const startTime = Date.now();

  try {
    onProgress?.('Preparing media plan generation...', 5);

    const systemPrompt = `You are a senior media buyer and paid advertising strategist with 10+ years of experience managing $1M+ monthly ad budgets across Meta, Google, LinkedIn, and TikTok for B2B SaaS and high-ticket service businesses.

Your task is to create a detailed, actionable media plan based on the strategic blueprint research provided. This plan will be executed by a media buying team.

CRITICAL RULES:
- The budget MUST respect the client's stated monthly ad budget. Do not exceed it.
- Platform budget percentages MUST sum to 100%.
- All monetary values are in USD.
- Be specific with targeting approaches — generic advice like "target decision-makers" is not acceptable.
- Campaign phases should be realistic and sequential (foundation → scale → optimize).
- KPI targets should be achievable based on industry benchmarks for the given platforms and verticals.
- CPL estimates should reflect real-world ranges for the industry and platforms.
- If the client has compliance restrictions, ensure the plan respects them.

FOCUS AREAS:
- Platform selection should be driven by where the ICP actually spends time (from research data).
- Budget allocation should weight toward platforms with highest probability of ROI.
- Phase 1 should always be testing/foundation with lower daily spend.
- Include retargeting in the strategy when applicable.`;

    onProgress?.('Generating media plan with Claude Sonnet...', 15);

    const result = await generateObject({
      model: anthropic(MODELS.CLAUDE_SONNET),
      schema: mediaPlanSchema,
      system: systemPrompt,
      prompt: `Generate a comprehensive media plan based on the following strategic research and client brief:\n\n${contextString}`,
      temperature: GENERATION_SETTINGS.synthesis.temperature,
      maxOutputTokens: GENERATION_SETTINGS.synthesis.maxTokens,
    });

    onProgress?.('Media plan generated, finalizing...', 90);

    // Calculate cost from usage
    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;
    const cost = estimateCost(MODELS.CLAUDE_SONNET, inputTokens, outputTokens);

    // Build metadata (not part of AI output)
    const metadata: MediaPlanMetadata = {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      processingTime: Date.now() - startTime,
      totalCost: cost,
      modelUsed: MODELS.CLAUDE_SONNET,
    };

    const mediaPlan: MediaPlanOutput = {
      ...result.object,
      metadata,
    };

    onProgress?.('Media plan complete!', 100);

    return {
      success: true,
      mediaPlan,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during media plan generation';
    console.error('[MediaPlanGenerator] Error:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
