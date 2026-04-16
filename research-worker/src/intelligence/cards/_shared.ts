/**
 * Shared helpers for card synthesizers.
 *
 * Every card synthesizer follows the same shape:
 *   1. Build a card-specific system+user prompt including the evidence pack.
 *   2. Call Anthropic with the card's model (Haiku or Sonnet).
 *   3. Extract JSON from the response.
 *   4. Zod-parse against the card schema.
 *   5. Return the parsed draft; dispatcher runs the validator.
 *
 * Errors bubble up. Dispatcher wraps each card call in try/catch.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { ZodTypeAny, z } from 'zod';

export interface CardLLMParams {
  model: string;
  maxTokens: number;
  system: string;
  user: string;
  client?: Anthropic;
}

/**
 * Call Anthropic and return the first text block.
 * Throws on network error, empty response, or non-text final block.
 */
export async function callCardLLM(params: CardLLMParams): Promise<string> {
  const client =
    params.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60_000 });

  const response = await client.messages.create({
    model: params.model,
    max_tokens: params.maxTokens,
    system: params.system,
    messages: [{ role: 'user', content: params.user }],
  });

  const textBlock = response.content.findLast((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('card LLM: no text block in response');
  }
  return textBlock.text;
}
