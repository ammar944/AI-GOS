import type {
  VoiceOfCustomerAcquisitionMode,
  VoiceOfCustomerCandidate,
  VoiceOfCustomerCandidateResult,
  VoiceOfCustomerCandidateSource,
  VoiceOfCustomerEvidenceKind,
} from "./voice-of-customer-candidates";

export type VoiceOfCustomerAcquisitionGapReason =
  | "api_error"
  | "blocked_js_challenge"
  | "empty_markdown"
  | "parser_no_match"
  | "not_independent"
  | "not_product_review";

export type VoiceOfCustomerLedgerRejectionReason =
  | VoiceOfCustomerAcquisitionGapReason
  | "insufficient_candidates"
  | "insufficient_independent_domains"
  | "no_review_or_forum_surfaces"
  | "not_selected";

export type VoiceOfCustomerLedgerStatus =
  | "failed"
  | "not_attempted"
  | "succeeded";

export type VoiceOfCustomerLedgerPromotionStatus =
  | "not_applicable"
  | "promoted"
  | "rejected";

export interface VoiceOfCustomerAcquisitionAttempt {
  acquisitionMode: VoiceOfCustomerAcquisitionMode;
  domain: string;
  gapReason?: VoiceOfCustomerAcquisitionGapReason;
  message?: string;
  source: string;
  status: "succeeded" | "failed";
  title?: string;
  url: string;
}

export interface VoiceOfCustomerAcquisitionAttemptWithQuery {
  attempt: VoiceOfCustomerAcquisitionAttempt;
  query: string;
}

export interface VoiceOfCustomerAcquisitionLedgerRow {
  sourceUrl: string;
  domain: string;
  query: string;
  source: string;
  acquisitionMode: VoiceOfCustomerAcquisitionMode;
  evidenceKind: VoiceOfCustomerEvidenceKind;
  scrapeStatus: VoiceOfCustomerLedgerStatus;
  parserStatus: VoiceOfCustomerLedgerStatus;
  promotionStatus: VoiceOfCustomerLedgerPromotionStatus;
  observedAt: string;
  candidateText?: string;
  rejectionReason?: VoiceOfCustomerLedgerRejectionReason;
  toolGapReason?: VoiceOfCustomerAcquisitionGapReason;
}

export interface VoiceOfCustomerAcquisitionLedgerInput {
  attempts: readonly VoiceOfCustomerAcquisitionAttemptWithQuery[];
  candidates: readonly VoiceOfCustomerCandidate[];
  observedAt: string;
  promotedCandidates?: readonly VoiceOfCustomerCandidate[];
  result: VoiceOfCustomerCandidateResult;
  sourceQueries: Partial<Record<VoiceOfCustomerCandidateSource, string>>;
}

const fallbackSourceQueries: Readonly<Record<VoiceOfCustomerCandidateSource, string>> =
  {
    firecrawl: "firecrawl quote recovery",
    researchInput: "researchInput.sectionExcerpts.positioningVoiceOfCustomer",
    reviews: "review body acquisition",
    web_search: "Voice of Customer web search",
    perplexity_research: "perplexity secondary-class verbatim acquisition",
  };

function evidenceKindForAcquisitionMode(
  acquisitionMode: VoiceOfCustomerAcquisitionMode,
): VoiceOfCustomerEvidenceKind {
  if (acquisitionMode === "review_body") {
    return "review";
  }

  if (acquisitionMode === "forum_comment") {
    return "forum";
  }

  return "support-thread";
}

function normalizeLedgerUrl(input: string): string {
  try {
    const url = new URL(input);
    url.hostname = url.hostname.replace(/^www\./, "");
    return url.toString();
  } catch {
    return input;
  }
}

function getAttemptScrapeStatus(
  attempt: VoiceOfCustomerAcquisitionAttempt,
): VoiceOfCustomerLedgerStatus {
  if (attempt.status === "succeeded" || attempt.gapReason === "parser_no_match") {
    return "succeeded";
  }

  return "failed";
}

function getAttemptParserStatus(
  attempt: VoiceOfCustomerAcquisitionAttempt,
): VoiceOfCustomerLedgerStatus {
  if (attempt.status === "succeeded") {
    return "succeeded";
  }

  return attempt.gapReason === "parser_no_match" ? "failed" : "not_attempted";
}

function getCandidateFetchStatus(
  candidate: VoiceOfCustomerCandidate,
): VoiceOfCustomerLedgerStatus {
  return candidate.source === "reviews" || candidate.source === "firecrawl"
    ? "succeeded"
    : "not_attempted";
}

function getCandidateKey(candidate: VoiceOfCustomerCandidate): string {
  return candidate.sourceInstanceId ?? normalizeLedgerUrl(candidate.url);
}

function truncateCandidateText(snippet: string): string {
  const normalized = snippet.replace(/\s+/g, " ").trim();
  const maxLength = 360;

  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 3)}...`;
}

function getCandidatePromotionStatus({
  isPromoted,
}: {
  isPromoted: boolean;
}): VoiceOfCustomerLedgerPromotionStatus {
  return isPromoted ? "promoted" : "rejected";
}

function getCandidateRejectionReason({
  isSelectedCandidateKey,
  result,
  promotionStatus,
}: {
  isSelectedCandidateKey: boolean;
  result: VoiceOfCustomerCandidateResult;
  promotionStatus: VoiceOfCustomerLedgerPromotionStatus;
}): VoiceOfCustomerLedgerRejectionReason | undefined {
  if (promotionStatus === "promoted") {
    return undefined;
  }

  if (isSelectedCandidateKey) {
    return "not_selected";
  }

  if (!result.ok) {
    return result.gap.reason;
  }

  return "not_selected";
}

function buildPromotedCandidateKeyCounts(
  candidates: readonly VoiceOfCustomerCandidate[],
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const candidate of candidates) {
    const key = getCandidateKey(candidate);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function consumePromotedCandidateKey({
  candidate,
  promotedCandidateKeyCounts,
}: {
  candidate: VoiceOfCustomerCandidate;
  promotedCandidateKeyCounts: Map<string, number>;
}): boolean {
  const key = getCandidateKey(candidate);
  const count = promotedCandidateKeyCounts.get(key) ?? 0;

  if (count === 0) {
    return false;
  }

  if (count === 1) {
    promotedCandidateKeyCounts.delete(key);
  } else {
    promotedCandidateKeyCounts.set(key, count - 1);
  }

  return true;
}

function buildAttemptQueryByUrl(
  attempts: readonly VoiceOfCustomerAcquisitionAttemptWithQuery[],
): Map<string, string> {
  const queryByUrl = new Map<string, string>();

  for (const { attempt, query } of attempts) {
    queryByUrl.set(normalizeLedgerUrl(attempt.url), query);
  }

  return queryByUrl;
}

function getCandidateQuery({
  candidate,
  queryByUrl,
  sourceQueries,
}: {
  candidate: VoiceOfCustomerCandidate;
  queryByUrl: ReadonlyMap<string, string>;
  sourceQueries: Partial<Record<VoiceOfCustomerCandidateSource, string>>;
}): string {
  return (
    queryByUrl.get(normalizeLedgerUrl(candidate.url)) ??
    sourceQueries[candidate.source] ??
    fallbackSourceQueries[candidate.source]
  );
}

function buildAttemptLedgerRow({
  attempt,
  observedAt,
  query,
}: {
  attempt: VoiceOfCustomerAcquisitionAttempt;
  observedAt: string;
  query: string;
}): VoiceOfCustomerAcquisitionLedgerRow {
  return {
    sourceUrl: attempt.url,
    domain: attempt.domain,
    query,
    source: attempt.source,
    acquisitionMode: attempt.acquisitionMode,
    evidenceKind: evidenceKindForAcquisitionMode(attempt.acquisitionMode),
    scrapeStatus: getAttemptScrapeStatus(attempt),
    parserStatus: getAttemptParserStatus(attempt),
    promotionStatus: "not_applicable",
    observedAt,
    ...(attempt.gapReason === undefined
      ? {}
      : {
          rejectionReason: attempt.gapReason,
          toolGapReason: attempt.gapReason,
        }),
  };
}

function buildCandidateLedgerRow({
  candidate,
  observedAt,
  query,
  result,
  isSelectedCandidateKey,
  isPromoted,
}: {
  candidate: VoiceOfCustomerCandidate;
  observedAt: string;
  query: string;
  result: VoiceOfCustomerCandidateResult;
  isSelectedCandidateKey: boolean;
  isPromoted: boolean;
}): VoiceOfCustomerAcquisitionLedgerRow {
  const promotionStatus = getCandidatePromotionStatus({
    isPromoted,
  });
  const rejectionReason = getCandidateRejectionReason({
    isSelectedCandidateKey,
    promotionStatus,
    result,
  });
  const fetchStatus = getCandidateFetchStatus(candidate);

  return {
    sourceUrl: candidate.url,
    domain: candidate.domain,
    query,
    source: candidate.source,
    acquisitionMode: candidate.acquisitionMode,
    evidenceKind: candidate.evidenceKind,
    scrapeStatus: fetchStatus,
    parserStatus: fetchStatus,
    candidateText: truncateCandidateText(candidate.snippet),
    promotionStatus,
    ...(rejectionReason === undefined ? {} : { rejectionReason }),
    observedAt,
  };
}

export function buildVoiceOfCustomerAcquisitionLedger({
  attempts,
  candidates,
  observedAt,
  promotedCandidates,
  result,
  sourceQueries,
}: VoiceOfCustomerAcquisitionLedgerInput): VoiceOfCustomerAcquisitionLedgerRow[] {
  const promotedCandidateKeyCounts = buildPromotedCandidateKeyCounts(
    promotedCandidates ?? (result.ok ? result.pack.candidates : []),
  );
  const selectedCandidateKeys = new Set(promotedCandidateKeyCounts.keys());
  const queryByUrl = buildAttemptQueryByUrl(attempts);
  const candidateRows = candidates.map((candidate) =>
    buildCandidateLedgerRow({
      candidate,
      observedAt,
      query: getCandidateQuery({ candidate, queryByUrl, sourceQueries }),
      result,
      isSelectedCandidateKey: selectedCandidateKeys.has(getCandidateKey(candidate)),
      isPromoted: consumePromotedCandidateKey({
        candidate,
        promotedCandidateKeyCounts,
      }),
    }),
  );
  const attemptRows = attempts.map(({ attempt, query }) =>
    buildAttemptLedgerRow({ attempt, observedAt, query }),
  );

  return [...attemptRows, ...candidateRows];
}
