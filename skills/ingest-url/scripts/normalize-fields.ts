import { fileURLToPath } from "url";
import { z } from "zod";
import {
  gtmBriefFieldKeys,
  prefilledFieldSchema,
  type GtmBriefFieldKey,
  type PrefilledField,
  type SourcedClaim,
} from "../schemas/output.ts";

export interface RawPrefillField {
  field_key: string;
  label?: string;
  value: string;
  confidence?: "low" | "medium" | "high" | number;
  evidence: SourcedClaim[];
  reason?: string;
}

export interface NormalizedFieldResult {
  fields: PrefilledField[];
  unresolved_fields: string[];
}

const fieldLabels: Record<GtmBriefFieldKey, string> = {
  companyName: "Company Name",
  companyUrl: "Company URL",
  category: "Category",
  market: "Market",
  industryVertical: "Industry Vertical",
  geography: "Geography",
  hqLocation: "HQ Location",
  productDescription: "Product Description",
  targetCustomer: "Target Customer",
  coreDeliverables: "Core Deliverables",
  useCases: "Use Cases",
  corePromise: "Core Promise",
  firstValueMoment: "First Value Moment",
  activationEvent: "Activation Event",
  retentionDrivers: "Retention Drivers",
  cta: "CTA",
  packaging: "Packaging",
  pricingModel: "Pricing Model",
  pricingTiers: "Pricing Tiers",
  targetPlan: "Target Plan",
  primaryIcpDescription: "Primary ICP Description",
  icpSegment: "ICP Segment",
  jobTitles: "Job Titles",
  icpRoles: "ICP Roles",
  companySize: "Company Size",
  buyingCommittee: "Buying Committee",
  buyingTriggers: "Buying Triggers",
  icpPains: "ICP Pains",
  icpTriggers: "ICP Triggers",
  currentAlternative: "Current Alternative",
  awarenessLevel: "Awareness Level",
  icpObjections: "ICP Objections",
  salesMotion: "Sales Motion",
  gtmMotion: "GTM Motion",
  conversionPath: "Conversion Path",
  landingPages: "Landing Pages",
  salesHandoff: "Sales Handoff",
  lifecycleConstraints: "Lifecycle Constraints",
  avgAcv: "Average ACV",
  acv: "ACV",
  avgCustomerLtv: "Average Customer LTV",
  ltv: "LTV",
  targetCac: "Target CAC",
  cacTarget: "CAC Target",
  monthlyAdBudget: "Monthly Ad Budget",
  monthlyBudget: "Monthly Budget",
  currentCac: "Current CAC",
  monthlyRevenue: "Monthly Revenue",
  salesCycleLength: "Sales Cycle Length",
  salesCycle: "Sales Cycle",
  marginAssumptions: "Margin Assumptions",
  topCompetitors: "Top Competitors",
  knownCompetitors: "Known Competitors",
  alternatives: "Alternatives",
  uniqueEdge: "Unique Edge",
  categoryFrames: "Category Frames",
  differentiation: "Differentiation",
  lossReasons: "Loss Reasons",
  competitorStrengths: "Competitor Strengths",
  testimonials: "Testimonials",
  caseStudies: "Case Studies",
  logos: "Logos",
  metrics: "Metrics",
  claims: "Claims",
  styleReferences: "Style References",
  brandPositioning: "Brand Positioning",
  tone: "Tone",
  forbiddenClaims: "Forbidden Claims",
  compliance: "Compliance",
  brandGeography: "Brand Geography",
  timeline: "Timeline",
  goals: "Goals",
  pipelineTarget: "Pipeline Target",
  campaignObjective: "Campaign Objective",
  expectedOutput: "Expected Output",
  targetMarket: "Target Market",
  launchUrgency: "Launch Urgency",
  commonObjections: "Common Objections",
  keyPromises: "Key Promises",
  channels: "Channels",
  channelBudgetSplit: "Channel Budget Split",
  whatIsWorking: "What Is Working",
  whatIsNotWorking: "What Is Not Working",
  visitorToSignupPct: "Visitor To Signup Percent",
  signupToActivationPct: "Signup To Activation Percent",
  activationToPaidPct: "Activation To Paid Percent",
  demoToCloseRate: "Demo To Close Rate",
  last3to6MoGrowthTrend: "Last 3 To 6 Month Growth Trend",
};

const legacyFieldMap: Record<string, GtmBriefFieldKey> = {
  websiteUrl: "companyUrl",
  valueProp: "corePromise",
  headquartersLocation: "hqLocation",
  testimonialQuote: "testimonials",
  caseStudiesUrl: "caseStudies",
  testimonialsUrl: "testimonials",
  pricingUrl: "pricingTiers",
  demoUrl: "conversionPath",
};

function isGtmBriefFieldKey(value: string): value is GtmBriefFieldKey {
  return (gtmBriefFieldKeys as readonly string[]).includes(value);
}

function normalizeFieldKey(fieldKey: string): GtmBriefFieldKey | null {
  const legacy = legacyFieldMap[fieldKey];
  if (legacy) {
    return legacy;
  }
  return isGtmBriefFieldKey(fieldKey) ? fieldKey : null;
}

function normalizeConfidence(confidence: RawPrefillField["confidence"]): "low" | "medium" | "high" {
  if (confidence === "low" || confidence === "medium" || confidence === "high") {
    return confidence;
  }
  if (typeof confidence === "number") {
    if (confidence >= 80) {
      return "high";
    }
    if (confidence >= 50) {
      return "medium";
    }
  }
  return "low";
}

export function normalizePrefilledFields(
  rawFields: RawPrefillField[],
  initialUnresolvedFields: string[] = [],
): NormalizedFieldResult {
  const unresolved = new Set(initialUnresolvedFields);
  const fields: PrefilledField[] = [];
  const seen = new Set<GtmBriefFieldKey>();

  for (const rawField of rawFields) {
    const normalizedKey = normalizeFieldKey(rawField.field_key);
    if (!normalizedKey) {
      unresolved.add(rawField.field_key);
      continue;
    }
    if (seen.has(normalizedKey)) {
      continue;
    }
    seen.add(normalizedKey);
    const candidate = {
      field_key: normalizedKey,
      label: rawField.label ?? fieldLabels[normalizedKey],
      value: rawField.value,
      confidence: normalizeConfidence(rawField.confidence),
      evidence: rawField.evidence,
      reason: rawField.reason ?? `Mapped from ${rawField.field_key}.`,
    };
    fields.push(prefilledFieldSchema.parse(candidate));
  }

  return {
    fields,
    unresolved_fields: [...unresolved].sort(),
  };
}

const rawFieldArraySchema = z.array(
  z
    .object({
      field_key: z.string().min(1),
      label: z.string().min(1).optional(),
      value: z.string().min(1),
      confidence: z.union([z.enum(["low", "medium", "high"]), z.number()]).optional(),
      evidence: z.array(
        z
          .object({
            value: z.string().min(1),
            source_url: z.string().url(),
            retrieved_at: z.string().datetime(),
          })
          .strict(),
      ),
      reason: z.string().min(1).optional(),
    })
    .strict(),
);

export function parseRawPrefillFields(value: unknown): RawPrefillField[] {
  return rawFieldArraySchema.parse(value);
}

const invokedPath = process.argv[1] ? fileURLToPath(new URL(`file://${process.argv[1]}`)) : "";
const modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
  process.stderr.write("normalize-fields.ts is a library script used by orchestrate.ts.\n");
}
