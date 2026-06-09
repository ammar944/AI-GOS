import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";

import { POSITIONING_SECTION_IDS } from "@/lib/ai/prompts/positioning-skills";
import type {
  ArtifactEnvelope,
  ResearchInput,
} from "@/lib/lab-engine/artifacts/artifact-envelope";
import { sectionRunnerModel } from "@/lib/lab-engine/ai/models";

const CANONICAL_ZONES = POSITIONING_SECTION_IDS;
const EMPTY_BODY_CHARS = 200;
const JUDGE_CHUNK_SIZE = 8;
const JUDGE_RETRY_CHUNK_SIZE = 4;
const JUDGE_MAX_OUTPUT_TOKENS = 16_384;
const JUDGE_RETRY_MAX_OUTPUT_TOKENS = 24_576;
const JUDGE_TIMEOUT_MS = 45_000;
const CITED_VERBATIM_RUN_MIN = 6;

type Zone = (typeof CANONICAL_ZONES)[number];

export type PlanFlagType =
  | "FABRICATION"
  | "PROVENANCE_INFLATION"
  | "MIS_ATTRIBUTION"
  | "FABRICATED_QUOTE"
  | "CONTRADICTION"
  | "EMPTY_SECTION_CITATION"
  | "INVALID_ENUM"
  | "VERIFIER_ERROR"
  | "PASS";

export interface PlanClaim {
  id: string;
  kind: string;
  text: string;
  grounding: string;
  sourceSection: string;
}

export interface PlanVerdict {
  id: string;
  flag: PlanFlagType;
  reason: string;
  by: "deterministic" | "judge";
}

export interface PlanVerifierSummary {
  totalClaims: number;
  judged: number;
  deterministicFlags: number;
  judgeFlags: number;
  verifierErrors: number;
  judgeSkipped: number;
  hardFailCount: number;
  needsReviewCount: number;
  hardFailIds: string[];
  needsReviewIds: string[];
}

export interface PaidMediaPlanVerificationResult {
  verdicts: PlanVerdict[];
  claims: PlanClaim[];
  summary: PlanVerifierSummary;
  hardFail: boolean;
  needsReview: boolean;
  repairIssues: string[];
}

interface JudgeCallStat {
  chunk: number;
  attempt: number;
  claimsInBatch: number;
  verdictsReturned: number;
  finishReason: string;
  complete: boolean;
}

interface JudgeCallResult {
  byId: Map<string, { id: string; flag: string; reason: string }>;
  finishReason: string;
}

export type PlanClaimJudge = (input: {
  batch: readonly PlanClaim[];
  sections: Readonly<Record<Zone, string>>;
  maxOutputTokens: number;
  signal?: AbortSignal;
}) => Promise<JudgeCallResult>;

export interface VerifyPaidMediaPlanInput {
  artifact: ArtifactEnvelope;
  researchInput: ResearchInput;
  env?: Record<string, string | undefined>;
  judge?: PlanClaimJudge;
  model?: LanguageModel;
  signal?: AbortSignal;
}

const judgeVerdictSchema = z
  .object({
    verdicts: z.array(
      z
        .object({
          id: z.string().describe("the claim id, copied verbatim"),
          flag: z
            .string()
            .describe(
              "one of: FABRICATION, PROVENANCE_INFLATION, MIS_ATTRIBUTION, FABRICATED_QUOTE, CONTRADICTION, PASS",
            ),
          reason: z
            .string()
            .describe("one sentence: the specific fact and why it fails"),
        })
        .strict(),
    ),
  })
  .strict();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function clip(value: string, maxChars: number): string {
  if (value.length === 0) {
    return "(empty section)";
  }

  return value.length > maxChars
    ? `${value.slice(0, maxChars)}\n...[truncated]`
    : value;
}

function normalizeForQuote(value: string): string {
  return value
    .toLowerCase()
    .replace(/[‘’′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9'%$.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractQuotedSpans(text: string): string[] {
  const spans: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string): void => {
    const span = raw.trim();
    if (span.split(/\s+/).length >= 4 && !seen.has(span)) {
      seen.add(span);
      spans.push(span);
    }
  };
  const unambiguous = /["“]([^"”]{12,}?)["”]|‘([^’]{12,}?)’/g;
  let match: RegExpExecArray | null;

  while ((match = unambiguous.exec(text)) !== null) {
    add(match[1] ?? match[2] ?? "");
  }

  const straight = /(^|[^A-Za-z])'([^']{12,}?)'(?=[^A-Za-z]|$)/g;
  while ((match = straight.exec(text)) !== null) {
    add(match[2] ?? "");
  }

  return spans;
}

function quoteAppearsVerbatim(
  quote: string,
  sections: Readonly<Record<Zone, string>>,
): boolean {
  const normalizedQuote = normalizeForQuote(quote);

  if (normalizedQuote.length === 0) {
    return true;
  }

  for (const zone of CANONICAL_ZONES) {
    const normalizedSection = normalizeForQuote(sections[zone]);
    if (normalizedSection.includes(normalizedQuote)) {
      return true;
    }
    const quoteWords = normalizedQuote.split(" ");
    if (quoteWords.length >= 6) {
      const head = quoteWords
        .slice(0, Math.ceil(quoteWords.length * 0.7))
        .join(" ");
      if (normalizedSection.includes(head)) {
        return true;
      }
    }
  }

  return false;
}

function spanFuzzyInSection(span: string, sectionText: string): boolean {
  const normalizedSpan = normalizeForQuote(span);
  const normalizedSection = normalizeForQuote(sectionText);

  if (normalizedSpan.length === 0 || normalizedSection.includes(normalizedSpan)) {
    return true;
  }

  const words = normalizedSpan.split(" ");
  if (words.length >= 6) {
    const head = words.slice(0, Math.ceil(words.length * 0.6)).join(" ");
    const tail = words.slice(Math.floor(words.length * 0.4)).join(" ");
    if (normalizedSection.includes(head) || normalizedSection.includes(tail)) {
      return true;
    }
  }

  for (const chunk of span.split(/\.\.\.|…/)) {
    const normalizedChunk = normalizeForQuote(chunk);
    if (
      normalizedChunk.split(" ").length >= 4 &&
      normalizedSection.includes(normalizedChunk)
    ) {
      return true;
    }
  }

  return false;
}

function spanVerbatimInSection(span: string, sectionText: string): boolean {
  const normalizedSpan = normalizeForQuote(span);

  return (
    normalizedSpan.length >= 10 &&
    normalizeForQuote(sectionText).includes(normalizedSpan)
  );
}

function findMisStampedQuote(
  text: string,
  grounding: string,
  citedZones: readonly Zone[],
  sections: Readonly<Record<Zone, string>>,
): { span: string; zone: Zone } | null {
  const spans = [
    ...extractQuotedSpans(grounding),
    ...extractQuotedSpans(text),
  ];

  for (const source of [text, grounding]) {
    const first = source.search(/['‘]/);
    const last = Math.max(source.lastIndexOf("'"), source.lastIndexOf("’"));
    if (first !== -1 && last > first + 12) {
      const full = source.slice(first + 1, last).trim();
      if (full.split(/\s+/).length >= 4 && !spans.includes(full)) {
        spans.push(full);
      }
    }
  }

  for (const span of spans) {
    const inCited = citedZones.some((zone) =>
      spanFuzzyInSection(span, sections[zone] ?? ""),
    );
    if (inCited) {
      continue;
    }
    const elsewhere = CANONICAL_ZONES.find(
      (zone) =>
        !citedZones.includes(zone) &&
        spanVerbatimInSection(span, sections[zone] ?? ""),
    );
    if (elsewhere) {
      return { span, zone: elsewhere };
    }
  }

  return null;
}

function extractDistinctiveCounts(value: string): string[] {
  const out: string[] = [];
  const pattern = /(?<![\d.$])\b(\d{1,3}(?:,\d{3})+|\d{3,})(k\+?)?\b/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    out.push(match[1].replace(/,/g, ""));
  }

  return [...new Set(out)];
}

function sectionHasCount(section: string, count: string): boolean {
  return new RegExp(`\\b${count}\\b`).test(section.replace(/,/g, ""));
}

function extractMoneyTokens(value: string): string[] {
  const out: string[] = [];
  const pattern = /\$\s?\d[\d,]*(?:\.\d+)?\s?[kmb]?\+?/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    out.push(match[0]);
  }

  return [...new Set(out)];
}

function normalizeMoney(value: string): string {
  return value
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/,/g, "")
    .replace(/\s+/g, "");
}

function moneyAppearsVerbatim(
  token: string,
  sections: Readonly<Record<Zone, string>>,
): boolean {
  const core = normalizeMoney(token).replace(/\+$/, "").replace(/\/.*$/, "");

  return CANONICAL_ZONES.some((zone) =>
    normalizeMoney(sections[zone]).includes(core),
  );
}

function maxContiguousRun(claimText: string, section: string): number {
  const claimWords = normalizeForQuote(claimText).split(" ").filter(Boolean);
  const normalizedSection = ` ${normalizeForQuote(section)} `;
  let best = 0;

  for (let start = 0; start < claimWords.length; start += 1) {
    for (let end = start + 1; end <= claimWords.length; end += 1) {
      const span = claimWords.slice(start, end).join(" ");
      if (!normalizedSection.includes(` ${span} `)) {
        break;
      }
      best = Math.max(best, end - start);
    }
  }

  return best;
}

function claimHasLongVerbatimRunInCited(
  claimText: string,
  citedZones: readonly Zone[],
  sections: Readonly<Record<Zone, string>>,
): boolean {
  return citedZones.some(
    (zone) =>
      maxContiguousRun(claimText, sections[zone] ?? "") >=
      CITED_VERBATIM_RUN_MIN,
  );
}

function extractRangeTokens(value: string): string[] {
  const out: string[] = [];
  const pattern = /\b\d{1,3}\s*-\s*\d{1,3}\s*%/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value.replace(/[–—]/g, "-"))) !== null) {
    out.push(match[0].replace(/\s+/g, ""));
  }

  return [...new Set(out)];
}

function rangeTokenInCited(
  token: string,
  citedZones: readonly Zone[],
  sections: Readonly<Record<Zone, string>>,
): boolean {
  const core = token.replace(/[–—]/g, "-").replace(/\s+/g, "").toLowerCase();

  return citedZones.some((zone) =>
    (sections[zone] ?? "")
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, "")
      .toLowerCase()
      .includes(core),
  );
}

function isUnverified(grounding: string): boolean {
  return (
    /^\s*unverified\b/i.test(grounding) ||
    /\bunverified\b/i.test(grounding.trim().slice(0, 12))
  );
}

function assertsQuantifiedOutcome(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[–—]/g, "-");
  const strongPatterns = [
    /\b\d+\s*-?\s*day\b/,
    /\b\d+\s*hours?\b/,
    /\b\d+\s*x\s*(?:faster|more|less)?\b/,
  ];
  const outcomeCue =
    /(close|faster|accuracy|reclaim|save[ds]?|cut|cuts|reduc|fewer|decrease|increase|boost|roi|payback|productivity|efficien)/;
  const percentage = /\b\d{1,3}\s*%/;
  const weekOrMinute = /\b\d+\s*(?:weeks?|minutes?)\b/;

  return (
    strongPatterns.some((pattern) => pattern.test(normalized)) ||
    ((percentage.test(normalized) || weekOrMinute.test(normalized)) &&
      outcomeCue.test(normalized))
  );
}

function pushClaim(claims: PlanClaim[], claim: PlanClaim): void {
  if (claim.text.trim().length === 0 && claim.grounding.trim().length === 0) {
    return;
  }

  claims.push(claim);
}

export function extractPlanClaims(plan: unknown): PlanClaim[] {
  const body = asRecord(plan);
  const claims: PlanClaim[] = [];

  asRecordArray(body.creativeFramework).forEach((creative, index) => {
    pushClaim(claims, {
      id: `creativeFramework[${index}].${asString(creative.label) || index}`,
      kind: "creativeFramework.hook",
      text: asString(creative.hook),
      grounding: asString(creative.grounding),
      sourceSection: asString(creative.sourceSection),
    });
  });

  asRecordArray(body.anglesToTest).forEach((angle, index) => {
    pushClaim(claims, {
      id: `anglesToTest[${index}].${asString(angle.shortName) || index}`,
      kind: "anglesToTest",
      text: asString(angle.description) || asString(angle.shortName),
      grounding: asString(angle.grounding),
      sourceSection: asString(angle.sourceSection),
    });
  });

  asRecordArray(body.competitorReviewInsights).forEach((review, index) => {
    pushClaim(claims, {
      id: `competitorReviewInsights[${index}]`,
      kind: "competitorReviewInsights",
      text: asString(review.complaint),
      grounding: asString(review.grounding),
      sourceSection: asString(review.sourceSection),
    });
  });

  asRecordArray(body.crossSectionInsight).forEach((insight, index) => {
    const sourceSection = Array.isArray(insight.sourceSections)
      ? insight.sourceSections.map(asString).filter(Boolean).join(", ")
      : asString(insight.sourceSection);
    const fields = [
      ["tension", insight.tension],
      ["implicationForPlan", insight.implicationForPlan],
      ["clientBlindSpot", insight.clientBlindSpot],
      ["secondOrderRisk", insight.secondOrderRisk],
      ["contrarianInversion", insight.contrarianInversion],
    ] as const;

    fields.forEach(([field, value]) => {
      pushClaim(claims, {
        id: `crossSectionInsight[${index}].${field}`,
        kind: `crossSectionInsight.${field}`,
        text: asString(value),
        grounding: asString(insight.implicationForPlan),
        sourceSection,
      });
    });
  });

  asRecordArray(body.audienceTypes).forEach((audience, index) => {
    pushClaim(claims, {
      id: `audienceTypes[${index}].${asString(audience.archetype) || index}`,
      kind: "audienceTypes.detail",
      text: asString(audience.detail),
      grounding: asString(audience.grounding),
      sourceSection: asString(audience.sourceSection),
    });
  });

  asRecordArray(body.competitorMarketingInsights).forEach((competitor, index) => {
    pushClaim(claims, {
      id: `competitorMarketingInsights[${index}].${asString(competitor.competitor) || index}`,
      kind: "competitorMarketingInsights",
      text: [competitor.offer, competitor.positioning, competitor.messaging]
        .map(asString)
        .filter(Boolean)
        .join(" | "),
      grounding: asString(competitor.grounding),
      sourceSection: asString(competitor.sourceSection),
    });
  });

  const campaignOverview = asRecord(body.campaignOverview);
  pushClaim(claims, {
    id: "campaignOverview.prose",
    kind: "campaignOverview",
    text: asString(campaignOverview.prose),
    grounding: asString(campaignOverview.primaryKpi),
    sourceSection: "gtmBrief",
  });

  asRecordArray(body.channelSuggestions).forEach((channel, index) => {
    pushClaim(claims, {
      id: `channelSuggestions[${index}].${asString(channel.channel) || index}`,
      kind: "channelSuggestions.recommendation",
      text: asString(channel.recommendation),
      grounding: asString(channel.verdict),
      sourceSection: asString(channel.sourceSection),
    });
  });

  return claims;
}

function splitCitedZones(sourceSection: string): string[] {
  return sourceSection
    .split(/[,+]/)
    .map((zone) => zone.trim())
    .filter((zone) => zone.length > 0 && zone !== "gtmBrief");
}

export function deterministicPlanPass(
  claims: readonly PlanClaim[],
  sections: Readonly<Record<Zone, string>>,
): { verdicts: PlanVerdict[]; needJudge: PlanClaim[] } {
  const verdicts: PlanVerdict[] = [];
  const needJudge: PlanClaim[] = [];

  for (const claim of claims) {
    const citedZones = splitCitedZones(claim.sourceSection);
    const badZone = citedZones.find(
      (zone) => !(CANONICAL_ZONES as readonly string[]).includes(zone),
    );

    if (badZone !== undefined) {
      verdicts.push({
        id: claim.id,
        flag: "INVALID_ENUM",
        reason: `sourceSection '${badZone}' is not one of the 6 canonical zones`,
        by: "deterministic",
      });
      continue;
    }

    const canonicalCitedZones = citedZones as Zone[];
    const emptyCited = canonicalCitedZones.find(
      (zone) => (sections[zone] ?? "").trim().length < EMPTY_BODY_CHARS,
    );

    if (canonicalCitedZones.length > 0 && emptyCited !== undefined) {
      verdicts.push({
        id: claim.id,
        flag: "EMPTY_SECTION_CITATION",
        reason: `cites '${emptyCited}' whose body is <${EMPTY_BODY_CHARS} chars`,
        by: "deterministic",
      });
      continue;
    }

    if (isUnverified(claim.grounding)) {
      if (assertsQuantifiedOutcome(claim.text)) {
        needJudge.push(claim);
        continue;
      }
      verdicts.push({
        id: claim.id,
        flag: "PASS",
        reason: "grounding declared UNVERIFIED and citation is structurally valid",
        by: "deterministic",
      });
      continue;
    }

    const counts = [
      ...extractDistinctiveCounts(claim.grounding),
      ...extractDistinctiveCounts(claim.text),
    ];
    const citedSet = new Set(canonicalCitedZones);
    const misattributedCount = counts.find((count) => {
      const inCited = canonicalCitedZones.some((zone) =>
        sectionHasCount(sections[zone] ?? "", count),
      );
      if (inCited) {
        return false;
      }
      return CANONICAL_ZONES.some(
        (zone) => !citedSet.has(zone) && sectionHasCount(sections[zone] ?? "", count),
      );
    });

    if (misattributedCount !== undefined) {
      const elsewhereZone = CANONICAL_ZONES.find(
        (zone) =>
          !citedSet.has(zone) &&
          sectionHasCount(sections[zone] ?? "", misattributedCount),
      );
      verdicts.push({
        id: claim.id,
        flag: "MIS_ATTRIBUTION",
        reason: `count '${misattributedCount}' absent from cited ${claim.sourceSection} but present in ${elsewhereZone}`,
        by: "deterministic",
      });
      continue;
    }

    const misStamped = findMisStampedQuote(
      claim.text,
      claim.grounding,
      canonicalCitedZones,
      sections,
    );

    if (misStamped !== null) {
      verdicts.push({
        id: claim.id,
        flag: "MIS_ATTRIBUTION",
        reason: `quoted phrase "${misStamped.span.slice(0, 50)}..." absent from cited ${claim.sourceSection} but verbatim in ${misStamped.zone}`,
        by: "deterministic",
      });
      continue;
    }

    const quotedSpans =
      claim.kind === "competitorReviewInsights"
        ? extractQuotedSpans(claim.text)
        : [];
    const fabricatedQuote = quotedSpans.find(
      (quote) => !quoteAppearsVerbatim(quote, sections),
    );

    if (fabricatedQuote !== undefined) {
      verdicts.push({
        id: claim.id,
        flag: "FABRICATED_QUOTE",
        reason: `quoted text "${fabricatedQuote.slice(0, 70)}..." not found verbatim in any section`,
        by: "deterministic",
      });
      continue;
    }

    needJudge.push(claim);
  }

  return { verdicts, needJudge };
}

function recoverVerdictsFromText(
  text: string,
): Array<{ id: string; flag: string; reason: string }> {
  if (text.length === 0) {
    return [];
  }

  const candidates: string[] = [];
  const arrayStart = text.indexOf("[");
  const objectStart = text.indexOf("{");

  if (arrayStart !== -1) {
    const arrayEnd = text.lastIndexOf("]");
    if (arrayEnd > arrayStart) {
      candidates.push(text.slice(arrayStart, arrayEnd + 1));
    }
  }
  if (objectStart !== -1) {
    const objectEnd = text.lastIndexOf("}");
    if (objectEnd > objectStart) {
      candidates.push(text.slice(objectStart, objectEnd + 1));
    }
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(isRecord).map((record) => ({
          id: asString(record.id),
          flag: asString(record.flag),
          reason: asString(record.reason),
        }));
      }
      if (isRecord(parsed) && Array.isArray(parsed.verdicts)) {
        return parsed.verdicts.filter(isRecord).map((record) => ({
          id: asString(record.id),
          flag: asString(record.flag),
          reason: asString(record.reason),
        }));
      }
    } catch {
      // Continue to the next candidate and then regex recovery.
    }
  }

  const out: Array<{ id: string; flag: string; reason: string }> = [];
  const objectPattern =
    /\{\s*"id"\s*:\s*"([^"]+)"\s*,\s*"flag"\s*:\s*"([^"]+)"\s*,\s*"reason"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let match: RegExpExecArray | null;

  while ((match = objectPattern.exec(text)) !== null) {
    out.push({ id: match[1], flag: match[2], reason: match[3] });
  }

  return out;
}

function buildSectionsFromResearchInput(
  researchInput: ResearchInput,
): Record<Zone, string> {
  const committed = asRecord(researchInput.committedPositioningArtifacts);
  const committedMarkdown = asRecord(
    researchInput.committedPositioningSectionMarkdown,
  );
  const sectionExcerpts = asRecord(researchInput.corpus.sectionExcerpts);
  const out = {} as Record<Zone, string>;

  for (const zone of CANONICAL_ZONES) {
    const artifact = committed[zone];
    const artifactText =
      artifact === undefined ? "" : JSON.stringify(artifact, null, 2);
    const markdownText = asString(committedMarkdown[zone]);
    const excerptText = asRecordArray(sectionExcerpts[zone])
      .map((excerpt) => asString(excerpt.text))
      .filter(Boolean)
      .join("\n\n");
    out[zone] = [markdownText, artifactText, excerptText]
      .filter(Boolean)
      .join("\n\n");
  }

  return out;
}

function buildJudgePrompt({
  batch,
  sections,
}: {
  batch: readonly PlanClaim[];
  sections: Readonly<Record<Zone, string>>;
}): string {
  const sectionBlock = CANONICAL_ZONES.map(
    (zone) => `\n### ${zone}\n${clip(sections[zone], 5_000)}`,
  ).join("\n");
  const claimBlock = batch
    .map(
      (claim) =>
        `- id: ${claim.id}\n  cited_section: ${claim.sourceSection}\n  claim_text: ${claim.text}\n  grounding_assertion: ${claim.grounding}`,
    )
    .join("\n");

  return [
    "For EACH claim, verify only load-bearing facts against the six sections.",
    "Return one verdict per claim id. Use PASS unless a specific fact is provably unsupported, contradicted, fabricated, or mis-attributed.",
    "Flags: FABRICATION, PROVENANCE_INFLATION, MIS_ATTRIBUTION, FABRICATED_QUOTE, CONTRADICTION, PASS.",
    "Reasons must stay under 30 words and name the specific token or quote.",
    "",
    "=== SIX SECTIONS ===",
    sectionBlock,
    "",
    "=== CLAIMS TO JUDGE ===",
    claimBlock,
  ].join("\n");
}

function readErrorText(error: unknown): string {
  if (isRecord(error)) {
    return asString(error.text);
  }

  return "";
}

function readErrorFinishReason(error: unknown): string {
  if (isRecord(error)) {
    return asString(error.finishReason) || "error";
  }

  return "error";
}

/**
 * Bound every judge call to a real per-call timeout while still honoring the
 * parent (285s job) signal. Previously `signal ?? AbortSignal.timeout(...)`
 * meant the per-call timeout was dead code whenever a job signal was threaded
 * in (always, in production), so a single hung judge call could consume the
 * entire section budget. AbortSignal.any aborts on whichever fires first.
 */
export function composeJudgeAbortSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number = JUDGE_TIMEOUT_MS,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export function createDefaultPlanClaimJudge(
  model: LanguageModel = sectionRunnerModel,
): PlanClaimJudge {
  return async ({ batch, maxOutputTokens, sections, signal }): Promise<JudgeCallResult> => {
    let rawText = "";
    let finishReason = "unknown";
    let outputVerdicts: Array<{ id: string; flag: string; reason: string }> | null = null;

    try {
      const result = await generateText({
        model,
        output: Output.object({
          schema: judgeVerdictSchema,
          name: "ClaimVerdicts",
          description: "Entailment verdict per paid-media claim id.",
        }),
        temperature: 0,
        maxOutputTokens,
        abortSignal: composeJudgeAbortSignal(signal),
        system:
          "You are a strict, evidence-first paid-media plan verifier. Do not infer beyond the provided six sections.",
        prompt: buildJudgePrompt({ batch, sections }),
      });

      rawText = result.text ?? "";
      finishReason = result.finishReason ?? "unknown";
      outputVerdicts = result.output?.verdicts ?? null;
    } catch (error) {
      rawText = readErrorText(error);
      finishReason = readErrorFinishReason(error);
      outputVerdicts = null;
    }

    const raw = outputVerdicts ?? recoverVerdictsFromText(rawText);
    const byId = new Map(raw.map((verdict) => [verdict.id, verdict]));

    return { byId, finishReason };
  };
}

const JUDGE_ALLOWED_FLAGS: PlanFlagType[] = [
  "FABRICATION",
  "PROVENANCE_INFLATION",
  "MIS_ATTRIBUTION",
  "FABRICATED_QUOTE",
  "CONTRADICTION",
  "PASS",
];

function toVerdict(
  claim: PlanClaim,
  verdict: { id: string; flag: string; reason: string } | undefined,
): PlanVerdict {
  const flagRaw = (verdict?.flag ?? "PASS").toUpperCase().trim();
  const flag =
    verdict === undefined ||
    !(JUDGE_ALLOWED_FLAGS as readonly string[]).includes(flagRaw)
      ? "VERIFIER_ERROR"
      : (flagRaw as PlanFlagType);

  return {
    id: claim.id,
    flag,
    reason:
      verdict === undefined
        ? "(judge returned no verdict)"
        : verdict.reason || `judge returned unsupported flag '${verdict.flag}'`,
    by: "judge",
  };
}

function isJudgeComplete(
  batch: readonly PlanClaim[],
  byId: Map<string, { id: string; flag: string; reason: string }>,
  finishReason: string,
): boolean {
  return finishReason === "stop" && batch.every((claim) => byId.has(claim.id));
}

async function judgeChunk({
  chunk,
  chunkIndex,
  judge,
  sections,
  signal,
  stats,
}: {
  chunk: readonly PlanClaim[];
  chunkIndex: number;
  judge: PlanClaimJudge;
  sections: Readonly<Record<Zone, string>>;
  signal?: AbortSignal;
  stats: JudgeCallStat[];
}): Promise<PlanVerdict[]> {
  const first = await judge({
    batch: chunk,
    maxOutputTokens: JUDGE_MAX_OUTPUT_TOKENS,
    sections,
    signal,
  });
  const firstComplete = isJudgeComplete(chunk, first.byId, first.finishReason);

  stats.push({
    chunk: chunkIndex,
    attempt: 1,
    claimsInBatch: chunk.length,
    verdictsReturned: chunk.filter((claim) => first.byId.has(claim.id)).length,
    finishReason: first.finishReason,
    complete: firstComplete,
  });

  if (firstComplete) {
    return chunk.map((claim) => toVerdict(claim, first.byId.get(claim.id)));
  }

  const recovered = new Map(first.byId);
  const stillMissing = chunk.filter((claim) => !recovered.has(claim.id));

  for (let start = 0; start < stillMissing.length; start += JUDGE_RETRY_CHUNK_SIZE) {
    const sub = stillMissing.slice(start, start + JUDGE_RETRY_CHUNK_SIZE);
    const retry = await judge({
      batch: sub,
      maxOutputTokens: JUDGE_RETRY_MAX_OUTPUT_TOKENS,
      sections,
      signal,
    });

    stats.push({
      chunk: chunkIndex,
      attempt: 2,
      claimsInBatch: sub.length,
      verdictsReturned: sub.filter((claim) => retry.byId.has(claim.id)).length,
      finishReason: retry.finishReason,
      complete: isJudgeComplete(sub, retry.byId, retry.finishReason),
    });

    for (const claim of sub) {
      const verdict = retry.byId.get(claim.id);
      if (verdict !== undefined) {
        recovered.set(claim.id, verdict);
      }
    }
  }

  return chunk.map((claim) => {
    const verdict = recovered.get(claim.id);
    if (verdict !== undefined) {
      return toVerdict(claim, verdict);
    }

    return {
      id: claim.id,
      flag: "VERIFIER_ERROR",
      reason:
        "judge truncated/incomplete after retry - no trustworthy verdict (BLOCKS, never a silent PASS)",
      by: "judge",
    };
  });
}

async function judgePass({
  claims,
  judge,
  sections,
  signal,
}: {
  claims: readonly PlanClaim[];
  judge: PlanClaimJudge;
  sections: Readonly<Record<Zone, string>>;
  signal?: AbortSignal;
}): Promise<{ verdicts: PlanVerdict[]; stats: JudgeCallStat[] }> {
  const chunks: PlanClaim[][] = [];
  for (let start = 0; start < claims.length; start += JUDGE_CHUNK_SIZE) {
    chunks.push(claims.slice(start, start + JUDGE_CHUNK_SIZE));
  }

  // Run chunks concurrently — each is an independent judge call, so wall-clock
  // is the slowest chunk, not their sum. The previous sequential loop could
  // stack chunk latencies past the 285s job ceiling and trip the timeout. Each
  // chunk gets its own stats array so the concurrent pushes never race.
  const chunkResults = await Promise.all(
    chunks.map((chunk, index) => {
      const chunkStats: JudgeCallStat[] = [];
      return judgeChunk({
        chunk,
        chunkIndex: index + 1,
        judge,
        sections,
        signal,
        stats: chunkStats,
      }).then((verdicts) => ({ verdicts, stats: chunkStats }));
    }),
  );

  return {
    verdicts: chunkResults.flatMap((result) => result.verdicts),
    stats: chunkResults.flatMap((result) => result.stats),
  };
}

function applyJudgeFalseAlarmGuards({
  judgeVerdicts,
  claims,
  sections,
}: {
  judgeVerdicts: PlanVerdict[];
  claims: readonly PlanClaim[];
  sections: Readonly<Record<Zone, string>>;
}): void {
  const claimById = new Map(claims.map((claim) => [claim.id, claim]));

  for (const verdict of judgeVerdicts) {
    const claim = claimById.get(verdict.id);
    if (claim === undefined) {
      continue;
    }

    if (
      (verdict.flag === "FABRICATION" ||
        verdict.flag === "PROVENANCE_INFLATION" ||
        verdict.flag === "MIS_ATTRIBUTION") &&
      claim.kind === "competitorMarketingInsights"
    ) {
      const money = extractMoneyTokens(claim.text);
      if (
        money.length > 0 &&
        money.every((token) => moneyAppearsVerbatim(token, sections))
      ) {
        verdict.flag = "PASS";
        verdict.reason = `competitor price(s) ${money.join(", ")} present verbatim in sections`;
        continue;
      }
    }

    if (verdict.flag !== "MIS_ATTRIBUTION" && verdict.flag !== "FABRICATION") {
      continue;
    }

    const citedZones = splitCitedZones(claim.sourceSection).filter((zone) =>
      (CANONICAL_ZONES as readonly string[]).includes(zone),
    ) as Zone[];

    if (claimHasLongVerbatimRunInCited(claim.text, citedZones, sections)) {
      verdict.flag = "PASS";
      verdict.reason = `>=${CITED_VERBATIM_RUN_MIN}-word verbatim run present in cited ${claim.sourceSection}`;
      continue;
    }

    const ranges = extractRangeTokens(claim.text);
    const present = ranges.find((token) =>
      rangeTokenInCited(token, citedZones, sections),
    );
    if (present !== undefined) {
      verdict.flag = "PASS";
      verdict.reason = `range/benchmark token '${present}' present verbatim in cited ${claim.sourceSection}`;
    }
  }
}

function shouldRunJudge(input: VerifyPaidMediaPlanInput): boolean {
  if (input.judge !== undefined) {
    return true;
  }

  if (input.env?.LAB_PAID_MEDIA_VERIFIER_JUDGE === "false") {
    return false;
  }

  return input.env?.NODE_ENV !== "test";
}

function isHardFailVerdict(verdict: PlanVerdict): boolean {
  // VERIFIER_ERROR (judge truncation/timeout/unparseable) means "we could not
  // verify this claim" — NOT a confirmed fabrication. Per ARI it commits with an
  // honest needs_review badge instead of hard-failing the section (which would
  // reintroduce the .strict()->repair->timeout regression in a new form). Only
  // deterministic, evidence-backed fabrications hard-fail.
  return (
    verdict.flag === "FABRICATED_QUOTE" ||
    verdict.flag === "EMPTY_SECTION_CITATION" ||
    verdict.flag === "INVALID_ENUM" ||
    (verdict.flag === "MIS_ATTRIBUTION" &&
      verdict.by === "deterministic" &&
      verdict.reason.startsWith("count "))
  );
}

function summarizeVerification({
  claims,
  deterministicVerdicts,
  judgeSkipped,
  judgeVerdicts,
}: {
  claims: readonly PlanClaim[];
  deterministicVerdicts: readonly PlanVerdict[];
  judgeSkipped: number;
  judgeVerdicts: readonly PlanVerdict[];
}): PlanVerifierSummary {
  const allFlagged = [...deterministicVerdicts, ...judgeVerdicts].filter(
    (verdict) => verdict.flag !== "PASS",
  );
  const hardFailIds = allFlagged
    .filter(isHardFailVerdict)
    .map((verdict) => verdict.id);
  const needsReviewIds = allFlagged
    .filter((verdict) => !isHardFailVerdict(verdict))
    .map((verdict) => verdict.id);

  return {
    totalClaims: claims.length,
    judged: judgeVerdicts.length,
    deterministicFlags: deterministicVerdicts.filter(
      (verdict) => verdict.flag !== "PASS",
    ).length,
    judgeFlags: judgeVerdicts.filter(
      (verdict) => verdict.flag !== "PASS" && verdict.flag !== "VERIFIER_ERROR",
    ).length,
    verifierErrors: judgeVerdicts.filter(
      (verdict) => verdict.flag === "VERIFIER_ERROR",
    ).length,
    judgeSkipped,
    hardFailCount: hardFailIds.length,
    needsReviewCount: needsReviewIds.length + judgeSkipped,
    hardFailIds,
    needsReviewIds,
  };
}

export async function verifyPaidMediaPlan(
  input: VerifyPaidMediaPlanInput,
): Promise<PaidMediaPlanVerificationResult> {
  const sections = buildSectionsFromResearchInput(input.researchInput);
  const claims = extractPlanClaims(input.artifact.body);
  const { verdicts: deterministicVerdicts, needJudge } = deterministicPlanPass(
    claims,
    sections,
  );
  const judge =
    input.judge ?? createDefaultPlanClaimJudge(input.model ?? sectionRunnerModel);
  const judgeShouldRun = shouldRunJudge(input);
  const { verdicts: judgeVerdicts } =
    judgeShouldRun && needJudge.length > 0
      ? await judgePass({
          claims: needJudge,
          judge,
          sections,
          signal: input.signal,
        })
      : { verdicts: [] };

  applyJudgeFalseAlarmGuards({ claims, judgeVerdicts, sections });

  const judgeSkipped = judgeShouldRun ? 0 : needJudge.length;
  const verdicts = [...deterministicVerdicts, ...judgeVerdicts];
  const summary = summarizeVerification({
    claims,
    deterministicVerdicts,
    judgeSkipped,
    judgeVerdicts,
  });
  const hardFail = summary.hardFailCount > 0;
  const needsReview = !hardFail && summary.needsReviewCount > 0;
  const repairIssues = verdicts
    .filter((verdict) => verdict.flag !== "PASS")
    .map(
      (verdict) =>
        `paid-media verifier ${verdict.flag} ${verdict.id}: ${verdict.reason}`,
    );

  if (!judgeShouldRun && judgeSkipped > 0) {
    repairIssues.push(
      `paid-media verifier judge skipped for ${judgeSkipped} claim(s); marking needs_review`,
    );
  }

  return {
    verdicts,
    claims,
    summary,
    hardFail,
    needsReview,
    repairIssues,
  };
}
