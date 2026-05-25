import { z } from "zod";

import {
  researchInputSchema,
  type ResearchInput,
} from "../artifacts/artifact-envelope";
import {
  SECTION_REGISTRY,
  type SupportedSectionId,
} from "../sections/section-registry";

const supportedSectionIds = Object.keys(SECTION_REGISTRY) as [
  SupportedSectionId,
  ...SupportedSectionId[],
];

export const brandRunPayloadSchema = researchInputSchema
  .omit({ fixtureId: true, runId: true })
  .extend({
    inputId: z.string().min(1).optional(),
  })
  .strict();

export const fixtureCreateRunRequestSchema = z
  .object({
    inputMode: z.literal("fixture"),
    fixtureId: z.literal("saaslaunch"),
    sectionIds: z.array(z.enum(supportedSectionIds)).min(1),
  })
  .strict();

export const brandCreateRunRequestSchema = z
  .object({
    inputMode: z.literal("brand"),
    brand: brandRunPayloadSchema,
    sectionIds: z.array(z.enum(supportedSectionIds)).min(1),
  })
  .strict();

export const createRunRequestSchema = z.discriminatedUnion("inputMode", [
  fixtureCreateRunRequestSchema,
  brandCreateRunRequestSchema,
]);

export type BrandRunPayload = z.infer<typeof brandRunPayloadSchema>;
export type CreateRunRequest = z.infer<typeof createRunRequestSchema>;

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return slug.length > 0 ? slug : "brand";
}

export function deriveBrandInputId(brand: BrandRunPayload): string {
  return brand.inputId ?? `brand_${slugify(brand.company.id)}`;
}

export function buildResearchInputFromBrand({
  brand,
  runId,
}: {
  brand: BrandRunPayload;
  runId: string;
}): ResearchInput {
  return researchInputSchema.parse({
    company: brand.company,
    onboarding: brand.onboarding,
    corpus: brand.corpus,
    sources: brand.sources,
    competitorAds: brand.competitorAds,
    fixtureId: deriveBrandInputId(brand),
    runId,
  });
}
