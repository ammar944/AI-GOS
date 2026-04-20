/**
 * Anthropic prompt-caching helper (Phase 1.1).
 *
 * When RESEARCH_PROMPT_CACHE=true and the system prompt is large enough to
 * cross the cache min-token threshold (~1024 chars ≈ 250 tokens is our rough
 * gate), wrap the system string as a cached block. Otherwise pass-through as
 * a plain string.
 *
 * Cache TTL defaults to '1h' for system prompts (reused across primary/
 * repair/rescue attempts and across runners within one pipeline). Use '5m'
 * for context blocks that turn over faster.
 *
 * Quality-neutral: same content, same tokens received by the model.
 * Telemetry tracks cache_read_input_tokens / cache_creation_input_tokens
 * (already exposed by buildRunnerTelemetry in ../telemetry.ts).
 */

export type EphemeralTtl = '5m' | '1h';

export interface CachedTextBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral'; ttl?: EphemeralTtl };
}

const MIN_CACHE_CHARS = 1024;

/**
 * Return the system argument as-is (string) unless caching is enabled AND the
 * prompt is long enough. When enabled, returns a single-element block array
 * with cache_control attached.
 */
export function maybeCachedSystem(
  system: string,
  ttl: EphemeralTtl = '1h',
): string | CachedTextBlock[] {
  // Cache is ON by default. Set RESEARCH_PROMPT_CACHE=false to disable.
  // Previously required opt-in via `=true`, but production never had the env
  // set, so cacheReadTokens=0 across every run (cost + latency waste).
  if (process.env.RESEARCH_PROMPT_CACHE === 'false') return system;
  if (!system || system.length < MIN_CACHE_CHARS) return system;
  return [
    {
      type: 'text',
      text: system,
      cache_control: { type: 'ephemeral', ttl },
    },
  ];
}

/**
 * For callers that always want block form (e.g., when they already have other
 * structured system blocks). The block gets cache_control when the flag is on.
 */
export function systemBlock(text: string, ttl: EphemeralTtl = '1h'): CachedTextBlock {
  const block: CachedTextBlock = { type: 'text', text };
  // Cache is ON by default. Set RESEARCH_PROMPT_CACHE=false to disable.
  if (process.env.RESEARCH_PROMPT_CACHE !== 'false' && text.length >= MIN_CACHE_CHARS) {
    block.cache_control = { type: 'ephemeral', ttl };
  }
  return block;
}

/**
 * AI SDK v6 variant — returns a `{ role: 'system', ... }` message object
 * shaped for `generateObject({ ..., messages: [...] })` (or `streamObject` /
 * `generateText` / `streamText`). Marks the system prompt for Anthropic
 * prompt caching via `providerOptions.anthropic.cacheControl` when the env
 * flag permits and the prompt is large enough to cross the cache threshold.
 *
 * Use this for runners that call the Vercel AI SDK (e.g., media-plan,
 * synthesize). For runners that call the native Anthropic SDK tool runner
 * (icp, offer), use `maybeCachedSystem` instead — it returns native-SDK
 * `cache_control` blocks rather than AI-SDK `providerOptions`.
 */
export interface AiSdkCachedSystemMessage {
  role: 'system';
  content: string;
  providerOptions?: {
    anthropic: { cacheControl: { type: 'ephemeral'; ttl?: EphemeralTtl } };
  };
}

export function cachedSystemForAiSdk(
  system: string,
  ttl: EphemeralTtl = '1h',
): AiSdkCachedSystemMessage {
  const msg: AiSdkCachedSystemMessage = { role: 'system', content: system };
  if (process.env.RESEARCH_PROMPT_CACHE !== 'false' && system.length >= MIN_CACHE_CHARS) {
    msg.providerOptions = { anthropic: { cacheControl: { type: 'ephemeral', ttl } } };
  }
  return msg;
}
