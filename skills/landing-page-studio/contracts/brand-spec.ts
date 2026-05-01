// skills/landing-page-studio/contracts/brand-spec.ts
// BrandSpec — primary input contract for the landing-page-studio skill.
// Imported by: generate.ts, plan-directions.ts, generate-direction.ts, regen-section.ts, patch-text.ts.
// No imports from outside skills/landing-page-studio/.
import { z } from "zod";

export const BrandSpecSchema = z.object({
  brandName: z.string().describe("Company or product name"),
  tagline: z.string().describe("One-line positioning statement"),
  primaryColor: z
    .string()
    .describe("Hex color code for primary brand color, e.g. #1A2B3C"),
  accentColor: z
    .string()
    .describe("Hex accent color code for highlights and CTAs, e.g. #FF6B00"),
  voice: z
    .enum(["professional", "playful", "bold", "minimal", "warm"])
    .describe(
      "Tone of voice for generated copy. professional=formal, playful=lighthearted, bold=assertive, minimal=sparse, warm=friendly"
    ),
  direction: z
    .string()
    .describe(
      "One of the 15 direction keys from references/directions.json taxonomy, e.g. brutalist-arena, bento-notion-vercel"
    ),
  industry: z
    .string()
    .describe("Industry or vertical, e.g. SaaS, ecommerce, fintech, healthtech"),
  targetAudience: z
    .string()
    .describe(
      "Brief description of the ideal customer profile, e.g. B2B developers at mid-market SaaS companies"
    ),
  keyBenefit: z
    .string()
    .describe("Primary value proposition in one sentence, e.g. Cut deployment time by 80%"),
  cta: z
    .string()
    .describe(
      "Call-to-action button text, e.g. Start free trial, Get started, Book a demo"
    ),
  logoUrl: z
    .string()
    .optional()
    .describe("Optional URL to logo asset (PNG or SVG)"),
  customInstructions: z
    .string()
    .optional()
    .describe(
      "Optional free-text override for the generation prompt, e.g. Emphasize the enterprise security angle"
    ),
});

export type BrandSpec = z.infer<typeof BrandSpecSchema>;

// Convenience: parse-and-throw variant for use in scripts
export function parseBrandSpec(raw: unknown): BrandSpec {
  return BrandSpecSchema.parse(raw);
}

// Convenience: safe-parse variant for use in validators
export function safeParseBrandSpec(raw: unknown) {
  return BrandSpecSchema.safeParse(raw);
}
