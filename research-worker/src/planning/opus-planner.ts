// Planning pass: one Opus call to produce a strategic brief that guides
// downstream Sonnet-based generateObject() runners (media plan).
// Gated by ENABLE_OPUS_PLANNING env — returns '' when disabled.

import Anthropic from '@anthropic-ai/sdk';
import type { RunnerProgressReporter } from '../runner';
import { emitRunnerProgress } from '../runner';
import { MODELS } from '../models';

const OPUS_MODEL = MODELS.STRONG;
const MAX_TOKENS = 2000;
const TIMEOUT_MS = 45_000;

const MEDIA_PLAN_ADVISOR_SYSTEM = `You are a senior media strategist. Given research context about a company, produce a concise strategic media plan outline in under 500 words.

Focus on:
1. Top 3 recommended channels with rationale (why THIS channel for THIS business)
2. Budget allocation strategy (percentages and phasing logic, not dollar amounts)
3. Audience prioritization (which segments to hit first, second, third)
4. Key risks and mitigation (what could go wrong, what to test first)
5. Creative format recommendations per channel

Be opinionated. Don't hedge. This plan guides a detailed media plan generator.
Use ONLY the provided research data. Never fabricate metrics or pricing.`;

export async function getStrategicPlan(
  context: string,
  planType: 'media-plan',
  onProgress?: RunnerProgressReporter,
): Promise<string> {
  if (process.env.ENABLE_OPUS_PLANNING !== 'true') {
    return '';
  }

  const label = 'channel strategy';
  console.log(`[opus-planner] Starting ${planType} planning pass (Opus ${OPUS_MODEL})`);
  await emitRunnerProgress(onProgress, 'analysis', `planning ${label} with strategic advisor`);

  const client = new Anthropic({ maxRetries: 0 });
  const systemPrompt = MEDIA_PLAN_ADVISOR_SYSTEM;

  try {
    const response = await Promise.race([
      client.messages.create({
        model: OPUS_MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: context }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Opus planning pass timed out')), TIMEOUT_MS),
      ),
    ]);

    const textBlock = response.content.find((b) => b.type === 'text');
    const plan = textBlock && 'text' in textBlock ? textBlock.text : '';

    if (plan) {
      console.log(`[opus-planner] ${planType} plan received (${plan.length} chars)`);
      await emitRunnerProgress(onProgress, 'analysis', `${label} plan received — guiding generation`);
    } else {
      console.log(`[opus-planner] ${planType} plan was empty`);
    }

    return plan;
  } catch (err) {
    console.warn(
      `[opus-planner] ${planType} planning pass failed:`,
      err instanceof Error ? err.message : String(err),
    );
    // Graceful degradation — continue without planning pass
    return '';
  }
}
