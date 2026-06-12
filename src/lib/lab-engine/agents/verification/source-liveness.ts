import { getRegistrableDomain } from "../../domain-utils";

export interface SourceUrlRow {
  path: string;
  sourceUrl: string;
  row: Record<string, unknown>;
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
  status: number;
}

export interface SourceLivenessResult {
  body: Record<string, unknown>;
  checkedUrls: SourceLivenessCheck[];
  droppedRows: SourceLivenessDrop[];
  livenessUnknownRows: SourceLivenessUnknownRow[];
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
  entities: string[];
  numbers: string[];
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
const entityFieldNames = new Set([
  "advertiserName",
  "company",
  "competitor",
  "competitorName",
  "exampleCompany",
  "name",
  "persona",
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
    entities: uniqueStrings([...extractEntityFields(row), ...extractProperNouns(text)]),
    numbers: uniqueStrings(extractNumbers(text)),
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
  }

  if (/^\d+$/.test(noCommas)) {
    variants.add(Number(noCommas).toLocaleString("en-US"));
  }

  return Array.from(variants).filter((variant) => variant.length > 0);
}

function containsNumber(haystack: string, value: string): boolean {
  return numberVariants(value).some((variant) =>
    haystack.includes(variant.toLowerCase()),
  );
}

function containsEntity(haystack: string, value: string): boolean {
  return haystack.includes(normalizeForContainment(value));
}

function containmentPasses({
  needs,
  text,
}: {
  needs: NormalizedContainmentNeed;
  text: string | null;
}): boolean {
  if (needs.numbers.length === 0 && needs.entities.length === 0) {
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

  return numbersPass && entitiesPass;
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
  "Rows in this block were removed before publishing because their cited sources could not be verified live.";

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
  fetchImpl = fetch,
  maxChecks = defaultMaxChecks,
  preverifiedUrls = new Set<string>(),
  signal,
  timeoutMs = defaultTimeoutMs,
}: {
  body: Record<string, unknown>;
  concurrency?: number;
  fetchImpl?: SourceLivenessFetch;
  maxChecks?: number;
  preverifiedUrls?: ReadonlySet<string>;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<SourceLivenessResult> {
  const cloned = cloneJsonRecord(body);
  const rows = collectSourceUrlRows({ body: cloned });
  const urlsToProbe = Array.from(
    new Set(
      rows
        .map((row) => row.sourceUrl)
        .filter((url) => !preverifiedUrls.has(url))
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
      const needs = row === undefined ? { entities: [], numbers: [] } : containmentNeeds(row);
      const needsText = needs.entities.length > 0 || needs.numbers.length > 0;
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
  const droppedPaths = new Set<string>();
  let liveTotal = 0;
  let livePassed = 0;
  let containmentTotal = 0;
  let containmentPassed = 0;

  for (const row of rows) {
    if (preverifiedUrls.has(row.sourceUrl)) {
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
      needs.entities.length > 0 || needs.numbers.length > 0;
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
          detail: "Fetched page text did not contain the attributed number or named entity.",
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
  "Evidence gap: subject-site CTA claim removed because fetched subject pages showed a free/signup path.";

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
