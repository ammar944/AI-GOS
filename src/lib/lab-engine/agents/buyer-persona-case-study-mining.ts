// Buyer ICP case-study champion acquisition.
//
// The Perplexity venue prepass (buyer-persona-acquisition.ts) is unreliable at
// surfacing named EXTERNAL buyers — live-probed against Ramp it returned 0-1
// parseable leads, and the only one was a vendor exec. The durable source is the
// subject's OWN customer/case-study pages: they name real external buyers (CFO /
// VP Finance / Controller at named customer companies) in server-rendered prose,
// so the name + employer appear in fetchable page text and clear the
// source-liveness containment gate that JS-rendered LinkedIn/news URLs fail.
//
// This module maps the subject site, scrapes its case-study leaf pages, and
// extracts champion LEADS (the agent verifies + promotes each against the
// scraped page it is handed). Direct Firecrawl v2 calls mirror tools/reviews.ts.
// Bounded: one map + at most scrapeLimit scrapes; never a loop.

import { getRegistrableDomain } from "../domain-utils";
import { isLikelyNamedBuyerIdentity } from "../artifacts/schemas/buyer-icp";
import {
  personaCompanyReconcilesWithSubject,
  type BuyerPersonaCandidate,
} from "./buyer-persona-acquisition";
import { credentialGap, type ToolGap } from "./tools/_shared";

const firecrawlMapUrl = "https://api.firecrawl.dev/v2/map";
const firecrawlScrapeUrl = "https://api.firecrawl.dev/v2/scrape";
const caseStudyScrapeTimeoutMs = 18_000;
const caseStudyMapTimeoutMs = 18_000;

const CASE_STUDY_MAP_LIMIT = 60;
const CASE_STUDY_SCRAPE_LIMIT = 8;
const CASE_STUDY_MAX_CHAMPIONS_PER_PAGE = 2;

// Path segments that denote a customer-story/case-study area. A LEAF page under
// one of these (a slug after the segment) is a single customer story; the bare
// segment is the index and is skipped.
const caseStudyPathSegmentPattern =
  /\/(?:customers?|case-?stud(?:y|ies)|customer-stories|success-stories|stories|testimonials?)\/([^/?#]+)/i;

// A real person's name never contains these role/department tokens — used to
// reject "Marketing Operations Manager"-style role phrases that sit where a name
// would in an attribution.
const roleDepartmentStopwords = new Set([
  "chief",
  "officer",
  "vp",
  "vice",
  "president",
  "director",
  "head",
  "manager",
  "lead",
  "controller",
  "founder",
  "cofounder",
  "ceo",
  "cfo",
  "coo",
  "cto",
  "cmo",
  "cro",
  "finance",
  "accounting",
  "accountant",
  "marketing",
  "operations",
  "sales",
  "revenue",
  "product",
  "engineering",
  "growth",
  "people",
  "talent",
  "procurement",
  "treasury",
  "treasurer",
  "team",
]);

const titleRoleKeywordPattern =
  /\b(?:chief|c[efot]o|cmo|cro|vp|vice president|head|director|senior director|controller|founder|co-?founder|president|manager|lead|officer|treasurer|finance|accounting|accountant|procurement|owner|partner)\b/i;

// Connectives, prepositions, articles, determiners, pronouns, and common
// sentence-start verbs that begin a narrative clause but never a person name.
// Live regression (run jsl0fh): the em-dash attribution pattern matched the
// start of a marketing sentence — "With Ramp — the finance team has also
// streamlined..." — and the trailing finance noun satisfied the title-role
// check, so a clause was extracted as a champion named "With Ramp". A name is
// rejected if ANY of its bare tokens is in this set.
const nonNameWords = new Set([
  "with",
  "before",
  "after",
  "when",
  "while",
  "the",
  "a",
  "an",
  "and",
  "but",
  "or",
  "nor",
  "so",
  "our",
  "your",
  "their",
  "his",
  "her",
  "its",
  "this",
  "that",
  "these",
  "those",
  "from",
  "into",
  "onto",
  "by",
  "for",
  "to",
  "of",
  "in",
  "on",
  "at",
  "as",
  "how",
  "why",
  "what",
  "since",
  "because",
  "although",
  "though",
  "during",
  "once",
  "said",
  "says",
  "using",
  "used",
  "founded",
  "here",
  "there",
  "we",
  "they",
  "it",
]);

const subjectCtaStopAttribution = /\b(?:said|says|according to|explains|notes|adds|recalls)\b/i;

function stripEmphasis(value: string): string {
  return value.replace(/[*_`]+/g, "");
}

function titleizeSlug(slug: string): string | null {
  const cleaned = slug
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .trim();
  if (cleaned.length === 0) {
    return null;
  }
  return cleaned
    .split("-")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * True when `url` is a single customer-story/case-study LEAF page on the
 * subject's own registrable domain (a slug after the customers/case-study
 * segment). The bare index page and off-domain URLs are rejected.
 */
export function isCaseStudyUrl(url: string, subjectDomain: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const urlDomain = getRegistrableDomain(url);
  if (urlDomain === null || urlDomain !== subjectDomain) {
    return false;
  }
  const match = caseStudyPathSegmentPattern.exec(parsed.pathname);
  if (match === null) {
    return false;
  }
  const slug = match[1]?.trim() ?? "";
  return slug.length > 0;
}

/** Derive the customer company name from the case-study URL's trailing slug. */
export function deriveCustomerCompanyFromCaseStudyUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const match = caseStudyPathSegmentPattern.exec(parsed.pathname);
  const slug = match?.[1];
  if (slug === undefined) {
    return null;
  }
  return titleizeSlug(slug);
}

interface ExtractedChampion {
  name: string;
  title: string;
  company: string;
}

function looksLikePersonName(name: string): boolean {
  const tokens = name.trim().split(/\s+/);
  if (tokens.length < 2 || tokens.length > 3) {
    return false;
  }
  for (const token of tokens) {
    if (!/^[A-Z][a-zA-Z.'’-]*$/.test(token)) {
      return false;
    }
    const bare = token.toLowerCase().replace(/[^a-z]/g, "");
    if (roleDepartmentStopwords.has(bare) || nonNameWords.has(bare)) {
      return false;
    }
  }
  return true;
}

function parseTitleAndCompany(
  rest: string,
  fallbackCompany: string,
): { title: string; company: string } | null {
  const trimmed = rest
    .replace(subjectCtaStopAttribution, "")
    .replace(/[.\s]+$/, "")
    .trim();
  if (trimmed.length === 0 || trimmed.length > 80) {
    return null;
  }

  // A company name never runs past the first clause boundary, and never contains
  // serialized-markup characters (quotes/brackets/braces) — trim at the first one
  // so an RSC-embedded attribution ("Perplexity"]}],[...") yields "Perplexity".
  const firstClause = (value: string): string => {
    const clause = value.split(/[,;.]/)[0]?.trim() ?? "";
    const cut = clause.split(/["'`[\]{}|\\<>]/)[0] ?? clause;
    return cut.replace(/[\s,;:.–—-]+$/, "").trim();
  };

  // "<title> at <company>"
  const atMatch = /^(.+?)\s+at\s+(.+)$/i.exec(trimmed);
  if (atMatch?.[1] !== undefined && atMatch[2] !== undefined) {
    return { title: atMatch[1].trim(), company: firstClause(atMatch[2]) };
  }
  // "<C-level/Founder/President> of <company>"
  const ofMatch =
    /^((?:chief[^,]*officer|c[efot]o|cmo|cro|president|founder|co-?founder|owner)[^,]*?)\s+of\s+(.+)$/i.exec(
      trimmed,
    );
  if (ofMatch?.[1] !== undefined && ofMatch[2] !== undefined) {
    return { title: ofMatch[1].trim(), company: firstClause(ofMatch[2]) };
  }
  // "<title>, <company>"
  const commaMatch = /^(.+?),\s+(.+)$/.exec(trimmed);
  if (commaMatch?.[1] !== undefined && commaMatch[2] !== undefined) {
    return { title: commaMatch[1].trim(), company: firstClause(commaMatch[2]) };
  }
  return { title: firstClause(trimmed), company: fallbackCompany };
}

/**
 * Best-effort extraction of named champions from a scraped case-study page.
 * Recognizes "<Name>, <Title>[ at|of <Company>]" attribution shapes. The agent
 * re-verifies each promoted persona against the same page text, so this is a
 * lead generator, not the final authority.
 */
export function extractCaseStudyChampions(
  markdown: string,
  customerCompany: string | null,
): ExtractedChampion[] {
  const text = stripEmphasis(markdown);
  const fallbackCompany = customerCompany ?? "";
  const seen = new Set<string>();
  const champions: ExtractedChampion[] = [];

  // Accept a comma OR an em/en dash between the name and the title clause.
  // Server-rendered case-study pages attribute champions as "Name — Title at
  // Company" (em dash, no comma); the comma-only form silently dropped every
  // such champion (live-proven on ramp.com/customers/wizehire + perplexity).
  const attributionPattern =
    /([A-Z][a-zA-Z.'’-]+(?:\s+[A-Z][a-zA-Z.'’-]+){1,2})\s*[,—–]\s+([^.\n]{2,80})/g;

  for (const match of text.matchAll(attributionPattern)) {
    const name = match[1]?.trim() ?? "";
    const rest = match[2]?.trim() ?? "";
    if (!looksLikePersonName(name)) {
      continue;
    }
    if (!titleRoleKeywordPattern.test(rest)) {
      continue;
    }
    const parsed = parseTitleAndCompany(rest, fallbackCompany);
    if (parsed === null || !titleRoleKeywordPattern.test(parsed.title)) {
      continue;
    }
    if (
      !isLikelyNamedBuyerIdentity(name, {
        company: parsed.company,
        title: parsed.title,
      })
    ) {
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    champions.push({ name, title: parsed.title, company: parsed.company });
  }

  return champions;
}

export interface BuyerPersonaSubject {
  name: string;
  websiteUrl: string;
}

export interface CaseStudyChampionAcquisition {
  candidates: BuyerPersonaCandidate[];
  pages: Array<{ url: string; markdown: string }>;
  // Set when FIRECRAWL_API_KEY is unset/empty: case-study mining is the durable
  // source of named external buyers, so a missing key is the #1 silent-zero
  // cause of BuyerICP rendering personas:[]. Surface it as an explicit gap
  // (mirrors the credentialGap pattern in tools/reviews.ts) instead of an
  // unexplained empty acquisition.
  credentialGap?: ToolGap;
}

async function postJson(
  fetchImpl: typeof fetch,
  url: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  parentSignal?: AbortSignal,
): Promise<unknown | null> {
  // If the parent (prepass deadline) is already aborted, do no work.
  if (parentSignal?.aborted === true) {
    return null;
  }
  const apiKey = process.env.FIRECRAWL_API_KEY;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // A parent abort (prepass deadline) also aborts this local request. Cleaned
  // up in finally so the listener never outlives the call. The local per-request
  // timeout above still applies independently.
  const onParentAbort = (): void => controller.abort();
  parentSignal?.addEventListener("abort", onParentAbort, { once: true });
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey === undefined ? {} : { Authorization: `Bearer ${apiKey}` }),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onParentAbort);
  }
}

function extractMapLinks(payload: unknown): string[] {
  if (payload === null || typeof payload !== "object") {
    return [];
  }
  const record = payload as Record<string, unknown>;
  const raw =
    (Array.isArray(record.links) ? record.links : undefined) ??
    (typeof record.data === "object" &&
    record.data !== null &&
    Array.isArray((record.data as Record<string, unknown>).links)
      ? ((record.data as Record<string, unknown>).links as unknown[])
      : undefined) ??
    [];
  return raw
    .map((entry) =>
      typeof entry === "string"
        ? entry
        : typeof entry === "object" && entry !== null
          ? String((entry as Record<string, unknown>).url ?? "")
          : "",
    )
    .filter((url) => url.length > 0);
}

function extractScrapeMarkdown(payload: unknown): string {
  if (payload === null || typeof payload !== "object") {
    return "";
  }
  const record = payload as Record<string, unknown>;
  const data =
    typeof record.data === "object" && record.data !== null
      ? (record.data as Record<string, unknown>)
      : record;
  return typeof data.markdown === "string" ? data.markdown : "";
}

// Mirror the source-liveness gate's verifier UA so a case-study page that serves
// these champions to that gate also serves them to this miner on a plain GET.
const caseStudyPlainFetchUserAgent =
  "AI-GOS-Source-Liveness/1.0 (+https://ai-gos.local/research-verifier)";

/** Strip HTML to readable text, preserving em/en dashes (attribution separators). */
function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Plain server-side GET of a case-study leaf page, returned as stripped text.
// Same abort/timeout discipline as postJson; never throws (empty on any failure).
async function getPlainText(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number,
  parentSignal?: AbortSignal,
): Promise<string> {
  if (parentSignal?.aborted === true) {
    return "";
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onParentAbort = (): void => controller.abort();
  parentSignal?.addEventListener("abort", onParentAbort, { once: true });
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { "User-Agent": caseStudyPlainFetchUserAgent },
      signal: controller.signal,
    });
    if (!response.ok) {
      return "";
    }
    return stripHtmlToText(await response.text());
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onParentAbort);
  }
}

// Merge champion lists from multiple extractions of the same page, deduped by
// name. Prefer the entry that carries a company (richer grounding).
function mergeChampionsByName(
  groups: readonly ExtractedChampion[][],
): ExtractedChampion[] {
  const byName = new Map<string, ExtractedChampion>();
  for (const group of groups) {
    for (const champion of group) {
      const key = champion.name.toLowerCase();
      const existing = byName.get(key);
      if (
        existing === undefined ||
        (existing.company.length === 0 && champion.company.length > 0)
      ) {
        byName.set(key, champion);
      }
    }
  }
  return [...byName.values()];
}

/**
 * Acquire named buyer-persona LEADS from the subject's own customer/case-study
 * pages. Maps the site, scrapes case-study leaf pages, extracts champions, and
 * drops any whose company reconciles with the subject. Never throws — a
 * map/scrape failure yields fewer (or no) candidates. The agent receives both
 * the leads and the scraped page text (`pages`) so it can ground firmographics
 * + the in-market trigger and author personas whose name/employer are present
 * in the cited page (clearing the source-liveness gate).
 */
export async function acquireCaseStudyChampionCandidates({
  subject,
  fetchImpl = fetch,
  mapLimit = CASE_STUDY_MAP_LIMIT,
  scrapeLimit = CASE_STUDY_SCRAPE_LIMIT,
  signal,
}: {
  subject: BuyerPersonaSubject;
  fetchImpl?: typeof fetch;
  mapLimit?: number;
  scrapeLimit?: number;
  signal?: AbortSignal;
}): Promise<CaseStudyChampionAcquisition> {
  const subjectDomain = getRegistrableDomain(subject.websiteUrl);
  if (subjectDomain === null) {
    return { candidates: [], pages: [] };
  }

  // Fail loudly, not silently: without a Firecrawl key the map/scrape calls
  // 401 and quietly yield zero case-study URLs → zero champions → BuyerICP
  // renders personas:[] with no explanation. Emit the credential gap so the
  // missing-config root cause is visible to the prepass and the reader.
  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
  if (firecrawlApiKey === undefined || firecrawlApiKey.trim().length === 0) {
    return {
      candidates: [],
      pages: [],
      credentialGap: credentialGap("FIRECRAWL_API_KEY"),
    };
  }

  const mapPayload = await postJson(
    fetchImpl,
    firecrawlMapUrl,
    { url: subject.websiteUrl, limit: mapLimit },
    caseStudyMapTimeoutMs,
    signal,
  );
  const caseStudyUrls = Array.from(
    new Set(extractMapLinks(mapPayload).filter((url) => isCaseStudyUrl(url, subjectDomain))),
  ).slice(0, scrapeLimit);

  const candidates: BuyerPersonaCandidate[] = [];
  const pages: Array<{ url: string; markdown: string }> = [];
  const seenCandidates = new Set<string>();

  for (const url of caseStudyUrls) {
    // Prepass deadline reached mid-loop: return whatever we have collected so
    // far. Never throws; partial/empty result is valid.
    if (signal?.aborted === true) {
      break;
    }
    // Firecrawl markdown (clean, JS-rendered) for the agent's evidence pool, plus
    // a plain GET — the SAME fetch the source-liveness gate later re-runs — for
    // reliable champion attributions. Firecrawl silently returns empty markdown
    // for some leaf pages (live: next.ramp.com/customers/perplexity) and can
    // reformat an attribution out of the markdown that the raw page still renders
    // cleanly. Run concurrently so the second fetch never extends the deadline.
    const [scrapePayload, plainText] = await Promise.all([
      postJson(
        fetchImpl,
        firecrawlScrapeUrl,
        { url, formats: ["markdown"], onlyMainContent: true },
        caseStudyScrapeTimeoutMs,
        signal,
      ),
      getPlainText(fetchImpl, url, caseStudyScrapeTimeoutMs, signal),
    ]);
    const firecrawlMarkdown = extractScrapeMarkdown(scrapePayload);
    // Prefer Firecrawl markdown for the evidence pool; fall back to the plain
    // fetch when Firecrawl yields nothing so the page still grounds the section.
    const pageText =
      firecrawlMarkdown.length > 0 ? firecrawlMarkdown : plainText;
    if (pageText.length === 0) {
      continue;
    }
    pages.push({ url, markdown: pageText });

    const customerCompany = deriveCustomerCompanyFromCaseStudyUrl(url);
    // Extract from both sources and merge — each catches attributions the other
    // drops. Plain-fetch text aligns with what the source-liveness gate re-reads,
    // so champions found there clear containment on re-fetch.
    const championsForPage = mergeChampionsByName([
      extractCaseStudyChampions(firecrawlMarkdown, customerCompany),
      extractCaseStudyChampions(plainText, customerCompany),
    ]);
    let perPage = 0;
    for (const champion of championsForPage) {
      if (perPage >= CASE_STUDY_MAX_CHAMPIONS_PER_PAGE) {
        break;
      }
      // Own-company guard: drop "Eric Glyman, CEO of Ramp" featured on Ramp's
      // own page. Reconcile on the CHAMPION'S COMPANY LABEL ONLY — never the
      // sourceUrl, which is always the subject's own case-study domain here and
      // would otherwise reject every real external champion.
      if (
        personaCompanyReconcilesWithSubject({
          company: champion.company,
          subjectName: subject.name,
          subjectWebsiteUrl: subject.websiteUrl,
        })
      ) {
        continue;
      }
      const key = `${champion.name.toLowerCase()}::${url}`;
      if (seenCandidates.has(key)) {
        continue;
      }
      seenCandidates.add(key);
      perPage += 1;
      candidates.push({
        company: champion.company.length > 0 ? champion.company : (customerCompany ?? ""),
        name: champion.name,
        title: champion.title,
        url,
        venue: "case_study_champions",
      });
    }
  }

  return { candidates, pages };
}
