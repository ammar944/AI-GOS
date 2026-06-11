import { getRegistrableDomain } from "../../domain-utils";
import { quoteAttributionFieldNames } from "./claim-extractor";

export interface QuoteAdmissionInput {
  text: string;
  sourceUrl: string;
  subjectDomain?: string | null;
}

export interface QuoteAdmissionResult {
  admissible: boolean;
  normalizedText: string;
  reasons: string[];
}

export interface DroppedDuplicateQuoteField {
  path: string;
  reason: "duplicate-long-quote";
  normalizedText: string;
}

export interface QuoteDeduplicationResult {
  body: Record<string, unknown>;
  dropped: DroppedDuplicateQuoteField[];
}

const quoteMaxCharacters = 400;
const quoteDedupMinCharacters = 200;
const markdownLinkPattern = /\[[^\]]+\]\([^)]+\)/g;
const numberedMarkdownLinkPattern = /\b\d{2}\.\s+\[[^\]]+\]\(/;
const markdownHeadingPattern = /(^|\n)##\s+/;
const imageReferencePattern =
  /!\[[^\]]*]\([^)]+\)|https?:\/\/[^\s)]+?\.(?:png|jpe?g|gif|webp|svg)(?:[?#][^\s)]*)?|\bimageUrl\b|<img\b/i;
const firstOrSecondPersonPattern =
  /\b(?:i|i'm|i've|i’d|i'll|me|my|mine|we|we're|we've|we’d|we'll|us|our|ours|you|your|yours)\b/i;
const experientialSpeakerPattern =
  /\b(?:user|users|buyer|buyers|customer|customers|reviewer|reviewers|admin|admins|founder|founders|operator|operators|team|teams|marketer|marketers|analyst|analysts)\s+(?:says?|said|complains?|complained|reports?|reported|mentions?|mentioned|describes?|described|struggles?|struggled|needs?|needed|wants?|wanted|likes?|liked|hates?|hated)\b/i;
const experienceLanguagePattern =
  /\b(?:hard to|difficult to|easy to|frustrating|love|loved|hate|hated|struggle|struggled|wish|needed|saved us|helped us|switched from|moved from|before we|after we)\b/i;
const permalinkPathPattern =
  /(?:^|\/)(?:reviews?|review|comments?|comment|threads?|thread|discussions?|discussion|forums?|forum|community|answers?|answer|questions?|question|posts?|post|item)(?:\/|$|[?#])/i;
const permalinkQueryPattern = /[?&#](?:id|review|comment|thread|post)=/i;
const trustedQuoteHosts = new Set([
  "capterra.com",
  "community.atlassian.com",
  "community.hubspot.com",
  "g2.com",
  "g2crowd.com",
  "news.ycombinator.com",
  "old.reddit.com",
  "reddit.com",
  "reviews.io",
  "sourceforge.net",
  "stackexchange.com",
  "stackoverflow.com",
  "trustpilot.com",
]);

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function safeUrl(value: string): URL | null {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:"
      ? url
      : null;
  } catch {
    return null;
  }
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function isSubjectUrl(url: URL, subjectDomain: string | null | undefined): boolean {
  if (subjectDomain === undefined || subjectDomain === null) {
    return false;
  }

  const subjectRegistrableDomain = getRegistrableDomain(subjectDomain);
  const urlRegistrableDomain = getRegistrableDomain(url.hostname);

  return (
    subjectRegistrableDomain !== null &&
    urlRegistrableDomain !== null &&
    subjectRegistrableDomain === urlRegistrableDomain
  );
}

function isTrustedQuoteHost(hostname: string): boolean {
  const host = normalizeHost(hostname);

  return Array.from(trustedQuoteHosts).some(
    (trustedHost) => host === trustedHost || host.endsWith(`.${trustedHost}`),
  );
}

function isPermalinkishUrl(url: URL): boolean {
  const path = url.pathname.replace(/\/+$/g, "");

  if (path.length === 0) {
    return false;
  }

  if (permalinkPathPattern.test(path) || permalinkQueryPattern.test(url.search)) {
    return true;
  }

  if (!isTrustedQuoteHost(url.hostname)) {
    return false;
  }

  return path.split("/").filter(Boolean).length >= 1;
}

function hasNavOrMarkdownSignals(value: string): boolean {
  const markdownLinks = value.match(markdownLinkPattern)?.length ?? 0;

  return (
    markdownLinks >= 3 ||
    numberedMarkdownLinkPattern.test(value) ||
    markdownHeadingPattern.test(value) ||
    value.includes("Close\n") ||
    imageReferencePattern.test(value)
  );
}

function hasHumanVoice(value: string): boolean {
  return (
    firstOrSecondPersonPattern.test(value) ||
    experientialSpeakerPattern.test(value) ||
    experienceLanguagePattern.test(value)
  );
}

export function normalizeQuoteText(value: string): string {
  return normalizeWhitespace(value)
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .toLowerCase();
}

export function evaluateQuoteAdmission(
  input: QuoteAdmissionInput,
): QuoteAdmissionResult {
  const normalizedText = normalizeWhitespace(input.text);
  const reasons: string[] = [];
  const url = safeUrl(input.sourceUrl);

  if (normalizedText.length === 0) {
    reasons.push("empty-quote");
  }

  if (normalizedText.length > quoteMaxCharacters) {
    reasons.push("quote-too-long");
  }

  if (hasNavOrMarkdownSignals(input.text)) {
    reasons.push("navigation-or-markdown-snippet");
  }

  if (!hasHumanVoice(normalizedText)) {
    reasons.push("not-human-voice");
  }

  if (url === null) {
    reasons.push("invalid-source-url");
  } else {
    if (!isPermalinkishUrl(url)) {
      reasons.push("source-url-not-permalink");
    }

    if (isSubjectUrl(url, input.subjectDomain)) {
      reasons.push("subject-domain-source");
    }
  }

  return {
    admissible: reasons.length === 0,
    normalizedText,
    reasons,
  };
}

export function isAdmissibleQuote(input: QuoteAdmissionInput): boolean {
  return evaluateQuoteAdmission(input).admissible;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJsonRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function quoteFieldEntries(
  record: Record<string, unknown>,
): Array<{ field: string; value: string }> {
  return quoteAttributionFieldNames.flatMap((field) => {
    const value = record[field];

    return typeof value === "string" ? [{ field, value }] : [];
  });
}

function firstDuplicateQuotePath({
  path,
  record,
  seen,
}: {
  path: string;
  record: Record<string, unknown>;
  seen: Set<string>;
}): DroppedDuplicateQuoteField | null {
  for (const entry of quoteFieldEntries(record)) {
    const normalized = normalizeQuoteText(entry.value);

    if (normalized.length < quoteDedupMinCharacters) {
      continue;
    }

    if (seen.has(normalized)) {
      return {
        path: `${path}.${entry.field}`,
        reason: "duplicate-long-quote",
        normalizedText: normalized,
      };
    }

    seen.add(normalized);
  }

  return null;
}

function dedupeValue({
  checkCurrentRecord = true,
  path,
  seen,
  value,
}: {
  checkCurrentRecord?: boolean;
  path: string;
  seen: Set<string>;
  value: unknown;
}): { value: unknown; dropped: DroppedDuplicateQuoteField[] } {
  if (Array.isArray(value)) {
    const dropped: DroppedDuplicateQuoteField[] = [];
    const items: unknown[] = [];

    value.forEach((item, index) => {
      if (isRecord(item)) {
        const duplicate = firstDuplicateQuotePath({
          path: `${path}[${index}]`,
          record: item,
          seen,
        });

        if (duplicate !== null) {
          dropped.push(duplicate);
          return;
        }
      }

      const child = dedupeValue({
        checkCurrentRecord: false,
        path: `${path}[${index}]`,
        seen,
        value: item,
      });
      items.push(child.value);
      dropped.push(...child.dropped);
    });

    return { value: items, dropped };
  }

  if (!isRecord(value)) {
    return { value, dropped: [] };
  }

  const duplicate = checkCurrentRecord
    ? firstDuplicateQuotePath({ path, record: value, seen })
    : null;

  if (duplicate !== null && path !== "body") {
    return { value: undefined, dropped: [duplicate] };
  }

  const dropped: DroppedDuplicateQuoteField[] = [];
  const next: Record<string, unknown> = {};

  for (const [key, childValue] of Object.entries(value)) {
    const child = dedupeValue({
      path: path === "body" ? `body.${key}` : `${path}.${key}`,
      seen,
      value: childValue,
    });

    if (child.value !== undefined) {
      next[key] = child.value;
    }
    dropped.push(...child.dropped);
  }

  return { value: next, dropped };
}

export function dedupeQuoteBearingFields({
  body,
}: {
  body: Record<string, unknown>;
}): QuoteDeduplicationResult {
  const cloned = cloneJsonRecord(body);
  const result = dedupeValue({
    path: "body",
    seen: new Set<string>(),
    value: cloned,
  });

  return {
    body: isRecord(result.value) ? result.value : cloned,
    dropped: result.dropped,
  };
}
