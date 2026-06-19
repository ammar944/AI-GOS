import { generateText, Output } from "ai";
import { z } from "zod";

import { sectionRunnerModel } from "../../ai/models";
import { extractClaims } from "./claim-extractor";
import { numericValueIsBriefEconomicsSupported } from "./evidence-support";
import type {
  Claim,
  ClaimVerdict,
  EntailmentVerdict,
  VerificationReport,
  VerificationSourceRef,
} from "./types";

export interface CapturedToolResult {
  toolName: string;
  output: unknown;
  input?: unknown;
  type?: string;
}

export interface CorpusExcerptForVerification {
  text: string;
  sourceUrl: string;
}

export interface StructuralVerifierInput {
  body: unknown;
  toolResults: readonly CapturedToolResult[];
  corpusExcerpts: readonly CorpusExcerptForVerification[];
  onboarding?: unknown;
}

export interface EntailmentEvidenceSource {
  sourceIndex: number;
  ref: VerificationSourceRef;
  text: string;
}

export interface EntailmentJudgeInput {
  claims: readonly Claim[];
  sources: readonly EntailmentEvidenceSource[];
  signal?: AbortSignal;
}

export interface EntailmentJudgeVerdict {
  claimIndex: number;
  verdict: EntailmentVerdict;
  sourceIndex?: number;
  rationale?: string;
}

export interface EntailmentJudgeResult {
  verdicts: readonly EntailmentJudgeVerdict[];
}

export type EntailmentJudge = (
  input: EntailmentJudgeInput,
) => Promise<EntailmentJudgeResult>;

export interface StructuralVerifierWithEntailmentInput
  extends StructuralVerifierInput {
  judge?: EntailmentJudge;
  signal?: AbortSignal;
}

interface SearchableString {
  path: string;
  value: string;
}

interface SearchableSource {
  ref: VerificationSourceRef;
  rawText: string;
  text: string;
  urls: ReadonlySet<string>;
}

const urlPattern = /https?:\/\/[^\s)"'>\]}]+/gi;
const sourceAttributionEntityPattern =
  /\b(?:[A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*){0,3}|[A-Z]{2,}\d*)\b/g;
const maxJudgeSourceTextLength = 2_000;
const maxJudgeSources = 80;
const maxJudgeOutputTokens = 4_096;
const sourceAttributionEntityStopWords = new Set([
  "A",
  "An",
  "And",
  "As",
  "At",
  "Both",
  "But",
  "By",
  "Confidence",
  "Evidence",
  "For",
  "From",
  "High",
  "If",
  "In",
  "Into",
  "Low",
  "Medium",
  "Of",
  "On",
  "Or",
  "Per",
  "Source",
  "Sources",
  "That",
  "The",
  "These",
  "This",
  "Those",
  "To",
  "When",
  "Where",
  "With",
]);

const entailmentJudgeVerdictSchema = z
  .object({
    claimIndex: z
      .number()
      .int()
      .describe("Zero-based index of the claim being judged."),
    verdict: z.enum(["supported", "refuted", "user_asserted"]),
    sourceIndex: z
      .number()
      .int()
      .describe("sourceIndex for the strongest supporting source, when any.")
      .optional(),
    rationale: z.string().describe("Brief evidence-based reason.").optional(),
  })
  .strict();

const entailmentJudgeResultSchema = z
  .object({
    verdicts: z.array(entailmentJudgeVerdictSchema),
  })
  .strict();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSearchText(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

function cleanUrl(value: string): string {
  return value.replace(/[.,;:!?]+$/g, "");
}

function collectStrings(value: unknown, path = "$"): SearchableString[] {
  if (typeof value === "string") {
    return [{ path, value }];
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [{ path, value: String(value) }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectStrings(item, `${path}[${index}]`));
  }

  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, childValue]) =>
    collectStrings(childValue, `${path}.${key}`),
  );
}

function extractUrls(value: string): string[] {
  return Array.from(value.matchAll(urlPattern), (match) => cleanUrl(match[0]));
}

function buildToolResultSource(
  toolResult: CapturedToolResult,
  stepIndex: number,
): SearchableSource {
  const strings = [
    ...collectStrings(toolResult.output, "$.output"),
    ...collectStrings(toolResult.input, "$.input"),
  ];
  const text = strings.map((item) => item.value).join(" ");
  const urls = new Set(strings.flatMap((item) => extractUrls(item.value)));

  return {
    ref: {
      kind: "toolResult",
      toolName: toolResult.toolName,
      stepIndex,
    },
    rawText: normalizeWhitespace(text),
    text: normalizeSearchText(text),
    urls,
  };
}

function buildCorpusSource(
  excerpt: CorpusExcerptForVerification,
  excerptIndex: number,
): SearchableSource {
  return {
    ref: {
      kind: "corpusExcerpt",
      excerptIndex,
      sourceUrl: excerpt.sourceUrl,
    },
    rawText: normalizeWhitespace(`${excerpt.text} ${excerpt.sourceUrl}`),
    text: normalizeSearchText(`${excerpt.text} ${excerpt.sourceUrl}`),
    urls: new Set([excerpt.sourceUrl, ...extractUrls(excerpt.text)]),
  };
}

function formatUserProvidedField(path: string): string | undefined {
  const field = path
    .replace(/^\$\./, "")
    .replace(/^\$/, "")
    .replace(/\[(\d+)\]/g, ".$1");

  return field.length === 0 ? undefined : field;
}

function buildUserProvidedSources(onboarding: unknown): SearchableSource[] {
  return collectStrings(onboarding).map((item) => {
    const field = formatUserProvidedField(item.path);

    return {
      ref: {
        kind: "userProvided",
        ...(field === undefined ? {} : { field }),
      },
      rawText: normalizeWhitespace(item.value),
      text: normalizeSearchText(item.value),
      urls: new Set(extractUrls(item.value)),
    };
  });
}

function buildSearchableSources({
  corpusExcerpts,
  onboarding,
  toolResults,
}: Omit<StructuralVerifierInput, "body">): SearchableSource[] {
  return [
    ...toolResults.map((toolResult, index) =>
      buildToolResultSource(toolResult, index),
    ),
    ...corpusExcerpts.map((excerpt, index) => buildCorpusSource(excerpt, index)),
    ...(onboarding === undefined ? [] : buildUserProvidedSources(onboarding)),
  ];
}

function stripCurrencyDecimals(value: string): string {
  return value.replace(/([$£€]\s?\d[\d,]*)\.00\b/g, "$1");
}

function expandMagnitude(value: string): string {
  return value
    .replace(/\b(\d+(?:\.\d+)?)\s?k\b/gi, "$1 thousand")
    .replace(/\b(\d+(?:\.\d+)?)\s?m\b/gi, "$1 million")
    .replace(/\b(\d+(?:\.\d+)?)\s?b\b/gi, "$1 billion");
}

function isNumericRangeClaim(value: string): boolean {
  return /\d[\d,]*(?:\.\d+)?(?:\s?(?:k|m|b|thousand|million|billion)\b|%)?\s*(?:-|–|—|to)\s*[$£€]?\s?\d[\d,]*(?:\.\d+)?/iu.test(
    value,
  );
}

function normalizeRangeSeparators(value: string): string {
  return normalizeSearchText(value).replace(/\s*(?:-|–|—|\bto\b)\s*/gu, "-");
}

function buildNumericRangeNeedles(value: string): string[] {
  const normalized = normalizeRangeSeparators(value);
  const withoutDecimals = normalizeRangeSeparators(stripCurrencyDecimals(value));
  const expandedMagnitude = normalizeRangeSeparators(expandMagnitude(value));
  const monthlyVariant = withoutDecimals
    .replace(/\s?\/\s?mo\b/g, " per month")
    .replace(/\s?\/\s?month\b/g, " per month");
  const variants = [
    normalized,
    withoutDecimals,
    expandedMagnitude,
    monthlyVariant,
  ];

  return Array.from(
    new Set(
      variants
        .flatMap((variant) => [variant, variant.replace(/[,+]/g, "")])
        .filter((variant) => variant.length > 0),
    ),
  );
}

function buildNumericNeedles(value: string): string[] {
  if (isNumericRangeClaim(value)) {
    return buildNumericRangeNeedles(value);
  }

  const normalized = normalizeSearchText(value);
  const withoutDecimals = normalizeSearchText(stripCurrencyDecimals(value));
  const expandedMagnitude = normalizeSearchText(expandMagnitude(value));
  const monthlyVariant = withoutDecimals
    .replace(/\s?\/\s?mo\b/g, " per month")
    .replace(/\s?\/\s?month\b/g, " per month");
  const bareCurrency = withoutDecimals.match(/[$£€]\s?\d[\d,]*/)?.[0];
  const variants = [
    normalized,
    withoutDecimals,
    expandedMagnitude,
    monthlyVariant,
    ...(bareCurrency === undefined ? [] : [normalizeSearchText(bareCurrency)]),
  ];

  return Array.from(new Set(variants.filter((variant) => variant.length > 0)));
}

function stripNumericPunctuation(value: string): string {
  return value.replace(/[,+]/g, "");
}

function buildNumericAttributionNeedles(value: string): string[] {
  const numericFragments = Array.from(
    value.matchAll(
      /\d[\d,]*(?:\.\d+)?(?:\s?(?:k|m|b|thousand|million|billion)\b)?/gi,
    ),
    (match) => match[0],
  );
  const variants = [
    ...buildNumericNeedles(value),
    ...numericFragments.flatMap((fragment) => buildNumericNeedles(fragment)),
  ];

  return Array.from(
    new Set(
      variants
        .flatMap((variant) => [variant, stripNumericPunctuation(variant)])
        .filter((variant) => variant.length > 0),
    ),
  );
}

function findUrlMatch(
  claim: Claim,
  sources: readonly SearchableSource[],
): VerificationSourceRef | null {
  const normalizedUrl = cleanUrl(claim.value);

  for (const source of sources) {
    if (source.urls.has(normalizedUrl)) {
      return source.ref;
    }
  }

  return null;
}

function findTextMatch({
  needles,
  sources,
}: {
  needles: readonly string[];
  sources: readonly SearchableSource[];
}): VerificationSourceRef | null {
  for (const source of sources) {
    const commaStrippedText = stripNumericPunctuation(source.text);

    if (
      needles.some(
        (needle) =>
          source.text.includes(needle) || commaStrippedText.includes(needle),
      )
    ) {
      return source.ref;
    }
  }

  return null;
}

function extractSourceAttributionEntities(value: string): string[] {
  const seen = new Set<string>();
  const entities: string[] = [];

  for (const match of value.matchAll(sourceAttributionEntityPattern)) {
    const terms = normalizeWhitespace(match[0])
      .split(/\s+/)
      .filter((term) => term.length > 0);

    while (
      terms.length > 0 &&
      sourceAttributionEntityStopWords.has(terms[0] ?? "")
    ) {
      terms.shift();
    }

    while (
      terms.length > 0 &&
      sourceAttributionEntityStopWords.has(terms[terms.length - 1] ?? "")
    ) {
      terms.pop();
    }

    const entity = terms.join(" ");

    if (
      terms.length === 0 ||
      terms.every((term) => sourceAttributionEntityStopWords.has(term)) ||
      (entity.length < 3 && !/\d/.test(entity))
    ) {
      continue;
    }

    const key = entity.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    entities.push(entity);
  }

  return entities;
}

function sourceTextContainsEntity(sourceText: string, entity: string): boolean {
  const normalizedEntity = normalizeSearchText(entity);

  if (sourceText.includes(normalizedEntity)) {
    return true;
  }

  const tokens = normalizedEntity
    .split(/\s+/)
    .filter((token) => token.length > 0);

  return tokens.length > 0 && tokens.every((token) => sourceText.includes(token));
}

function sourceSupportsAttributionClaim({
  claim,
  source,
}: {
  claim: Extract<Claim, { kind: "sourceAttribution" }>;
  source: SearchableSource;
}): boolean {
  const entities = extractSourceAttributionEntities(claim.value);

  if (entities.length === 0) {
    return true;
  }

  return entities.every((entity) =>
    sourceTextContainsEntity(source.text, entity),
  );
}

function findSourceAttributionMatch(
  claim: Extract<Claim, { kind: "sourceAttribution" }>,
  sources: readonly SearchableSource[],
): VerificationSourceRef | null {
  const citedSources = sources.filter((source) =>
    isSourceAtUrl(source, claim.assertedSourceUrl),
  );

  for (const source of citedSources) {
    if (sourceSupportsAttributionClaim({ claim, source })) {
      return source.ref;
    }
  }

  return null;
}

function isSourceAtUrl(source: SearchableSource, sourceUrl: string): boolean {
  const normalizedSourceUrl = cleanUrl(sourceUrl);

  return (
    (source.ref.kind === "corpusExcerpt" &&
      cleanUrl(source.ref.sourceUrl) === normalizedSourceUrl) ||
    source.urls.has(normalizedSourceUrl)
  );
}

function findClaimMatch(
  claim: Claim,
  sources: readonly SearchableSource[],
): VerificationSourceRef | null {
  if (claim.kind === "url") {
    return findUrlMatch(claim, sources);
  }

  if (claim.kind === "numeric") {
    return findTextMatch({ needles: buildNumericNeedles(claim.value), sources });
  }

  if (claim.kind === "numericAttribution") {
    if (claim.assertedSourceUrl === undefined) {
      return null;
    }

    return findTextMatch({
      needles: buildNumericAttributionNeedles(claim.value),
      sources: sources.filter((source) =>
        isSourceAtUrl(source, claim.assertedSourceUrl ?? ""),
      ),
    });
  }

  if (claim.kind === "sourceAttribution") {
    return findSourceAttributionMatch(claim, sources);
  }

  if (claim.kind === "quote") {
    return findTextMatch({
      needles: [normalizeSearchText(claim.value)],
      sources,
    });
  }

  if (claim.kind === "quoteAttribution") {
    return findTextMatch({
      needles: [normalizeSearchText(claim.value)],
      sources,
    });
  }

  if (claim.value.trim().length < 3) {
    return null;
  }

  return findTextMatch({
    needles: [normalizeSearchText(claim.value)],
    sources,
  });
}

// Operator-provided economics (ACV/CAC/budget splits/sales cycle) often appear
// as DERIVED numbers the model computes from the brief (e.g. $26.25K = 35%×$75K)
// that never substring-match the stored operator string. When the claim's own
// prose self-labels it as operator-supplied, it is honestly `user_asserted`
// (the operator told us; not publicly verified) rather than an unsupported
// public fact. This is an honesty floor — it never promotes a claim to
// `supported` (evidence-corroborated).
const OPERATOR_PROVENANCE_MARKERS = ["operator-supplied", "client brief"];

function hasOperatorProvenanceMarker(claim: Claim): boolean {
  const raw = claim.raw.toLowerCase();
  return OPERATOR_PROVENANCE_MARKERS.some((marker) => raw.includes(marker));
}

export function structuralVerifier({
  body,
  corpusExcerpts,
  onboarding,
  toolResults,
}: StructuralVerifierInput): VerificationReport {
  const sources = buildSearchableSources({
    corpusExcerpts,
    onboarding,
    toolResults,
  });
  const claims = extractClaims(body);
  const briefEconomics =
    typeof onboarding === "object" && onboarding !== null
      ? (onboarding as { economics?: unknown }).economics
      : undefined;
  const verdicts: ClaimVerdict[] = claims.map((claim) => {
    const match = findClaimMatch(claim, sources);

    if (match !== null) {
      return {
        status: "verified",
        claim,
        matchedSourceRef: match,
        entailmentVerdict:
          match.kind === "userProvided" ? "user_asserted" : "supported",
      };
    }

    if (hasOperatorProvenanceMarker(claim)) {
      return {
        status: "verified",
        claim,
        matchedSourceRef: { kind: "userProvided" },
        entailmentVerdict: "user_asserted",
      };
    }

    // Operator-supplied economics (ACV/CAC/LTV/budget) are user_asserted even
    // when the section prose formats the figure differently than the stored
    // brief value. Only credited when the claim's significant money tokens are
    // ALL present in the brief — an invented magnitude stays unsupported.
    if (
      claim.kind === "numeric" &&
      numericValueIsBriefEconomicsSupported(claim.value, briefEconomics)
    ) {
      return {
        status: "verified",
        claim,
        matchedSourceRef: { kind: "userProvided" },
        entailmentVerdict: "user_asserted",
      };
    }

    return {
      status: "unsupported",
      claim,
      reason: "no_match",
    };
  });
  const verifiedCount = verdicts.filter(
    (verdict) => verdict.status === "verified",
  ).length;
  const unsupportedCount = verdicts.length - verifiedCount;

  return {
    verifiedCount,
    unsupportedCount,
    claims: verdicts,
  };
}

function truncateForJudge(value: string): string {
  if (value.length <= maxJudgeSourceTextLength) {
    return value;
  }

  return `${value.slice(0, maxJudgeSourceTextLength)}...`;
}

function toJudgeSources(
  sources: readonly SearchableSource[],
): EntailmentEvidenceSource[] {
  return sources.slice(0, maxJudgeSources).map((source, sourceIndex) => ({
    ref: source.ref,
    sourceIndex,
    text: truncateForJudge(source.rawText),
  }));
}

function formatSourceRef(ref: VerificationSourceRef): string {
  if (ref.kind === "toolResult") {
    return `toolResult:${ref.toolName}:step-${ref.stepIndex}`;
  }

  if (ref.kind === "corpusExcerpt") {
    return `corpusExcerpt:${ref.excerptIndex}:${ref.sourceUrl}`;
  }

  return `userProvided:${ref.field ?? "onboarding"}`;
}

function buildJudgePrompt({
  claims,
  sources,
}: {
  claims: readonly Claim[];
  sources: readonly EntailmentEvidenceSource[];
}): string {
  return [
    "Judge each extracted claim against the evidence sources.",
    "Return exactly one verdict for every claimIndex.",
    "Use supported when the evidence entails the claim, even if phrased differently.",
    "Use user_asserted only when a userProvided source states the claim.",
    "Use refuted when the evidence contradicts the claim or does not support it.",
    "For sourceAttribution claims, the cited assertedSourceUrl must support every named entity, product, and vendor in the claim; a source about Google/AppSheet does not support a Microsoft/E5 claim.",
    "For supported or user_asserted verdicts, include the strongest sourceIndex.",
    "",
    JSON.stringify(
      {
        claims: claims.map((claim, claimIndex) => ({ claimIndex, ...claim })),
        sources: sources.map((source) => ({
          sourceIndex: source.sourceIndex,
          ref: formatSourceRef(source.ref),
          text: source.text,
        })),
      },
      null,
      2,
    ),
  ].join("\n");
}

const defaultEntailmentJudge: EntailmentJudge = async ({
  claims,
  signal,
  sources,
}: EntailmentJudgeInput): Promise<EntailmentJudgeResult> => {
  const result = await generateText({
    model: sectionRunnerModel,
    output: Output.object({
      schema: entailmentJudgeResultSchema,
      name: "VerificationEntailmentJudge",
      description:
        "Claim-level evidence entailment verdicts for AI-GOS section verification.",
    }),
    maxOutputTokens: maxJudgeOutputTokens,
    abortSignal: signal,
    system:
      "You are a strict evidence entailment judge. Do not infer facts beyond the provided evidence.",
    prompt: buildJudgePrompt({ claims, sources }),
  });

  return entailmentJudgeResultSchema.parse(result.output);
};

function getJudgeVerdictsByClaimIndex(
  result: EntailmentJudgeResult,
): Map<number, EntailmentJudgeVerdict> {
  const verdicts = new Map<number, EntailmentJudgeVerdict>();

  for (const verdict of result.verdicts) {
    verdicts.set(verdict.claimIndex, verdict);
  }

  return verdicts;
}

function getSourceByIndex({
  sourceIndex,
  sources,
}: {
  sourceIndex: number | undefined;
  sources: readonly EntailmentEvidenceSource[];
}): EntailmentEvidenceSource | undefined {
  if (sourceIndex === undefined) {
    return undefined;
  }

  return sources.find((source) => source.sourceIndex === sourceIndex);
}

function getVerifiedSourceFromDeterministicVerdict(
  verdict: ClaimVerdict,
): VerificationSourceRef | undefined {
  if (verdict.status !== "verified") {
    return undefined;
  }

  return verdict.matchedSourceRef;
}

function withRationale(
  rationale: string | undefined,
): { entailmentRationale?: string } {
  return rationale === undefined || rationale.trim().length === 0
    ? {}
    : { entailmentRationale: rationale };
}

function applyJudgeVerdict({
  deterministicVerdict,
  judgeVerdict,
  sources,
}: {
  deterministicVerdict: ClaimVerdict;
  judgeVerdict: EntailmentJudgeVerdict | undefined;
  sources: readonly EntailmentEvidenceSource[];
}): ClaimVerdict {
  if (
    deterministicVerdict.status === "verified" &&
    deterministicVerdict.matchedSourceRef.kind === "userProvided"
  ) {
    return {
      ...deterministicVerdict,
      entailmentVerdict: "user_asserted",
    };
  }

  if (judgeVerdict === undefined) {
    return deterministicVerdict;
  }

  if (judgeVerdict.verdict === "refuted") {
    return {
      status: "unsupported",
      claim: deterministicVerdict.claim,
      reason: "no_match",
      entailmentVerdict: "refuted",
      ...withRationale(judgeVerdict.rationale),
    };
  }

  if (
    deterministicVerdict.claim.kind === "sourceAttribution" &&
    deterministicVerdict.status !== "verified"
  ) {
    return deterministicVerdict;
  }

  const judgedSource = getSourceByIndex({
    sourceIndex: judgeVerdict.sourceIndex,
    sources,
  });
  const deterministicSource =
    getVerifiedSourceFromDeterministicVerdict(deterministicVerdict);
  const sourceRef =
    deterministicVerdict.claim.kind === "sourceAttribution"
      ? deterministicSource
      : (judgedSource?.ref ?? deterministicSource);

  if (sourceRef === undefined) {
    return deterministicVerdict;
  }

  if (judgeVerdict.verdict === "user_asserted") {
    if (sourceRef.kind !== "userProvided") {
      return deterministicVerdict;
    }

    return {
      status: "verified",
      claim: deterministicVerdict.claim,
      matchedSourceRef: sourceRef,
      entailmentVerdict: "user_asserted",
      ...withRationale(judgeVerdict.rationale),
    };
  }

  return {
    status: "verified",
    claim: deterministicVerdict.claim,
    matchedSourceRef: sourceRef,
    entailmentVerdict:
      sourceRef.kind === "userProvided" ? "user_asserted" : "supported",
    ...withRationale(judgeVerdict.rationale),
  };
}

function buildReportFromVerdicts(
  verdicts: readonly ClaimVerdict[],
): VerificationReport {
  const verifiedCount = verdicts.filter(
    (verdict) => verdict.status === "verified",
  ).length;

  return {
    verifiedCount,
    unsupportedCount: verdicts.length - verifiedCount,
    claims: [...verdicts],
  };
}

export async function structuralVerifierWithEntailment({
  judge = defaultEntailmentJudge,
  signal,
  ...input
}: StructuralVerifierWithEntailmentInput): Promise<VerificationReport> {
  const deterministicReport = structuralVerifier(input);

  if (deterministicReport.claims.length === 0) {
    return deterministicReport;
  }

  const judgeSources = toJudgeSources(buildSearchableSources(input));

  if (judgeSources.length === 0) {
    return deterministicReport;
  }

  try {
    const judgeResult = await judge({
      claims: deterministicReport.claims.map((verdict) => verdict.claim),
      sources: judgeSources,
      ...(signal === undefined ? {} : { signal }),
    });
    const judgeVerdicts = getJudgeVerdictsByClaimIndex(judgeResult);
    const verdicts = deterministicReport.claims.map(
      (deterministicVerdict, index) =>
        applyJudgeVerdict({
          deterministicVerdict,
          judgeVerdict: judgeVerdicts.get(index),
          sources: judgeSources,
        }),
    );

    return buildReportFromVerdicts(verdicts);
  } catch (error) {
    console.warn(
      "[lab-section] entailment judge failed; using deterministic verifier",
      {
        claimCount: deterministicReport.claims.length,
        error: error instanceof Error ? error.message : String(error),
        sourceCount: judgeSources.length,
      },
    );

    return deterministicReport;
  }
}
