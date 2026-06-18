import { getRegistrableDomain } from "../../domain-utils";
import { dedupQuoteFieldNames } from "./claim-extractor";

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
const quoteMinCharactersAfterChromeStrip = 25;
// Review-platform DOM chrome that SearchAPI index pages glue onto truncated
// review fragments (live: run c9bc2056). Each token marks the START of a chrome
// tail that is not part of the human's quote: "Verified User", "Mid-Market",
// employee-count labels like "(50 or fewer emp.)", reviewer-attribute headers.
const chromeTokenPattern =
  /(?:Verified (?:User|Reviewer)|See Related User Reviews|Show More|Read more|Mid-Market|Small[- ]Business|Enterprise(?:\s*\(|\b)|Reviewer Function|Industry:|Time Used|\((?:\d[\d,]*|\d+\s*-\s*\d+)\s*(?:or (?:fewer|more) )?emp\.?\))/i;
// A mid-word truncation marker ("...as strong as Microsoft Project, bu...!"):
// 1-3 surviving characters before an ellipsis, optionally trailing punctuation.
const truncationMarkerPattern = /\b\w{1,3}\.\.\.[!?.]?(?=\s|$)/;
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
// Index/filter/listing query strings that pin a page to an aggregate view of
// MANY reviews, not one — these are never per-review permalinks (live c9bc2056:
// g2.com/.../reviews?qs=pros-and-cons, trustpilot.com/review/x?page=4).
const indexQueryPattern = /[?&#](?:qs|page|sort|filter|tab)=/i;
const permalinkQueryPattern = /[?&#](?:id|review|comment|thread|post)=/i;
const permalinkPathPattern =
  /(?:^|\/)(?:reviews?|review|comments?|comment|threads?|thread|discussions?|discussion|forums?|forum|community|answers?|answer|questions?|question|posts?|post|item)(?:\/|$|[?#])/i;
// A path that ENDS at a bare listing segment (…/reviews, …/review) — i.e. the
// product's review-listing root, not a single review (live c9bc2056:
// capterra.com/.../reviews/, softwareadvice.com/.../reviews/).
const listingRootPattern =
  /\/(?:reviews?|comments?|threads?|discussions?|forums?|community|answers?|questions?|posts?)$/i;
// A leaf that is itself a hostname/domain (e.g. trustpilot.com/review/airtable.com)
// is an INDEX of all reviews for that product, not a single review.
const hostnameLikeLeafPattern = /\/[A-Za-z0-9-]+(?:\.[A-Za-z]{2,})+\/?$/;
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
  "trustradius.com",
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

  // Reject the specific INDEX/LISTING shapes that ship as fake permalinks (live
  // c9bc2056): filter/page query strings, a bare review-listing root, or a leaf
  // that is itself a product hostname (trustpilot.com/review/<domain>). An
  // explicit per-item query (?review=, ?id=) still counts as a permalink.
  if (!permalinkQueryPattern.test(url.search)) {
    if (
      indexQueryPattern.test(url.search) ||
      listingRootPattern.test(path) ||
      hostnameLikeLeafPattern.test(url.pathname)
    ) {
      return false;
    }
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

/**
 * Strip a single TRAILING review-platform chrome tail off a quote. SearchAPI
 * index pages append the reviewer's tier/employee-count labels (and sometimes a
 * neighbouring review's title) after the review body; this removes that tail so
 * a clean review survives intact while chrome-only suffixes fall away. Interior
 * chrome (a chrome token at position 0, or one that survives because the quote
 * is a multi-review concatenation) is left in place so the admission check can
 * reject it as unsalvageable.
 */
// A run of alphabetic characters long enough to be a real review sentence (not
// a tier label or employee-count). Used to decide whether a chrome tail is a
// pure trailing artifact (salvageable) or glues on a second review (not).
const substantialProsePattern = /[A-Za-z][A-Za-z' ]{24,}/;

export function cleanQuoteText(raw: string): string {
  if (typeof raw !== "string") {
    return "";
  }

  const text = normalizeWhitespace(raw);
  const match = text.match(chromeTokenPattern);

  if (match?.index !== undefined && match.index > 0) {
    const tail = text.slice(match.index + match[0].length);

    // Only salvage when the chrome tail is a pure artifact. If a real review
    // sentence follows the chrome token, the quote glues two reviews together
    // and must NOT be salvaged — leaving the chrome in place lets the admission
    // check reject it as `contains-ui-chrome`.
    if (!substantialProsePattern.test(tail)) {
      return text.slice(0, match.index).replace(/[\s"'“”‘’]+$/g, "").trim();
    }
  }

  return text.replace(/[\s"'“”‘’]+$/g, "").trim();
}

export function evaluateQuoteAdmission(
  input: QuoteAdmissionInput,
): QuoteAdmissionResult {
  // Strip a trailing chrome tail first so a salvageable review survives and so
  // the rest of the checks (and the returned normalizedText) run on clean text.
  const normalizedText = cleanQuoteText(input.text);
  const reasons: string[] = [];
  const url = safeUrl(input.sourceUrl);

  if (normalizedText.length === 0) {
    reasons.push("empty-quote");
  }

  // Chrome that survives the trailing strip means the quote is a multi-review
  // concatenation (chrome at position 0 or interior) — not a single human quote.
  if (chromeTokenPattern.test(normalizedText)) {
    reasons.push("contains-ui-chrome");
  }

  if (truncationMarkerPattern.test(normalizedText)) {
    reasons.push("truncated-fragment");
  }

  if (
    normalizedText.length > 0 &&
    normalizedText.length < quoteMinCharactersAfterChromeStrip
  ) {
    reasons.push("too-short-after-chrome-strip");
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

// FIX-VOC directional lane: a clean independent-domain pain quote on a trusted
// review/forum host (Trustpilot/TrustRadius/Reddit, …) whose ONLY admission
// failure is the per-review-permalink shape is KEPT and labeled directional
// instead of dropped. Every other rejection — chrome concatenation, truncation,
// not-human-voice, overlong, subject-domain source, invalid URL — is still
// fatal, so this never weakens the truth floor; it only tolerates the lone
// `source-url-not-permalink` reason on a trusted host. Downstream surfacing must
// relabel the quote as a paraphrased/directional pattern (it is never presented
// as independently-verified verbatim VoC).
export function isDirectionalAdmissibleQuote(input: QuoteAdmissionInput): boolean {
  const { admissible, reasons } = evaluateQuoteAdmission(input);

  if (admissible) {
    return true;
  }

  if (reasons.length !== 1 || reasons[0] !== "source-url-not-permalink") {
    return false;
  }

  const url = safeUrl(input.sourceUrl);

  return url !== null && isTrustedQuoteHost(url.hostname);
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
  return dedupQuoteFieldNames.flatMap((field) => {
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
