// Post-processing utilities for the ICM script pipeline.
// Pure functions — no AI calls, no I/O. Safe to call after any creative stage.

/**
 * Strip em dashes (—) and en dashes (–) from a string.
 * Context-aware: spaced em dashes become ". " with capitalized next word,
 * unspaced become ", ". Preserves hyphens in compound words.
 */
function stripDashes(text: string): string {
  // Spaced em dash " — " or " – " → ". "
  let result = text.replace(/\s[—–]\s/g, '. ');

  // Capitalize the character after each ". " that we just inserted
  // (only where the original had an em dash, detected by looking for lowercase after ". ")
  result = result.replace(/\. ([a-z])/g, (_, ch) => `. ${ch.toUpperCase()}`);

  // Numeric range en dash "$500K–$5M" or "3–6 months" → "$500K to $5M" or "3 to 6 months"
  result = result.replace(/(\d[\d$%KkMmBb.,]*)[—–](\$?\d)/g, '$1 to $2');

  // Unspaced em/en dash "word—word" or "word–word" → "word, word"
  result = result.replace(/([a-zA-Z])([—–])([a-zA-Z])/g, '$1, $3');

  // Any remaining em/en dashes (e.g., at start/end of string)
  result = result.replace(/[—–]/g, ',');

  return result;
}

/**
 * Strip em/en dashes from all string fields and normalize confidenceScore.
 * Confidence prompt specifies 0–10 but models sometimes output 0–100; we clamp.
 */
export function sanitizeScript(script: Record<string, unknown>): Record<string, unknown> {
  const result = { ...script };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'string') {
      result[key] = stripDashes(value);
    } else if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      result[key] = value.map((v) => stripDashes(v as string));
    }
  }
  if (typeof result.confidenceScore === 'number') {
    let score = result.confidenceScore;
    if (!Number.isFinite(score)) {
      result.confidenceScore = 5;
    } else {
      if (score > 20) score = score / 10;
      else if (score > 10) score = 10;
      result.confidenceScore = Math.min(10, Math.max(0, Math.round(score * 10) / 10));
    }
  }
  return result;
}

/**
 * Dedup scripts within a batch by fingerprint (angle|type|platform|normalizedBody).
 * Returns unique scripts. Does NOT retry — caller handles retry if count is short.
 */
export function dedupScripts(
  scripts: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  const unique: Array<Record<string, unknown>> = [];
  for (const s of scripts) {
    const body = typeof s.body === 'string' ? s.body : '';
    const normalized = body.toLowerCase().replace(/\s+/g, ' ').slice(0, 50);
    const fp = `${s.angle}|${s.type}|${s.platform}|${normalized}`;
    if (!seen.has(fp)) {
      seen.add(fp);
      unique.push(s);
    }
  }
  return unique;
}

/**
 * Select a subset of items for a given awareness level.
 * Sliding window of size ceil(items.length / 2), offset by levelIndex. Wraps.
 * Returns all items if 0-1 available.
 */
export function getProofSubset<T>(allProofs: T[], levelIndex: number): T[] {
  if (allProofs.length <= 1) return allProofs;
  if (allProofs.length === 2) {
    return [allProofs[levelIndex % 2]];
  }
  const windowSize = Math.ceil(allProofs.length / 2);
  const offset = levelIndex % allProofs.length;
  const subset: T[] = [];
  for (let i = 0; i < windowSize; i++) {
    subset.push(allProofs[(offset + i) % allProofs.length]);
  }
  return subset;
}

/**
 * Detect which proof point headlines appear in a script's body+headline (normalized match).
 */
export function detectUsedProofPoints(
  scripts: Array<Record<string, unknown>>,
  proofHeadlines: string[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const script of scripts) {
    const body = (typeof script.body === 'string' ? script.body : '').toLowerCase();
    const headline = (typeof script.headline === 'string' ? script.headline : '').toLowerCase();
    const combined = `${body} ${headline}`;
    for (const ph of proofHeadlines) {
      if (combined.includes(ph.toLowerCase())) {
        counts.set(ph, (counts.get(ph) ?? 0) + 1);
      }
    }
  }
  return counts;
}
