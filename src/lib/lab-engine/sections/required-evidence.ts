import type { SectionId } from "../events/activity-event";

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

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
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

function hasIcpPersona(body: Record<string, unknown>): boolean {
  const personaReality = asRecord(body.personaReality);
  return hasRecordWithText(personaReality.personas, "name");
}

function hasIcpQuoteOrGap(body: Record<string, unknown>): boolean {
  const personaReality = asRecord(body.personaReality);
  const buyingContext = asRecord(body.buyingContext);
  return (
    hasRecordWithText(personaReality.personas, "evidence") ||
    hasRecordWithText(buyingContext.triggers, "evidence") ||
    hasNestedGap(body)
  );
}

function hasCompetitor(body: Record<string, unknown>): boolean {
  const competitorSet = asRecord(body.competitorSet);
  return hasRecordWithText(competitorSet.competitors, "name");
}

// The "linkedin not probed this run" sentinel is structural (linkedin is always
// 0 when the agent didn't call linkedin_ads). It documents a non-attempt, not a
// genuine probe failure, so in strict mode it must NOT rubber-stamp the gate.
function isNotProbedSentinel(reason: unknown): boolean {
  return typeof reason === "string" && /not probed this run/i.test(reason);
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

function hasAdEvidenceOrGap(body: Record<string, unknown>): boolean {
  const adEvidence = asRecord(body.adEvidence);
  const advertiserGroups = asRecordArray(adEvidence.advertiserGroups);
  const strict = process.env.LAB_AD_EVIDENCE_STRICT === "true";

  return advertiserGroups.some((group) => {
    const displayableTotal =
      typeof group.displayableTotal === "number" ? group.displayableTotal : 0;

    // STRICT: only real evidence (displayableTotal > 0) or a genuine probe-attempt
    // failure/empty passes. rawSourceSamples and the linkedin not-probed sentinel
    // do NOT count — they let an all-empty run rubber-stamp the gate.
    if (strict) {
      return displayableTotal > 0 || hasGenuineProbeGap(group);
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

function hasVocQuoteOrGap(body: Record<string, unknown>): boolean {
  const painLanguage = asRecord(body.painLanguage);
  const successLanguage = asRecord(body.successLanguage);
  const decisionCriteria = asRecord(body.decisionCriteria);

  return (
    hasRecordWithText(painLanguage.quotes, "verbatimText") ||
    hasRecordWithText(successLanguage.quotes, "verbatimText") ||
    hasRecordWithText(decisionCriteria.criteria, "evidenceQuote") ||
    hasNestedGap(body)
  );
}

function hasDemandSignalOrGap(body: Record<string, unknown>): boolean {
  const keywordDemand = asRecord(body.keywordDemand);
  const intentSignals = asRecord(body.intentSignals);
  const questionMining = asRecord(body.questionMining);

  return (
    hasRecordWithText(keywordDemand.keywords, "keyword") ||
    hasRecordWithText(intentSignals.items, "description") ||
    hasRecordWithText(questionMining.questions, "question") ||
    hasNestedGap(body)
  );
}

function hasOfferAxis(body: Record<string, unknown>): boolean {
  const offerMarketFit = asRecord(body.offerMarketFit);
  const funnelDiagnosis = asRecord(body.funnelDiagnosis);
  const channelTruth = asRecord(body.channelTruth);

  return (
    hasRecordWithText(offerMarketFit.proofPoints, "metric") ||
    hasRecordWithText(funnelDiagnosis.breaks, "stageName") ||
    hasRecordWithText(channelTruth.channels, "channelName")
  );
}

function hasRequiredClass(
  body: Record<string, unknown>,
  requiredClass: RequiredEvidenceClass,
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
      return hasAdEvidenceOrGap(body);
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
  requiredEvidenceClasses,
}: {
  body: unknown;
  requiredEvidenceClasses: readonly RequiredEvidenceClass[];
  sectionId: SectionId;
}): RequiredEvidenceClass | null {
  const bodyRecord = asRecord(body);

  for (const requiredClass of requiredEvidenceClasses) {
    if (!hasRequiredClass(bodyRecord, requiredClass)) {
      return requiredClass;
    }
  }

  return null;
}
