// Ad Copy Zod Schemas
// Platform-specific schemas with hard character limits matching ad-copy-types.ts

import { z } from "zod";

// =============================================================================
// Platform-Specific Schemas
// =============================================================================

export const metaAdCopySchema = z.object({
  primaryText: z
    .string()
    .max(300)
    .describe(
      "Meta primary text, 125 chars visible before 'See More'. Write the strongest hook in the first 125 characters. Full text up to 300 chars."
    ),
  headline: z
    .string()
    .max(40)
    .describe("Meta headline, 40 chars max. Punchy, benefit-driven, no filler words."),
  linkDescription: z
    .string()
    .max(25)
    .describe("Link description shown below headline, 25 chars max. Reinforce the CTA or add urgency."),
  ctaButton: z.enum([
    "Learn More",
    "Sign Up",
    "Get Quote",
    "Shop Now",
    "Contact Us",
    "Download",
    "Book Now",
  ]),
});

export const googleRSASchema = z.object({
  headlines: z
    .array(z.string().max(30))
    .min(3)
    .max(15)
    .describe(
      "3-15 diverse headlines, 30 chars each. Include keyword variants, benefits, CTAs, and brand mentions. Headlines must work in any combination — no sequential dependencies."
    ),
  descriptions: z
    .array(z.string().max(90))
    .min(2)
    .max(4)
    .describe(
      "2-4 descriptions, 90 chars each. Expand on value prop, include proof points and CTAs. Must work independently."
    ),
  displayPaths: z.tuple([
    z
      .string()
      .max(15)
      .optional()
      .describe("First display path segment, 15 chars max (e.g., 'solutions')"),
    z
      .string()
      .max(15)
      .optional()
      .describe("Second display path segment, 15 chars max (e.g., 'enterprise')"),
  ]),
});

export const linkedInAdCopySchema = z.object({
  introText: z
    .string()
    .max(600)
    .describe(
      "LinkedIn intro text, 150 chars visible before 'see more'. Lead with a data-driven hook or provocative question. Full text up to 600 chars."
    ),
  ctaButton: z.enum([
    "Learn More",
    "Sign Up",
    "Register",
    "Download",
    "Request Demo",
    "Get Quote",
  ]),
});

export const tiktokAdCopySchema = z.object({
  adText: z
    .string()
    .max(100)
    .describe("TikTok ad text, 100 chars max. Casual, native-sounding, avoid corporate speak."),
  videoScript: z.object({
    hook: z
      .string()
      .describe(
        "Hook 0-3s: Pattern interrupt that stops the scroll. Use a bold claim, unexpected visual cue, or relatable scenario."
      ),
    body: z
      .string()
      .describe(
        "Body 3-15s: Deliver the value proposition. Show the transformation or proof point. Keep it conversational."
      ),
    cta: z
      .string()
      .describe(
        "CTA 15-20s: Direct call to action. Tell them exactly what to do next. Create urgency."
      ),
  }),
});

export const youtubeAdCopySchema = z.object({
  headlineOverlay: z
    .string()
    .max(15)
    .describe("YouTube headline overlay text, 15 chars max. Shown on screen during ad."),
  ctaText: z
    .string()
    .max(10)
    .describe("CTA button text, 10 chars max (e.g., 'Try Free', 'Get Demo')."),
  script: z.object({
    hook: z
      .string()
      .describe(
        "Hook 0-3s: Must earn the viewer's attention before the skip button appears at 5s. Open with a bold statement or question."
      ),
    problemSolution: z
      .string()
      .describe(
        "Problem/solution 3-15s: Agitate the pain point, then present the solution. Use specific numbers from research."
      ),
    socialProof: z
      .string()
      .describe(
        "Social proof 15-18s: Cite a result, testimonial snippet, or trust signal. Make it specific and believable."
      ),
    cta: z
      .string()
      .describe(
        "CTA 18-22s: Clear next step with urgency. Repeat the key benefit and tell them what to click."
      ),
  }),
});

// =============================================================================
// Platform Variant Discriminated Union
// =============================================================================

export const platformCopyVariantSchema = z.discriminatedUnion("platform", [
  z.object({ platform: z.literal("meta"), copy: metaAdCopySchema }),
  z.object({ platform: z.literal("google"), copy: googleRSASchema }),
  z.object({ platform: z.literal("linkedin"), copy: linkedInAdCopySchema }),
  z.object({ platform: z.literal("tiktok"), copy: tiktokAdCopySchema }),
  z.object({ platform: z.literal("youtube"), copy: youtubeAdCopySchema }),
]);

// =============================================================================
// Copy Set (angle x platform)
// =============================================================================

export const angleCopySetSchema = z.object({
  angleName: z
    .string()
    .describe("Creative angle name matching the media plan angle (e.g., 'Pain Agitation', 'Social Proof')"),
  angleDescription: z
    .string()
    .describe("Brief description of the angle approach and why it works for this funnel stage"),
  funnelStage: z.enum(["cold", "warm", "hot"]).describe("Funnel stage this copy set targets"),
  variants: z
    .array(platformCopyVariantSchema)
    .describe("One variant per active platform for this angle. Each variant contains platform-specific copy."),
});

// =============================================================================
// Top-Level Output Schema
// =============================================================================

export const adCopyOutputSchema = z.object({
  copySets: z
    .array(angleCopySetSchema)
    .describe(
      "One copy set per creative angle from the media plan. Each set contains platform-specific copy variants for every active platform."
    ),
});
