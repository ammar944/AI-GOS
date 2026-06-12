import { z } from "zod";

import { sectionWriterModel, type SectionLanguageModel } from "../ai/models";
import {
  createTolerantDecodeShortfallError,
  tolerantDecode,
} from "../artifacts/tolerant-decode";
import type { CrossSectionFactConflict } from "./cross-section-facts";
import {
  reconcileFactLedgerForMemo,
  type Contradiction,
} from "./synthesis/contradictions";
import {
  ledgerWinnerReadings,
  type FactLedger,
  type FactLedgerFact,
  type FactLedgerReading,
} from "./synthesis/fact-ledger";
import type { PaidMediaFeasibilityAudit } from "./synthesis/feasibility";
import {
  extractNumericTokens,
  numericCoherenceGapLine,
  scrubInternalJargon,
  type BriefFidelityStrike,
} from "./verification/numeric-coherence";
import {
  defaultStructuredCaller,
  type StructuredCaller,
} from "./section-agent";

export const executiveBriefTimeoutMs = 120_000;
export const executiveBriefMaxOutputTokens = 8_192;
const maxDecisions = 5;

export interface ExecutiveBriefSectionInput {
  sectionId: string;
  sectionTitle: string;
  verdict: string;
  statusSummary: string;
  body: Record<string, unknown>;
  // Persisted verification tier + confidence for the committed section row.
  // Optional so callers without DB context (tests, fixtures) stay valid;
  // when present the memo marks decisions resting on weak sections as
  // directional.
  verificationTier?: "verified" | "needs_review" | "insufficient" | null;
  verificationConfidence?: number | null;
}

export interface ExecutiveBriefRankedMove {
  rank: number;
  move: string;
  provingSections: string[];
}

export interface ExecutiveBriefResolvedConflict {
  factKey: string;
  label?: string;
  readings: Array<{ sectionId: string; value: string }>;
  resolution: string;
  setAsideCount?: number;
  winningSectionId: string;
}

export interface ExecutiveBriefDecision {
  decision: string;
  cost: string;
  confidenceGrade: "A" | "B" | "C";
  confidenceBasis: string;
  bestEvidence: {
    statement: string;
    sourceUrl?: string;
    sectionRef?: string;
  };
  provesWrongIf: {
    metric: string;
    threshold: string;
    window: string;
  };
}

export interface ExecutiveBriefAssumptionToConfirm {
  value: string;
  statement: string;
  sectionRef: string;
  reason: string;
}

export interface ExecutiveBriefAppendix {
  factLedger: FactLedger;
  contradictions: Contradiction[];
}

export interface ExecutiveBriefResult {
  thesis: string;
  decisions: ExecutiveBriefDecision[];
  assumptionsToConfirm: ExecutiveBriefAssumptionToConfirm[];
  appendix: ExecutiveBriefAppendix;
  executiveThesis: string;
  rankedMoves: ExecutiveBriefRankedMove[];
  factConflicts: ExecutiveBriefResolvedConflict[];
  feasibilityAudit?: PaidMediaFeasibilityAudit;
  fidelityStrikes: BriefFidelityStrike[];
}

export interface RunExecutiveBriefParams {
  sections: readonly ExecutiveBriefSectionInput[];
  conflicts: readonly CrossSectionFactConflict[];
  companyName: string;
  companyWebsiteUrl: string;
  factLedger?: FactLedger;
  contradictions?: readonly Contradiction[];
  feasibilityAudit?: PaidMediaFeasibilityAudit;
  evidencePoolBlock?: string;
  signal?: AbortSignal;
  callStructured?: StructuredCaller;
  model?: SectionLanguageModel;
}

interface ParsedBrief {
  thesis: string;
  decisions: ExecutiveBriefDecision[];
  assumptionsToConfirm: ExecutiveBriefAssumptionToConfirm[];
  factConflicts: z.infer<typeof rawBriefSchema>["factConflicts"];
}

interface NumericEvidence {
  rawValues: Set<string>;
  values: number[];
}

const bestEvidenceSchema = z
  .object({
    statement: z.string().min(1),
    sourceUrl: z.string().url().optional(),
    sectionRef: z.string().min(1).optional(),
  })
  .strict();

const provesWrongIfSchema = z
  .object({
    metric: z.string().min(1),
    threshold: z.string().min(1),
    window: z.string().min(1),
  })
  .strict();

const decisionSchema = z
  .object({
    decision: z.string().min(1),
    cost: z.string().min(1),
    confidenceGrade: z.enum(["A", "B", "C"]),
    confidenceBasis: z.string().min(1),
    bestEvidence: bestEvidenceSchema,
    provesWrongIf: provesWrongIfSchema,
  })
  .strict();

const assumptionSchema = z
  .object({
    value: z.string().min(1),
    statement: z.string().min(1),
    sectionRef: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();

const legacyMoveSchema = z
  .object({
    rank: z.number(),
    move: z.string().min(1),
    provingSections: z.array(z.string()),
  })
  .strict();

const rawBriefSchema = z
  .object({
    thesis: z.string().min(1).optional(),
    executiveThesis: z.string().min(1).optional(),
    decisions: z.array(decisionSchema).optional(),
    rankedMoves: z.array(legacyMoveSchema).optional(),
    assumptionsToConfirm: z.array(assumptionSchema).optional(),
    factConflicts: z
      .array(
        z
          .object({
            factKey: z.string().min(1),
            resolution: z.string().min(1),
            winningSectionId: z.string(),
          })
          .strict(),
      )
      .default([]),
  })
  .passthrough();

const briefInstructions = [
  "You are writing the executive decision memo for a paid GTM research report.",
  "Use only the deterministic synthesis packet. Do not recompute math and do not introduce new numbers.",
  "If evidence disagrees, write a client-language caveat. Never write repair instructions, contradiction IDs, field names, or process vocabulary.",
  "Do not use the phrase 'Resolve contradiction'.",
  "",
  "Return:",
  "1. thesis: <=120 words, one argument the whole report proves.",
  "2. decisions: 3-5 items. Each decision needs cost, confidenceGrade A/B/C with confidenceBasis, bestEvidence, and provesWrongIf.",
  "3. assumptionsToConfirm: include only assumptions provided in the prompt. Do not invent new assumptions.",
  "",
  "Mark any decision that rests primarily on a section whose verification line reads needs_review or insufficient as 'directional', with one clause naming the weak section (e.g. \"Directional — competitor pricing verified needs_review.\"). Do not hedge decisions backed by verified sections.",
  "",
  "The LLM may phrase; TypeScript owns fact selection, contradictions, and feasibility math.",
].join("\n");

function emptyFactLedger({
  companyName,
}: {
  companyName: string;
}): FactLedger {
  return {
    absentSections: [],
    facts: [],
    keywordMetrics: [],
    subjectName: companyName,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    out.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, out);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const child of Object.values(value)) {
    collectStrings(child, out);
  }
}

function sectionKeyFindings(section: ExecutiveBriefSectionInput): string[] {
  const keyFindings = section.body.keyFindings;

  if (!Array.isArray(keyFindings)) {
    return [];
  }

  return keyFindings.flatMap((finding) =>
    typeof finding === "string" ? [finding] : [],
  );
}

function factSummary(fact: FactLedgerFact): string {
  const winner = fact.winner;
  const readings = fact.readings
    .map((reading) => `${reading.sectionId}: ${reading.value} (${reading.basis})`)
    .join("; ");

  return [
    `${fact.label}`,
    winner === undefined
      ? "winner: none"
      : `winner: ${winner.value} from ${winner.sectionId}`,
    `disputed: ${fact.disputed ? "yes" : "no"}`,
    `readings: ${readings}`,
  ].join(" | ");
}

function factLabel(factKey: string): string {
  return factKey
    .replace(/^subject-price:/, "Subject price: ")
    .replace(/^competitor-price:/, "Competitor price: ")
    .replace(/^keyword-cluster:/, "Keyword cluster: ")
    .replace(/^ARR$/, "ARR")
    .replace(/^acv$/, "ACV")
    .replace(/^cac-target$/, "CAC target")
    .replace(/^customer-count$/, "Customer count")
    .replace(/^monthly-budget$/, "Monthly budget")
    .replace(/^sales-cycle-days$/, "Sales cycle")
    .replace(/-/g, " ");
}

function clientBasis(value: string): string {
  if (/brief-supplied/i.test(value)) {
    return "brief";
  }

  if (/measured-tool-data/i.test(value)) {
    return "measured";
  }

  if (/subject-own-page-sourced|corroborated-secondary/i.test(value)) {
    return "sourced";
  }

  if (/derived/i.test(value)) {
    return "derived";
  }

  if (/benchmark/i.test(value)) {
    return "benchmark";
  }

  return "selected";
}

function sectionLabel(sectionId: string | undefined): string {
  if (sectionId === undefined) {
    return "another section";
  }

  const labels: Record<string, string> = {
    deepResearchProgram: "the research corpus",
    positioningBuyerICP: "Buyer & ICP Validation",
    positioningCompetitorLandscape: "Competitor Landscape",
    positioningDemandIntent: "Demand & Intent",
    positioningMarketCategory: "Market & Category",
    positioningOfferDiagnostic: "Offer Diagnostic",
    positioningPaidMediaPlan: "Paid Media Plan",
    positioningVoiceOfCustomer: "Voice of Customer",
  };

  return labels[sectionId] ?? "another section";
}

function clientContradictionLine(contradiction: Contradiction): string {
  if (contradiction.kind === "strategic") {
    return [
      `${sectionLabel(contradiction.sections[0])} disagrees with measured demand volume.`,
      "We use the measured demand data and keep scale as a caveat.",
    ].join(" ");
  }

  if (contradiction.kind === "numeric") {
    return [
      contradiction.description.replace(/\s+has disagreeing readings:.*/i, ""),
      "readings disagree.",
      contradiction.resolved
        ? contradiction.resolution
        : "We keep the figure as a caveat instead of making it a spend premise.",
    ].join(" ");
  }

  return contradiction.resolution;
}

function inheritedClaimText(contradiction: Contradiction): string | undefined {
  if (contradiction.kind !== "inherited-stripped-claim") {
    return undefined;
  }

  const separatorIndex = contradiction.description.indexOf(": ");

  return separatorIndex === -1
    ? undefined
    : contradiction.description.slice(separatorIndex + 2).trim();
}

function resolvedInheritedContradiction(
  contradiction: Contradiction,
  claim: string | undefined,
): Contradiction {
  return {
    ...contradiction,
    resolution: inheritedResolution(claim),
    resolved: true,
    severity: "warning",
  };
}

function claimNeedle(claim: string): string | undefined {
  const quoted = /['"`]([^'"`]{4,})['"`]/.exec(claim);

  if (quoted !== null) {
    return quoted[1].toLowerCase();
  }

  const moneyOrPercent = claim.match(
    /\$?\d[\d,]*(?:\.\d+)?(?:\s?[KMBkmb]\b)?(?:\s*[-–]\s*\$?\d[\d,]*(?:\.\d+)?(?:\s?[KMBkmb]\b)?)?(?:%|\/(?:click|lead|trial|mo|month))?/,
  );

  if (moneyOrPercent !== null) {
    return moneyOrPercent[0].toLowerCase();
  }

  const normalized = claim.replace(/\s+/g, " ").trim().toLowerCase();

  return normalized.length >= 24 ? normalized.slice(0, 120) : undefined;
}

function stripNeedleFromText({
  needle,
  value,
}: {
  needle: string;
  value: string;
}): string {
  if (!value.toLowerCase().includes(needle)) {
    return value;
  }

  const sentences = value.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter(
    (sentence) => !sentence.toLowerCase().includes(needle),
  );
  const next =
    kept.length === sentences.length
      ? value.replace(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), "")
      : kept.join(" ");
  const cleaned = next
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();

  return cleaned.length === 0 ? numericCoherenceGapLine : cleaned;
}

function stripNeedleFromValue({
  needle,
  value,
}: {
  needle: string;
  value: unknown;
}): unknown {
  if (typeof value === "string") {
    return stripNeedleFromText({ needle, value });
  }

  if (Array.isArray(value)) {
    return value.map((item) => stripNeedleFromValue({ needle, value: item }));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      stripNeedleFromValue({ needle, value: child }),
    ]),
  );
}

function inheritedResolution(claim: string | undefined): string {
  if (claim !== undefined && /\$/.test(claim)) {
    return "We set aside an unverified price range that two sections repeated from each other.";
  }

  if (claim !== undefined && /%/.test(claim)) {
    return "We set aside an unverified percentage that two sections repeated from each other.";
  }

  return "We set aside an unverified claim that two sections repeated from each other.";
}

function resolveInheritedContradictions({
  contradictions,
  sections,
}: {
  contradictions: readonly Contradiction[];
  sections: readonly ExecutiveBriefSectionInput[];
}): {
  contradictions: Contradiction[];
  sections: ExecutiveBriefSectionInput[];
} {
  let nextSections = sections.map((section) => ({
    ...section,
    body: { ...section.body },
  }));

  const nextContradictions = contradictions.map((contradiction) => {
    if (
      contradiction.kind !== "inherited-stripped-claim" ||
      contradiction.resolved
    ) {
      return contradiction;
    }

    const claim = inheritedClaimText(contradiction);
    const needle = claim === undefined ? undefined : claimNeedle(claim);
    const dependentSectionId = contradiction.sections[1];

    if (needle !== undefined && dependentSectionId !== undefined) {
      nextSections = nextSections.map((section) => {
        if (section.sectionId !== dependentSectionId) {
          return section;
        }

        return {
          ...section,
          body: stripNeedleFromValue({
            needle,
            value: section.body,
          }) as Record<string, unknown>,
          statusSummary: stripNeedleFromText({
            needle,
            value: section.statusSummary,
          }),
          verdict: stripNeedleFromText({
            needle,
            value: section.verdict,
          }),
        };
      });
    }

    return resolvedInheritedContradiction(contradiction, claim);
  });

  return {
    contradictions: nextContradictions,
    sections: nextSections,
  };
}

function evidenceDisagreementBlock(
  contradictions: readonly Contradiction[],
): string {
  const bullets = contradictions
    .filter((contradiction) => !contradiction.resolved)
    .slice(0, 3)
    .map((contradiction) => `- ${clientContradictionLine(contradiction)}`);

  if (bullets.length === 0) {
    return "";
  }

  return ["", "## Where the evidence disagrees", ...bullets].join("\n");
}

function appendEvidenceDisagreements({
  contradictions,
  thesis,
}: {
  contradictions: readonly Contradiction[];
  thesis: string;
}): string {
  const block = evidenceDisagreementBlock(contradictions);

  return block.length === 0 ? thesis : `${thesis.trim()}\n${block}`;
}

function feasibilitySummary(
  feasibilityAudit: PaidMediaFeasibilityAudit | undefined,
): string {
  if (feasibilityAudit === undefined) {
    return "not available";
  }

  return JSON.stringify(feasibilityAudit, null, 1);
}

function sectionVerificationLine(section: ExecutiveBriefSectionInput): string {
  const tier = section.verificationTier ?? "unknown";
  const confidence =
    typeof section.verificationConfidence === "number" &&
    Number.isFinite(section.verificationConfidence)
      ? ` (confidence ${section.verificationConfidence.toFixed(2)})`
      : "";

  return `verification: ${tier}${confidence}`;
}

function buildBriefPrompt({
  assumptionsToConfirm,
  params,
}: {
  assumptionsToConfirm: readonly ExecutiveBriefAssumptionToConfirm[];
  params: RunExecutiveBriefParams;
}): string {
  const factLedger = params.factLedger ?? emptyFactLedger({ companyName: params.companyName });
  const contradictions = params.contradictions ?? [];
  const sectionBlock = params.sections
    .map((section) =>
      [
        `### ${section.sectionId} — ${section.sectionTitle}`,
        `verdict: ${section.verdict}`,
        sectionVerificationLine(section),
        `statusSummary: ${section.statusSummary}`,
        `keyFindings: ${JSON.stringify(sectionKeyFindings(section))}`,
      ].join("\n"),
    )
    .join("\n\n");

  return [
    `Company: ${params.companyName} (${params.companyWebsiteUrl})`,
    "",
    "FACT LEDGER WINNERS AND DISPUTES:",
    factLedger.facts.length === 0
      ? "none"
      : factLedger.facts.map(factSummary).join("\n"),
    "",
    "EVIDENCE DISAGREEMENTS TO HANDLE AS CLIENT-LANGUAGE CAVEATS:",
    contradictions.length === 0
      ? "none"
      : contradictions.map(clientContradictionLine).join("\n"),
    "",
    "FEASIBILITY AUDIT:",
    feasibilitySummary(params.feasibilityAudit),
    "",
    "RUN-LEVEL EVIDENCE POOL:",
    params.evidencePoolBlock ?? "not available",
    "",
    "ASSUMPTIONS TO CONFIRM (copy these exactly if needed):",
    assumptionsToConfirm.length === 0
      ? "none"
      : JSON.stringify(assumptionsToConfirm, null, 1),
    "",
    "SECTION VERDICTS AND FINDINGS:",
    sectionBlock,
  ].join("\n");
}

function alignConflicts({
  conflicts,
  factLedger,
  modelConflicts,
}: {
  conflicts: readonly CrossSectionFactConflict[];
  factLedger: FactLedger;
  modelConflicts: z.infer<typeof rawBriefSchema>["factConflicts"];
}): ExecutiveBriefResolvedConflict[] {
  const resolvedFacts = factLedger.facts
    .filter((fact) => fact.disputed && fact.winner !== undefined)
    .slice(0, 6)
    .map((fact): ExecutiveBriefResolvedConflict => {
      const winner = fact.winner;
      const setAsideCount = Math.max(0, fact.readings.length - 1);
      const label = fact.label || factLabel(fact.factKey);
      const basis = clientBasis(fact.winnerBasis);
      const figureWord = setAsideCount === 1 ? "figure" : "figures";

      return {
        factKey: fact.factKey,
        label,
        readings: fact.readings.map((reading) => ({
          sectionId: reading.sectionId,
          value: reading.value,
        })),
        resolution:
          winner === undefined
            ? `${label}: we kept this as a caveat because the readings disagree.`
            : `${label}: we use ${winner.value} (${basis}); ${setAsideCount} conflicting ${figureWord} set aside.`,
        setAsideCount,
        winningSectionId: winner?.sectionId ?? "",
      };
    });

  if (resolvedFacts.length > 0) {
    return resolvedFacts;
  }

  return conflicts.map((conflict) => {
    const resolved = modelConflicts.find(
      (candidate) => candidate.factKey === conflict.factKey,
    );

    return {
      factKey: conflict.factKey,
      readings: conflict.readings.map((reading) => ({
        sectionId: reading.sectionId,
        value: reading.value,
      })),
      resolution:
        resolved?.resolution ??
        "unresolved — readings disagree; verify against the cited sections before using this figure.",
      winningSectionId: resolved?.winningSectionId ?? "",
    };
  });
}

function fallbackDecisionFromMove(
  move: z.infer<typeof legacyMoveSchema>,
): ExecutiveBriefDecision {
  const sectionRef = move.provingSections[0];

  return {
    bestEvidence: {
      statement: "Legacy ranked move; evidence section retained for compatibility.",
      ...(sectionRef === undefined ? {} : { sectionRef }),
    },
    confidenceBasis: "Legacy brief did not grade confidence.",
    confidenceGrade: "C",
    cost: "assumption",
    decision: move.move,
    provesWrongIf: {
      metric: "decision outcome",
      threshold: "not achieved",
      window: "next review cycle",
    },
  };
}

function normalizeDecisionCount(
  decisions: readonly ExecutiveBriefDecision[],
): ExecutiveBriefDecision[] {
  return decisions.slice(0, maxDecisions);
}

function parseBrief(raw: unknown): ParsedBrief {
  if (!isRecord(raw)) {
    throw new Error("executive brief returned a non-object result");
  }

  const decoded = tolerantDecode(rawBriefSchema, raw, {
    sectionId: "executive-brief",
  });

  if (!decoded.ok) {
    throw createTolerantDecodeShortfallError({
      context: "executive brief decode failed",
      shortfalls: decoded.shortfalls,
    });
  }

  if (decoded.snaps.length > 0) {
    console.info("[executive-brief] tolerant decode repaired output", {
      repairs: decoded.snaps,
    });
  }

  const parsed = decoded.value;
  const thesis = parsed.thesis ?? parsed.executiveThesis;

  if (thesis === undefined) {
    throw new Error("executive brief omitted thesis");
  }

  const decisions =
    parsed.decisions ??
    [...(parsed.rankedMoves ?? [])]
      .sort((left, right) => left.rank - right.rank)
      .map(fallbackDecisionFromMove);

  return {
    assumptionsToConfirm: parsed.assumptionsToConfirm ?? [],
    decisions: normalizeDecisionCount(decisions),
    factConflicts: parsed.factConflicts,
    thesis,
  };
}

function moneyOrPercentTokenValues(text: string): string[] {
  return extractNumericTokens(text)
    .filter((token) => token.raw.includes("$") || token.raw.includes("%"))
    .map((token) => token.raw);
}

function collectOperatorAssumptions(
  params: RunExecutiveBriefParams,
): ExecutiveBriefAssumptionToConfirm[] {
  const ledger = params.factLedger ?? emptyFactLedger({ companyName: params.companyName });
  const ledgerWinnerValues = new Set(
    ledgerWinnerReadings(ledger).map((reading) => reading.value.toLowerCase()),
  );
  const assumptions: ExecutiveBriefAssumptionToConfirm[] = [];
  const seen = new Set<string>();

  for (const section of params.sections) {
    const strings: string[] = [];

    collectStrings(section.body, strings);
    strings.push(section.verdict, section.statusSummary);

    for (const text of strings) {
      if (
        !/\b(?:CAC|CPL|ACV|budget|spend|CPC|CPM|conversion|trial|paid|sales cycle|benchmark|unverified|unknown|estimate)\b/i.test(
          text,
        )
      ) {
        continue;
      }

      for (const token of moneyOrPercentTokenValues(text)) {
        const key = `${section.sectionId}:${token}:${text.slice(0, 80)}`;

        if (seen.has(key) || ledgerWinnerValues.has(token.toLowerCase())) {
          continue;
        }

        seen.add(key);
        assumptions.push({
          reason:
            /unverified|unknown|estimate|benchmark|client brief/i.test(text)
              ? "Figure is labeled as unverified, unknown, estimated, benchmarked, or client-brief-derived."
              : "Operator-economics figure is not a fact-ledger winner.",
          sectionRef: section.sectionId,
          statement: text.replace(/\s+/g, " ").slice(0, 220),
          value: token,
        });
      }
    }
  }

  return assumptions;
}

function addNumericEvidenceFromValue(value: unknown, evidence: NumericEvidence): void {
  if (typeof value === "number" && Number.isFinite(value)) {
    evidence.values.push(value);
    evidence.rawValues.add(String(value).toLowerCase());
    return;
  }

  if (typeof value === "string") {
    evidence.rawValues.add(value.toLowerCase());
    for (const token of extractNumericTokens(value)) {
      for (const numericValue of token.values) {
        evidence.values.push(numericValue);
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      addNumericEvidenceFromValue(item, evidence);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const child of Object.values(value)) {
    addNumericEvidenceFromValue(child, evidence);
  }
}

function buildNumericEvidence({
  assumptionsToConfirm,
  factLedger,
  feasibilityAudit,
}: {
  assumptionsToConfirm: readonly ExecutiveBriefAssumptionToConfirm[];
  factLedger: FactLedger;
  feasibilityAudit?: PaidMediaFeasibilityAudit;
}): NumericEvidence {
  const evidence: NumericEvidence = { rawValues: new Set<string>(), values: [] };

  for (const reading of ledgerWinnerReadings(factLedger)) {
    addNumericEvidenceFromValue(reading.value, evidence);
    addNumericEvidenceFromValue(reading.normalizedValue, evidence);
  }

  for (const assumption of assumptionsToConfirm) {
    addNumericEvidenceFromValue(assumption.value, evidence);
  }

  addNumericEvidenceFromValue(feasibilityAudit, evidence);

  return evidence;
}

function numericTokenAllowed({
  evidence,
  raw,
  values,
}: {
  evidence: NumericEvidence;
  raw: string;
  values: readonly number[];
}): boolean {
  const normalizedRaw = raw.toLowerCase().replace(/^[~\s]+/, "").trim();

  for (const candidate of evidence.rawValues) {
    if (candidate.includes(normalizedRaw)) {
      return true;
    }
  }

  return values.every((value) =>
    evidence.values.some((candidate) => {
      const denominator = Math.max(Math.abs(candidate), 1);

      return Math.abs(candidate - value) / denominator <= 0.02;
    }),
  );
}

function scrubFieldNumbers({
  evidence,
  field,
  sentenceMode,
  value,
}: {
  evidence: NumericEvidence;
  field: string;
  sentenceMode: boolean;
  value: string;
}): { strikes: BriefFidelityStrike[]; value: string } {
  const jargon = scrubInternalJargon({ field, value });
  const strikes: BriefFidelityStrike[] = jargon.strikes.map((strike) => ({
    field: strike.field,
    kind:
      strike.pattern === "section-id-humanized"
        ? "section-id-humanized"
        : "internal-jargon",
    removedText: strike.removedText,
  }));
  const sentences = sentenceMode
    ? jargon.value.split(/(?<=[.!?])\s+/)
    : [jargon.value];
  const kept: string[] = [];

  for (const sentence of sentences) {
    const unknown = extractNumericTokens(sentence).filter(
      (token) =>
        (token.raw.includes("$") || token.raw.includes("%")) &&
        !numericTokenAllowed({
          evidence,
          raw: token.raw,
          values: token.values,
        }),
    );

    if (unknown.length === 0) {
      kept.push(sentence);
      continue;
    }

    strikes.push(
      ...unknown.map((token) => ({
        field,
        kind: "number-untraceable" as const,
        removedText: sentenceMode ? sentence : token.raw,
      })),
    );

    if (!sentenceMode) {
      let next = sentence;

      for (const token of unknown) {
        next = next
          .replace(token.raw, "")
          .replace(/\s{2,}/g, " ")
          .replace(/\s+([.,;:])/g, "$1")
          .trim();
      }

      kept.push(next.length === 0 ? "assumption" : next);
    }
  }

  const next = kept.join(" ").trim();

  return {
    strikes,
    value: next.length === 0 ? numericCoherenceGapLine : next,
  };
}

function guardDecisionNumbers({
  decision,
  evidence,
  index,
}: {
  decision: ExecutiveBriefDecision;
  evidence: NumericEvidence;
  index: number;
}): { decision: ExecutiveBriefDecision; strikes: BriefFidelityStrike[] } {
  const fields = {
    confidenceBasis: scrubFieldNumbers({
      evidence,
      field: `decisions[${index}].confidenceBasis`,
      sentenceMode: false,
      value: decision.confidenceBasis,
    }),
    cost: scrubFieldNumbers({
      evidence,
      field: `decisions[${index}].cost`,
      sentenceMode: false,
      value: decision.cost,
    }),
    decision: scrubFieldNumbers({
      evidence,
      field: `decisions[${index}].decision`,
      sentenceMode: true,
      value: decision.decision,
    }),
    evidenceStatement: scrubFieldNumbers({
      evidence,
      field: `decisions[${index}].bestEvidence.statement`,
      sentenceMode: true,
      value: decision.bestEvidence.statement,
    }),
    threshold: scrubFieldNumbers({
      evidence,
      field: `decisions[${index}].provesWrongIf.threshold`,
      sentenceMode: false,
      value: decision.provesWrongIf.threshold,
    }),
  };

  return {
    decision: {
      ...decision,
      bestEvidence: {
        ...decision.bestEvidence,
        statement: fields.evidenceStatement.value,
      },
      confidenceBasis: fields.confidenceBasis.value,
      cost: fields.cost.value,
      decision: fields.decision.value,
      provesWrongIf: {
        ...decision.provesWrongIf,
        threshold: fields.threshold.value,
      },
    },
    strikes: [
      ...fields.confidenceBasis.strikes,
      ...fields.cost.strikes,
      ...fields.decision.strikes,
      ...fields.evidenceStatement.strikes,
      ...fields.threshold.strikes,
    ],
  };
}

function guardBriefNumbers({
  assumptionsToConfirm,
  brief,
  factLedger,
  feasibilityAudit,
}: {
  assumptionsToConfirm: readonly ExecutiveBriefAssumptionToConfirm[];
  brief: ParsedBrief;
  factLedger: FactLedger;
  feasibilityAudit?: PaidMediaFeasibilityAudit;
}): { brief: ParsedBrief; strikes: BriefFidelityStrike[] } {
  const evidence = buildNumericEvidence({
    assumptionsToConfirm,
    factLedger,
    feasibilityAudit,
  });
  const thesis = scrubFieldNumbers({
    evidence,
    field: "thesis",
    sentenceMode: true,
    value: brief.thesis,
  });
  const guardedDecisions = brief.decisions.map((decision, index) =>
    guardDecisionNumbers({ decision, evidence, index }),
  );

  return {
    brief: {
      ...brief,
      decisions: guardedDecisions.map((decision) => decision.decision),
      thesis: thesis.value,
    },
    strikes: [
      ...thesis.strikes,
      ...guardedDecisions.flatMap((decision) => decision.strikes),
    ],
  };
}

function rankedMovesFromDecisions(
  decisions: readonly ExecutiveBriefDecision[],
): ExecutiveBriefRankedMove[] {
  return decisions
    .filter((decision) => {
      const text = decision.decision;

      return (
        text.trim().length > 0 &&
        !/insufficient synthesized evidence|confirm the missing evidence|resolve contradiction/i.test(
          text,
        )
      );
    })
    .slice(0, 3)
    .map((decision, index) => ({
      move: decision.decision,
      provingSections:
        decision.bestEvidence.sectionRef === undefined
          ? []
          : [decision.bestEvidence.sectionRef],
      rank: index + 1,
    }));
}

async function callBriefModel({
  assumptionsToConfirm,
  extraInstruction,
  params,
}: {
  assumptionsToConfirm: readonly ExecutiveBriefAssumptionToConfirm[];
  extraInstruction?: string;
  params: RunExecutiveBriefParams;
}): Promise<ParsedBrief> {
  const callStructured = params.callStructured ?? defaultStructuredCaller;
  const model = params.model ?? sectionWriterModel;
  const abortSignals = [AbortSignal.timeout(executiveBriefTimeoutMs)];

  if (params.signal !== undefined) {
    abortSignals.push(params.signal);
  }

  const raw = await callStructured({
    model,
    schema: rawBriefSchema,
    schemaName: "ExecutiveDecisionMemo",
    schemaDescription:
      "Executive decision memo with thesis, decisions, assumptions, and conflict resolutions.",
    instructions:
      extraInstruction === undefined
        ? briefInstructions
        : `${briefInstructions}\n\n${extraInstruction}`,
    prompt: buildBriefPrompt({ assumptionsToConfirm, params }),
    maxOutputTokens: executiveBriefMaxOutputTokens,
    signal: AbortSignal.any(abortSignals),
  });

  return parseBrief(raw);
}

export async function runExecutiveBrief(
  params: RunExecutiveBriefParams,
): Promise<ExecutiveBriefResult> {
  if (params.sections.length === 0) {
    throw new Error(
      "executive brief requires committed section bodies; refusing to write from nothing",
    );
  }

  const factLedger =
    params.factLedger ?? emptyFactLedger({ companyName: params.companyName });
  const memoFactLedger = reconcileFactLedgerForMemo(factLedger);
  const resolved = resolveInheritedContradictions({
    contradictions: [...(params.contradictions ?? [])],
    sections: params.sections,
  });
  const briefParams: RunExecutiveBriefParams = {
    ...params,
    contradictions: resolved.contradictions,
    factLedger: memoFactLedger,
    sections: resolved.sections,
  };
  const assumptionsToConfirm = collectOperatorAssumptions(briefParams);
  let parsed = await callBriefModel({
    assumptionsToConfirm,
    params: briefParams,
  });
  let guarded = guardBriefNumbers({
    assumptionsToConfirm,
    brief: parsed,
    factLedger: memoFactLedger,
    feasibilityAudit: params.feasibilityAudit,
  });

  if (guarded.strikes.length > 0) {
    const violation = guarded.strikes
      .map((strike) => `${strike.field}: ${strike.removedText}`)
      .join("; ");

    parsed = await callBriefModel({
      assumptionsToConfirm,
      extraInstruction: `Numeric fidelity violation from the previous draft: ${violation}. Rewrite without those numbers unless they appear exactly in the fact ledger winners, feasibility audit, or assumptionsToConfirm.`,
      params: briefParams,
    });
    guarded = guardBriefNumbers({
      assumptionsToConfirm,
      brief: parsed,
      factLedger: memoFactLedger,
      feasibilityAudit: params.feasibilityAudit,
    });
  }

  const executiveThesis = appendEvidenceDisagreements({
    contradictions: resolved.contradictions,
    thesis: guarded.brief.thesis,
  });
  const rankedMoves = rankedMovesFromDecisions(guarded.brief.decisions);

  return {
    appendix: {
      contradictions: resolved.contradictions,
      factLedger: memoFactLedger,
    },
    assumptionsToConfirm,
    decisions: guarded.brief.decisions,
    executiveThesis,
    factConflicts: alignConflicts({
      conflicts: params.conflicts,
      factLedger: memoFactLedger,
      modelConflicts: guarded.brief.factConflicts,
    }),
    feasibilityAudit: params.feasibilityAudit,
    fidelityStrikes: guarded.strikes,
    rankedMoves,
    thesis: executiveThesis,
  };
}
