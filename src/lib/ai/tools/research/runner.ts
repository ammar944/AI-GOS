// Shared runner for research sub-agents
// Handles rate-limit-aware execution with backoff

import Anthropic from '@anthropic-ai/sdk';
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';

// Disable SDK retries — we handle backoff ourselves
export function createResearchClient() {
  return new Anthropic({ maxRetries: 0 });
}

// Run a sub-agent with rate-limit-aware retry (single retry after 65s)
export async function runWithBackoff(
  runFn: () => Promise<Anthropic.Beta.BetaMessage>,
  label: string,
): Promise<Anthropic.Beta.BetaMessage> {
  try {
    return await runFn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isRateLimit =
      msg.includes('rate limit') ||
      msg.includes('rate_limit') ||
      (err as { status?: number }).status === 429;
    if (isRateLimit) {
      console.warn(`[${label}] Rate limited — waiting 65s before retry`);
      await new Promise((resolve) => setTimeout(resolve, 65_000));
      return await runFn(); // one retry after backoff
    }
    throw err;
  }
}

export type { BetaMessageParam };
