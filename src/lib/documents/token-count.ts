/**
 * Estimate token count from plain text.
 * Uses the ~4 chars/token heuristic for English text (Claude/GPT family).
 * Accurate enough for context budget enforcement — not billing.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
