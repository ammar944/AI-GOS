import Anthropic from '@anthropic-ai/sdk';

export function createClient() {
  return new Anthropic({ maxRetries: 0 });
}

export async function runWithBackoff(
  runFn: () => Promise<Anthropic.Beta.BetaMessage>,
  label: string,
): Promise<Anthropic.Beta.BetaMessage> {
  try {
    return await runFn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isRateLimit = msg.includes('rate limit') || msg.includes('rate_limit') || (err as { status?: number }).status === 429;
    if (isRateLimit) {
      console.warn(`[${label}] Rate limited — waiting 65s before retry`);
      await new Promise((resolve) => setTimeout(resolve, 65_000));
      return await runFn();
    }
    throw err;
  }
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim();

  // 1. Try full response as-is
  try { return JSON.parse(trimmed); } catch {}

  // 2. Try fenced code block
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) { try { return JSON.parse(fenced[1].trim()); } catch {} }

  // 3. Extract first { to last } substring
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    const candidate = trimmed.slice(first, last + 1);
    try { return JSON.parse(candidate); } catch {}

    // 4. Fix common Haiku JSON issues: trailing commas before } or ]
    const fixed = candidate
      .replace(/,\s*([\]}])/g, '$1');
    try { return JSON.parse(fixed); } catch {}
  }

  // 5. Fallback: return raw text wrapped in an object so callers always get an object
  const RAW_LIMIT = 4000;
  const raw = trimmed.length > RAW_LIMIT ? trimmed.slice(0, RAW_LIMIT) + '...' : trimmed;
  return { raw };
}
