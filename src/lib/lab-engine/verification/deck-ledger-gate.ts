// Deterministic, BLOCKING deck-vs-ledger liar-catcher (P0.3).
//
// Standalone, READ-ONLY, DECK-LEVEL gate. Fundamentally different shape from
// provenance-gate.ts (which is advisory, per-section, never hard-fails per
// ADR-0011): this module walks a committed deck bundle, dereferences every
// GROUNDED cell's evidence-pack ref into the upstream section body it claims to
// be composed from, then asserts a real ResearchFact in the ledger backs that
// (sourceUrl, claimed-token) pair. ANY miss BLOCKS.
//
// Cells that are explicit honest gaps (evidencePack.status === "gap", empty
// refs, empty upstream arrays / personas:[]) are SKIPPED — never flagged. The
// gate punishes ASSERTED grounding that the ledger cannot prove, not honest
// absence.
//
// This module never mutates anything and never throws on data shape: a
// malformed cell simply yields a violation or is skipped.

import { isCleanTokenBoundary } from "@/lib/lab-engine/agents/verification/evidence-support";
import { isHttpUrl } from "@/lib/lab-engine/artifacts/schemas/buyer-icp";
import type { ResearchFact } from "@/lib/lab-engine/evidence/research-fact";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

// A committed deck bundle, keyed by sectionId. Each value is either a full
// ArtifactEnvelope (carrying a `body`) or a raw body object — mirrors
// resolveCommittedBody in paid-media-evidence-pack.ts.
export type DeckBundle = Record<string, unknown>;

// One evidence-pack ref as authored by withPaidMediaEvidencePack — mirrors
// PaidMediaEvidenceRef in paid-media-plan.ts.
export interface DeckEvidenceRef {
  sourceSection: string;
  evidenceKind: string;
  locator: string;
  excerpt: string;
}

export interface DeckEvidencePack {
  status: "grounded" | "gap";
  refs: DeckEvidenceRef[];
  note?: string;
}

// A grounded deck cell, identified for violation reporting.
export interface GroundedCell {
  sectionId: string;
  rowKind: string;
  rowIndex: number;
  evidencePack: DeckEvidencePack;
}

// A resolved source from one ref's locator: either a real (sourceUrl, quote)
// pulled from the upstream body, or an explicit unresolvable marker.
export type ResolvedCellSource =
  | { sourceUrl: string; quote: string; locator: string }
  | { locator: string; unresolvable: true };

export type LiarViolationReason =
  | "locator-unresolvable"
  | "no-ledger-fact-for-source"
  | "token-not-in-ledger-quote";

export interface LiarViolation {
  cell: { sectionId: string; rowKind: string; rowIndex: number };
  reason: LiarViolationReason;
  sourceUrl?: string;
}

export interface LiarVerdict {
  blocked: boolean;
  violations: LiarViolation[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Resolve a sectionId in the deck bundle to its body. The value may be a full
// ArtifactEnvelope (with `body`) or a raw body object.
function resolveSectionBody(
  deck: DeckBundle,
  sectionId: string,
): Record<string, unknown> | undefined {
  const entry = deck[sectionId];
  if (!isRecord(entry)) {
    return undefined;
  }
  const body = "body" in entry ? entry.body : entry;
  return isRecord(body) ? body : undefined;
}

// Walk a locator like "body.painLanguage.quotes[0]" or "body.forces[2]" into a
// section body. Returns the addressed record, or undefined if any segment is
// missing / out of range. The leading "body." segment is the body itself.
function dereferenceLocator(
  body: Record<string, unknown>,
  locator: string,
): Record<string, unknown> | undefined {
  const segments = locator.split(".");
  if (segments.length === 0 || segments[0] !== "body") {
    return undefined;
  }

  let current: unknown = body;
  for (const segment of segments.slice(1)) {
    const match = /^([A-Za-z0-9_]+)(?:\[(\d+)\])?$/.exec(segment);
    if (match === null) {
      return undefined;
    }
    const key = match[1];
    const indexRaw = match[2];

    if (!isRecord(current)) {
      return undefined;
    }
    let next: unknown = current[key];

    if (indexRaw !== undefined) {
      if (!Array.isArray(next)) {
        return undefined;
      }
      next = next[Number(indexRaw)];
    }

    current = next;
  }

  return isRecord(current) ? current : undefined;
}

// The text fields, in priority order, that a resolved upstream row exposes as
// its verbatim quote. Mirrors the quote-bearing fields across the typed
// section schemas (VoC verbatimText, market-category force evidence, etc.).
const QUOTE_FIELDS = [
  "verbatimText",
  "evidenceQuote",
  "evidence",
  "objectionText",
  "reasonToLeave",
  "value",
  "name",
] as const;

function extractQuote(row: Record<string, unknown>): string | undefined {
  for (const field of QUOTE_FIELDS) {
    const value = row[field];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

function extractSourceUrl(row: Record<string, unknown>): string | undefined {
  const value = row.sourceUrl;
  if (typeof value === "string" && isHttpUrl(value)) {
    return value;
  }
  return undefined;
}

// The claimed token of a resolved source: the first whitespace-delimited token
// of the quote (always a substring of the quote by construction — mirrors
// deriveTokenFromText in research-fact.ts). A ledger fact at the same URL must
// literally contain this token at a clean boundary for the cell to be honest.
function claimTokenFromQuote(quote: string): string | null {
  const trimmed = quote.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const first = trimmed.split(/\s+/u, 1)[0];
  return first !== undefined && first.length > 0 ? first : trimmed;
}

// Clean-boundary substring containment, reusing isCleanTokenBoundary so an
// embedded match ("Cox" inside "Coxwell") never counts as present.
function quoteContainsTokenCleanly(quote: string, token: string): boolean {
  if (token.length === 0 || !quote.includes(token)) {
    return false;
  }
  let from = 0;
  for (;;) {
    const offset = quote.indexOf(token, from);
    if (offset === -1) {
      return false;
    }
    if (
      isCleanTokenBoundary({
        matchLength: token.length,
        offset,
        source: quote,
      })
    ) {
      return true;
    }
    from = offset + 1;
  }
}

// ---------------------------------------------------------------------------
// Resolver (unit-tested standalone)
// ---------------------------------------------------------------------------

/**
 * Dereference every evidence-pack ref of a grounded cell into the upstream
 * section body it cites, pulling the real (sourceUrl, quote) pair. A ref whose
 * locator does not resolve to an upstream http sourceUrl is itself a violation:
 * it yields an explicit `{ locator, unresolvable: true }` marker.
 */
export function resolveCellSourceUrls(
  cell: GroundedCell,
  deck: DeckBundle,
): ResolvedCellSource[] {
  const out: ResolvedCellSource[] = [];

  for (const ref of cell.evidencePack.refs) {
    const body = resolveSectionBody(deck, ref.sourceSection);
    const row = body ? dereferenceLocator(body, ref.locator) : undefined;
    const sourceUrl = row ? extractSourceUrl(row) : undefined;
    const quote = row ? extractQuote(row) : undefined;

    if (sourceUrl === undefined || quote === undefined) {
      out.push({ locator: ref.locator, unresolvable: true });
      continue;
    }

    out.push({ sourceUrl, quote, locator: ref.locator });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Deck cell enumeration
// ---------------------------------------------------------------------------

// The synthesized paid-media row arrays that can carry an evidencePack —
// mirrors SYNTHESIZED_ROW_ARRAYS in paid-media-evidence-pack.ts.
const PAID_MEDIA_GROUNDED_ROW_ARRAYS = [
  "audienceTypes",
  "anglesToTest",
  "creativeFramework",
  "competitorMarketingInsights",
  "competitorReviewInsights",
  "channelSuggestions",
] as const;

const PAID_MEDIA_PLAN_SECTION_ID = "positioningPaidMediaPlan";

// Walk the paid-media plan body and yield every GROUNDED cell. Cells with no
// evidencePack, or with status !== "grounded" (explicit honest gaps), are
// skipped.
function collectGroundedCells(deck: DeckBundle): GroundedCell[] {
  const body = resolveSectionBody(deck, PAID_MEDIA_PLAN_SECTION_ID);
  if (!body) {
    return [];
  }

  const cells: GroundedCell[] = [];
  for (const rowKind of PAID_MEDIA_GROUNDED_ROW_ARRAYS) {
    const rows = body[rowKind];
    if (!Array.isArray(rows)) {
      continue;
    }
    rows.forEach((row, rowIndex) => {
      if (!isRecord(row)) {
        return;
      }
      const pack = row.evidencePack;
      if (!isRecord(pack) || pack.status !== "grounded") {
        // No pack, or an explicit honest gap — skip, never flag.
        return;
      }
      if (!Array.isArray(pack.refs) || pack.refs.length === 0) {
        // Grounded with zero refs is an honest no-op; nothing to verify.
        return;
      }
      const refs: DeckEvidenceRef[] = [];
      for (const ref of pack.refs) {
        if (
          isRecord(ref) &&
          typeof ref.sourceSection === "string" &&
          typeof ref.evidenceKind === "string" &&
          typeof ref.locator === "string" &&
          typeof ref.excerpt === "string"
        ) {
          refs.push({
            sourceSection: ref.sourceSection,
            evidenceKind: ref.evidenceKind,
            locator: ref.locator,
            excerpt: ref.excerpt,
          });
        }
      }
      if (refs.length === 0) {
        return;
      }
      cells.push({
        sectionId: PAID_MEDIA_PLAN_SECTION_ID,
        rowKind,
        rowIndex,
        evidencePack: { status: "grounded", refs },
      });
    });
  }

  return cells;
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

/**
 * Walk every GROUNDED deck cell, resolve its evidence-pack refs into upstream
 * (sourceUrl, quote) pairs, and assert a ResearchFact in the ledger backs each:
 * a fact must exist whose sourceUrl matches AND whose sourceQuote literally
 * contains the claimed token at a clean boundary. ANY miss pushes a violation
 * and blocks. Honest-gap cells are skipped by collectGroundedCells.
 */
export function checkDeckAgainstLedger({
  deck,
  ledger,
}: {
  deck: DeckBundle;
  ledger: readonly ResearchFact[];
}): LiarVerdict {
  const violations: LiarViolation[] = [];
  const cells = collectGroundedCells(deck);

  for (const cell of cells) {
    const cellRef = {
      sectionId: cell.sectionId,
      rowKind: cell.rowKind,
      rowIndex: cell.rowIndex,
    };

    for (const resolved of resolveCellSourceUrls(cell, deck)) {
      if ("unresolvable" in resolved) {
        violations.push({ cell: cellRef, reason: "locator-unresolvable" });
        continue;
      }

      const token = claimTokenFromQuote(resolved.quote);
      const factsAtUrl = ledger.filter(
        (fact) => fact.sourceUrl === resolved.sourceUrl,
      );

      if (factsAtUrl.length === 0) {
        violations.push({
          cell: cellRef,
          reason: "no-ledger-fact-for-source",
          sourceUrl: resolved.sourceUrl,
        });
        continue;
      }

      const backed =
        token !== null &&
        factsAtUrl.some((fact) =>
          quoteContainsTokenCleanly(fact.sourceQuote, token),
        );

      if (!backed) {
        violations.push({
          cell: cellRef,
          reason: "token-not-in-ledger-quote",
          sourceUrl: resolved.sourceUrl,
        });
      }
    }
  }

  return { blocked: violations.length > 0, violations };
}
