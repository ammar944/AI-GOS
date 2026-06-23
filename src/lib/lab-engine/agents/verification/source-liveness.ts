import { BUYER_PERSONA_GROUNDING_FIELD } from "../../artifacts/schemas/buyer-icp-constants";
import type { StrippedRow } from "../../artifacts/schemas/strategic-insight";
import { getRegistrableDomain } from "../../domain-utils";

export interface SourceUrlRow {
  path: string;
  sourceUrl: string;
  row: Record<string, unknown>;
}

// Phase 2 (downgrade-not-delete): a row that failed containment/liveness but was
// KEPT (its tier demoted, verification meta written). The caller folds the
// strippedRow into the owning block's coverage.strippedByVerifier so the reader
// sees what was downgraded and why — distinct from an acquisition gap.
export interface DowngradedRow {
  path: string;
  strippedRow: StrippedRow;
}

export interface SourceLivenessDrop {
  path: string;
  reason:
    | "containment-mismatch"
    | "fetch-error"
    | "http-error"
    | "invalid-source-url";
  sourceUrl: string;
  detail: string;
}

export interface SourceLivenessCheck {
  containmentChecked: boolean;
  containmentPassed: boolean;
  livenessPassed: boolean;
  sourceUrl: string;
  status: number | null;
}

/** Row kept because its host blocks server-side probes (403/429/503 from a
 * known bot-hostile review platform): liveness is UNKNOWN, not failed. */
export interface SourceLivenessUnknownRow {
  path: string;
  sourceUrl: string;
  // Bot-hostile carve-outs carry the HTTP status (403/429/503); a preverified
  // row kept after a verify-time fetch-error has no HTTP status (null).
  status: number | null;
}

export interface SourceLivenessResult {
  body: Record<string, unknown>;
  checkedUrls: SourceLivenessCheck[];
  droppedRows: SourceLivenessDrop[];
  livenessUnknownRows: SourceLivenessUnknownRow[];
  // Phase 2 downgrade-not-delete: rows kept-but-demoted instead of dropped.
  // Empty in the default (delete) path; populated only under downgradeMode.
  downgradedRows: DowngradedRow[];
  containmentPassRate: number | null;
  livenessPassRate: number | null;
  networkUnavailable: boolean;
}

export interface SubjectSiteObservation {
  sourceUrl: string;
  text: string;
  ctas: string[];
}

export interface SubjectCtaClaimStrip {
  path: string;
  reason: "contradicted-subject-site-cta";
  removedText: string;
  observedCtas: string[];
}

export interface SubjectCtaClaimResult {
  body: Record<string, unknown>;
  stripped: SubjectCtaClaimStrip[];
}

export type SourceLivenessFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

interface UrlProbe {
  detail: string;
  status: number | null;
  text: string | null;
  type: "dead" | "live";
}

interface NormalizedContainmentNeed {
  // Lenient bucket: proper nouns mined from prose. Noisy, so any-one suffices
  // (.some). A free-text mention need not be reproduced verbatim on the page.
  entities: string[];
  // Strict bucket: values pulled from the load-bearing entity NAME fields
  // (persona, name, company, competitor...). A persona row that names a
  // specific human at a specific company is an explicit "this individual
  // appears here" claim — EACH such value must be contained on the live page,
  // or the named human is unverifiable and the row is dropped. This closes the
  // fabricated-name-on-a-live-HTTP-200-page hole that .some()-over-all-entities
  // let through (a real company name carried the row past containment while the
  // invented person name was never checked on its own).
  requiredEntities: string[];
  numbers: string[];
  // Phase 2 quote-at-URL: verbatim quote strings pulled from the row's quote-
  // bearing fields (verbatimQuote/verbatimText/quote). A fabricated quote stapled
  // onto a real fetched URL clears entity/number containment but is NOT in the
  // page text — this bucket closes that hole. Each quote must be contained at
  // its cited URL (.every, strict) or the row is uncontained.
  quotes: string[];
}

const defaultMaxChecks = 25;
const defaultTimeoutMs = 5000;
const defaultConcurrency = 4;
const userAgent =
  "AI-GOS-Source-Liveness/1.0 (+https://ai-gos.local/research-verifier)";
const sourceUrlKey = "sourceUrl";
const evidenceTextKeys = new Set([
  "description",
  "evidence",
  "evidenceSummary",
  "finding",
  "insight",
  "proof",
  "quote",
  "summary",
  "text",
  "title",
  "value",
  "verbatimQuote",
  "verbatimText",
]);
// Phase 2 quote-at-URL: the subset of evidence-text fields that hold a VERBATIM
// customer/source quote (not a paraphrase, summary, or title). Only these are
// strict-containment-checked against the fetched page text — a fabricated quote
// stapled onto a real URL clears entity/number containment but fails here.
const quoteFieldNames = new Set([
  "quote",
  "verbatimQuote",
  "verbatimText",
]);
const entityFieldNames = new Set([
  "advertiserName",
  "company",
  "competitor",
  "competitorName",
  "exampleCompany",
  "name",
  "persona",
  // Option B: a persona's role/segment grounding label. Imported as a shared
  // constant from buyer-icp.ts so the schema -> strict-containment wire is a
  // compile-time dependency (string-literal coupling would silently let a
  // fabricated segment ship). A segmentLabel lands in requiredEntities and MUST
  // appear verbatim on the live page via the .every() strict bucket.
  BUYER_PERSONA_GROUNDING_FIELD,
]);
const numberPattern =
  /(?:[$£€]\s*)?\b\d[\d,]*(?:\.\d+)?(?:\s?(?:%|k|m|b|thousand|million|billion))?(?:\s?\/\s?(?:mo|month|yr|year))?\b/gi;
const properNounPattern =
  /\b[A-Z][A-Za-z0-9&'.-]*(?:\s+[A-Z][A-Za-z0-9&'.-]*){0,3}\b/g;
const properNounStopwords = new Set([
  "API",
  "ARR",
  "CTA",
  "CRM",
  "GTM",
  "ICP",
  "ROI",
  "SaaS",
  "SEO",
  "The",
]);
const freeSignupPattern =
  /\b(?:free|trial|sign\s?up|signup|start\s+free|get\s+started|create\s+account|try\s+for\s+free)\b/i;
const negativeSelfServePattern =
  /\b(?:no|not|never|without|lacks?|lack|absent|unavailable|does\s+not|doesn't)\b.{0,60}\b(?:self[-\s]?serve|free|trial|sign\s?up|signup|create\s+account|get\s+started)\b|\b(?:self[-\s]?serve|free|trial|sign\s?up|signup|create\s+account|get\s+started)\b.{0,60}\b(?:no|not|never|without|lacks?|lack|absent|unavailable|does\s+not|doesn't)\b/i;
// A negated-self-serve match only counts as a SUBJECT-SITE CTA claim when the
// sentence carries an explicit site/CTA anchor. Bare "free"/"signup" proximity
// struck funnel-arithmetic prose in run d838ed4e ("94% of those signups never
// convert") — analysis that asserts nothing about the site's purchase path.
const subjectCtaAnchorPattern =
  /\b(?:CTAs?|call[-\s]?to[-\s]?action|book[-\s]a[-\s]demo|request[-\s]a[-\s]demo|demo[-\s]?gated?|path[-\s]to[-\s]purchase|self[-\s]?serve|homepage|pricing\s+page|landing\s+page|website)\b/i;
// Affirmative exclusive-gating assertions ("demo-gated", "every CTA routes to
// a demo", "the only path is book-a-demo") contradict an observed free/signup
// CTA without any negation token.
const demoGateAssertionPattern =
  /\bdemo[-\s]?gated?\b|\bgated\s+behind\s+(?:a\s+)?demo\b|\b(?:every|all|each)\s+CTAs?\b[^.!?]{0,60}\b(?:demo|sales)\b|\broutes?\s+(?:all|every|each)\b[^.!?]{0,40}\bto\s+(?:a\s+)?demo\b|\b(?:only|sole(?:ly)?|exclusively)\b[^.!?]{0,40}\bbook[-\s]a[-\s]demo\b|\bbook[-\s]a[-\s]demo\b[^.!?]{0,40}\b(?:only|sole)\b/i;
const ctaSentenceSplitPattern = /(?<=[.!?])\s+/;
// Anti-bot statuses from hosts that block server-side fetches: a 403/429/503
// from these platforms means "probe blocked", not "evidence dead". Rows are
// kept and excluded from the liveness passRate denominator (mirroring the
// networkUnavailable carve-out).
const botHostileStatusCodes = new Set([403, 429, 503]);
const botHostileRegistrableDomains = new Set([
  "g2.com",
  "capterra.com",
  "trustpilot.com",
  "trustradius.com",
  "reddit.com",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJsonRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForContainment(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&"),
  ).toLowerCase();
}

function validHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function pathForChild(parent: string, key: string): string {
  return parent.length === 0 ? key : `${parent}.${key}`;
}

function collectSourceRows(value: unknown, path: string, rows: SourceUrlRow[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectSourceRows(item, `${path}[${index}]`, rows);
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const sourceUrl = validHttpUrl(value[sourceUrlKey]);

  if (sourceUrl !== null) {
    rows.push({ path, sourceUrl, row: value });
  }

  for (const [key, child] of Object.entries(value)) {
    collectSourceRows(child, pathForChild(path, key), rows);
  }
}

export function collectSourceUrlRows({
  body,
}: {
  body: Record<string, unknown>;
}): SourceUrlRow[] {
  const rows: SourceUrlRow[] = [];
  collectSourceRows(body, "body", rows);

  return rows;
}

function stripHtmlToText(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

async function fetchWithTimeout({
  fetchImpl,
  init,
  parentSignal,
  timeoutMs,
  url,
}: {
  fetchImpl: SourceLivenessFetch;
  init: RequestInit;
  parentSignal?: AbortSignal;
  timeoutMs: number;
  url: string;
}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`source liveness timeout after ${timeoutMs}ms`));
  }, timeoutMs);
  const abort = (): void => {
    controller.abort(parentSignal?.reason);
  };

  if (parentSignal?.aborted === true) {
    controller.abort(parentSignal.reason);
  } else {
    parentSignal?.addEventListener("abort", abort, { once: true });
  }

  try {
    return await fetchImpl(url, {
      ...init,
      headers: {
        "user-agent": userAgent,
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abort);
  }
}

async function probeUrl({
  fetchImpl,
  needsText,
  signal,
  timeoutMs,
  url,
}: {
  fetchImpl: SourceLivenessFetch;
  needsText: boolean;
  signal?: AbortSignal;
  timeoutMs: number;
  url: string;
}): Promise<UrlProbe> {
  try {
    const headResponse = await fetchWithTimeout({
      fetchImpl,
      init: { method: "HEAD", redirect: "follow" },
      parentSignal: signal,
      timeoutMs,
      url,
    });

    if (!headResponse.ok && headResponse.status !== 405) {
      return {
        detail: `HTTP ${headResponse.status}`,
        status: headResponse.status,
        text: null,
        type: "dead",
      };
    }

    if (!needsText && headResponse.ok) {
      return {
        detail: "HEAD live",
        status: headResponse.status,
        text: null,
        type: "live",
      };
    }

    const getResponse = await fetchWithTimeout({
      fetchImpl,
      init: { method: "GET", redirect: "follow" },
      parentSignal: signal,
      timeoutMs,
      url,
    });

    if (!getResponse.ok) {
      return {
        detail: `HTTP ${getResponse.status}`,
        status: getResponse.status,
        text: null,
        type: "dead",
      };
    }

    return {
      detail: "GET live",
      status: getResponse.status,
      text: await getResponse.text(),
      type: "live",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      detail: message,
      status: null,
      text: null,
      type: "dead",
    };
  }
}

function extractEvidenceText(row: Record<string, unknown>): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(row)) {
    if (key === sourceUrlKey || !evidenceTextKeys.has(key)) {
      continue;
    }

    if (typeof value === "string") {
      parts.push(value);
    }
  }

  return parts.join(" ");
}

function extractNumbers(value: string): string[] {
  return Array.from(value.matchAll(numberPattern))
    .map((match) => normalizeWhitespace(match[0]))
    .filter((number) => number.length > 0);
}

function extractEntityFields(row: Record<string, unknown>): string[] {
  const entities: string[] = [];

  for (const [key, value] of Object.entries(row)) {
    if (!entityFieldNames.has(key) || typeof value !== "string") {
      continue;
    }

    const normalized = normalizeWhitespace(value);
    if (normalized.length > 1) {
      entities.push(normalized);
    }
  }

  return entities;
}

// Phase 2 quote-at-URL: pull the row's VERBATIM quote strings (the quote-bearing
// fields only — not paraphrases/summaries/titles). A quote <15 chars is too short
// to judge (the containment primitive skips it), so don't harvest it.
function extractQuoteFields(row: Record<string, unknown>): string[] {
  const quotes: string[] = [];

  for (const [key, value] of Object.entries(row)) {
    if (!quoteFieldNames.has(key) || typeof value !== "string") {
      continue;
    }

    const normalized = normalizeWhitespace(value);
    if (normalized.length >= 15) {
      quotes.push(normalized);
    }
  }

  return quotes;
}

function extractProperNouns(value: string): string[] {
  return Array.from(value.matchAll(properNounPattern))
    .map((match) => normalizeWhitespace(match[0]))
    .filter(
      (entity) =>
        entity.length > 1 &&
        !properNounStopwords.has(entity) &&
        !/^\d/.test(entity),
    )
    .slice(0, 5);
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function containmentNeeds(row: Record<string, unknown>): NormalizedContainmentNeed {
  const text = extractEvidenceText(row);

  return {
    entities: uniqueStrings(extractProperNouns(text)),
    requiredEntities: uniqueStrings(extractEntityFields(row)),
    numbers: uniqueStrings(extractNumbers(text)),
    quotes: uniqueStrings(extractQuoteFields(row)),
  };
}

function numberVariants(value: string): string[] {
  const normalized = value.toLowerCase().replace(/\s+/g, "");
  const noCurrency = normalized.replace(/^[$£€]/, "");
  const noCommas = noCurrency.replace(/,/g, "");
  const variants = new Set([normalized, noCurrency, noCommas]);
  const magnitudeMatch = noCommas.match(
    /^(\d+(?:\.\d+)?)(k|m|b|thousand|million|billion)%?$/,
  );

  if (magnitudeMatch !== null) {
    const amount = Number(magnitudeMatch[1]);
    const suffix = magnitudeMatch[2];
    const multiplier =
      suffix === "k" || suffix === "thousand"
        ? 1_000
        : suffix === "m" || suffix === "million"
          ? 1_000_000
          : 1_000_000_000;
    const expanded = Math.round(amount * multiplier).toString();
    variants.add(expanded);
    variants.add(Number(expanded).toLocaleString("en-US"));

    // Emit both alternate magnitude spellings so "$13 billion" matches a page
    // saying "$13B" and vice-versa (currency- and whitespace-stripped).
    const letter =
      suffix === "k" || suffix === "thousand"
        ? "k"
        : suffix === "m" || suffix === "million"
          ? "m"
          : "b";
    const word =
      letter === "k" ? "thousand" : letter === "m" ? "million" : "billion";
    variants.add(`${magnitudeMatch[1]}${letter}`);
    variants.add(`${magnitudeMatch[1]}${word}`);
  }

  if (/^\d+$/.test(noCommas)) {
    variants.add(Number(noCommas).toLocaleString("en-US"));
  }

  return Array.from(variants).filter((variant) => variant.length > 0);
}

// A bare run of digits (e.g. "13") must only match a STANDALONE quantity on the
// page — never digits glued into a longer number or carrying a magnitude suffix.
// Tested against the space-preserving haystack (NOT the compacted copy) because
// the trailing-suffix boundary depends on the real whitespace: without it a
// claim's bare "13" substring-matches "$13M"/"$13 billion" (a different
// magnitude) and a false-positive citation slips through containment.
function bareIntegerMatches(haystack: string, digits: string): boolean {
  const re = new RegExp(
    `(?<![\\d.,])${digits}(?![\\d.,]|\\s?(?:k|m|b|thousand|million|billion)\\b)`,
    "i",
  );
  return re.test(haystack);
}

function containsNumber(haystack: string, value: string): boolean {
  // The haystack collapses-but-keeps spaces while variants are whitespace-
  // stripped, so also compare against a space-stripped haystack copy.
  const compact = haystack.replace(/\s+/g, "");
  return numberVariants(value).some((variant) => {
    const v = variant.toLowerCase();
    // Bare digit-only variants need word-boundary + magnitude-suffix guards so
    // "13" does not match "$13M"; richer variants ($, commas, k/m/b, spelled-out
    // magnitudes) are distinctive enough for a plain substring test.
    if (/^\d+$/.test(v)) {
      return bareIntegerMatches(haystack, v);
    }
    return haystack.includes(v) || compact.includes(v);
  });
}

function containsEntity(haystack: string, value: string): boolean {
  return haystack.includes(normalizeForContainment(value));
}

// Shared strict-containment primitive: does `value` appear verbatim in the live
// page `text`, using the SAME normalization the requiredEntities (.every) bucket
// uses? Exported so the grounded-buyer-unit validator runs the identical check
// rather than forking a weaker matcher.
export function isEntityContainedInLiveText(
  text: string,
  value: string,
): boolean {
  if (value.trim().length === 0) {
    return false;
  }
  return containsEntity(normalizeForContainment(text), value);
}

// Phase 2 quote-at-URL: does the normalized `quote` appear verbatim in the live
// page `text`? A quote <15 chars is too short to judge (skip = pass). Tolerates
// punctuation/whitespace drift via a contiguous-fragment fallback (a ≥4-token
// hyphen-normalized run of the quote appears verbatim in the page) so a real
// quote with author-inserted connective words still passes, while a quote
// assembled from scattered page words does not. Exported for unit testing +
// reuse by sibling validators that need the identical at-URL quote check.
export function isQuoteContainedInLiveText(
  text: string,
  quote: string,
): boolean {
  const normalizedQuote = normalizeWhitespace(quote).toLowerCase();
  if (normalizedQuote.length < 15) {
    return true; // too short to judge — skip (mirrors the transcript-side gate)
  }
  // strip editorial insertions the writer adds inside a real quote: "[are superior]", "[…]"
  const cleaned = normalizedQuote
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\.\.\.|…/g, " ")
    .replace(/["']/g, "");
  if (cleaned.trim().length === 0) {
    return true;
  }
  return containsQuote(normalizeForContainment(text), cleaned);
}

// The at-URL quote containment check. Mirrors the transcript-side `quoteGrounded`
// (scripts/provenance/gate.ts:349): substring first, then a contiguous-fragment
// fallback that tolerates punctuation/whitespace drift while rejecting quotes
// assembled from scattered page words.
function containsQuote(haystack: string, quote: string): boolean {
  if (haystack.includes(quote)) {
    return true;
  }
  // tolerate terminal/internal punctuation drift: strip non-word chars and retry
  const strippedQuote = quote.replace(/[^\w ]/g, "").replace(/\s+/g, " ").trim();
  if (
    strippedQuote.length > 0 &&
    haystack.replace(/[^\w ]/g, "").includes(strippedQuote)
  ) {
    return true;
  }
  return hasContiguousQuoteFragment(haystack, quote);
}

// True iff a CONTIGUOUS run of ≥4 quote tokens (hyphen-normalized) is a verbatim
// substring of the haystack. A genuine (possibly drifted) quote shares a long
// contiguous run with its source; a quote assembled from scattered words does
// not. Ported from scripts/provenance/gate.ts:332 (hasContiguousFragment).
function hasContiguousQuoteFragment(
  haystack: string,
  quote: string,
): boolean {
  const hyphenNormalize = (s: string): string =>
    s.replace(/[^\w ]/g, " ").replace(/\s+/g, " ").trim();
  const haystackHN = hyphenNormalize(haystack);
  const tokens = hyphenNormalize(quote).split(" ").filter(Boolean);
  const MIN_TOKENS = 4;
  if (tokens.length < MIN_TOKENS) {
    return false;
  }
  for (let i = 0; i + MIN_TOKENS <= tokens.length; i++) {
    for (let j = tokens.length; j >= i + MIN_TOKENS; j--) {
      const fragment = tokens.slice(i, j).join(" ");
      if (fragment.length >= 18 && haystackHN.includes(fragment)) {
        return true;
      }
    }
  }
  return false;
}

// Phase 2 quote-at-URL: a containment-mismatch detail that names the missing
// signal class, so a dropped/demoted row's telemetry distinguishes a fabricated
// QUOTE (the keystone pattern) from a missing number/entity.
function containmentMismatchDetail(
  needs: NormalizedContainmentNeed,
  text: string | null,
): string {
  if (needs.quotes.length > 0) {
    const missingQuotes = needs.quotes.filter(
      (quote) => !isQuoteContainedInLiveText(text ?? "", quote),
    );
    if (missingQuotes.length > 0) {
      return `Fetched page text did not contain the attributed verbatim quote (${missingQuotes.length} uncontained).`;
    }
  }
  return "Fetched page text did not contain the attributed number or named entity.";
}

function containmentPasses({
  needs,
  text,
}: {
  needs: NormalizedContainmentNeed;
  text: string | null;
}): boolean {
  if (
    needs.numbers.length === 0 &&
    needs.entities.length === 0 &&
    needs.requiredEntities.length === 0 &&
    needs.quotes.length === 0
  ) {
    return true;
  }

  if (text === null || text.length === 0) {
    return false;
  }

  const normalized = normalizeForContainment(text);
  const numbersPass = needs.numbers.every((number) =>
    containsNumber(normalized, number),
  );
  const entitiesPass =
    needs.entities.length === 0 ||
    needs.entities.some((entity) => containsEntity(normalized, entity));
  // Strict: a row that names specific entities in its NAME fields (e.g. a
  // persona's named human + employer) must reproduce EVERY such value on the
  // live page. One real entity can no longer carry a fabricated sibling past
  // containment.
  const requiredEntitiesPass = needs.requiredEntities.every((entity) =>
    containsEntity(normalized, entity),
  );
  // Phase 2 quote-at-URL: a verbatim quote stapled onto a real fetched URL must
  // appear in the fetched page text (strict .every). This is the keystone that
  // catches "confident-with-a-citation-it-never-opened" — a fabricated quote
  // clears entity/number containment but is absent from the real page.
  const quotesPass = needs.quotes.every((quote) =>
    isQuoteContainedInLiveText(text, quote),
  );

  return numbersPass && entitiesPass && requiredEntitiesPass && quotesPass;
}

// Phase 2 — three-way containment classification used by downgradeMode.
//   "contained"   — every required signal is on the page (strict pass).
//   "partial"     — SOME (but not all) required entity tokens match: a missing
//                   sibling (e.g. company present, named human absent). Kept and
//                   DOWNGRADED, never dropped (§4.6: missing sibling -> downgrade).
//   "uncontained" — no required signal matched / page empty. Kept + downgraded.
// Numbers and lenient proper-noun entities follow the same .some() spirit here:
// their absence demotes confidence, it does not refute the claim.
function classifyContainment({
  needs,
  text,
}: {
  needs: NormalizedContainmentNeed;
  text: string | null;
}): "contained" | "partial" | "uncontained" {
  if (
    needs.numbers.length === 0 &&
    needs.entities.length === 0 &&
    needs.requiredEntities.length === 0 &&
    needs.quotes.length === 0
  ) {
    return "contained";
  }

  if (text === null || text.length === 0) {
    return "uncontained";
  }

  const normalized = normalizeForContainment(text);
  const numbersAllPass =
    needs.numbers.length === 0 ||
    needs.numbers.every((number) => containsNumber(normalized, number));
  const lenientEntitiesPass =
    needs.entities.length === 0 ||
    needs.entities.some((entity) => containsEntity(normalized, entity));

  const requiredMatches = needs.requiredEntities.filter((entity) =>
    containsEntity(normalized, entity),
  ).length;
  const requiredAllPass =
    needs.requiredEntities.length === 0 ||
    requiredMatches === needs.requiredEntities.length;
  const requiredAnyPass =
    needs.requiredEntities.length === 0 || requiredMatches > 0;

  // Phase 2 quote-at-URL: verbatim quotes are strict (.every). A missing quote
  // on a fetched page is the fabrication signal — it demotes the row, never
  // silently passes.
  const quotesAllPass =
    needs.quotes.length === 0 ||
    needs.quotes.every((quote) => isQuoteContainedInLiveText(text, quote));
  const quotesAnyPass =
    needs.quotes.length === 0 ||
    needs.quotes.some((quote) => isQuoteContainedInLiveText(text, quote));

  if (numbersAllPass && lenientEntitiesPass && requiredAllPass && quotesAllPass) {
    return "contained";
  }

  // EITHER the name OR the company token (a required entity) is present, OR a
  // number/lenient entity matched — enough real signal to keep-and-downgrade.
  // A quote that partially matches (some quote present, one absent) also counts
  // as partial: real signal exists, the row is demoted not dropped.
  if (
    (requiredAnyPass && (numbersAllPass || lenientEntitiesPass)) ||
    (quotesAnyPass && (requiredAnyPass || numbersAllPass || lenientEntitiesPass))
  ) {
    return "partial";
  }
  if (
    requiredAnyPass &&
    needs.numbers.length === 0 &&
    needs.entities.length === 0 &&
    needs.quotes.length === 0
  ) {
    return "partial";
  }

  return "uncontained";
}

async function mapWithConcurrency<T, R>({
  concurrency,
  items,
  mapper,
}: {
  concurrency: number;
  items: readonly T[];
  mapper: (item: T) => Promise<R>;
}): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index] as T);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}

const emptiedBlockGapSummary =
  "Public sources for this block could not be independently verified, so those rows are not shown.";

// When liveness/containment drops empty out a standard evidence block
// ({ prose, <rows>[], blockGap? }), install an honest blockGap so the
// artifact stays committable and the reader sees a plain-language gap
// instead of the section crashing on persistence minimums. The block's prose
// is replaced with the same summary: prose narrating dropped rows would
// otherwise keep asserting the dropped numbers over an empty table.
function installBlockGapsForEmptiedBlocks({
  after,
  before,
}: {
  after: Record<string, unknown>;
  before: Record<string, unknown>;
}): Record<string, unknown> {
  const next: Record<string, unknown> = { ...after };

  for (const [key, afterValue] of Object.entries(after)) {
    const beforeValue = before[key];

    if (!isRecord(afterValue) || !isRecord(beforeValue)) {
      continue;
    }

    if (typeof afterValue.prose !== "string") {
      continue;
    }

    if (afterValue.blockGap !== undefined && afterValue.blockGap !== null) {
      continue;
    }

    for (const [field, fieldValue] of Object.entries(afterValue)) {
      const beforeField = beforeValue[field];

      if (
        Array.isArray(fieldValue) &&
        fieldValue.length === 0 &&
        Array.isArray(beforeField) &&
        beforeField.length > 0
      ) {
        next[key] = {
          ...afterValue,
          prose: emptiedBlockGapSummary,
          blockGap: {
            summary: emptiedBlockGapSummary,
            foundCount: 0,
            requiredCount: beforeField.length,
            sourcingPlan: [
              "Re-verify the removed citations against live sources and restore the rows that hold up.",
            ],
          },
        };
        break;
      }
    }
  }

  return next;
}

// Phase 2 — demote a kept row in place: write its verification meta, demote a
// hard_evidence tier to directional_signal (other tiers are left as-is), and
// return the strippedRow the caller folds into coverage.strippedByVerifier. The
// row's REAL sourceUrl is never rewritten. `row` is a node inside the cloned
// body, so the mutation surfaces in the returned body.
function downgradeRowInPlace({
  detail,
  reach,
  row,
}: {
  detail: string;
  reach: "uncontained" | "unreachable";
  row: Record<string, unknown>;
}): StrippedRow {
  const originalTier =
    row.tier === "hard_evidence" ||
    row.tier === "directional_signal" ||
    row.tier === "strategic_inference" ||
    row.tier === "operator_input"
      ? row.tier
      : "hard_evidence";

  // Only hard_evidence is re-fetch-gated, so only it can be demoted here; a row
  // carrying a weaker tier keeps it (already not re-fetch-gated).
  if (row.tier === "hard_evidence") {
    row.tier = "directional_signal";
  }

  row.verification = {
    reach,
    outcome: "downgraded",
    method: "node-fetch re-check",
    note: detail,
  };

  const sourceUrl =
    typeof row.sourceUrl === "string" ? row.sourceUrl : undefined;

  return {
    summary: extractEvidenceText(row) || `Row at ${reach} source`,
    originalTier,
    droppedReason:
      reach === "unreachable"
        ? `unreachable: ${detail}`
        : `containment-mismatch: ${detail}`,
    ...(sourceUrl !== undefined ? { sourceUrl } : {}),
  };
}

function dropRowsByPath({
  drops,
  value,
}: {
  drops: ReadonlySet<string>;
  value: unknown;
}): unknown {
  function visit(child: unknown, path: string): unknown {
    if (Array.isArray(child)) {
      return child.flatMap((item, index) => {
        const itemPath = `${path}[${index}]`;

        if (drops.has(itemPath)) {
          return [];
        }

        return [visit(item, itemPath)];
      });
    }

    if (!isRecord(child)) {
      return child;
    }

    if (path !== "body" && drops.has(path)) {
      return undefined;
    }

    const next: Record<string, unknown> = {};

    for (const [key, childValue] of Object.entries(child)) {
      const childPath = pathForChild(path, key);

      if (drops.has(childPath)) {
        continue;
      }

      const visited = visit(childValue, childPath);
      if (visited !== undefined) {
        next[key] = visited;
      }
    }

    return next;
  }

  return visit(value, "body");
}

function passRate({
  passed,
  total,
}: {
  passed: number;
  total: number;
}): number {
  return total === 0 ? 1 : passed / total;
}

function isGlobalNetworkUnavailable(
  probes: ReadonlyMap<string, UrlProbe>,
): boolean {
  if (probes.size === 0) {
    return false;
  }

  const values = Array.from(probes.values());
  const statusBearingCount = values.filter((probe) => probe.status !== null).length;
  const fetchErrorCount = values.filter(
    (probe) => probe.type === "dead" && probe.status === null,
  ).length;

  return statusBearingCount === 0 && fetchErrorCount / probes.size >= 0.8;
}

export async function applySourceLivenessGate({
  body,
  concurrency = defaultConcurrency,
  downgradeMode = false,
  fetchImpl = fetch,
  maxChecks = defaultMaxChecks,
  preverifiedUrls = new Set<string>(),
  signal,
  timeoutMs = defaultTimeoutMs,
}: {
  body: Record<string, unknown>;
  concurrency?: number;
  // Phase 2 (§4.6): when true, an uncontained/unreachable row is KEPT and
  // demoted (tier hard_evidence -> directional_signal, verification meta
  // written, strippedRow recorded) instead of dropped + URL-rewritten. Default
  // false preserves the existing delete behaviour for the other 6 sections.
  downgradeMode?: boolean;
  fetchImpl?: SourceLivenessFetch;
  maxChecks?: number;
  preverifiedUrls?: ReadonlySet<string>;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<SourceLivenessResult> {
  const cloned = cloneJsonRecord(body);
  const rows = collectSourceUrlRows({ body: cloned });
  // A preverified URL means the agent fetched it during the run (it is real and
  // live) — it does NOT mean the named human/company this row attributes to it
  // actually appears on the page. Rows that name a specific entity in their NAME
  // fields must still be grounded, so their URLs are probed even when preverified.
  // This closes the c9bc2056 hole where a real vendor page
  // (airtable.com/breakthroughs) was preverified and carried fabricated personas
  // (Sarah Koo, Michelle Bandler) past the containment check entirely.
  const entityGroundedUrls = new Set(
    rows
      .filter((row) => containmentNeeds(row.row).requiredEntities.length > 0)
      .map((row) => row.sourceUrl),
  );
  const urlsToProbe = Array.from(
    new Set(
      rows
        .map((row) => row.sourceUrl)
        .filter(
          (url) => !preverifiedUrls.has(url) || entityGroundedUrls.has(url),
        )
        .slice(0, maxChecks),
    ),
  );
  const rowsByUrl = new Map(rows.map((row) => [row.sourceUrl, row.row]));
  const probes = new Map<string, UrlProbe>();

  await mapWithConcurrency({
    concurrency,
    items: urlsToProbe,
    mapper: async (url): Promise<void> => {
      const row = rowsByUrl.get(url);
      const needs =
        row === undefined
          ? { entities: [], requiredEntities: [], numbers: [], quotes: [] }
          : containmentNeeds(row);
      const needsText =
        needs.entities.length > 0 ||
        needs.requiredEntities.length > 0 ||
        needs.numbers.length > 0 ||
        needs.quotes.length > 0;
      probes.set(
        url,
        await probeUrl({
          fetchImpl,
          needsText,
          signal,
          timeoutMs,
          url,
        }),
      );
    },
  });

  const networkUnavailable = isGlobalNetworkUnavailable(probes);

  const droppedRows: SourceLivenessDrop[] = [];
  const checkedUrls: SourceLivenessCheck[] = [];
  const livenessUnknownRows: SourceLivenessUnknownRow[] = [];
  const downgradedRows: DowngradedRow[] = [];
  const droppedPaths = new Set<string>();
  let liveTotal = 0;
  let livePassed = 0;
  let containmentTotal = 0;
  let containmentPassed = 0;

  for (const row of rows) {
    const rowNeedsEntityGrounding =
      containmentNeeds(row.row).requiredEntities.length > 0;
    if (preverifiedUrls.has(row.sourceUrl) && !rowNeedsEntityGrounding) {
      // Preverified + no named entity to ground: spare the probe (cost saving),
      // the agent already established the URL is real/live.
      checkedUrls.push({
        containmentChecked: false,
        containmentPassed: true,
        livenessPassed: true,
        sourceUrl: row.sourceUrl,
        status: null,
      });
      continue;
    }

    const probe = probes.get(row.sourceUrl);

    if (probe === undefined) {
      continue;
    }

    if (
      probe.type === "dead" &&
      probe.status !== null &&
      botHostileStatusCodes.has(probe.status) &&
      botHostileRegistrableDomains.has(
        getRegistrableDomain(row.sourceUrl) ?? "",
      )
    ) {
      // Bot-walled host: the probe was blocked, not the evidence refuted.
      // Keep the row, record it, and leave it out of the passRate
      // denominator (mirrors the networkUnavailable carve-out below).
      livenessUnknownRows.push({
        path: row.path,
        sourceUrl: row.sourceUrl,
        status: probe.status,
      });
      checkedUrls.push({
        containmentChecked: false,
        containmentPassed: false,
        livenessPassed: false,
        sourceUrl: row.sourceUrl,
        status: probe.status,
      });
      continue;
    }

    if (preverifiedUrls.has(row.sourceUrl) && probe.type !== "live") {
      // The agent already fetched this URL successfully during the run, so a
      // verify-time probe failure (network/http) does not refute it. Keep the
      // row and exclude it from the liveness denominator (mirrors the
      // bot-hostile carve-out above). We could not re-fetch text to run name
      // containment, so the row is kept rather than dropped.
      livenessUnknownRows.push({
        path: row.path,
        sourceUrl: row.sourceUrl,
        status: probe.status,
      });
      checkedUrls.push({
        containmentChecked: false,
        containmentPassed: false,
        livenessPassed: false,
        sourceUrl: row.sourceUrl,
        status: probe.status,
      });
      continue;
    }

    liveTotal += 1;
    if (probe.type === "live") {
      livePassed += 1;
    } else if (networkUnavailable) {
      checkedUrls.push({
        containmentChecked: false,
        containmentPassed: false,
        livenessPassed: false,
        sourceUrl: row.sourceUrl,
        status: probe.status,
      });
      continue;
    } else if (downgradeMode) {
      // §4.6: an unreachable re-fetch (fetch error / non-200 from a non-bot-
      // hostile host) is ABSENCE OF CONFIRMATION, not evidence of falsity —
      // keep the row and demote it instead of dropping + URL-rewriting.
      downgradedRows.push({
        path: row.path,
        strippedRow: downgradeRowInPlace({
          detail: probe.detail,
          reach: "unreachable",
          row: row.row,
        }),
      });
      checkedUrls.push({
        containmentChecked: false,
        containmentPassed: false,
        livenessPassed: false,
        sourceUrl: row.sourceUrl,
        status: probe.status,
      });
      continue;
    } else {
      const drop: SourceLivenessDrop = {
        path: row.path,
        reason: probe.status === null ? "fetch-error" : "http-error",
        sourceUrl: row.sourceUrl,
        detail: probe.detail,
      };
      droppedRows.push(drop);
      droppedPaths.add(row.path);
      checkedUrls.push({
        containmentChecked: false,
        containmentPassed: false,
        livenessPassed: false,
        sourceUrl: row.sourceUrl,
        status: probe.status,
      });
      continue;
    }

    const needs = containmentNeeds(row.row);
    const containmentChecked =
      needs.entities.length > 0 ||
      needs.requiredEntities.length > 0 ||
      needs.numbers.length > 0 ||
      needs.quotes.length > 0;

    if (downgradeMode) {
      // §4.6: classify three ways. "contained" passes; "partial" (a missing
      // sibling token — .some() over required entities) and "uncontained" are
      // KEPT + demoted, never dropped. Only an affirmative contradiction would
      // refute, which this gate does not synthesize.
      const containment = classifyContainment({ needs, text: probe.text });

      if (containmentChecked) {
        containmentTotal += 1;
        if (containment === "contained") {
          containmentPassed += 1;
        } else {
          downgradedRows.push({
            path: row.path,
            strippedRow: downgradeRowInPlace({
              // The detail names the missing signal class. A quote-mismatch takes
              // precedence (the keystone pattern) — even when classifyContainment
              // returned "partial" on entity grounds, a missing verbatim quote is
              // the load-bearing failure and the telemetry must say so.
              detail:
                containment === "partial" &&
                needs.quotes.length === 0
                  ? "Live page contained only part of the attributed entity (missing sibling token)."
                  : containmentMismatchDetail(needs, probe.text),
              reach: "uncontained",
              row: row.row,
            }),
          });
        }
      }

      checkedUrls.push({
        containmentChecked,
        containmentPassed: !containmentChecked || containment === "contained",
        livenessPassed: true,
        sourceUrl: row.sourceUrl,
        status: probe.status,
      });
      continue;
    }

    const contained = containmentPasses({ needs, text: probe.text });

    if (containmentChecked) {
      containmentTotal += 1;
      if (contained) {
        containmentPassed += 1;
      } else {
        const drop: SourceLivenessDrop = {
          path: row.path,
          reason: "containment-mismatch",
          sourceUrl: row.sourceUrl,
          detail: containmentMismatchDetail(needs, probe.text),
        };
        droppedRows.push(drop);
        droppedPaths.add(row.path);
      }
    }

    checkedUrls.push({
      containmentChecked,
      containmentPassed: !containmentChecked || contained,
      livenessPassed: true,
      sourceUrl: row.sourceUrl,
      status: probe.status,
    });
  }

  const nextBody = dropRowsByPath({ drops: droppedPaths, value: cloned });
  const gappedBody =
    !networkUnavailable && isRecord(nextBody)
      ? installBlockGapsForEmptiedBlocks({ after: nextBody, before: cloned })
      : nextBody;

  return {
    body: networkUnavailable ? cloned : isRecord(gappedBody) ? gappedBody : cloned,
    checkedUrls,
    droppedRows: networkUnavailable ? [] : droppedRows,
    livenessUnknownRows: networkUnavailable ? [] : livenessUnknownRows,
    downgradedRows: networkUnavailable ? [] : downgradedRows,
    containmentPassRate: networkUnavailable
      ? null
      : passRate({
          passed: containmentPassed,
          total: containmentTotal,
        }),
    livenessPassRate: networkUnavailable
      ? null
      : passRate({ passed: livePassed, total: liveTotal }),
    networkUnavailable,
  };
}

export function collectPreverifiedSourceUrlsFromSteps({
  steps,
}: {
  steps: readonly {
    toolResults: readonly { input?: unknown; output: unknown; type?: string }[];
  }[];
}): ReadonlySet<string> {
  const urls = new Set<string>();

  function visit(value: unknown): void {
    const url = validHttpUrl(value);
    if (url !== null) {
      urls.add(url);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (!isRecord(value)) {
      return;
    }

    for (const child of Object.values(value)) {
      visit(child);
    }
  }

  for (const step of steps) {
    for (const toolResult of step.toolResults) {
      if (toolResult.type === "tool-error") {
        continue;
      }
      visit(toolResult.input);
      visit(toolResult.output);
    }
  }

  return urls;
}

function extractMarkdownLinkTexts(value: string): string[] {
  return Array.from(value.matchAll(/\[([^\]]{2,80})]\(([^)]+)\)/g)).map(
    (match) => normalizeWhitespace(match[1] ?? ""),
  );
}

function extractHtmlAnchorTexts(value: string): string[] {
  return Array.from(
    value.matchAll(/<(?:a|button)\b[^>]*>([\s\S]{2,120}?)<\/(?:a|button)>/gi),
  ).map((match) => stripHtmlToText(match[1] ?? ""));
}

export function extractSubjectSiteObservation({
  sourceUrl,
  text,
}: {
  sourceUrl: string;
  text: string;
}): SubjectSiteObservation {
  const ctas = uniqueStrings(
    [...extractMarkdownLinkTexts(text), ...extractHtmlAnchorTexts(text)]
      .map(normalizeWhitespace)
      .filter((cta) => freeSignupPattern.test(cta)),
  );

  return { sourceUrl, text, ctas };
}

export function collectSubjectSiteObservations({
  corpusExcerpts,
  subjectWebsiteUrl,
}: {
  corpusExcerpts: readonly { sourceUrl: string; text: string }[];
  subjectWebsiteUrl: string | null;
}): SubjectSiteObservation[] {
  if (subjectWebsiteUrl === null) {
    return [];
  }

  const subjectDomain = getRegistrableDomain(subjectWebsiteUrl);
  if (subjectDomain === null) {
    return [];
  }

  return corpusExcerpts.flatMap((excerpt) => {
    const excerptDomain = getRegistrableDomain(excerpt.sourceUrl);
    if (excerptDomain !== subjectDomain) {
      return [];
    }

    const observation = extractSubjectSiteObservation(excerpt);
    return observation.ctas.length > 0 || freeSignupPattern.test(excerpt.text)
      ? [observation]
      : [];
  });
}

export function collectSubjectSiteObservationsFromSteps({
  steps,
  subjectWebsiteUrl,
}: {
  steps: readonly {
    toolResults: readonly { output: unknown; type?: string }[];
  }[];
  subjectWebsiteUrl: string | null;
}): SubjectSiteObservation[] {
  if (subjectWebsiteUrl === null) {
    return [];
  }

  const subjectDomain = getRegistrableDomain(subjectWebsiteUrl);
  if (subjectDomain === null) {
    return [];
  }

  return steps.flatMap((step) =>
    step.toolResults.flatMap((toolResult) => {
      if (toolResult.type === "tool-error") {
        return [];
      }

      const output = toolResult.output;
      if (!isRecord(output)) {
        return [];
      }

      const outputType = output.type;
      const markdown = output.markdown;
      const outputUrl = validHttpUrl(output.sourceUrl) ?? validHttpUrl(output.url);

      if (
        outputType !== "result" ||
        typeof markdown !== "string" ||
        outputUrl === null ||
        getRegistrableDomain(outputUrl) !== subjectDomain
      ) {
        return [];
      }

      const observation = extractSubjectSiteObservation({
        sourceUrl: outputUrl,
        text: markdown,
      });

      return observation.ctas.length > 0 || freeSignupPattern.test(markdown)
        ? [observation]
        : [];
    }),
  );
}

function observedSelfServeCtas(
  observations: readonly SubjectSiteObservation[],
): string[] {
  return uniqueStrings(
    observations.flatMap((observation) =>
      observation.ctas.length > 0
        ? observation.ctas
        : freeSignupPattern.test(observation.text)
          ? ["observed free/signup CTA"]
          : [],
    ),
  );
}

const contradictedSubjectCtaPlaceholder =
  "This company offers a free, self-serve signup, so a pricing-gate constraint does not bind here.";

// A sentence contradicts an observed free/signup CTA only when it explicitly
// asserts the subject site's CTA/gating state: either an affirmative
// exclusive-gate claim ("every CTA routes to a demo", "demo-gated") or a
// negated self-serve claim anchored to the site/CTA ("no self-serve signup
// path"). Pure funnel arithmetic ("94% of signups never convert") asserts
// nothing about the purchase path and must survive.
function sentenceAssertsContradictedSubjectCta(sentence: string): boolean {
  return (
    demoGateAssertionPattern.test(sentence) ||
    (negativeSelfServePattern.test(sentence) &&
      subjectCtaAnchorPattern.test(sentence))
  );
}

interface SubjectCtaStripState {
  placeholderUsed: boolean;
}

function stripContradictedStrings({
  observedCtas,
  path,
  state,
  value,
}: {
  observedCtas: readonly string[];
  path: string;
  state: SubjectCtaStripState;
  value: unknown;
}): { value: unknown; stripped: SubjectCtaClaimStrip[] } {
  if (typeof value === "string") {
    const sentences = value.split(ctaSentenceSplitPattern);
    const offending = sentences.filter(sentenceAssertsContradictedSubjectCta);

    if (offending.length === 0) {
      return { value, stripped: [] };
    }

    // Strike only the offending sentence(s); the rest of the field survives.
    const remainder = sentences
      .filter((sentence) => !sentenceAssertsContradictedSubjectCta(sentence))
      .join(" ")
      .trim();

    if (remainder.length > 0) {
      return {
        value: remainder,
        stripped: [
          {
            path,
            reason: "contradicted-subject-site-cta",
            removedText: offending.join(" "),
            observedCtas: [...observedCtas],
          },
        ],
      };
    }

    // The whole field offends. The placeholder may ship at most ONCE per
    // section — run d838ed4e pasted the identical placeholder into five
    // strategic fields. A second fully-offending field keeps its text; the
    // section badge and verifierSummary still surface the first strike.
    if (state.placeholderUsed) {
      return { value, stripped: [] };
    }

    state.placeholderUsed = true;

    return {
      value: contradictedSubjectCtaPlaceholder,
      stripped: [
        {
          path,
          reason: "contradicted-subject-site-cta",
          removedText: value,
          observedCtas: [...observedCtas],
        },
      ],
    };
  }

  if (Array.isArray(value)) {
    const stripped: SubjectCtaClaimStrip[] = [];
    const next = value.map((item, index) => {
      const child = stripContradictedStrings({
        observedCtas,
        path: `${path}[${index}]`,
        state,
        value: item,
      });
      stripped.push(...child.stripped);
      return child.value;
    });

    return { value: next, stripped };
  }

  if (!isRecord(value)) {
    return { value, stripped: [] };
  }

  const stripped: SubjectCtaClaimStrip[] = [];
  const next: Record<string, unknown> = {};

  for (const [key, childValue] of Object.entries(value)) {
    const child = stripContradictedStrings({
      observedCtas,
      path: pathForChild(path, key),
      state,
      value: childValue,
    });
    next[key] = child.value;
    stripped.push(...child.stripped);
  }

  return { value: next, stripped };
}

export function stripContradictedSubjectCtaClaims({
  body,
  observations,
}: {
  body: Record<string, unknown>;
  observations: readonly SubjectSiteObservation[];
}): SubjectCtaClaimResult {
  const observedCtas = observedSelfServeCtas(observations);

  if (observedCtas.length === 0) {
    return { body, stripped: [] };
  }

  const cloned = cloneJsonRecord(body);
  const result = stripContradictedStrings({
    observedCtas,
    path: "body",
    state: { placeholderUsed: false },
    value: cloned,
  });

  return {
    body: isRecord(result.value) ? result.value : cloned,
    stripped: result.stripped,
  };
}
