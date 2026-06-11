import {
  collectUnsupportedNumericTokens,
  isCleanTokenBoundary,
  type UnsupportedNumericToken,
} from "./evidence-support";
import type { VerificationReport } from "./types";

// W6 creative truth gate (Manus-grade program): two deterministic strips that
// close the fabrication frontier the numeric redactor does not reach.
//
// 1) dropConfessedExemplarQuotes — a quote card whose own fields confess
//    non-evidence ("fictional exemplar", "illustrative pattern") is dropped
//    from its array instead of shipping with the confession attached. In the
//    paid-media plan, where row counts are schema-pinned, the confessed row is
//    gap-relabeled in place rather than dropped.
// 2) stripUngroundedNamedEntityMetrics — paid-media creative copy may not
//    attach an unsupported metric to a named person or company (legal exposure
//    in deployable ad copy). The poisoned sentence is removed, the rest of the
//    copy survives, and the row self-flags grounding UNVERIFIED.
//
// Both run at the same post-validation choke point as the numeric redactor
// (annotateEvidenceSupportReview): the artifact still commits, the badge and
// verifierSummary carry the record. ADR-0011 posture — strip the lie, never
// hard-fail the section.

export interface DroppedConfessedExemplar {
  field: string;
  confession: string;
}

export interface StrippedNamedEntityMetric {
  field: string;
  removedSentence: string;
  values: string[];
}

interface CreativeTruthGateResult<TStripped> {
  body: Record<string, unknown>;
  stripped: TStripped[];
}

// "pattern" alone is normal analyst language ("recurring pattern across
// reviews"); only confession PHRASES trip the gate.
const confessionPattern =
  /\bfictional\b|\bexemplar pattern\b|\billustrative (?:example|pattern|quote)\b|\bhypothetical (?:example|quote|review|customer)\b|\bnot (?:a )?real (?:quote|review|buyer|customer)\b|\binvented (?:quote|example|testimonial)\b/i;

// A record is a quote card when it carries verbatim buyer/competitor language
// in one of these fields — the surfaces where a confessed exemplar can ship.
const quoteCardFieldNames = new Set([
  "verbatimText",
  "verbatimQuote",
  "quote",
  "evidenceQuote",
  "objectionText",
  "reasonToLeave",
]);

// Paid-media creative copy fields: the surfaces that become deployable ad
// language. Numbers here are claims, never derived budget math.
const paidMediaCreativeFieldNames = new Set([
  "hook",
  "description",
  "complaint",
  "howWeLeverage",
  "detail",
]);

const namedEntityPattern =
  /\b[A-Z][a-z]+ [A-Z][a-z]+\b|\b[A-Z][A-Za-z]+['']s\b|\([A-Z][A-Za-z]+\)/;

const removedCreativeCopyGapLine =
  "evidence gap: copy removed — a metric attached to a named person or company could not be traced to research evidence";

const confessedComplaintGapLine =
  "evidence gap: fabricated exemplar removed — no real review evidence found";

const confessedLeverageGapLine =
  "evidence gap: leverage move depended on the removed exemplar";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isQuoteCard(record: Record<string, unknown>): boolean {
  return Object.keys(record).some((key) => quoteCardFieldNames.has(key));
}

function findConfession(record: Record<string, unknown>): string | null {
  for (const value of Object.values(record)) {
    if (typeof value !== "string") {
      continue;
    }

    const match = value.match(confessionPattern);

    if (match !== null) {
      return value;
    }
  }

  return null;
}

function relabelConfessedReviewInsightRow(
  record: Record<string, unknown>,
): void {
  if (typeof record.complaint === "string") {
    record.complaint = confessedComplaintGapLine;
  }

  if (typeof record.howWeLeverage === "string") {
    record.howWeLeverage = confessedLeverageGapLine;
  }

  if (typeof record.grounding === "string") {
    record.grounding = "UNVERIFIED";
  }
}

function walkForConfessedExemplars({
  dropped,
  path,
  relabelOnly,
  value,
}: {
  dropped: DroppedConfessedExemplar[];
  path: string;
  relabelOnly: boolean;
  value: unknown;
}): unknown {
  if (Array.isArray(value)) {
    const kept: unknown[] = [];

    value.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;

      if (isRecord(item) && isQuoteCard(item)) {
        const confession = findConfession(item);

        if (confession !== null) {
          dropped.push({ confession, field: itemPath });

          if (relabelOnly) {
            relabelConfessedReviewInsightRow(item);
            kept.push(item);
          }

          return;
        }
      }

      kept.push(
        walkForConfessedExemplars({
          dropped,
          path: itemPath,
          relabelOnly,
          value: item,
        }),
      );
    });

    return kept;
  }

  if (!isRecord(value)) {
    return value;
  }

  for (const [key, childValue] of Object.entries(value)) {
    value[key] = walkForConfessedExemplars({
      dropped,
      path: `${path}.${key}`,
      relabelOnly,
      value: childValue,
    });
  }

  return value;
}

export function dropConfessedExemplarQuotes({
  body,
  sectionId,
}: {
  body: Record<string, unknown>;
  sectionId: string;
}): CreativeTruthGateResult<DroppedConfessedExemplar> {
  const cloned = structuredClone(body);
  const dropped: DroppedConfessedExemplar[] = [];

  walkForConfessedExemplars({
    dropped,
    path: "body",
    // Paid-media row counts are schema-pinned (exactly 3 review-insight rows):
    // relabel in place instead of dropping.
    relabelOnly: sectionId === "positioningPaidMediaPlan",
    value: cloned,
  });

  return dropped.length === 0 ? { body, stripped: [] } : { body: cloned, stripped: dropped };
}

function sentenceContainsToken({
  sentence,
  token,
}: {
  sentence: string;
  token: UnsupportedNumericToken;
}): boolean {
  let offset = sentence.indexOf(token.value);

  while (offset !== -1) {
    if (
      isCleanTokenBoundary({
        matchLength: token.value.length,
        offset,
        source: sentence,
      })
    ) {
      return true;
    }

    offset = sentence.indexOf(token.value, offset + 1);
  }

  return false;
}

function stripPoisonedSentences({
  field,
  stripped,
  tokens,
  value,
}: {
  field: string;
  stripped: StrippedNamedEntityMetric[];
  tokens: readonly UnsupportedNumericToken[];
  value: string;
}): string {
  const sentences = value.split(/(?<=[.!?])\s+/);
  const kept: string[] = [];

  for (const sentence of sentences) {
    const matchedValues = tokens
      .filter((token) => sentenceContainsToken({ sentence, token }))
      .map((token) => token.value);

    if (matchedValues.length > 0 && namedEntityPattern.test(sentence)) {
      stripped.push({
        field,
        removedSentence: sentence,
        values: matchedValues,
      });
      continue;
    }

    kept.push(sentence);
  }

  const next = kept.join(" ").trim();

  return next.length === 0 ? removedCreativeCopyGapLine : next;
}

function walkForNamedEntityMetrics({
  path,
  stripped,
  tokens,
  value,
}: {
  path: string;
  stripped: StrippedNamedEntityMetric[];
  tokens: readonly UnsupportedNumericToken[];
  value: unknown;
}): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkForNamedEntityMetrics({
        path: `${path}[${index}]`,
        stripped,
        tokens,
        value: item,
      });
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  let touchedCreativeField = false;

  for (const [key, childValue] of Object.entries(value)) {
    const childPath = `${path}.${key}`;

    if (
      typeof childValue === "string" &&
      paidMediaCreativeFieldNames.has(key)
    ) {
      const next = stripPoisonedSentences({
        field: childPath,
        stripped,
        tokens,
        value: childValue,
      });

      if (next !== childValue) {
        value[key] = next;
        touchedCreativeField = true;
      }

      continue;
    }

    walkForNamedEntityMetrics({
      path: childPath,
      stripped,
      tokens,
      value: childValue,
    });
  }

  if (touchedCreativeField && typeof value.grounding === "string") {
    value.grounding = "UNVERIFIED";
  }
}

export function stripUngroundedNamedEntityMetrics({
  body,
  verification,
}: {
  body: Record<string, unknown>;
  verification: VerificationReport;
}): CreativeTruthGateResult<StrippedNamedEntityMetric> {
  const tokens = collectUnsupportedNumericTokens(verification);

  if (tokens.length === 0) {
    return { body, stripped: [] };
  }

  const cloned = structuredClone(body);
  const stripped: StrippedNamedEntityMetric[] = [];

  walkForNamedEntityMetrics({
    path: "body",
    stripped,
    tokens,
    value: cloned,
  });

  return stripped.length === 0
    ? { body, stripped: [] }
    : { body: cloned, stripped };
}
