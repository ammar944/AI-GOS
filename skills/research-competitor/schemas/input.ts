/**
 * SECTION 03 — Competitor Landscape & Positioning
 * Input schema: sealed onboarding payload per run
 */
import { z } from "zod";

export const ResearchCompetitorInputSchema = z
  .object({
    run_id: z.string().regex(/^[a-z0-9_-]+$/),
    company_name: z.string().min(1),
    product_description: z.string().min(1),
    icp: z.string().min(1),
    industry: z.string().min(1),
    geo: z.string().optional(),
    stated_competitors: z.array(z.string()).optional(),
    offer_tier: z
      .enum(["freemium", "smb_mid_market", "enterprise", "custom"])
      .optional(),
    target_plan: z.string().optional(),
    pricing: z.string().optional(),
  })
  .describe("Sealed per-run onboarding payload — no cross-account bleed");

export type ResearchCompetitorInput = z.infer<
  typeof ResearchCompetitorInputSchema
>;
