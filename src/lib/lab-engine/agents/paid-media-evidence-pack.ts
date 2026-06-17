// Paid-media row-level evidence pack (Wave 2C).
//
// The synthesized paid-media rows (audiences, angles, creative slots, competitor
// marketing/review insights, channel suggestions) each carry only a broad
// `sourceSection` enum + a free-text `grounding` string. That is an assertion,
// not proof. This module DETERMINISTICALLY (never via a model) attaches a
// row-level evidence pack tying each synthesized row to the EXACT upstream
// committed row(s) it was composed from — or honestly marks a gap when no exact
// upstream row matched.
//
// The match is conservative and anchor-token based: a synthesized row is tied to
// an upstream row ONLY when at least one ANCHOR token (a >=3-char non-stopword
// token from that upstream row's identifier — a persona name word, competitor
// name word, trigger name word, a distinctive pain-theme/criterion word) appears
// in the synthesized row's own salient text. No ref or excerpt is ever
// fabricated, and excerpts are sliced verbatim from the matched upstream row.
// Purely additive: only the optional `evidencePack` field is written, and a new
// artifact object is returned (the input is never mutated).

import type { ArtifactEnvelope } from "../artifacts/artifact-envelope";
import type {
  PaidMediaEvidencePack,
  PaidMediaEvidenceRef,
} from "../artifacts/schemas/paid-media-plan";

const PAID_MEDIA_PLAN_SECTION_ID = "positioningPaidMediaPlan";
const EXCERPT_MAX_LENGTH = 240;
const MAX_REFS_PER_ROW = 3;
const MIN_TOKEN_LENGTH = 3;

// The six synthesized row arrays that earn an evidence pack. The templated /
// economics rows (campaignOverview, campaignPhases, creativeStrategy,
// funnelIdeation, salesProcess, projectedResults, kpis, crossSectionInsight,
// feasibilityAudit) are NOT model-synthesized provenance rows and are skipped.
const SYNTHESIZED_ROW_ARRAYS = [
  "audienceTypes",
  "anglesToTest",
  "creativeFramework",
  "competitorMarketingInsights",
  "competitorReviewInsights",
  "channelSuggestions",
] as const;

const STOPWORDS: ReadonlySet<string> = new Set([
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "all",
  "any",
  "can",
  "her",
  "was",
  "one",
  "our",
  "out",
  "his",
  "has",
  "had",
  "how",
  "who",
  "its",
  "let",
  "put",
  "say",
  "she",
  "too",
  "use",
  "via",
  "with",
  "that",
  "this",
  "from",
  "they",
  "them",
  "then",
  "than",
  "your",
  "will",
  "into",
  "more",
  "most",
  "such",
  "some",
  "what",
  "when",
  "were",
  "been",
  "have",
  "here",
  "over",
  "only",
  "also",
  "each",
  "both",
  "does",
  "doing",
  "while",
  "about",
  "above",
  "after",
  "again",
  "their",
  "there",
  "these",
  "those",
  "which",
  "would",
  "could",
  "should",
  "being",
  "where",
  "every",
  "other",
  "because",
  "between",
  "around",
  "audience", // generic paid-media noun — never a discriminating anchor
  "plan",
  "test",
  "testing",
  "targets",
  "target",
  "evidence",
  "gap",
]);

// Honest gap-row phrasing, mirroring the buyer-eval gap detection
// (scripts/zz-buyer-eval.mjs: recommendationIsGap / DENY_LIST 'evidence gap:')
// plus the normalize* fallbacks in paid-media-plan.ts ("Evidence gap: ...").
function isGapText(value: string): boolean {
  const lower = value.trim().toLowerCase();
  if (lower.length === 0) {
    return false;
  }
  if (
    lower.startsWith("gap:") ||
    lower.startsWith("evidence gap:") ||
    lower.startsWith("[unverified]")
  ) {
    return true;
  }
  return (
    lower.includes("not supplied") ||
    lower.includes("did not supply") ||
    lower.includes("awaiting") ||
    lower.includes("unknown") ||
    lower.includes("n/a")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < MIN_TOKEN_LENGTH) {
      continue;
    }
    if (STOPWORDS.has(raw)) {
      continue;
    }
    tokens.add(raw);
  }
  return tokens;
}

function clipExcerpt(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= EXCERPT_MAX_LENGTH) {
    return collapsed;
  }
  return collapsed.slice(0, EXCERPT_MAX_LENGTH).trimEnd();
}

// One candidate upstream evidence row: its kind, stable locator, the verbatim
// text we slice the excerpt from, and the ANCHOR tokens (drawn ONLY from the
// row's identifier — never the whole text) that gate a match.
interface UpstreamCandidate {
  evidenceKind: string;
  locator: string;
  text: string;
  anchorTokens: Set<string>;
}

function makeCandidate(
  evidenceKind: string,
  locator: string,
  text: string,
  anchorSource: string,
): UpstreamCandidate {
  return {
    evidenceKind,
    locator,
    text,
    anchorTokens: tokenize(anchorSource),
  };
}

function arrayAt(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key];
  return Array.isArray(value) ? value : [];
}

function childRecord(
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = record[key];
  return isRecord(value) ? value : undefined;
}

function joinText(parts: Array<unknown>): string {
  return parts
    .map((part) => asString(part))
    .filter((part) => part.length > 0)
    .join(" — ");
}

// ---- Per-section upstream candidate enumerators -------------------------------

function buyerICPCandidates(
  body: Record<string, unknown>,
): UpstreamCandidate[] {
  const out: UpstreamCandidate[] = [];

  const personaReality = childRecord(body, "personaReality");
  if (personaReality) {
    arrayAt(personaReality, "personas").forEach((persona, index) => {
      if (!isRecord(persona)) {
        return;
      }
      const name = asString(persona.name);
      out.push(
        makeCandidate(
          "persona",
          `body.personaReality.personas[${index}]`,
          joinText([persona.name, persona.role, persona.evidence]),
          name,
        ),
      );
    });
  }

  const buyingContext = childRecord(body, "buyingContext");
  if (buyingContext) {
    arrayAt(buyingContext, "triggers").forEach((trigger, index) => {
      if (!isRecord(trigger)) {
        return;
      }
      const name = asString(trigger.name);
      out.push(
        makeCandidate(
          "trigger",
          `body.buyingContext.triggers[${index}]`,
          joinText([trigger.name, trigger.evidence]),
          name,
        ),
      );
    });
  }

  const icpExistenceCheck = childRecord(body, "icpExistenceCheck");
  if (icpExistenceCheck) {
    arrayAt(icpExistenceCheck, "firmographicCuts").forEach((cut, index) => {
      if (!isRecord(cut)) {
        return;
      }
      const value = asString(cut.value);
      out.push(
        makeCandidate(
          "firmographicCut",
          `body.icpExistenceCheck.firmographicCuts[${index}]`,
          joinText([cut.cutType, cut.value]),
          value,
        ),
      );
    });
  }

  const clusters = childRecord(body, "clusters");
  if (clusters) {
    arrayAt(clusters, "venues").forEach((venue, index) => {
      if (!isRecord(venue)) {
        return;
      }
      const name = asString(venue.name);
      out.push(
        makeCandidate(
          "venue",
          `body.clusters.venues[${index}]`,
          joinText([venue.name, venue.whyItMatters]),
          name,
        ),
      );
    });
  }

  return out;
}

function voiceOfCustomerCandidates(
  body: Record<string, unknown>,
): UpstreamCandidate[] {
  const out: UpstreamCandidate[] = [];

  const painLanguage = childRecord(body, "painLanguage");
  if (painLanguage) {
    arrayAt(painLanguage, "quotes").forEach((quote, index) => {
      if (!isRecord(quote)) {
        return;
      }
      // Anchor on the distinctive pain theme + the verbatim quote, so a shared
      // theme word ("handoff", "onboarding") gates the match — never stopwords.
      out.push(
        makeCandidate(
          "painQuote",
          `body.painLanguage.quotes[${index}]`,
          joinText([quote.verbatimText, quote.painTheme]),
          joinText([quote.painTheme, quote.verbatimText]),
        ),
      );
    });
  }

  const objections = childRecord(body, "objections");
  if (objections) {
    arrayAt(objections, "items").forEach((item, index) => {
      if (!isRecord(item)) {
        return;
      }
      const text = asString(item.objectionText);
      out.push(
        makeCandidate(
          "objection",
          `body.objections.items[${index}]`,
          text,
          text,
        ),
      );
    });
  }

  const decisionCriteria = childRecord(body, "decisionCriteria");
  if (decisionCriteria) {
    arrayAt(decisionCriteria, "criteria").forEach((criterion, index) => {
      if (!isRecord(criterion)) {
        return;
      }
      out.push(
        makeCandidate(
          "decisionCriterion",
          `body.decisionCriteria.criteria[${index}]`,
          joinText([criterion.criterion, criterion.evidenceQuote]),
          asString(criterion.criterion),
        ),
      );
    });
  }

  const switchingStories = childRecord(body, "switchingStories");
  if (switchingStories) {
    arrayAt(switchingStories, "stories").forEach((story, index) => {
      if (!isRecord(story)) {
        return;
      }
      const reason = asString(story.reasonToLeave);
      out.push(
        makeCandidate(
          "switchingStory",
          `body.switchingStories.stories[${index}]`,
          joinText([story.reasonToLeave, story.priorSolution]),
          reason,
        ),
      );
    });
  }

  const successLanguage = childRecord(body, "successLanguage");
  if (successLanguage) {
    arrayAt(successLanguage, "quotes").forEach((quote, index) => {
      if (!isRecord(quote)) {
        return;
      }
      const text = asString(quote.verbatimText);
      out.push(
        makeCandidate(
          "successQuote",
          `body.successLanguage.quotes[${index}]`,
          text,
          joinText([quote.afterStatePattern, text]),
        ),
      );
    });
  }

  return out;
}

// Heuristic: does this array look like a list of competitor records?
function looksLikeNamedRecords(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (entry) =>
        isRecord(entry) &&
        (typeof entry.name === "string" ||
          typeof entry.competitor === "string"),
    )
  );
}

function competitorLandscapeCandidates(
  body: Record<string, unknown>,
): UpstreamCandidate[] {
  const out: UpstreamCandidate[] = [];

  // Canonical shape: body.competitorSet.competitors[]. Probe defensively for
  // legacy/alternate array locations.
  const competitorSet = childRecord(body, "competitorSet");
  const namedArrays: Array<{ locatorBase: string; rows: unknown[] }> = [];

  if (competitorSet && looksLikeNamedRecords(competitorSet.competitors)) {
    namedArrays.push({
      locatorBase: "body.competitorSet.competitors",
      rows: competitorSet.competitors as unknown[],
    });
  }
  for (const key of ["competitors", "landscape", "competitorSet"]) {
    const value = body[key];
    if (looksLikeNamedRecords(value)) {
      namedArrays.push({ locatorBase: `body.${key}`, rows: value });
    }
  }

  const seenLocators = new Set<string>();
  for (const { locatorBase, rows } of namedArrays) {
    rows.forEach((row, index) => {
      if (!isRecord(row)) {
        return;
      }
      const locator = `${locatorBase}[${index}]`;
      if (seenLocators.has(locator)) {
        return;
      }
      seenLocators.add(locator);
      const name = asString(row.name) || asString(row.competitor);
      if (name.length === 0) {
        return;
      }
      out.push(
        makeCandidate(
          "competitor",
          locator,
          joinText([name, row.oneLinePositioning, row.verbatimHeroCopy]),
          name,
        ),
      );
    });
  }

  return out;
}

// Conservative generic enumerator for sections we do not model row-by-row
// (demand-intent / offer-diagnostic / market-category): walk the body's
// top-level arrays of records and anchor each row on its most identifying short
// string field. If no such arrays exist, yield nothing.
function genericArrayCandidates(
  body: Record<string, unknown>,
  evidenceKind: string,
): UpstreamCandidate[] {
  const out: UpstreamCandidate[] = [];

  for (const [topKey, topValue] of Object.entries(body)) {
    // Direct array of records under a top-level key.
    if (looksLikeNamedRecords(topValue)) {
      topValue.forEach((row, index) => {
        const candidate = genericRowCandidate(
          row,
          `body.${topKey}[${index}]`,
          evidenceKind,
        );
        if (candidate) {
          out.push(candidate);
        }
      });
      continue;
    }
    // One level of nesting: body.<group>.<array>[] (mirrors the typed sections).
    if (isRecord(topValue)) {
      for (const [childKey, childValue] of Object.entries(topValue)) {
        if (!looksLikeNamedRecords(childValue)) {
          continue;
        }
        childValue.forEach((row, index) => {
          const candidate = genericRowCandidate(
            row,
            `body.${topKey}.${childKey}[${index}]`,
            evidenceKind,
          );
          if (candidate) {
            out.push(candidate);
          }
        });
      }
    }
  }

  return out;
}

function genericRowCandidate(
  row: Record<string, unknown>,
  locator: string,
  evidenceKind: string,
): UpstreamCandidate | undefined {
  // Most identifying short string: prefer common identity fields, else the
  // first short-ish string field on the row.
  const identityFields = [
    "name",
    "keyword",
    "term",
    "label",
    "title",
    "signal",
    "offer",
    "category",
  ];
  let anchor = "";
  for (const field of identityFields) {
    const value = asString(row[field]);
    if (value.length > 0) {
      anchor = value;
      break;
    }
  }
  if (anchor.length === 0) {
    for (const value of Object.values(row)) {
      const str = asString(value);
      if (str.length > 0 && str.length <= 80) {
        anchor = str;
        break;
      }
    }
  }
  if (anchor.length === 0) {
    return undefined;
  }

  const text = joinText(
    Object.values(row).filter((value) => typeof value === "string"),
  );
  return makeCandidate(evidenceKind, locator, text || anchor, anchor);
}

function enumerateUpstreamCandidates(
  sourceSection: string,
  body: Record<string, unknown>,
): UpstreamCandidate[] {
  switch (sourceSection) {
    case "positioningBuyerICP":
      return buyerICPCandidates(body);
    case "positioningVoiceOfCustomer":
      return voiceOfCustomerCandidates(body);
    case "positioningCompetitorLandscape":
      return competitorLandscapeCandidates(body);
    case "positioningDemandIntent":
      return genericArrayCandidates(body, "keyword");
    case "positioningOfferDiagnostic":
      return genericArrayCandidates(body, "offerSignal");
    case "positioningMarketCategory":
      return genericArrayCandidates(body, "marketSignal");
    default:
      // gtmBrief / unattributed / unknown -> no upstream rows.
      return [];
  }
}

// ---- Synthesized-row salient text --------------------------------------------

// The salient text of each synthesized row kind: its content field(s) + its
// free-text grounding (channelSuggestions has no grounding field by schema).
function synthesizedRowSalientText(
  rowKind: (typeof SYNTHESIZED_ROW_ARRAYS)[number],
  row: Record<string, unknown>,
): string {
  switch (rowKind) {
    case "audienceTypes":
      return joinText([row.archetype, row.detail, row.grounding]);
    case "anglesToTest":
      return joinText([row.shortName, row.description, row.grounding]);
    case "creativeFramework":
      return joinText([row.hook, row.executesAngle, row.grounding]);
    case "competitorMarketingInsights":
      return joinText([row.competitor, row.messaging, row.grounding]);
    case "competitorReviewInsights":
      return joinText([row.complaint, row.howWeLeverage, row.grounding]);
    case "channelSuggestions":
      return joinText([row.channel, row.recommendation]);
    default:
      return "";
  }
}

// A row is an honest gap when its core content reads as gap phrasing.
function rowIsHonestGap(
  rowKind: (typeof SYNTHESIZED_ROW_ARRAYS)[number],
  row: Record<string, unknown>,
): boolean {
  const fieldsByKind: Record<
    (typeof SYNTHESIZED_ROW_ARRAYS)[number],
    string[]
  > = {
    audienceTypes: ["detail", "grounding"],
    anglesToTest: ["description", "grounding"],
    creativeFramework: ["hook", "executesAngle", "grounding"],
    competitorMarketingInsights: ["messaging", "grounding"],
    competitorReviewInsights: ["complaint", "howWeLeverage", "grounding"],
    channelSuggestions: ["recommendation"],
  };
  return fieldsByKind[rowKind].some((field) => isGapText(asString(row[field])));
}

// ---- Matcher -----------------------------------------------------------------

function buildEvidencePackForRow(
  rowKind: (typeof SYNTHESIZED_ROW_ARRAYS)[number],
  row: Record<string, unknown>,
  committedArtifacts: Record<string, unknown> | undefined,
): PaidMediaEvidencePack {
  const sourceSection = asString(row.sourceSection) || "unattributed";
  const salientTokens = tokenize(synthesizedRowSalientText(rowKind, row));

  const upstreamBody = resolveCommittedBody(committedArtifacts, sourceSection);
  if (!upstreamBody) {
    return {
      status: "gap",
      refs: [],
      note: `No exact upstream row in ${sourceSection} matched this synthesized row; cited at section level only.`,
    };
  }

  const candidates = enumerateUpstreamCandidates(sourceSection, upstreamBody);

  const scored: Array<{ candidate: UpstreamCandidate; overlap: number }> = [];
  for (const candidate of candidates) {
    let overlap = 0;
    for (const anchor of candidate.anchorTokens) {
      if (salientTokens.has(anchor)) {
        overlap += 1;
      }
    }
    if (overlap >= 1) {
      scored.push({ candidate, overlap });
    }
  }

  if (scored.length === 0) {
    return {
      status: "gap",
      refs: [],
      note: `No exact upstream row in ${sourceSection} matched this synthesized row; cited at section level only.`,
    };
  }

  scored.sort((a, b) => b.overlap - a.overlap);
  const refs: PaidMediaEvidenceRef[] = scored
    .slice(0, MAX_REFS_PER_ROW)
    .map(({ candidate }) => ({
      sourceSection,
      evidenceKind: candidate.evidenceKind,
      locator: candidate.locator,
      excerpt: clipExcerpt(candidate.text),
    }));

  return { status: "grounded", refs };
}

// Resolve the committed upstream artifact body. committedArtifacts[sourceSection]
// may be a full ArtifactEnvelope (with a `body` field) or a raw body object.
function resolveCommittedBody(
  committedArtifacts: Record<string, unknown> | undefined,
  sourceSection: string,
): Record<string, unknown> | undefined {
  if (!committedArtifacts) {
    return undefined;
  }
  const rec = committedArtifacts[sourceSection];
  if (!isRecord(rec)) {
    return undefined;
  }
  const body = "body" in rec ? rec.body : rec;
  return isRecord(body) ? body : undefined;
}

/**
 * Attach a deterministic, code-built row-level evidence pack to each synthesized
 * paid-media row that is not already an honest gap row. No-op unless the artifact
 * is the paid-media plan. Purely additive: returns a new artifact object and
 * never mutates the input. Honest gap rows are left untouched (evidencePack
 * omitted) so the eval's existing gap->warn path is unaffected.
 */
export function withPaidMediaEvidencePack({
  artifact,
  committedArtifacts,
}: {
  artifact: ArtifactEnvelope;
  committedArtifacts: Record<string, unknown> | undefined;
  observedAt?: string;
}): ArtifactEnvelope {
  if (artifact.sectionId !== PAID_MEDIA_PLAN_SECTION_ID) {
    return artifact;
  }

  const body = artifact.body as Record<string, unknown>;
  const nextBody: Record<string, unknown> = { ...body };
  let changed = false;

  for (const rowKind of SYNTHESIZED_ROW_ARRAYS) {
    const rows = body[rowKind];
    if (!Array.isArray(rows)) {
      continue;
    }
    nextBody[rowKind] = rows.map((row) => {
      if (!isRecord(row)) {
        return row;
      }
      if (rowIsHonestGap(rowKind, row)) {
        // Honest gap row: leave intact, omit evidencePack.
        return row;
      }
      const evidencePack = buildEvidencePackForRow(
        rowKind,
        row,
        committedArtifacts,
      );
      changed = true;
      return { ...row, evidencePack };
    });
  }

  if (!changed) {
    return artifact;
  }

  return { ...artifact, body: nextBody };
}
