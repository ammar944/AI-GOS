// Ad Copy Context Builder
// Transforms media plan, blueprint, and onboarding data into a focused ~3KB context
// for the ad copy generation LLM call.

import type { MediaPlanOutput } from "./types";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";
import type { OnboardingFormData } from "@/lib/onboarding/types";

export interface AdCopyContext {
  contextString: string;
  tokenEstimate: number;
}

/**
 * Build a focused context string for ad copy generation.
 * Extracts the most relevant data from the media plan, blueprint, and onboarding data.
 * Target: ~3KB context, ~750-1000 tokens.
 */
export function buildAdCopyContext(
  mediaPlan: MediaPlanOutput,
  blueprint: StrategicBlueprintOutput,
  onboarding: OnboardingFormData
): AdCopyContext {
  const sections: string[] = [];

  // 1. Creative angles from the media plan (primary input)
  sections.push(buildCreativeAnglesSection(mediaPlan));

  // 2. Active platforms from the media plan
  sections.push(buildActivePlatformsSection(mediaPlan));

  // 3. ICP psychographics and pain points
  sections.push(buildICPSection(mediaPlan, blueprint));

  // 4. Offer details from onboarding
  sections.push(buildOfferSection(onboarding));

  // 5. Brand guidelines from media plan creative strategy
  sections.push(buildBrandGuidelinesSection(mediaPlan));

  // 6. Competitor hooks from blueprint (if available)
  sections.push(buildCompetitorHooksSection(blueprint));

  // 7. Compliance constraints
  sections.push(buildComplianceSection(onboarding));

  const contextString = sections.filter(Boolean).join("\n\n");
  const tokenEstimate = Math.ceil(contextString.length / 4);

  return { contextString, tokenEstimate };
}

// =============================================================================
// Section Builders
// =============================================================================

function buildCreativeAnglesSection(mediaPlan: MediaPlanOutput): string {
  const { angles } = mediaPlan.creativeStrategy;
  const lines: string[] = ["## Creative Angles"];

  for (const angle of angles) {
    lines.push(`### ${angle.name}`);
    lines.push(`- Description: ${angle.description}`);
    lines.push(`- Example Hook: ${angle.exampleHook}`);
    lines.push(
      `- Funnel Stages: ${angle.bestForFunnelStages.join(", ")}`
    );
    lines.push(`- Platforms: ${angle.platforms.join(", ")}`);
  }

  return lines.join("\n");
}

function buildActivePlatformsSection(mediaPlan: MediaPlanOutput): string {
  const lines: string[] = ["## Active Platforms"];

  // Sort by priority: primary first, then secondary, then testing
  const sorted = [...mediaPlan.platformStrategy].sort((a, b) => {
    const order = { primary: 0, secondary: 1, testing: 2 };
    return order[a.priority] - order[b.priority];
  });

  for (const platform of sorted) {
    lines.push(
      `- ${platform.platform} (${platform.priority}): ${platform.rationale.slice(0, 120)}`
    );
    lines.push(
      `  Ad Formats: ${platform.adFormats.slice(0, 4).join(", ")}`
    );
  }

  return lines.join("\n");
}

function buildICPSection(
  mediaPlan: MediaPlanOutput,
  blueprint: StrategicBlueprintOutput
): string {
  const lines: string[] = ["## ICP & Pain Points"];

  // Psychographics from media plan targeting
  if (mediaPlan.icpTargeting.psychographics) {
    lines.push(`### Psychographics`);
    lines.push(mediaPlan.icpTargeting.psychographics);
  }

  // Demographics
  if (mediaPlan.icpTargeting.demographics) {
    lines.push(`### Demographics`);
    lines.push(mediaPlan.icpTargeting.demographics);
  }

  // Pain points from blueprint
  const { painPoints } = blueprint.industryMarketOverview;
  const topPains = [
    ...painPoints.primary.slice(0, 3),
    ...painPoints.secondary.slice(0, 2),
  ];
  if (topPains.length > 0) {
    lines.push(`### Top Pain Points`);
    for (const pain of topPains) {
      lines.push(`- ${pain}`);
    }
  }

  // Audience segments with funnel positions
  if (mediaPlan.icpTargeting.segments.length > 0) {
    lines.push(`### Audience Segments`);
    for (const seg of mediaPlan.icpTargeting.segments.slice(0, 4)) {
      lines.push(
        `- ${seg.name} (${seg.funnelPosition}): ${seg.description.slice(0, 100)}`
      );
    }
  }

  return lines.join("\n");
}

function buildOfferSection(onboarding: OnboardingFormData): string {
  const { productOffer, businessBasics, customerJourney } = onboarding;
  const lines: string[] = ["## Offer Details"];

  lines.push(`- Business: ${businessBasics.businessName}`);
  lines.push(`- Product: ${productOffer.productDescription.slice(0, 200)}`);
  lines.push(`- Value Prop: ${productOffer.valueProp}`);
  if (productOffer.pricingTiers && productOffer.pricingTiers.length > 0) {
    for (const t of productOffer.pricingTiers) {
      lines.push(`- Tier: ${t.name} — $${t.price}/${t.billingCycle}${t.isPrimary ? ' [PRIMARY]' : ''}`);
    }
  } else {
    lines.push(`- Price: $${productOffer.offerPrice} (${productOffer.pricingModel.join(", ")})`);
  }
  lines.push(`- Core Deliverables: ${productOffer.coreDeliverables.slice(0, 200)}`);

  if (productOffer.guarantees) {
    lines.push(`- Guarantee: ${productOffer.guarantees}`);
  }

  // Transformation (useful for copy angles)
  if (customerJourney.desiredTransformation) {
    lines.push(
      `- Desired Transformation: ${customerJourney.desiredTransformation.slice(0, 150)}`
    );
  }

  // Situation before (useful for pain agitation)
  if (customerJourney.situationBeforeBuying) {
    lines.push(
      `- Situation Before: ${customerJourney.situationBeforeBuying.slice(0, 150)}`
    );
  }

  return lines.join("\n");
}

function buildBrandGuidelinesSection(mediaPlan: MediaPlanOutput): string {
  const { brandGuidelines } = mediaPlan.creativeStrategy;
  if (!brandGuidelines || brandGuidelines.length === 0) return "";

  const lines: string[] = ["## Brand Guidelines"];

  for (const guideline of brandGuidelines) {
    lines.push(`- [${guideline.category}] ${guideline.guideline}`);
  }

  return lines.join("\n");
}

function buildCompetitorHooksSection(
  blueprint: StrategicBlueprintOutput
): string {
  const lines: string[] = [];

  // Extract competitor ad hooks from synthesis messaging framework
  const hooks = blueprint.crossAnalysisSynthesis.messagingFramework?.adHooks;
  if (hooks && hooks.length > 0) {
    lines.push("## Competitor & Market Hooks");
    for (const hook of hooks.slice(0, 6)) {
      const sourceLabel = hook.source?.type
        ? ` (${hook.source.type}${hook.source.competitors?.length ? ` from ${hook.source.competitors.join(", ")}` : ""})`
        : "";
      lines.push(`- [${hook.technique}] ${hook.hook}${sourceLabel}`);
    }
  }

  // Competitor messaging themes
  const competitors = blueprint.competitorAnalysis.competitors;
  const allThemes: string[] = [];
  for (const comp of competitors.slice(0, 3)) {
    if (comp.adMessagingThemes && comp.adMessagingThemes.length > 0) {
      allThemes.push(
        ...comp.adMessagingThemes
          .slice(0, 2)
          .map((t) => `${comp.name}: ${t}`)
      );
    }
  }
  if (allThemes.length > 0) {
    lines.push("### Competitor Messaging Themes");
    for (const theme of allThemes) {
      lines.push(`- ${theme}`);
    }
  }

  // Market gaps (opportunities for differentiation in copy)
  const whiteSpaceGaps = blueprint.competitorAnalysis.whiteSpaceGaps;
  if (whiteSpaceGaps?.length) {
    lines.push("### Messaging Gaps to Exploit");
    for (const wsg of whiteSpaceGaps.filter(g => g.type === 'messaging').slice(0, 3)) {
      lines.push(`- ${wsg.gap} — ${wsg.recommendedAction}`);
    }
    // Also include high-impact non-messaging gaps
    for (const wsg of whiteSpaceGaps.filter(g => g.type !== 'messaging' && g.impact >= 7).slice(0, 2)) {
      lines.push(`- [${wsg.type}] ${wsg.gap}`);
    }
  } else {
    const gaps = blueprint.competitorAnalysis.gapsAndOpportunities;
    if (gaps?.messagingOpportunities?.length) {
      lines.push("### Messaging Gaps to Exploit");
      for (const opp of gaps.messagingOpportunities.slice(0, 3)) {
        lines.push(`- ${opp}`);
      }
    }
  }

  return lines.length > 0 ? lines.join("\n") : "";
}

function buildComplianceSection(onboarding: OnboardingFormData): string {
  const { compliance } = onboarding;
  if (!compliance.topicsToAvoid && !compliance.claimRestrictions) return "";

  const lines: string[] = ["## Compliance Constraints"];

  if (compliance.topicsToAvoid) {
    lines.push(`- Topics to Avoid: ${compliance.topicsToAvoid}`);
  }
  if (compliance.claimRestrictions) {
    lines.push(`- Claim Restrictions: ${compliance.claimRestrictions}`);
  }

  return lines.join("\n");
}
