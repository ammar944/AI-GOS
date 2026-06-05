export type VoiceOfCustomerCandidateSource =
  | "reviews"
  | "researchInput"
  | "web_search"
  | "firecrawl";

export type VoiceOfCustomerEvidenceKind =
  | "review"
  | "forum"
  | "support-thread"
  | "article";

export type VoiceOfCustomerAcquisitionMode =
  | "review_body"
  | "forum_comment"
  | "support_thread";

export interface VoiceOfCustomerCandidate {
  acquisitionMode: VoiceOfCustomerAcquisitionMode;
  source: VoiceOfCustomerCandidateSource;
  evidenceKind: VoiceOfCustomerEvidenceKind;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  sourceInstanceId?: string;
}

export interface VoiceOfCustomerCandidatePack {
  candidates: VoiceOfCustomerCandidate[];
  domains: string[];
}

export interface VoiceOfCustomerGap {
  reason:
    | "no_review_or_forum_surfaces"
    | "insufficient_independent_domains"
    | "insufficient_candidates";
  message: string;
  domains: string[];
  candidateCount: number;
}

export type VoiceOfCustomerCandidateResult =
  | { ok: true; pack: VoiceOfCustomerCandidatePack }
  | { ok: false; gap: VoiceOfCustomerGap };

export const VOC_CANDIDATE_PACK_MAX_SIZE = 12;
export const VOC_CANDIDATE_MIN_DOMAINS = 3;
export const VOC_CANDIDATE_MIN_COUNT = 6;
export const VOC_CANDIDATE_PER_DOMAIN_CAP = 4;
export const VOC_PREPASS_MAX_LOOKUPS = 3;
export const VOC_PREPASS_REVIEW_BODY_MAX_PAGES = 6;

interface CreateVoiceOfCustomerCandidateInput {
  acquisitionMode?: VoiceOfCustomerAcquisitionMode;
  auditedCompanyDomain: string;
  evidenceKind?: VoiceOfCustomerEvidenceKind;
  source: VoiceOfCustomerCandidateSource;
  title?: string;
  url: string;
  snippet: string;
  sourceInstanceId?: string;
}

interface RankedCandidate {
  candidate: VoiceOfCustomerCandidate;
  index: number;
}

const knownTwoLabelPublicSuffixes: ReadonlySet<string> = new Set([
  "co.uk",
  "com.au",
]);

const reviewDomains: ReadonlySet<string> = new Set([
  "capterra.com",
  "g2.com",
  "getapp.com",
  "softwareadvice.com",
  "trustpilot.com",
]);

const forumDomains: ReadonlySet<string> = new Set([
  "news.ycombinator.com",
  "quora.com",
  "reddit.com",
  "stackoverflow.com",
  "ycombinator.com",
]);

const evidenceKindRank: Readonly<Record<VoiceOfCustomerEvidenceKind, number>> = {
  review: 0,
  forum: 1,
  "support-thread": 2,
  article: 3,
};

const sourceRank: Readonly<Record<VoiceOfCustomerCandidateSource, number>> = {
  firecrawl: 0,
  reviews: 1,
  researchInput: 2,
  web_search: 3,
};

function parseUrlLike(input: string): URL | null {
  const trimmedInput = input.trim();

  if (trimmedInput.length === 0 || /\s/.test(trimmedInput)) {
    return null;
  }

  const urlInput = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedInput)
    ? trimmedInput
    : `https://${trimmedInput}`;

  try {
    return new URL(urlInput);
  } catch {
    return null;
  }
}

function isValidHostname(hostname: string): boolean {
  const labels = hostname.split(".");

  if (labels.length < 2) {
    return false;
  }

  return labels.every(
    (label) =>
      /^[a-z0-9-]+$/.test(label) &&
      !label.startsWith("-") &&
      !label.endsWith("-"),
  );
}

function normalizeHostname(hostname: string): string | null {
  let normalized = hostname.trim().toLowerCase().replace(/\.$/, "");

  while (normalized.startsWith("www.")) {
    normalized = normalized.slice(4);
  }

  return isValidHostname(normalized) ? normalized : null;
}

function normalizeCandidateUrl(input: string): string | null {
  const parsedUrl = parseUrlLike(input);
  const hostname =
    parsedUrl === null ? null : normalizeHostname(parsedUrl.hostname);

  if (parsedUrl === null || hostname === null) {
    return null;
  }

  parsedUrl.hostname = hostname;
  return parsedUrl.toString();
}

function includesSignal(
  values: readonly string[],
  signals: readonly string[],
): boolean {
  const haystack = values.join(" ").toLowerCase();
  return signals.some((signal) => haystack.includes(signal));
}

export function inferVoiceOfCustomerEvidenceKind({
  domain,
  source,
  snippet,
  title,
  url,
}: {
  domain: string;
  source: VoiceOfCustomerCandidateSource;
  snippet: string;
  title: string;
  url: string;
}): VoiceOfCustomerEvidenceKind {
  if (source === "reviews" || reviewDomains.has(domain)) {
    return "review";
  }

  if (
    forumDomains.has(domain) ||
    includesSignal(
      [domain, title, url],
      ["forum", "reddit", "hacker news", "news.ycombinator"],
    )
  ) {
    return "forum";
  }

  if (
    includesSignal(
      [domain, title, url, snippet],
      ["support", "help", "zendesk", "intercom", "freshdesk", "ticket"],
    )
  ) {
    return "support-thread";
  }

  if (includesSignal([domain, title, url], ["community", "discuss"])) {
    return "forum";
  }

  return "article";
}

function isReviewForumOrSupport(
  candidate: VoiceOfCustomerCandidate,
): boolean {
  return candidate.evidenceKind !== "article";
}

function getUniqueDomains(
  candidates: readonly VoiceOfCustomerCandidate[],
): string[] {
  return Array.from(new Set(candidates.map((candidate) => candidate.domain)));
}

function compareRankedCandidates(
  left: RankedCandidate,
  right: RankedCandidate,
): number {
  const evidenceRankDelta =
    evidenceKindRank[left.candidate.evidenceKind] -
    evidenceKindRank[right.candidate.evidenceKind];

  if (evidenceRankDelta !== 0) {
    return evidenceRankDelta;
  }

  const sourceRankDelta =
    sourceRank[left.candidate.source] - sourceRank[right.candidate.source];

  if (sourceRankDelta !== 0) {
    return sourceRankDelta;
  }

  return left.index - right.index;
}

function buildGap({
  candidates,
  domains,
  reason,
}: {
  candidates: readonly VoiceOfCustomerCandidate[];
  domains: readonly string[];
  reason: VoiceOfCustomerGap["reason"];
}): VoiceOfCustomerCandidateResult {
  const messages: Record<VoiceOfCustomerGap["reason"], string> = {
    no_review_or_forum_surfaces:
      "No independent review, forum, or support-thread surfaces were found for buyer pain language.",
    insufficient_independent_domains: `Found ${domains.length} independent domains; need at least ${VOC_CANDIDATE_MIN_DOMAINS}.`,
    insufficient_candidates: `Found ${candidates.length} usable candidates; need at least ${VOC_CANDIDATE_MIN_COUNT}.`,
  };

  return {
    ok: false,
    gap: {
      reason,
      message: messages[reason],
      domains: [...domains],
      candidateCount: candidates.length,
    },
  };
}

function truncateSnippet(snippet: string): string {
  const maxLength = 360;

  if (snippet.length <= maxLength) {
    return snippet;
  }

  return `${snippet.slice(0, maxLength - 3)}...`;
}

export function getRegistrableDomain(input: string): string | null {
  const parsedUrl = parseUrlLike(input);
  const hostname =
    parsedUrl === null ? null : normalizeHostname(parsedUrl.hostname);

  if (hostname === null) {
    return null;
  }

  const labels = hostname.split(".");
  const suffix = labels.slice(-2).join(".");

  if (knownTwoLabelPublicSuffixes.has(suffix)) {
    return labels.length >= 3 ? labels.slice(-3).join(".") : null;
  }

  return labels.slice(-2).join(".");
}

export function createVoiceOfCustomerCandidate(
  input: CreateVoiceOfCustomerCandidateInput,
): VoiceOfCustomerCandidate | null {
  const snippet = input.snippet.trim();
  const normalizedUrl = normalizeCandidateUrl(input.url);
  const domain =
    normalizedUrl === null ? null : getRegistrableDomain(normalizedUrl);
  const auditedDomain = getRegistrableDomain(input.auditedCompanyDomain);

  if (snippet.length === 0 || normalizedUrl === null || domain === null) {
    return null;
  }

  if (input.acquisitionMode === undefined) {
    return null;
  }

  if (auditedDomain !== null && domain === auditedDomain) {
    return null;
  }

  const title = input.title?.trim() ?? domain;
  const evidenceKind =
    input.evidenceKind ??
    inferVoiceOfCustomerEvidenceKind({
      domain,
      source: input.source,
      snippet,
      title,
      url: normalizedUrl,
    });

  return {
    acquisitionMode: input.acquisitionMode,
    source: input.source,
    evidenceKind,
    title: title.length === 0 ? domain : title,
    url: normalizedUrl,
    domain,
    snippet,
    ...(input.sourceInstanceId === undefined
      ? {}
      : { sourceInstanceId: input.sourceInstanceId }),
  };
}

export function selectVoiceOfCustomerCandidates(
  candidates: readonly VoiceOfCustomerCandidate[],
): VoiceOfCustomerCandidateResult {
  const rankedCandidates = candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort(compareRankedCandidates);
  const seenUrls = new Set<string>();
  const domainCounts = new Map<string, number>();
  const selectedCandidates: VoiceOfCustomerCandidate[] = [];

  for (const { candidate } of rankedCandidates) {
    const dedupeKey = candidate.sourceInstanceId ?? candidate.url;

    if (seenUrls.has(dedupeKey)) {
      continue;
    }

    const domainCount = domainCounts.get(candidate.domain) ?? 0;
    if (domainCount >= VOC_CANDIDATE_PER_DOMAIN_CAP) {
      continue;
    }

    seenUrls.add(dedupeKey);
    domainCounts.set(candidate.domain, domainCount + 1);
    selectedCandidates.push(candidate);

    if (selectedCandidates.length >= VOC_CANDIDATE_PACK_MAX_SIZE) {
      break;
    }
  }

  const domains = getUniqueDomains(selectedCandidates);
  const hasReviewForumOrSupport = selectedCandidates.some(
    isReviewForumOrSupport,
  );

  if (!hasReviewForumOrSupport) {
    return buildGap({
      candidates: selectedCandidates,
      domains,
      reason: "no_review_or_forum_surfaces",
    });
  }

  if (domains.length < VOC_CANDIDATE_MIN_DOMAINS) {
    return buildGap({
      candidates: selectedCandidates,
      domains,
      reason: "insufficient_independent_domains",
    });
  }

  if (selectedCandidates.length < VOC_CANDIDATE_MIN_COUNT) {
    return buildGap({
      candidates: selectedCandidates,
      domains,
      reason: "insufficient_candidates",
    });
  }

  return {
    ok: true,
    pack: {
      candidates: selectedCandidates,
      domains,
    },
  };
}

export function formatVoiceOfCustomerCandidateBlock(
  result: VoiceOfCustomerCandidateResult,
): string {
  if (!result.ok) {
    return [
      "Voice of Customer Candidate Pack: GAP",
      `Reason: ${result.gap.reason}`,
      `Message: ${result.gap.message}`,
      `Observed domains (${result.gap.domains.length}): ${
        result.gap.domains.join(", ") || "none"
      }`,
      `Candidate count: ${result.gap.candidateCount}`,
    ].join("\n");
  }

  return [
    "Voice of Customer Candidate Pack (deterministic prepass)",
    `Independent domains (${result.pack.domains.length}): ${result.pack.domains.join(
      ", ",
    )}`,
    `Candidate count: ${result.pack.candidates.length}`,
    "",
    "Instructions:",
    "- Use this evidence pack for `body.painLanguage.quotes[]`; every quote must trace to one of these candidate URLs or another fetched independent source.",
    "- Use at least 3 independent domains across pain-language quotes.",
    "- Avoid the audited company domain and first-party testimonials as VoC pain evidence.",
    "- Align top-level sources with the candidate URLs used in `body.painLanguage.quotes[]`.",
    "",
    "Candidates:",
    ...result.pack.candidates.map(
      (candidate, index) =>
        `${index + 1}. [${candidate.evidenceKind} via ${
          candidate.source
        }/${candidate.acquisitionMode
        }] ${candidate.title} (${candidate.domain})\n   URL: ${
          candidate.url
        }\n   Snippet: ${truncateSnippet(candidate.snippet)}`,
    ),
  ].join("\n");
}
