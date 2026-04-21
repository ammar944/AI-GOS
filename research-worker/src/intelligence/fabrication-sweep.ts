/**
 * Fabrication detector for intelligence card output (Phase 0.3).
 *
 * Mirrors the deterministic-layer sweeper at src/lib/media-plan/validation.ts
 * (sweepFabricatedClaims). Worker cannot import from src/lib/, so patterns are
 * duplicated here. If you update one list, update both — or better, bump the
 * shared pattern version in the plan's follow-up and consolidate.
 *
 * The worker-side sweeper differs from the media-plan one in posture:
 *   media-plan: scrub the offending phrase, keep the surrounding text
 *   cards:      gate the whole card — intel cards must cite evidence or stay silent
 *
 * Rationale: media plan is narrative and has headroom for a single bad sentence;
 * intel cards are short, evidence-backed assertions — one fabricated growth
 * number invalidates the whole card's credibility.
 */

export interface FabricationMatch {
  /** Pattern name that matched (yoy_growth, scale_to_arr, grow_from_to, reach_arr). */
  pattern: string;
  /** The exact text that matched. */
  match: string;
  /** Path within the card data where the string lives (e.g., "opportunities[2].size"). */
  path: string;
}

export interface FabricationSweepResult {
  /** True if at least one un-cited fabrication pattern was detected. */
  fabricated: boolean;
  /** All matches found, including ones that were allowed through via citation. */
  matches: FabricationMatch[];
  /**
   * Subset of matches considered fabrications (not covered by a benchmark
   * citation and, if gated, not matching the user's reported rate).
   */
  fabricatedMatches: FabricationMatch[];
}

interface SweepPattern {
  name: string;
  re: RegExp;
  /**
   * Gated patterns (e.g., YoY %) are allowed when the user actually provided
   * a baseline growth rate AND the sentence cites that number.
   */
  gated: boolean;
}

const FABRICATION_PATTERNS: readonly SweepPattern[] = [
  {
    name: 'yoy_growth',
    re: /\d+\s*%\s*(?:YoY|year[- ]over[- ]year|annual(?:ized)?\s*growth)/gi,
    gated: true,
  },
  {
    name: 'scale_to_arr',
    re: /scale\s+to\s+\$[\d.,]+\s*[MBK]?\s*(?:ARR|MRR|in revenue)?(?:\s+(?:in|within|over)\s+\d+\s*(?:months?|years?))?/gi,
    gated: false,
  },
  {
    name: 'grow_from_to',
    re: /grow(?:ing)?\s+(?:from|by)\s+\$[\d.,]+\s*[MBK]?(?:\s+to\s+\$[\d.,]+\s*[MBK]?)?/gi,
    gated: false,
  },
  {
    name: 'reach_arr',
    re: /reach\s+\$[\d.,]+\s*[MBK]?\s+ARR/gi,
    gated: false,
  },
];

/**
 * PLG-context-gated fabrication patterns (added 2026-04-21, Mahdy round 3).
 *
 * These patterns fire ONLY when the surrounding context indicates a PLG /
 * free-trial business. Applying them globally would false-positive on SLG
 * outputs where CAC/CPL/lead vocabulary is appropriate. The caller in
 * sweepCard's PLG-aware variant passes `plgContext: true` to enable these.
 *
 * See ltv-cac-viability.md for the rule:
 *   1. PLG offers must never ship numeric CAC / CPL targets.
 *   2. PLG offers must use "free sign-ups" / "trial starts" vocabulary,
 *      never "leads" / "CPL" / "MQL" / "SQL" / "lead-gen".
 */
const PLG_GATED_PATTERNS: readonly SweepPattern[] = [
  {
    // Catches "$600 CAC", "target CAC of $200", "$50 CPL", etc.
    name: 'plg_cac_cpl_numeric',
    re: /\$\s?\d{2,}\s?(?:CAC|CPL|customer\s+acquisition\s+cost|cost\s+per\s+lead)\b/gi,
    gated: false,
  },
  {
    // Catches "leads", "lead-gen", "MQL", "SQL" on a PLG offer.
    name: 'plg_lead_vocabulary',
    re: /\b(?:leads?|lead[-\s]gen(?:eration)?|MQL|SQL|lead[-\s]to[-\s](?:MQL|SQL|customer))\b/gi,
    gated: false,
  },
];

/**
 * Indicators that a sentence cites an external benchmark / source. A match
 * inside such a sentence is NOT counted as fabrication.
 */
const BENCHMARK_CITATION_RE =
  /per\s+\w+|benchmark|industry\s+(?:average|standard)|typical(?:ly)?|according\s+to|gartner|openview|forrester|mckinsey|statista/i;

/**
 * Return the sentence (coarsely delimited by `. `, `! `, `? `) containing
 * the given offset in `source`.
 */
function sentenceContainingMatch(offset: number, source: string): string {
  const start = Math.max(
    source.lastIndexOf('. ', offset - 1) + 1,
    source.lastIndexOf('! ', offset - 1) + 1,
    source.lastIndexOf('? ', offset - 1) + 1,
    0,
  );
  const endCandidates = [
    source.indexOf('. ', offset),
    source.indexOf('! ', offset),
    source.indexOf('? ', offset),
    source.length,
  ].filter((i) => i >= 0);
  const end = Math.min(...endCandidates);
  return source.slice(start, end);
}

/**
 * Sweep a single string for fabrication patterns.
 *
 * `plgContext` enables the PLG-gated pattern set (CAC/CPL numerics and
 * lead vocabulary) which would false-positive on SLG outputs. Caller
 * provides this based on context metadata (`[businessModelType:plg]` or
 * free-trial signals).
 */
export function sweepString(
  text: string,
  path: string,
  allowGrowthClaims: boolean,
  userGrowthRate: number | null,
  plgContext = false,
): FabricationMatch[] {
  if (!text) return [];
  const matches: FabricationMatch[] = [];
  const userRateStr = userGrowthRate !== null ? String(Math.round(userGrowthRate)) : null;

  const activePatterns = plgContext
    ? [...FABRICATION_PATTERNS, ...PLG_GATED_PATTERNS]
    : FABRICATION_PATTERNS;

  for (const pattern of activePatterns) {
    pattern.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.re.exec(text)) !== null) {
      const sentence = sentenceContainingMatch(m.index, text);
      if (BENCHMARK_CITATION_RE.test(sentence)) {
        continue; // cited — pass through
      }
      if (pattern.gated && allowGrowthClaims && userRateStr !== null) {
        const numberMatch = m[0].match(/(\d+)\s*%/);
        if (numberMatch && numberMatch[1] === userRateStr) {
          continue; // matches user-reported rate
        }
      }
      matches.push({ pattern: pattern.name, match: m[0], path });
    }
  }
  return matches;
}

/**
 * Recursively walk a card's data object and collect fabrication matches from
 * every string field.
 *
 * `plgContext` (default false) enables PLG-gated patterns. The media-plan
 * runner should pass true when `[businessModelType:plg]` or a free-trial
 * signal is in context; intel cards on SLG businesses should pass false.
 */
export function sweepCard(
  card: unknown,
  options: {
    allowGrowthClaims: boolean;
    userGrowthRate: number | null;
    plgContext?: boolean;
  },
): FabricationSweepResult {
  const all: FabricationMatch[] = [];
  const plgContext = options.plgContext ?? false;

  const walk = (node: unknown, path: string): void => {
    if (node === null || node === undefined) return;
    if (typeof node === 'string') {
      all.push(
        ...sweepString(
          node,
          path,
          options.allowGrowthClaims,
          options.userGrowthRate,
          plgContext,
        ),
      );
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, idx) => walk(item, `${path}[${idx}]`));
      return;
    }
    if (typeof node === 'object') {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        walk(value, path ? `${path}.${key}` : key);
      }
    }
  };

  walk(card, '');

  return {
    fabricated: all.length > 0,
    matches: all,
    fabricatedMatches: all,
  };
}
