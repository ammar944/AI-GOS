import type { SectionId } from "../events/activity-event";
import { isHttpUrl } from "../artifacts/schemas/buyer-icp";
import { isValidGroundedBuyerUnit } from "../agents/verification/grounded-buyer-unit";
import { isNotProbedSentinel } from "./sentinels";

export type RequiredEvidenceClass =
  | "marketCategory_name"
  | "icp_persona"
  | "icp_quote_or_gap"
  | "competitor"
  | "adEvidence_or_gap"
  | "voc_quote_or_gap"
  | "demand_signal_or_gap"
  | "offer_axis";

export class RequiredEvidenceMissingError extends Error {
  public readonly missingClass: RequiredEvidenceClass;
  public readonly sectionId: SectionId;
  public readonly unsupportedCount: number;
  public readonly verifiedCount: number;

  public constructor({
    missingClass,
    sectionId,
    unsupportedCount,
    verifiedCount,
  }: {
    missingClass: RequiredEvidenceClass;
    sectionId: SectionId;
    unsupportedCount: number;
    verifiedCount: number;
  }) {
    super(
      `required_evidence_missing: section ${sectionId} is missing ${missingClass} (verified=${verifiedCount}, unsupported=${unsupportedCount})`,
    );
    this.name = "RequiredEvidenceMissingError";
    this.missingClass = missingClass;
    this.sectionId = sectionId;
    this.unsupportedCount = unsupportedCount;
    this.verifiedCount = verifiedCount;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasHttpUrl(value: unknown): value is string {
  return typeof value === "string" && isHttpUrl(value);
}

function hasHttpSourceUrl(record: Record<string, unknown>): boolean {
  return hasHttpUrl(record.sourceUrl);
}

function hasRecordWithTextAndHttpSourceUrl(
  value: unknown,
  key: string,
): boolean {
  return asRecordArray(value).some(
    (record) => hasText(record[key]) && hasHttpSourceUrl(record),
  );
}

function isDomainLike(value: string): boolean {
  const candidate = value.trim();

  if (candidate.length === 0 || /\s/.test(candidate)) {
    return false;
  }

  const urlValue = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;

  if (!URL.canParse(urlValue)) {
    return false;
  }

  const hostname = new URL(urlValue).hostname.toLowerCase();
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(hostname);
}

function hasDomainOrHttpUrl(value: unknown): boolean {
  return typeof value === "string" && (isHttpUrl(value) || isDomainLike(value));
}

function hasAccountedShortfall({
  foundCount,
  requiredCount,
}: {
  foundCount: unknown;
  requiredCount: unknown;
}): boolean {
  if (
    typeof foundCount !== "number" ||
    typeof requiredCount !== "number" ||
    !Number.isInteger(foundCount) ||
    !Number.isInteger(requiredCount)
  ) {
    return false;
  }

  return (
    foundCount >= 0 &&
    requiredCount > 0 &&
    foundCount < requiredCount
  );
}

function hasAccountedBlockGap(value: unknown): boolean {
  const blockGap = asRecord(value);

  return (
    hasText(blockGap.summary) &&
    hasAccountedShortfall({
      foundCount: blockGap.foundCount,
      requiredCount: blockGap.requiredCount,
    })
  );
}

function hasSubstantiveIcpEvidence(value: unknown): boolean {
  if (!hasText(value)) {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();
  return !(
    normalizedValue === "evidence gap" ||
    normalizedValue.startsWith("evidence gap:") ||
    normalizedValue === "gap" ||
    normalizedValue === "unknown"
  );
}

function hasRecordWithText(
  value: unknown,
  key: string,
): boolean {
  return asRecordArray(value).some((record) => hasText(record[key]));
}

function hasNestedGap(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => hasNestedGap(item));
  }

  if (!isRecord(value)) {
    return false;
  }

  for (const [key, childValue] of Object.entries(value)) {
    if (
      (key === "dataGaps" || key === "capabilityGaps" || key === "sourceErrors") &&
      Array.isArray(childValue) &&
      childValue.length > 0
    ) {
      return true;
    }

    if (hasNestedGap(childValue)) {
      return true;
    }
  }

  return false;
}

function hasMarketCategoryName(body: Record<string, unknown>): boolean {
  const categoryDefinition = asRecord(body.categoryDefinition);
  return (
    hasText(categoryDefinition.prose) ||
    hasRecordWithText(categoryDefinition.adjacentCategories, "name")
  );
}

function hasBuyerICPNamedPersonaEvidenceGap(
  body: Record<string, unknown>,
): boolean {
  const evidenceGapReport = asRecord(body.evidenceGapReport);
  return (
    body.evidenceGap === true &&
    evidenceGapReport.reason === "insufficient_named_buyer_personas" &&
    hasAccountedShortfall({
      foundCount: evidenceGapReport.foundNamedPersonaCount,
      requiredCount: evidenceGapReport.requiredNamedPersonaCount,
    })
  );
}

function hasIcpPersona(body: Record<string, unknown>): boolean {
  if (hasBuyerICPNamedPersonaEvidenceGap(body)) {
    return true;
  }

  const personaReality = asRecord(body.personaReality);
  // Option B: a valid grounded buyer unit (live-sourced role/segment OR named
  // human), not strictly a named human.
  return asRecordArray(personaReality.personas).some((persona) =>
    isValidGroundedBuyerUnit(persona),
  );
}

function hasIcpQuoteOrGap(body: Record<string, unknown>): boolean {
  const personaReality = asRecord(body.personaReality);
  const buyingContext = asRecord(body.buyingContext);
  return (
    asRecordArray(personaReality.personas).some((persona) => {
      const evidence = persona.evidence;

      // Option B: substantive evidence on a valid grounded buyer unit
      // (live-sourced role/segment OR named human).
      return (
        hasSubstantiveIcpEvidence(evidence) &&
        isValidGroundedBuyerUnit(persona)
      );
    }) ||
    asRecordArray(buyingContext.triggers).some((trigger) => {
      const evidence = trigger.evidence;
      const sourceUrl = trigger.sourceUrl;

      return (
        hasSubstantiveIcpEvidence(evidence) &&
        typeof sourceUrl === "string" &&
        isHttpUrl(sourceUrl)
      );
    }) ||
    hasNestedGap(body)
  );
}

function hasCompetitor(body: Record<string, unknown>): boolean {
  const competitorSet = asRecord(body.competitorSet);
  return (
    asRecordArray(competitorSet.competitors).some(
      (competitor) =>
        hasText(competitor.name) &&
        (hasDomainOrHttpUrl(competitor.url) ||
          hasDomainOrHttpUrl(competitor.sourceUrl) ||
          hasDomainOrHttpUrl(competitor.domain)),
    ) ||
    hasAccountedBlockGap(competitorSet.blockGap)
  );
}

// A genuine probe-attempt gap is a real provider failure (any sourceError) or a
// dataGap that is not the not-probed sentinel (e.g. "returned no raw rows",
// "no displayable creative", "lookup failed", a truncation note).
function hasGenuineProbeGap(group: Record<string, unknown>): boolean {
  const sourceErrors = Array.isArray(group.sourceErrors)
    ? group.sourceErrors
    : [];
  if (sourceErrors.length > 0) {
    return true;
  }

  const dataGaps = Array.isArray(group.dataGaps) ? group.dataGaps : [];
  return dataGaps.some((gap) => {
    if (!isRecord(gap)) {
      return false;
    }
    return hasText(gap.reason) && !isNotProbedSentinel(gap.reason);
  });
}

function hasVerifiedAdEvidence(group: Record<string, unknown>): boolean {
  const verifiedCount =
    typeof group.verifiedCount === "number" ? group.verifiedCount : 0;

  if (verifiedCount > 0) {
    return true;
  }

  return asRecordArray(group.creatives).some(
    (creative) => creative.verified === true,
  );
}

function hasAdEvidenceOrGap(
  body: Record<string, unknown>,
  env: Record<string, string | undefined>,
): boolean {
  const adEvidence = asRecord(body.adEvidence);
  const advertiserGroups = asRecordArray(adEvidence.advertiserGroups);
  const strict = env.LAB_AD_EVIDENCE_STRICT === "true";

  return advertiserGroups.some((group) => {
    const displayableTotal =
      typeof group.displayableTotal === "number" ? group.displayableTotal : 0;

    // STRICT: only identity-verified ad evidence or a genuine probe-attempt
    // failure/empty passes. rawSourceSamples, displayableTotal, quarantine
    // samples, and the linkedin not-probed sentinel do NOT count as evidence.
    if (strict) {
      return hasVerifiedAdEvidence(group) || hasGenuineProbeGap(group);
    }

    const returnedCreativeCount =
      typeof group.returnedCreativeCount === "number"
        ? group.returnedCreativeCount
        : 0;
    const creatives = Array.isArray(group.creatives) ? group.creatives : [];
    const rawSourceSamples = Array.isArray(group.rawSourceSamples)
      ? group.rawSourceSamples
      : [];

    return (
      displayableTotal > 0 ||
      returnedCreativeCount > 0 ||
      creatives.length > 0 ||
      rawSourceSamples.length > 0 ||
      hasNestedGap(group)
    );
  });
}

// A per-block VoC gap (body.<block>.blockGap, W1b) is an honest evidence
// signal in its own right — same standing as the section-level evidenceGap.
function hasVocBlockGap(body: Record<string, unknown>): boolean {
  return [
    body.painLanguage,
    body.successLanguage,
    body.objections,
    body.switchingStories,
    body.decisionCriteria,
  ].some((block) => {
    return hasAccountedBlockGap(asRecord(block).blockGap);
  });
}

function addUniqueSourceBackedQuote({
  record,
  seen,
  textKey,
}: {
  record: Record<string, unknown>;
  seen: Set<string>;
  textKey: string;
}): void {
  const quoteText = record[textKey];
  const sourceUrl = record.sourceUrl;

  if (!hasText(quoteText) || !hasHttpUrl(sourceUrl)) {
    return;
  }

  seen.add(
    `${quoteText.trim().toLowerCase()}\n${sourceUrl.trim().toLowerCase()}`,
  );
}

function countUniqueSourceBackedVocQuotes(
  body: Record<string, unknown>,
): number {
  const seen = new Set<string>();
  const painLanguage = asRecord(body.painLanguage);
  const successLanguage = asRecord(body.successLanguage);
  const decisionCriteria = asRecord(body.decisionCriteria);

  asRecordArray(painLanguage.quotes).forEach((record) => {
    addUniqueSourceBackedQuote({ record, seen, textKey: "verbatimText" });
  });
  asRecordArray(successLanguage.quotes).forEach((record) => {
    addUniqueSourceBackedQuote({ record, seen, textKey: "verbatimText" });
  });
  asRecordArray(decisionCriteria.criteria).forEach((record) => {
    addUniqueSourceBackedQuote({ record, seen, textKey: "evidenceQuote" });
  });

  return seen.size;
}

function hasVocQuoteOrGap(body: Record<string, unknown>): boolean {
  return (
    countUniqueSourceBackedVocQuotes(body) > 0 ||
    hasVocBlockGap(body) ||
    hasNestedGap(body)
  );
}

function hasDemandBlockGap(body: Record<string, unknown>): boolean {
  return [body.questionMining, body.intentSignals].some((block) => {
    return hasAccountedBlockGap(asRecord(block).blockGap);
  });
}

function hasDemandSignalOrGap(body: Record<string, unknown>): boolean {
  const keywordDemand = asRecord(body.keywordDemand);
  const intentSignals = asRecord(body.intentSignals);
  const questionMining = asRecord(body.questionMining);

  return (
    hasRecordWithTextAndHttpSourceUrl(keywordDemand.keywords, "keyword") ||
    hasRecordWithTextAndHttpSourceUrl(intentSignals.items, "description") ||
    hasRecordWithTextAndHttpSourceUrl(questionMining.questions, "question") ||
    hasDemandBlockGap(body) ||
    hasNestedGap(body)
  );
}

function hasOfferBlockGap(body: Record<string, unknown>): boolean {
  return [body.offerMarketFit, body.funnelDiagnosis, body.channelTruth].some(
    (block) => {
      return hasAccountedBlockGap(asRecord(block).blockGap);
    },
  );
}

function hasOfferAxis(body: Record<string, unknown>): boolean {
  const offerMarketFit = asRecord(body.offerMarketFit);
  const funnelDiagnosis = asRecord(body.funnelDiagnosis);
  const channelTruth = asRecord(body.channelTruth);

  return (
    hasRecordWithTextAndHttpSourceUrl(offerMarketFit.proofPoints, "metric") ||
    hasRecordWithTextAndHttpSourceUrl(funnelDiagnosis.breaks, "stageName") ||
    hasRecordWithTextAndHttpSourceUrl(channelTruth.channels, "channelName") ||
    hasOfferBlockGap(body) ||
    hasNestedGap(body)
  );
}

function hasRequiredClass(
  body: Record<string, unknown>,
  requiredClass: RequiredEvidenceClass,
  env: Record<string, string | undefined>,
): boolean {
  switch (requiredClass) {
    case "marketCategory_name":
      return hasMarketCategoryName(body);
    case "icp_persona":
      return hasIcpPersona(body);
    case "icp_quote_or_gap":
      return hasIcpQuoteOrGap(body);
    case "competitor":
      return hasCompetitor(body);
    case "adEvidence_or_gap":
      return hasAdEvidenceOrGap(body, env);
    case "voc_quote_or_gap":
      return hasVocQuoteOrGap(body);
    case "demand_signal_or_gap":
      return hasDemandSignalOrGap(body);
    case "offer_axis":
      return hasOfferAxis(body);
  }
}

export function checkRequiredEvidenceClasses({
  body,
  env = process.env,
  requiredEvidenceClasses,
}: {
  body: unknown;
  env?: Record<string, string | undefined>;
  requiredEvidenceClasses: readonly RequiredEvidenceClass[];
  sectionId: SectionId;
}): RequiredEvidenceClass | null {
  const bodyRecord = asRecord(body);

  for (const requiredClass of requiredEvidenceClasses) {
    if (!hasRequiredClass(bodyRecord, requiredClass, env)) {
      return requiredClass;
    }
  }

  return null;
}
