/**
 * SECTION 03 — Competitor Landscape & Positioning
 * Typed output contract. Facts only. No scores, no recommendations, no synthesis.
 * Every claim carries source_url + retrieved_at.
 */
import { z } from "zod";

// ── shared primitives ──────────────────────────────────────────
const Sourced = z.object({
  source_url: z.string().url(),
  retrieved_at: z.string().datetime(),
});

const MaybeSourced = z.object({
  source_url: z.string().url().optional(),
  retrieved_at: z.string().datetime().optional(),
});

export const CompetitorRefSchema = z.object({
  name: z.string(),
  type: z.enum(["subject", "direct", "indirect", "status_quo", "diy"]),
}).merge(Sourced);

export type CompetitorRef = z.infer<typeof CompetitorRefSchema>;

// ── positioning_taxonomy ────────────────────────────────────────
export const PositioningTaxonomySchema = z
  .object({
    name: z.string(),
    problem_framing_verbatim: z.string().describe(
      "Exact wording of how they frame the problem they solve"
    ),
    solution_framing_verbatim: z.string().describe(
      "Exact wording of how they frame their solution"
    ),
  })
  .merge(Sourced);

// ── pricing_reality ─────────────────────────────────────────────
export const PricingRealitySchema = z
  .object({
    name: z.string(),
    public_prices: z
      .array(z.string())
      .describe("Exact tier names and prices verbatim from pricing page"),
    gated_pricing_signals: z
      .array(z.string())
      .describe(
        "Verbatim clues indicating pricing is hidden (e.g. 'Contact sales')"
      ),
    packaging_notes: z.string().describe(
      "Free observations: paywalls, usage-limits, feature bundling"
    ),
  })
  .merge(Sourced);

// ── share_of_voice ──────────────────────────────────────────────
export const ShareOfVoiceSchema = z
  .object({
    search_terms_owned: z
      .array(
        z.string().describe(
          "Organic keyword the competitor dominates"
        )
      )
      .describe(
        "Evidence-backed list of terms where competitor ranks top-3 organically"
      ),
    communities_owned: z.array(
      z.object({
        name: z.string(),
        url: z.string().url().optional(),
        evidence: z.string().optional(),
      }).describe(
        "Community or channel where competitor has strong presence"
      )
    ),
    publications_owned: z.array(
      z.object({
        name: z.string(),
        url: z.string().url().optional(),
        evidence: z.string().optional(),
      }).describe(
        "Third-party publication where competitor is featured"
      )
    ),
    evidence_per_claim: z.array(
      z.object({
        claim: z.string(),
        evidence_url: z.string().url(),
      })
    ),
  })
  .merge(Sourced);

// ── review_mined_feedback ───────────────────────────────────────
export const ReviewMinedFeedbackSchema = z
  .object({
    name: z.string(),
    verbatim_quote: z.string().describe("Unedited user quote from review site"),
    source_site: z.enum([
      "g2",
      "capterra",
      "trustradius",
      "getapp",
      "softwareadvice",
      "other",
    ]),
    review_date: z.string().optional(),
    polarity: z
      .enum(["positive", "negative", "mixed"])
      .describe(
        "NOT an LLM score — determined by review star rating or context"
      ),
  })
  .merge(MaybeSourced);

// ── competitor_narrative_arc ───────────────────────────────────
export const CompetitorNarrativeArcSchema = z
  .object({
    name: z.string(),
    villain: z.string().describe(
      "What they claim customers are struggling with (verbatim if possible)"
    ),
    hero: z.string().describe(
      "How they position themselves as the hero (verbatim if possible)"
    ),
    transformation_claim: z.string().describe(
      "Exact promise or outcome they claim (verbatim if possible)"
    ),
    evidence_verbatim: z.string().describe(
      "Exact sentence from their own site/copy that supports the claim"
    ),
  })
  .merge(Sourced);

// ── paid_social_ad_inventory ───────────────────────────────────
export const PaidSocialAdInventorySchema = z
  .object({
    name: z.string(),
    active_ad_count: z.number().describe(
      "Number of ad snapshots found in Meta Ad Library. Use 0 if unable to access."
    ),
    run_duration_range: z.string().describe(
      'e.g. "2024-03 to 2024-09" or "unavailable"'
    ),
    formats: z.array(z.enum(["image", "video", "carousel", "collection", "other"])),
    hook_strings_verbatim: z
      .array(z.string())
      .describe("Exact ad copy headlines or hooks found in library"),
    cta_patterns: z
      .array(z.string())
      .describe("Exact CTA text patterns (e.g. 'Learn More', 'Get Started')"),
    ad_library_url: z.string().url().describe(
      "Direct Meta Ad Library search URL for this competitor"
    ),
  })
  .merge(Sourced);

// ── paid_search_ad_inventory ───────────────────────────────────
export const PaidSearchAdInventorySchema = z
  .object({
    name: z.string(),
    keyword: z.string(),
    headline_verbatim: z.string().describe("Exact ad headline captured"),
    body_verbatim: z.string().describe("Exact ad body text captured"),
    destination_url: z.string().url().describe("Where the ad leads"),
    captured_at: z.string().describe("ISO datetime of observation"),
  })
  .merge(Sourced);

// ── ad_activity_signals ────────────────────────────────────────
export const AdActivitySignalsSchema = z
  .object({
    name: z.string(),
    always_on_vs_burst: z
      .enum(["always_on", "burst", "mixed", "unknown"])
      .describe(
        "Determined by ad library date coverage, NOT LLM inference"
      ),
    refresh_cadence_days: z.number().describe(
      "Approximate days between creative refreshes if observable. Use 0 if unobservable."
    ),
    geo_targeting_visible: z
      .array(z.string())
      .describe("Countries/regions visible in ad library if exposed"),
    spend_magnitude_estimate_if_available: z
      .string()
      .optional()
      .describe("Only if Meta or SpyFu provides a spend bucket. Omit otherwise."),
  })
  .merge(MaybeSourced);

// ── organic_vs_paid_narrative_delta ─────────────────────────────
export const OrganicVsPaidNarrativeDeltaSchema = z
  .object({
    name: z.string(),
    homepage_positioning: z.string().describe(
      "How they describe themselves on their homepage (verbatim summary)"
    ),
    dominant_ad_hook: z.string().describe(
      "The most frequent hook in their paid ads (verbatim)"
    ),
    delta_description: z.string().describe(
      "The difference between what they say organically vs in ads. Fact only, no judgment."
    ),
    evidence_urls: z.array(z.string().url()),
  })
  .merge(Sourced);

// ── full output ─────────────────────────────────────────────────
export const ResearchCompetitorOutputSchema = z.object({
  run_id: z.string().regex(/^[a-z0-9_-]+$/),
  source_company_name: z.string(),
  generated_at: z.string().datetime(),
  tool_calls_used: z.array(z.string()),
  competitor_set: z.array(CompetitorRefSchema),
  positioning_taxonomy: z.array(PositioningTaxonomySchema),
  pricing_reality: z.array(PricingRealitySchema),
  share_of_voice: ShareOfVoiceSchema,
  review_mined_feedback: z.array(ReviewMinedFeedbackSchema),
  competitor_narrative_arc: z.array(CompetitorNarrativeArcSchema),
  paid_social_ad_inventory: z.array(PaidSocialAdInventorySchema),
  paid_search_ad_inventory: z.array(PaidSearchAdInventorySchema),
  ad_activity_signals: z.array(AdActivitySignalsSchema),
  organic_vs_paid_narrative_delta: z.array(OrganicVsPaidNarrativeDeltaSchema),
});

export type ResearchCompetitorOutput = z.infer<
  typeof ResearchCompetitorOutputSchema
>;
