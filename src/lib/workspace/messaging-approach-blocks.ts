/**
 * Heuristic split of dense PAS/BAB (or similar) messaging strings into scannable blocks.
 * No worker/schema changes — display-only.
 */
export interface MessagingBlock {
  /** Optional short label extracted from the segment */
  heading?: string;
  body: string;
}

export function messagingApproachToBlocks(text: string): MessagingBlock[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.includes('\n\n')) {
    return trimmed
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((body) => normalizeBlock(body));
  }

  const frameworkSplit = trimmed.split(
    /\s+(?=(?:Agitate|Solution|After|Bridge)\s*[–—])/i,
  );
  if (frameworkSplit.length > 1) {
    return frameworkSplit.map((segment) => normalizeBlock(segment.trim())).filter((b) => b.body);
  }

  const pasBab = trimmed.match(/^(PAS|BAB)\s*:\s*(.+)$/is);
  if (pasBab) {
    const inner = pasBab[2].trim();
    const innerPieces = inner.split(/\s+(?=(?:Agitate|Solution|After|Bridge)\s*[–—])/i);
    if (innerPieces.length > 1) {
      return innerPieces.map((p) => normalizeBlock(p.trim())).filter((b) => b.body);
    }
  }

  return [normalizeBlock(trimmed)];
}

function normalizeBlock(segment: string): MessagingBlock {
  const labelMatch = segment.match(
    /^((?:PAS|BAB|Pain|Agitate|Solution|Before|After|Bridge)(?:\s+\w+)?)\s*[–—:]\s*(.+)$/is,
  );
  if (labelMatch && labelMatch[2]) {
    return {
      heading: labelMatch[1].replace(/[–—:\s]+$/u, '').trim(),
      body: labelMatch[2].trim(),
    };
  }
  return { body: segment };
}
