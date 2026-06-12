import type { SectionId } from "../events/activity-event";

export interface DecodeEnumFallback {
  sectionId: SectionId;
  pathPattern: string;
  fallback: string;
  reason: string;
}

/*
Closed enum inventory reviewed from src/lib/lab-engine/artifacts/schemas/*.ts.
Fallbacks are declared only where an existing member is semantically neutral:

| Section | Path pattern | Values | Fallback |
| --- | --- | --- | --- |
| positioningBuyerICP | icpExistenceCheck.firmographicCuts[].cutType | industry, employeeBands, revenueBands, geography, techStack | none |
| positioningBuyerICP | personaReality.personas[].role | champion, economic-buyer, decision-maker, influencer, end-user, gatekeeper | none |
| positioningBuyerICP | awarenessMap.levels[].level | unaware, problem-aware, solution-aware, product-aware, most-aware | none |
| positioningBuyerICP | awarenessMap.dominantLevel | unaware, problem-aware, solution-aware, product-aware, most-aware | none |
| positioningBuyerICP | buyingTriggers.triggers[].window | immediate, weeks, quarters | none |
| positioningBuyerICP | clusterVenues.venues[].bucketType | community, newsletter, conference, podcast, slack-group, event | none |
| positioningBuyerICP | evidenceGapReport.reason | insufficient_named_buyer_personas | none |
| positioningMarketCategory | marketSize.signals[].signalType | public-data, funding-flow, hiring-velocity, search-trend, analyst-report | none |
| positioningMarketCategory | marketSize.signals[].trajectory | expanding, stable, contracting, unclear | unclear |
| positioningMarketCategory | marketSize.signals[].methodology | top-down, bottom-up | none |
| positioningMarketCategory | marketSize.bottomUpTam.recipeName | keyword-demand-reachable-revenue | none |
| positioningMarketCategory | marketSize.bottomUpTam.inputs[].inputType | keyword-volume, commercial-intent-share, conversion-rate, acv | none |
| positioningMarketCategory | marketSize.bottomUpTam.inputs[].status | sourced, evidence-gap | evidence-gap |
| positioningMarketCategory | structuralForces.forces[].forceType | regulation, platform-shift, buyer-behavior | none |
| positioningMarketCategory | structuralForces.forces[].impact | high, medium, low | none |
| positioningMarketCategory | structuralForces.forces[].direction | accelerating, decelerating, neutral | neutral |
| positioningMarketCategory | categoryMaturity.signals[].signalType | player-count, buyer-education, feature-parity, price-pressure, platform-bundling | none |
| positioningMarketCategory | categoryMaturity.stage | emerging, growing, consolidating, commoditizing | none |
| positioningCompetitorLandscape | competitorSet.competitors[].competitorType | direct, indirect, status-quo, diy | none |
| positioningCompetitorLandscape | adEvidence.advertiserGroups[].platforms[] | google, meta, linkedin | none |
| positioningCompetitorLandscape | adEvidence.advertiserGroups[].identityConfidence | verified, low | low |
| positioningOfferDiagnostic | offerMarketFit.proofPoints[].reportedBy | company-own, external-source | none |
| positioningOfferDiagnostic | offerMarketFit.proofPoints[].confidence | high, medium, low | low |
| positioningOfferDiagnostic | channelTruth.channels[].hasWorked | yes, partial, no, unknown | unknown |
| positioningOfferDiagnostic | retentionHealth.signals[].signalType | activation, retention, first-value-moment | none |
| positioningOfferDiagnostic | redFlags.items[].severity | high, medium, low | none |
| positioningDemandIntent | keywordDemand.keywords[].intentType | informational, commercial, transactional, navigational | none |
| positioningDemandIntent | questionMining.questions[].surface | paa, reddit, quora, community, forum, support-thread | none |
| positioningDemandIntent | questionMining.questions[].frequency | recurring, occasional | none |
| positioningDemandIntent | intentSignals.items[].signalType | job-posting, rfp, news-trigger, funding, leadership-change | none |
| positioningDemandIntent | demandVenues.venues[].venueType | event, community, newsletter, podcast, slack | none |
| positioningVoiceOfCustomer | painLanguage.quotes[].source | g2, capterra, trustpilot, trustradius, reddit, hackernews, sales-call, support-thread, twitter, other | other |
| positioningVoiceOfCustomer | painLanguage.quotes[].painIntensity | high, medium, low | none |
| positioningVoiceOfCustomer | objections.items[].category | price, feature, trust, switching-cost, timing, stakeholder, other | other |
| positioningVoiceOfCustomer | objections.items[].frequency | recurring, occasional, one-off | none |
| positioningVoiceOfCustomer | decisionCriteria.criteria[].statedBy | buyer, champion, influencer, blocker | none |
| positioningVoiceOfCustomer | successLanguage.quotes[].source | g2, capterra, trustpilot, trustradius, reddit, hackernews, sales-call, support-thread, twitter, other | other |
| positioningVoiceOfCustomer | evidenceGapReport.acquisitionAttempts[].acquisitionMode | review_body, forum_comment, support_thread | none |
| positioningVoiceOfCustomer | evidenceGapReport.acquisitionAttempts[].status | succeeded, failed | none |
| positioningVoiceOfCustomer | evidenceGapReport.acquisitionAttempts[].gapReason | api_error, blocked_js_challenge, empty_markdown, parser_no_match, not_independent, not_product_review | none |
| positioningVoiceOfCustomer | evidenceGapReport.acquisitionLedger[].acquisitionMode | review_body, forum_comment, support_thread | none |
| positioningVoiceOfCustomer | evidenceGapReport.acquisitionLedger[].evidenceKind | review, forum, support-thread, article | none |
| positioningVoiceOfCustomer | evidenceGapReport.acquisitionLedger[].scrapeStatus | succeeded, failed, not_attempted | not_attempted |
| positioningVoiceOfCustomer | evidenceGapReport.acquisitionLedger[].parserStatus | succeeded, failed, not_attempted | not_attempted |
| positioningVoiceOfCustomer | evidenceGapReport.acquisitionLedger[].promotionStatus | promoted, rejected, not_applicable | not_applicable |
| positioningVoiceOfCustomer | evidenceGapReport.acquisitionLedger[].rejectionReason | api_error, blocked_js_challenge, empty_markdown, parser_no_match, not_independent, not_product_review, insufficient_candidates, insufficient_independent_domains, no_review_or_forum_surfaces, not_selected | none |
| positioningVoiceOfCustomer | evidenceGapReport.acquisitionLedger[].toolGapReason | api_error, blocked_js_challenge, empty_markdown, parser_no_match, not_independent, not_product_review | none |
| positioningPaidMediaPlan | *.sourceSection / crossSectionInsight[].sourceSections[] | positioningMarketCategory, positioningBuyerICP, positioningCompetitorLandscape, positioningVoiceOfCustomer, positioningDemandIntent, positioningOfferDiagnostic, gtmBrief, unattributed | unattributed |
| positioningPaidMediaPlan | channelSuggestions[].verdict | FIX, REWORK, REVIEW, KEEP, ADD, KILL, SCALE | REVIEW |
| positioningPaidMediaPlan | feasibilityAudit.verdicts[].verdict | fits, exceeds, unknown | unknown |
*/

export const DECODE_ENUM_FALLBACKS: readonly DecodeEnumFallback[] = [
  {
    sectionId: "positioningMarketCategory",
    pathPattern: "marketSize.signals[].trajectory",
    fallback: "unclear",
    reason: "unclear is the schema's explicit non-assertive trajectory.",
  },
  {
    sectionId: "positioningMarketCategory",
    pathPattern: "marketSize.bottomUpTam.inputs[].status",
    fallback: "evidence-gap",
    reason: "unsourced TAM inputs must remain explicit evidence gaps.",
  },
  {
    sectionId: "positioningMarketCategory",
    pathPattern: "structuralForces.forces[].direction",
    fallback: "neutral",
    reason: "neutral is the non-directional structural-force member.",
  },
  {
    sectionId: "positioningCompetitorLandscape",
    pathPattern: "adEvidence.advertiserGroups[].identityConfidence",
    fallback: "low",
    reason: "low is the conservative advertiser-resolution confidence.",
  },
  {
    sectionId: "positioningOfferDiagnostic",
    pathPattern: "offerMarketFit.proofPoints[].confidence",
    fallback: "low",
    reason: "low is the conservative confidence member.",
  },
  {
    sectionId: "positioningOfferDiagnostic",
    pathPattern: "channelTruth.channels[].hasWorked",
    fallback: "unknown",
    reason: "unknown is the schema's explicit non-claiming channel outcome.",
  },
  {
    sectionId: "positioningVoiceOfCustomer",
    pathPattern: "painLanguage.quotes[].source",
    fallback: "other",
    reason: "other preserves the quote without inventing a platform.",
  },
  {
    sectionId: "positioningVoiceOfCustomer",
    pathPattern: "objections.items[].category",
    fallback: "other",
    reason: "other is the schema's explicit miscellaneous objection bucket.",
  },
  {
    sectionId: "positioningVoiceOfCustomer",
    pathPattern: "successLanguage.quotes[].source",
    fallback: "other",
    reason: "other preserves the quote without inventing a platform.",
  },
  {
    sectionId: "positioningVoiceOfCustomer",
    pathPattern: "evidenceGapReport.acquisitionLedger[].scrapeStatus",
    fallback: "not_attempted",
    reason: "not_attempted avoids claiming a scrape succeeded or failed.",
  },
  {
    sectionId: "positioningVoiceOfCustomer",
    pathPattern: "evidenceGapReport.acquisitionLedger[].parserStatus",
    fallback: "not_attempted",
    reason: "not_attempted avoids claiming a parse succeeded or failed.",
  },
  {
    sectionId: "positioningVoiceOfCustomer",
    pathPattern: "evidenceGapReport.acquisitionLedger[].promotionStatus",
    fallback: "not_applicable",
    reason: "not_applicable avoids claiming promotion or rejection.",
  },
  {
    sectionId: "positioningPaidMediaPlan",
    pathPattern: "audienceTypes[].sourceSection",
    fallback: "unattributed",
    reason: "unattributed is the explicit non-fabricating provenance member.",
  },
  {
    sectionId: "positioningPaidMediaPlan",
    pathPattern: "anglesToTest[].sourceSection",
    fallback: "unattributed",
    reason: "unattributed is the explicit non-fabricating provenance member.",
  },
  {
    sectionId: "positioningPaidMediaPlan",
    pathPattern: "creativeFramework[].sourceSection",
    fallback: "unattributed",
    reason: "unattributed is the explicit non-fabricating provenance member.",
  },
  {
    sectionId: "positioningPaidMediaPlan",
    pathPattern: "competitorMarketingInsights[].sourceSection",
    fallback: "unattributed",
    reason: "unattributed is the explicit non-fabricating provenance member.",
  },
  {
    sectionId: "positioningPaidMediaPlan",
    pathPattern: "competitorReviewInsights[].sourceSection",
    fallback: "unattributed",
    reason: "unattributed is the explicit non-fabricating provenance member.",
  },
  {
    sectionId: "positioningPaidMediaPlan",
    pathPattern: "channelSuggestions[].sourceSection",
    fallback: "unattributed",
    reason: "unattributed is the explicit non-fabricating provenance member.",
  },
  {
    sectionId: "positioningPaidMediaPlan",
    pathPattern: "projectedResults[].sourceSection",
    fallback: "unattributed",
    reason: "unattributed is the explicit non-fabricating provenance member.",
  },
  {
    sectionId: "positioningPaidMediaPlan",
    pathPattern: "crossSectionInsight[].sourceSections[]",
    fallback: "unattributed",
    reason: "unattributed is the explicit non-fabricating provenance member.",
  },
  {
    sectionId: "positioningPaidMediaPlan",
    pathPattern: "channelSuggestions[].verdict",
    fallback: "REVIEW",
    reason: "REVIEW preserves the recommendation as needing human review.",
  },
  {
    sectionId: "positioningPaidMediaPlan",
    pathPattern: "feasibilityAudit.verdicts[].verdict",
    fallback: "unknown",
    reason: "unknown is the schema's explicit non-assertive feasibility verdict.",
  },
];

export function findDecodeEnumFallback({
  allowedValues,
  pathPattern,
  sectionId,
}: {
  allowedValues: readonly string[];
  pathPattern: string;
  sectionId: string;
}): DecodeEnumFallback | undefined {
  const fallback = DECODE_ENUM_FALLBACKS.find(
    (entry) =>
      entry.sectionId === sectionId && entry.pathPattern === pathPattern,
  );

  if (fallback === undefined) {
    return undefined;
  }

  return allowedValues.includes(fallback.fallback) ? fallback : undefined;
}

export function getDecodeFallbackLeafStrings(): readonly string[] {
  return DECODE_ENUM_FALLBACKS.map((entry) => entry.fallback);
}
