// POST /api/onboarding/suggest
// Streams per-step AI suggestions using streamObject
// Consumed by useStepSuggestion hook via experimental_useObject

import { streamObject } from 'ai';
import { auth } from '@clerk/nextjs/server';
import { perplexity, anthropic, MODELS } from '@/lib/ai/providers';
import {
  STEP_SUGGESTION_SCHEMAS,
  STEP_LABELS,
  STEP_MODEL_STRATEGY,
  type SuggestableStep,
} from '@/lib/company-intel/step-schemas';

export const maxDuration = 60;

const VALID_STEPS = Object.keys(STEP_SUGGESTION_SCHEMAS) as SuggestableStep[];

const SYSTEM_PROMPT = `You are an AI assistant helping fill in onboarding form fields for a marketing strategy platform.

RULES:
1. Base ALL suggestions on the context provided from the user's prior wizard inputs.
2. Do NOT invent company names, URLs, or specific facts not present in the context.
3. For Step 4 (Market & Competition), you have web search — find REAL competitors only.
4. Be specific and actionable. Avoid generic marketing fluff.
5. If you don't have enough context for a field, omit it entirely (optional fields can be undefined).
6. Use the user's own language and framing when possible.
7. Confidence scores must honestly reflect how derivable the suggestion is from the provided context.`;

// ---------------------------------------------------------------------------
// Context builder — serializes prior wizard sections into readable text
// ---------------------------------------------------------------------------

function isNonEmpty(val: unknown): boolean {
  if (val === undefined || val === null) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (typeof val === 'number') return val !== 0;
  if (Array.isArray(val)) return val.length > 0;
  return true;
}

function formatField(label: string, val: unknown): string | null {
  if (!isNonEmpty(val)) return null;
  if (Array.isArray(val)) return `- ${label}: ${val.join(', ')}`;
  return `- ${label}: ${val}`;
}

function buildBusinessBasicsContext(formData: Record<string, unknown>): string | null {
  const bb = formData.businessBasics as Record<string, unknown> | undefined;
  if (!bb) return null;
  const lines = [
    formatField('Business Name', bb.businessName),
    formatField('Website', bb.websiteUrl),
  ].filter(Boolean);
  return lines.length ? `## Business Basics\n${lines.join('\n')}` : null;
}

function buildICPContext(formData: Record<string, unknown>): string | null {
  const icp = formData.icp as Record<string, unknown> | undefined;
  if (!icp) return null;
  const lines = [
    formatField('Primary ICP', icp.primaryIcpDescription),
    formatField('Industry', icp.industryVertical),
    formatField('Job Titles', icp.jobTitles),
    formatField('Company Size', icp.companySize),
    formatField('Geography', icp.geography),
    formatField('Easiest to Close', icp.easiestToClose),
    formatField('Buying Triggers', icp.buyingTriggers),
    formatField('Best Client Sources', icp.bestClientSources),
    formatField('Secondary ICP', icp.secondaryIcp),
    formatField('Systems/Platforms', icp.systemsPlatforms),
  ].filter(Boolean);
  return lines.length ? `## Ideal Customer Profile\n${lines.join('\n')}` : null;
}

function buildProductContext(formData: Record<string, unknown>): string | null {
  const po = formData.productOffer as Record<string, unknown> | undefined;
  if (!po) return null;
  // Format pricing tiers if present
  const tiers = po.pricingTiers as Array<{ name?: string; price?: number; billingCycle?: string; isPrimary?: boolean }> | undefined;
  const pricingLine = tiers && Array.isArray(tiers) && tiers.length > 0
    ? `- Pricing Tiers: ${tiers.map(t => `${t.name ?? 'Tier'}: $${t.price ?? 0}/${t.billingCycle ?? 'monthly'}${t.isPrimary ? ' [PRIMARY]' : ''}`).join(', ')}`
    : null;

  const lines = [
    formatField('Product Description', po.productDescription),
    formatField('Core Deliverables', po.coreDeliverables),
    pricingLine,
    !pricingLine ? formatField('Price', po.offerPrice) : null,
    !pricingLine ? formatField('Pricing Model', po.pricingModel) : null,
    formatField('Value Proposition', po.valueProp),
    formatField('Guarantees', po.guarantees),
    formatField('Funnel Type', po.currentFunnelType),
  ].filter(Boolean);
  return lines.length ? `## Product & Offer\n${lines.join('\n')}` : null;
}

function buildMarketContext(formData: Record<string, unknown>): string | null {
  const mc = formData.marketCompetition as Record<string, unknown> | undefined;
  if (!mc) return null;
  const lines = [
    formatField('Top Competitors', mc.topCompetitors),
    formatField('Unique Edge', mc.uniqueEdge),
    formatField('Competitor Frustrations', mc.competitorFrustrations),
    formatField('Market Bottlenecks', mc.marketBottlenecks),
    formatField('Proprietary Tech', mc.proprietaryTech),
  ].filter(Boolean);
  return lines.length ? `## Market & Competition\n${lines.join('\n')}` : null;
}

function buildCustomerJourneyContext(formData: Record<string, unknown>): string | null {
  const cj = formData.customerJourney as Record<string, unknown> | undefined;
  if (!cj) return null;
  const lines = [
    formatField('Situation Before Buying', cj.situationBeforeBuying),
    formatField('Desired Transformation', cj.desiredTransformation),
    formatField('Common Objections', cj.commonObjections),
    formatField('Sales Cycle Length', cj.salesCycleLength),
    formatField('Sales Process', cj.salesProcessOverview),
  ].filter(Boolean);
  return lines.length ? `## Customer Journey\n${lines.join('\n')}` : null;
}

// Which context sections to include per step (cumulative from prior steps)
const STEP_CONTEXT_BUILDERS: Record<
  SuggestableStep,
  ((fd: Record<string, unknown>) => string | null)[]
> = {
  icp: [buildBusinessBasicsContext],
  productOffer: [buildBusinessBasicsContext, buildICPContext],
  marketCompetition: [buildBusinessBasicsContext, buildICPContext, buildProductContext],
  customerJourney: [buildBusinessBasicsContext, buildICPContext, buildProductContext, buildMarketContext],
  brandPositioning: [buildBusinessBasicsContext, buildICPContext, buildProductContext, buildMarketContext, buildCustomerJourneyContext],
};

function buildContextFromFormData(formData: Record<string, unknown>, step: SuggestableStep): string {
  const builders = STEP_CONTEXT_BUILDERS[step];
  const sections = builders
    .map((fn) => fn(formData))
    .filter(Boolean) as string[];
  return sections.length > 0
    ? sections.join('\n\n')
    : 'No prior context available.';
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { step?: string; formData?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { step, formData } = body;

  if (!step || !VALID_STEPS.includes(step as SuggestableStep)) {
    return new Response(
      JSON.stringify({ error: `Invalid step. Must be one of: ${VALID_STEPS.join(', ')}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!formData || typeof formData !== 'object') {
    return new Response(
      JSON.stringify({ error: 'formData object is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const typedStep = step as SuggestableStep;
  const context = buildContextFromFormData(formData, typedStep);
  const stepLabel = STEP_LABELS[typedStep];
  const schema = STEP_SUGGESTION_SCHEMAS[typedStep];

  const strategy = STEP_MODEL_STRATEGY[typedStep];
  const selectedModel =
    strategy === 'perplexity'
      ? perplexity(MODELS.SONAR_PRO)
      : anthropic(MODELS.CLAUDE_SONNET);

  try {
    const result = streamObject({
      model: selectedModel,
      schema,
      system: SYSTEM_PROMPT,
      prompt: `Based on the following context from the user's prior wizard inputs, generate suggestions for the "${stepLabel}" step.\n\nOnly suggest fields where you have enough context to provide a meaningful, specific value. Omit fields where you would need to guess.\n\n--- USER CONTEXT ---\n${context}\n--- END CONTEXT ---\n\nGenerate suggestions for the ${stepLabel} fields now.`,
      temperature: 0.3,
      maxOutputTokens: 2000,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('[suggest] streamObject error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate suggestions' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
