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

function pushClaim({
  claims,
  kind,
  raw,
  seen,
  value,
}: {
  claims: Claim[];
  kind: Claim["kind"];
  value: string;
  raw: string;
  seen: Set<string>;
}): void {
  const normalizedValue = normalizeWhitespace(value);

  if (normalizedValue.length === 0) {
    return;
  }

  const key = `${kind}:${normalizedValue.toLowerCase()}`;

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  claims.push({
    kind,
    value: normalizedValue,
    raw: normalizeWhitespace(raw),
  } as Claim);
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
      claims,
      kind: "entityName",
      raw: value,
      seen,
      value: normalized,
    });
  }

  for (const match of value.matchAll(urlPattern)) {
    const url = cleanUrl(match[0]);

    if (constructedAdLibraryLinkPattern.test(url)) {
      continue;
    }

    pushClaim({
      claims,
      kind: "url",
      raw: value,
      seen,
      value: url,
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
      pushClaim({ claims, kind: "numeric", raw: value, seen, value: full });
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
      claims,
      kind: "numeric",
      raw: value,
      seen,
      value: match[0],
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
      claims,
      kind: "numeric",
      raw: value,
      seen,
      value: match[0],
    });
  }

  for (const match of scanValue.matchAll(magnitudePattern)) {
    pushClaim({
      claims,
      kind: "numeric",
      raw: value,
      seen,
      value: match[0],
    });
  }

  for (const match of value.matchAll(quotePattern)) {
    const quote = normalizeWhitespace(match[1] ?? "");

    if (countWords(quote) < 6) {
      continue;
    }

    pushClaim({
      claims,
      kind: "quote",
      raw: value,
      seen,
      value: quote,
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
