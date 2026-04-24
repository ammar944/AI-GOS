/**
 * ingest-identity — Output schema (IdentityCard)
 * Typed output contract. Facts only. No scores, no recommendations.
 *
 * TODO (slice 1 Lane D): add category, coreKeywords, negativeKeywords,
 * source provenance (source_url + retrieved_at on every field).
 */
import { z } from "zod";

export const IdentityCardOutputSchema = z
  .object({
    run_id: z.string(),
    company_name: z.string().min(1),
    domain: z.string().min(1),
    generated_at: z.string().datetime(),
  })
  .describe("Scaffold output — expand in Lane D");

export type IdentityCardOutput = z.infer<typeof IdentityCardOutputSchema>;
