/**
 * Golden-snapshot diff (Phase 0.1).
 *
 * Computes three quality signals per section/card:
 *   1. Field-level recall — fraction of top-level fields present in live run
 *      that are also present in the golden snapshot. Detects schema drift
 *      where a new pipeline version starts omitting fields.
 *   2. Citation count per card — number of _provenance or evidence entries.
 *      Intel cards target ≥ 3.
 *   3. Fabrication flags — runs the same sweepCard from Phase 0.3. Target 0.
 *
 * Returns a structured result rather than exiting; run-eval.ts aggregates
 * and prints pass/fail and non-zero exits the process if any URL hard-fails.
 */
import { sweepCard, type FabricationMatch } from '../src/intelligence/fabrication-sweep';

export interface SectionDiff {
  section: string;
  goldenFieldCount: number;
  liveFieldCount: number;
  recall: number;
  missingFields: string[];
  extraFields: string[];
  statusChange: null | {
    goldenStatus: string;
    liveStatus: string;
  };
}

export interface CardDiff {
  card: string;
  citationCount: number;
  fabricationMatches: FabricationMatch[];
}

export interface UrlEvalResult {
  slug: string;
  sectionDiffs: SectionDiff[];
  cardDiffs: CardDiff[];
  pass: boolean;
  failures: string[];
}

export interface EvalTargets {
  fieldRecall: number;
  minCitationsPerCard: number;
  maxFabricationMatches: number;
}

function topLevelFields(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>);
}

function extractStatus(value: unknown): string | null {
  if (value && typeof value === 'object' && 'status' in value) {
    const s = (value as { status: unknown }).status;
    return typeof s === 'string' ? s : null;
  }
  return null;
}

function countCitations(card: unknown): number {
  if (!card || typeof card !== 'object') return 0;
  const obj = card as Record<string, unknown>;
  let count = 0;

  // Shape A — _provenance array on the card
  if (Array.isArray(obj._provenance)) count += obj._provenance.length;

  // Shape B — evidence strings in card items. Walk 1 level deep only so we
  // don't double-count nested structures.
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item && typeof item === 'object' && 'evidence' in item) {
          const ev = (item as { evidence: unknown }).evidence;
          if (typeof ev === 'string' && ev.trim().length > 0) count += 1;
          else if (Array.isArray(ev)) count += ev.length;
        }
      }
    }
  }

  return count;
}

export function diffSection(
  section: string,
  golden: unknown,
  live: unknown,
): SectionDiff {
  const goldenFields = topLevelFields(golden);
  const liveFields = topLevelFields(live);
  const liveSet = new Set(liveFields);
  const goldenSet = new Set(goldenFields);

  const missing = goldenFields.filter((f) => !liveSet.has(f));
  const extra = liveFields.filter((f) => !goldenSet.has(f));

  const recall = goldenFields.length === 0
    ? 1
    : (goldenFields.length - missing.length) / goldenFields.length;

  const goldenStatus = extractStatus(golden);
  const liveStatus = extractStatus(live);
  const statusChange =
    goldenStatus && liveStatus && goldenStatus !== liveStatus
      ? { goldenStatus, liveStatus }
      : null;

  return {
    section,
    goldenFieldCount: goldenFields.length,
    liveFieldCount: liveFields.length,
    recall,
    missingFields: missing,
    extraFields: extra,
    statusChange,
  };
}

export function diffCard(card: string, live: unknown): CardDiff {
  const sweep = sweepCard(live, { allowGrowthClaims: false, userGrowthRate: null });
  return {
    card,
    citationCount: countCitations(live),
    fabricationMatches: sweep.matches,
  };
}

export function evaluateUrl(params: {
  slug: string;
  goldenSections: Record<string, unknown>;
  liveSections: Record<string, unknown>;
  liveCards: Record<string, unknown>;
  targets: EvalTargets;
}): UrlEvalResult {
  const { slug, goldenSections, liveSections, liveCards, targets } = params;

  const sectionDiffs: SectionDiff[] = [];
  const failures: string[] = [];

  for (const [section, goldenValue] of Object.entries(goldenSections)) {
    const liveValue = liveSections[section];
    if (liveValue === undefined) {
      failures.push(`section ${section} missing in live run`);
      continue;
    }
    const d = diffSection(section, goldenValue, liveValue);
    sectionDiffs.push(d);

    if (d.recall < targets.fieldRecall) {
      failures.push(
        `section ${section} recall ${(d.recall * 100).toFixed(1)}% < target ${(targets.fieldRecall * 100).toFixed(0)}%; missing: ${d.missingFields.join(',')}`,
      );
    }
    if (d.statusChange && d.statusChange.goldenStatus === 'complete' && d.statusChange.liveStatus !== 'complete') {
      failures.push(
        `section ${section} regressed from complete → ${d.statusChange.liveStatus}`,
      );
    }
  }

  const cardDiffs: CardDiff[] = [];
  for (const [cardKey, liveValue] of Object.entries(liveCards)) {
    const d = diffCard(cardKey, liveValue);
    cardDiffs.push(d);

    if (d.citationCount < targets.minCitationsPerCard) {
      failures.push(
        `card ${cardKey} has ${d.citationCount} citations < target ${targets.minCitationsPerCard}`,
      );
    }
    if (d.fabricationMatches.length > targets.maxFabricationMatches) {
      failures.push(
        `card ${cardKey} has ${d.fabricationMatches.length} fabrication match(es) > max ${targets.maxFabricationMatches}`,
      );
    }
  }

  return {
    slug,
    sectionDiffs,
    cardDiffs,
    pass: failures.length === 0,
    failures,
  };
}
