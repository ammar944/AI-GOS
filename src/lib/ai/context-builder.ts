// Context Builder for Strategic Blueprint Generation
// Converts OnboardingFormData to structured context string

import type { OnboardingFormData } from '@/lib/onboarding/types';

// =============================================================================
// Input Sanitization (Prevent Prompt Injection)
// =============================================================================

const MAX_INPUT_LENGTH = 5000;

function sanitizeInput(input: string | undefined | null): string {
  if (!input) return '';
  let sanitized = String(input);
  sanitized = sanitized.slice(0, MAX_INPUT_LENGTH);

  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|context)/gi,
    /disregard\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|context)/gi,
    /forget\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|context)/gi,
    /system\s*:\s*/gi,
    /assistant\s*:\s*/gi,
    /user\s*:\s*/gi,
    /\[\s*INST\s*\]/gi,
    /\[\s*\/INST\s*\]/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
    /```\s*(json|javascript|python|bash|sh|cmd)/gi,
  ];

  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, '[FILTERED]');
  }

  sanitized = sanitized.replace(/```/g, "'''");
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized.trim();
}

function sanitizeNumber(input: number | undefined | null, defaultValue: number = 0): number {
  if (input === undefined || input === null || isNaN(input)) {
    return defaultValue;
  }
  return Math.max(0, Number(input));
}

// =============================================================================
// Business Context Builder
// =============================================================================

export interface ContextBuilderOptions {
  fullTierNames?: string[];
  summaryTierNames?: string[];
}

export function createBusinessContext(
  data: OnboardingFormData,
  options?: ContextBuilderOptions,
): string {
  const {
    businessBasics,
    icp,
    productOffer,
    marketCompetition,
    customerJourney,
    brandPositioning,
    budgetTargets,
    compliance,
  } = data;

  const s = sanitizeInput;
  const n = sanitizeNumber;

  return `
## BUSINESS CONTEXT FOR STRATEGIC BLUEPRINT

### Company Information
- Business Name: ${s(businessBasics.businessName)}
- Website: ${s(businessBasics.websiteUrl)}

### Ideal Customer Profile (ICP)
- Primary ICP: ${s(icp.primaryIcpDescription)}
- Industry: ${s(icp.industryVertical)}
- Target Job Titles: ${s(icp.jobTitles)}
- Company Size: ${Array.isArray(icp.companySize) ? icp.companySize.join(', ') : icp.companySize || 'Not specified'}
- Geography: ${s(icp.geography)}
- Easiest to Close: ${s(icp.easiestToClose)}
- Buying Triggers: ${s(icp.buyingTriggers)}
- Best Client Sources: ${icp.bestClientSources?.map(s).join(', ') || 'Not specified'}
${icp.secondaryIcp ? `- Secondary ICP: ${s(icp.secondaryIcp)}` : ''}
${icp.systemsPlatforms ? `- Systems & Platforms Used: ${s(icp.systemsPlatforms)}` : ''}

### Product & Offer
- Product Description: ${s(productOffer.productDescription)}
- Core Deliverables: ${s(productOffer.coreDeliverables)}
${productOffer.pricingTiers && productOffer.pricingTiers.length > 0
    ? `- Pricing Tiers:\n${productOffer.pricingTiers.map(t => `  * ${s(t.name)}: $${n(t.price)}/${t.billingCycle}${t.isPrimary ? ' [PRIMARY]' : ''}`).join('\n')}
- Primary Offer Price: $${n(productOffer.offerPrice)} (used for CAC/LTV calculations)`
    : `- Offer Price: $${n(productOffer.offerPrice)}
- Pricing Model: ${Array.isArray(productOffer.pricingModel) ? productOffer.pricingModel.join(', ') : productOffer.pricingModel || 'Not specified'}`}
- Value Proposition: ${s(productOffer.valueProp)}
- Current Funnel Type: ${Array.isArray(productOffer.currentFunnelType) ? productOffer.currentFunnelType.join(', ') : productOffer.currentFunnelType || 'Not specified'}
${productOffer.guarantees ? `- Guarantees: ${s(productOffer.guarantees)}` : ''}

### Market & Competition
- Top Competitors: ${s(marketCompetition.topCompetitors)}
- Unique Edge: ${s(marketCompetition.uniqueEdge)}
- Market Bottlenecks: ${s(marketCompetition.marketBottlenecks)}
${marketCompetition.competitorFrustrations ? `- Competitor Frustrations: ${s(marketCompetition.competitorFrustrations)}` : ''}
${marketCompetition.proprietaryTech ? `- Proprietary Tech: ${s(marketCompetition.proprietaryTech)}` : ''}
${options?.fullTierNames?.length ? `- Full-Analysis Competitors: ${options.fullTierNames.join(', ')}` : ''}
${options?.summaryTierNames?.length ? `- Summary Competitors: ${options.summaryTierNames.join(', ')}` : ''}

### Customer Journey
- Situation Before Buying: ${s(customerJourney.situationBeforeBuying)}
- Desired Transformation: ${s(customerJourney.desiredTransformation)}
- Common Objections: ${s(customerJourney.commonObjections)}
- Sales Cycle Length: ${s(customerJourney.salesCycleLength)}
${customerJourney.salesProcessOverview ? `- Sales Process: ${s(customerJourney.salesProcessOverview)}` : ''}

### Brand & Positioning
- Brand Positioning: ${s(brandPositioning.brandPositioning)}
${brandPositioning.customerVoice ? `- Customer Voice: ${s(brandPositioning.customerVoice)}` : ''}

### Budget & Targets
- Monthly Ad Budget: $${n(budgetTargets.monthlyAdBudget)}
- Campaign Duration: ${s(budgetTargets.campaignDuration)}
${budgetTargets.targetCpl ? `- Target CPL: $${n(budgetTargets.targetCpl)}` : ''}
${budgetTargets.targetCac ? `- Target CAC: $${n(budgetTargets.targetCac)}` : ''}

### Compliance
${compliance.topicsToAvoid ? `- Topics to Avoid: ${s(compliance.topicsToAvoid)}` : '- Topics to Avoid: None specified'}
${compliance.claimRestrictions ? `- Claim Restrictions: ${s(compliance.claimRestrictions)}` : '- Claim Restrictions: None specified'}
`.trim();
}

// =============================================================================
// Validation
// =============================================================================

export function validateOnboardingData(data: OnboardingFormData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.businessBasics?.businessName?.trim()) {
    errors.push('Missing required field: businessBasics.businessName');
  }
  if (!data.icp?.primaryIcpDescription?.trim()) {
    errors.push('Missing required field: icp.primaryIcpDescription');
  }
  if (!data.productOffer?.productDescription?.trim()) {
    errors.push('Missing required field: productOffer.productDescription');
  }

  return { valid: errors.length === 0, errors };
}
