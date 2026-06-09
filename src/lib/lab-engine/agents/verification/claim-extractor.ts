import type { Claim } from "./types";

const entityNameFieldNames = new Set([
  "advertiserName",
  "company",
  "competitor",
  "competitorName",
  "exampleCompany",
  "name",
  "persona",
]);
const countFieldNames = new Set([
  "accountCount",
  "audienceSize",
  "monthlyVolume",
]);
const quoteAttributionFieldNames = [
  "verbatimQuote",
  "verbatimText",
  "quote",
] as const;

const currencyPattern =
  /(?:[$£€]\s?\d[\d,]*(?:\.\d{1,2})?(?:\s?(?:[kmb]\b|thousand\b|million\b|billion\b))?(?:\s?\/\s?(?:mo|month|yr|year))?)/gi;
const percentPattern = /\b\d+(?:\.\d+)?%(?=\s|[.,;:!?)]|$)/g;
const magnitudePattern =
  /\b\d+(?:\.\d+)?\s?(?:k|m|b|thousand|million|billion)\b(?:\s+[A-Za-z][A-Za-z-]*)?/gi;
const quotePattern = /"([^"]+)"/g;
const urlPattern = /https?:\/\/[^\s)"'>\]}]+/gi;
// Deterministic ad-library *search* deep-links are constructed by the ad adapter
// (buildLibraryLink) as UI affordances ("go search this advertiser"), not factual
// citations. They are never returned by a fetched source, so the structural
// verifier flags them as unsupported URL claims and triggers a needless repair
// loop — the dominant cause of CompetitorLandscape's 186s / 4-repair latency
// (2026-06-01 live audit). Exclude ONLY the search forms (?query= / ?q= /
// /search?company=). Real ad-*detail* URLs (adstransparency.google.com/<id>,
// facebook.com/ads/library/?id=) stay checked, so a fabricated detail URL is
// still caught and a sourced one still verifies. Genuine citations on real
// source domains are untouched.
const constructedAdLibraryLinkPattern =
  /^https?:\/\/(?:adstransparency\.google\.com\/\?[^\s"']*query=|(?:www\.)?facebook\.com\/ads\/library\/?\?[^\s"']*\bq=|(?:www\.)?linkedin\.com\/ad-library\/search\b)/i;
// A single numeric range endpoint: optional currency, digits (with thousands
// commas / decimals), optional magnitude suffix, optional percent.
const rangeTokenSource =
  "[$£€]?\\s?\\d[\\d,]*(?:\\.\\d+)?(?:k|m|b|thousand|million|billion)?%?";
// A symbolic-separator range ("$1M–$5M ARR", "$49–$99/mo", "10,000–50,000 users").
// Separator class is en/em/hyphen only — the `/` unit separator ("$99/mo") is
// intentionally excluded. An optional trailing unit (/mo or one word) is kept.
const rangePattern = new RegExp(
  `(?<![\\w$£€])(?:${rangeTokenSource})\\s*[–—-]\\s*(?:${rangeTokenSource})` +
    `(?:\\s?\\/\\s?(?:mo|month|yr|year)|\\s+[A-Za-z][A-Za-z-]*)?`,
  "gi",
);
// A matched range only counts if it carries a currency symbol, percent,
// magnitude suffix, or thousands comma — this excludes dates ("2024-2025")
// and phone numbers ("555-1234").
const rangeQualifierPattern =
  /[$£€%]|,|\d\s?(?:k|m|b|thousand|million|billion)\b/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function countWords(value: string): number {
  return normalizeWhitespace(value)
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

function cleanUrl(value: string): string {
  return value.replace(/[.,;:!?]+$/g, "");
}

function normalizeClaim(claim: Claim): Claim | null {
  const normalizedValue = normalizeWhitespace(claim.value);

  if (normalizedValue.length === 0) {
    return null;
  }

  const normalizedRaw = normalizeWhitespace(claim.raw);

  if (claim.kind === "numericAttribution") {
    const assertedSourceUrl =
      claim.assertedSourceUrl === undefined
        ? undefined
        : cleanUrl(normalizeWhitespace(claim.assertedSourceUrl));

    return {
      kind: claim.kind,
      value: normalizedValue,
      raw: normalizedRaw,
      ...(assertedSourceUrl === undefined || assertedSourceUrl.length === 0
        ? {}
        : { assertedSourceUrl }),
    };
  }

  if (claim.kind === "quoteAttribution") {
    const assertedSource = normalizeWhitespace(claim.assertedSource);
    const assertedSourceUrl =
      claim.assertedSourceUrl === undefined
        ? undefined
        : cleanUrl(normalizeWhitespace(claim.assertedSourceUrl));

    if (assertedSource.length === 0) {
      return null;
    }

    return {
      kind: claim.kind,
      value: normalizedValue,
      raw: normalizedRaw,
      assertedSource,
      ...(assertedSourceUrl === undefined || assertedSourceUrl.length === 0
        ? {}
        : { assertedSourceUrl }),
    };
  }

  return {
    kind: claim.kind,
    value: normalizedValue,
    raw: normalizedRaw,
  };
}

function pushClaim({
  claim,
  claims,
  seen,
}: {
  claim: Claim;
  claims: Claim[];
  seen: Set<string>;
}): void {
  const normalizedClaim = normalizeClaim(claim);

  if (normalizedClaim === null) {
    return;
  }

  const key = `${normalizedClaim.kind}:${normalizedClaim.value.toLowerCase()}`;

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  claims.push(normalizedClaim);
}

function extractStringClaims({
  claims,
  fieldName,
  seen,
  value,
}: {
  claims: Claim[];
  fieldName: string;
  seen: Set<string>;
  value: string;
}): void {
  const normalized = normalizeWhitespace(value);

  if (entityNameFieldNames.has(fieldName) && normalized.length >= 3) {
    pushClaim({
      claim: {
        kind: "entityName",
        raw: value,
        value: normalized,
      },
      claims,
      seen,
    });
  }

  for (const match of value.matchAll(urlPattern)) {
    const url = cleanUrl(match[0]);

    if (constructedAdLibraryLinkPattern.test(url)) {
      continue;
    }

    pushClaim({
      claim: {
        kind: "url",
        raw: value,
        value: url,
      },
      claims,
      seen,
    });
  }

  // Range pass — runs BEFORE the single-value numeric loops. A symbolic-separator
  // range like "$1M–$5M ARR" becomes ONE claim instead of four substring-matchable
  // fragments ($1 / $5 / 1M / 5M). Matched spans are masked so the loops below
  // cannot re-emit the endpoints. Unqualified spans (dates, phone numbers) are left
  // intact but carry no currency/percent/magnitude, so the loops ignore them anyway.
  let scanValue = value;
  const rangeMatches = [...value.matchAll(rangePattern)];
  if (rangeMatches.length > 0) {
    const chars = value.split("");
    for (const match of rangeMatches) {
      const full = match[0];
      if (!rangeQualifierPattern.test(full)) {
        continue;
      }
      pushClaim({
        claim: { kind: "numeric", raw: value, value: full },
        claims,
        seen,
      });
      const start = match.index ?? 0;
      for (let i = start; i < start + full.length && i < chars.length; i += 1) {
        chars[i] = " ";
      }
    }
    scanValue = chars.join("");
  }

  const currencyMaskedChars = scanValue.split("");
  for (const match of scanValue.matchAll(currencyPattern)) {
    pushClaim({
      claim: {
        kind: "numeric",
        raw: value,
        value: match[0],
      },
      claims,
      seen,
    });
    const start = match.index ?? 0;
    for (
      let i = start;
      i < start + match[0].length && i < currencyMaskedChars.length;
      i += 1
    ) {
      currencyMaskedChars[i] = " ";
    }
  }
  scanValue = currencyMaskedChars.join("");

  for (const match of scanValue.matchAll(percentPattern)) {
    pushClaim({
      claim: {
        kind: "numeric",
        raw: value,
        value: match[0],
      },
      claims,
      seen,
    });
  }

  for (const match of scanValue.matchAll(magnitudePattern)) {
    pushClaim({
      claim: {
        kind: "numeric",
        raw: value,
        value: match[0],
      },
      claims,
      seen,
    });
  }

  for (const match of value.matchAll(quotePattern)) {
    const quote = normalizeWhitespace(match[1] ?? "");

    if (countWords(quote) < 6) {
      continue;
    }

    pushClaim({
      claim: {
        kind: "quote",
        raw: value,
        value: quote,
      },
      claims,
      seen,
    });
  }
}

function stringField(
  record: Record<string, unknown>,
  fieldName: string,
): string | undefined {
  const value = record[fieldName];

  return typeof value === "string" && normalizeWhitespace(value).length > 0
    ? value
    : undefined;
}

function hasDigit(value: string): boolean {
  return /\d/.test(value);
}

function extractRecordClaims({
  claims,
  record,
  seen,
}: {
  claims: Claim[];
  record: Record<string, unknown>;
  seen: Set<string>;
}): void {
  const sourceUrl = stringField(record, "sourceUrl");

  for (const [key, childValue] of Object.entries(record)) {
    if (
      countFieldNames.has(key) &&
      typeof childValue === "string" &&
      hasDigit(childValue)
    ) {
      pushClaim({
        claim: {
          kind: "numericAttribution",
          raw: childValue,
          value: childValue,
          ...(sourceUrl === undefined ? {} : { assertedSourceUrl: sourceUrl }),
        },
        claims,
        seen,
      });
    }
  }

  const quote = quoteAttributionFieldNames
    .map((fieldName) => stringField(record, fieldName))
    .find((value) => value !== undefined);
  const assertedSource =
    stringField(record, "source") ?? stringField(record, "platform");

  if (
    quote !== undefined &&
    assertedSource !== undefined &&
    sourceUrl !== undefined
  ) {
    pushClaim({
      claim: {
        kind: "quoteAttribution",
        raw: quote,
        value: quote,
        assertedSource,
        assertedSourceUrl: sourceUrl,
      },
      claims,
      seen,
    });
  }
}

function walkValue({
  claims,
  fieldName,
  seen,
  value,
}: {
  claims: Claim[];
  fieldName: string;
  seen: Set<string>;
  value: unknown;
}): void {
  if (typeof value === "string") {
    extractStringClaims({ claims, fieldName, seen, value });
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      walkValue({ claims, fieldName, seen, value: item });
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  extractRecordClaims({ claims, record: value, seen });

  for (const [key, childValue] of Object.entries(value)) {
    walkValue({ claims, fieldName: key, seen, value: childValue });
  }
}

export function extractClaims(body: unknown): Claim[] {
  const claims: Claim[] = [];
  const seen = new Set<string>();

  walkValue({ claims, fieldName: "body", seen, value: body });

  return claims;
}
