/**
 * ingest-fathom input schema.
 * Self-contained contract for attaching a Fathom recording to brief enrichment.
 */
import { z } from "zod";

export const meetingTypeHintSchema = z.enum([
  "discovery",
  "demo",
  "follow_up",
  "closing",
  "strategy",
  "kickoff",
  "review",
  "other",
]);

export const ingestFathomInputSchema = z
  .object({
    run_id: z.string().min(1),
    recording_id: z.string().min(1),
    brief_id: z.string().min(1).optional(),
    client_id: z.string().min(1).optional(),
    meeting_type_hint: meetingTypeHintSchema.optional(),
    title: z.string().min(1).optional(),
  })
  .strict();

export type IngestFathomInput = z.infer<typeof ingestFathomInputSchema>;
