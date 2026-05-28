import { extractClaims } from "./claim-extractor";
import type {
  Claim,
  ClaimVerdict,
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
}

interface SearchableString {
  path: string;
  value: string;
}

interface SearchableSource {
  ref: VerificationSourceRef;
  text: string;
  urls: ReadonlySet<string>;
}

const urlPattern = /https?:\/\/[^\s)"'>\]}]+/gi;

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
    text: normalizeSearchText(`${excerpt.text} ${excerpt.sourceUrl}`),
    urls: new Set([excerpt.sourceUrl, ...extractUrls(excerpt.text)]),
  };
}

function stripCurrencyDecimals(value: string): string {
  return value.replace(/([$£€]\s?\d[\d,]*)\.00\b/g, "$1");
}

function expandMagnitude(value: string): string {
  return value.replace(/\b(\d+(?:\.\d+)?)\s?m\b/gi, "$1 million");
}

function buildNumericNeedles(value: string): string[] {
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
    if (needles.some((needle) => source.text.includes(needle))) {
      return source.ref;
    }
  }

  return null;
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

  if (claim.kind === "quote") {
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

export function structuralVerifier({
  body,
  corpusExcerpts,
  toolResults,
}: StructuralVerifierInput): VerificationReport {
  const sources: SearchableSource[] = [
    ...toolResults.map((toolResult, index) =>
      buildToolResultSource(toolResult, index),
    ),
    ...corpusExcerpts.map((excerpt, index) => buildCorpusSource(excerpt, index)),
  ];
  const claims = extractClaims(body);
  const verdicts: ClaimVerdict[] = claims.map((claim) => {
    const match = findClaimMatch(claim, sources);

    if (match !== null) {
      return {
        status: "verified",
        claim,
        matchedSourceRef: match,
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
