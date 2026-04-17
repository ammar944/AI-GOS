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
import { runWithBackoff } from '../../runner';
import { maybeCachedSystem } from '../../utils/prompt-cache';

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

  const response = await runWithBackoff(
    () => client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      system: maybeCachedSystem(params.system) as Parameters<typeof client.messages.create>[0]['system'],
      messages: [{ role: 'user', content: params.user }],
    }),
    'callCardLLM',
  );

  if (response.stop_reason === 'max_tokens') {
    throw new Error('card LLM: response truncated at max_tokens');
  }

  const textBlock = response.content.findLast((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('card LLM: no text block in response');
  }
  return textBlock.text;
}

/**
 * Extract a JSON object from a model text response. Handles:
 *   - bare JSON: `{"a":1}`
 *   - fenced JSON: ```json\n{...}\n```
 *   - leading/trailing prose around the braces
 * Returns null when no object can be parsed.
 */
export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace < 0) return null;
  try {
    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

/**
 * Parse extracted JSON against a Zod schema. Throws on parse failure
 * so the dispatcher surfaces the error as a card failure.
 */
export function parseCardOutput<S extends ZodTypeAny>(
  schema: S,
  raw: unknown,
): z.infer<S> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const path = firstIssue?.path?.join('.') ?? '(root)';
    throw new Error(
      `card schema mismatch at ${path}: ${firstIssue?.message ?? 'unknown'}`,
    );
  }
  return result.data;
}
