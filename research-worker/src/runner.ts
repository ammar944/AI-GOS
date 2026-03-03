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
  try { return JSON.parse(trimmed); } catch {}
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) { try { return JSON.parse(fenced[1].trim()); } catch {} }
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) { return JSON.parse(trimmed.slice(first, last + 1)); }
  throw new Error('No parseable JSON found');
}
