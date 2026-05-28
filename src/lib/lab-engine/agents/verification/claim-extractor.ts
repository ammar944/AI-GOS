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
  /(?:[$£€]\s?\d[\d,]*(?:\.\d{1,2})?(?:\s?\/\s?(?:mo|month|yr|year))?)/gi;
const percentPattern = /\b\d+(?:\.\d+)?%(?=\s|[.,;:!?)]|$)/g;
const magnitudePattern =
  /\b\d+(?:\.\d+)?\s?(?:k|m|b|thousand|million|billion)\b(?:\s+[A-Za-z][A-Za-z-]*)?/gi;
const quotePattern = /"([^"]+)"/g;
const urlPattern = /https?:\/\/[^\s)"'>\]}]+/gi;

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
    pushClaim({
      claims,
      kind: "url",
      raw: value,
      seen,
      value: cleanUrl(match[0]),
    });
  }

  for (const match of value.matchAll(currencyPattern)) {
    pushClaim({
      claims,
      kind: "numeric",
      raw: value,
      seen,
      value: match[0],
    });
  }

  for (const match of value.matchAll(percentPattern)) {
    pushClaim({
      claims,
      kind: "numeric",
      raw: value,
      seen,
      value: match[0],
    });
  }

  for (const match of value.matchAll(magnitudePattern)) {
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
