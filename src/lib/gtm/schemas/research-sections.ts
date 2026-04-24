import { z } from 'zod';

const baseSectionOutputSchema = z.object({
  summary: z.string(),
  keyFindings: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  assumptions: z.array(z.string()),
});

export const marketCategoryOutputSchema = baseSectionOutputSchema;
export const buyerIcpOutputSchema = baseSectionOutputSchema;
export const competitorsOutputSchema = baseSectionOutputSchema;
export const vocOutputSchema = baseSectionOutputSchema;
export const demandIntentOutputSchema = baseSectionOutputSchema;
export const offerFunnelOutputSchema = baseSectionOutputSchema;

export type MarketCategoryOutput = z.infer<typeof marketCategoryOutputSchema>;
export type BuyerIcpOutput = z.infer<typeof buyerIcpOutputSchema>;
export type CompetitorsOutput = z.infer<typeof competitorsOutputSchema>;
export type VocOutput = z.infer<typeof vocOutputSchema>;
export type DemandIntentOutput = z.infer<typeof demandIntentOutputSchema>;
export type OfferFunnelOutput = z.infer<typeof offerFunnelOutputSchema>;
