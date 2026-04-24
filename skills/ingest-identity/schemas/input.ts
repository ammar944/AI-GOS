/**
 * ingest-identity — Input schema
 * Sealed per-run payload. No cross-account bleed.
 *
 * TODO (slice 1 Lane D): expand per design doc — add company_name,
 * stated_industry, locale, and optional prior-run context.
 */
import { z } from "zod";

export const IdentityResolverInputSchema = z
  .object({
    run_id: z.string().regex(/^[a-z0-9_-]+$/),
    url: z.string().url(),
  })
  .describe("Scaffold input — expand in Lane D");

export type IdentityResolverInput = z.infer<typeof IdentityResolverInputSchema>;
