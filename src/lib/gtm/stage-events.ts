import { z } from "zod";

export const gtmStageEventTypeSchema = z.enum([
  "queued",
  "started",
  "heartbeat",
  "tool_call",
  "artifact_written",
  "validation_started",
  "validation_passed",
  "validation_failed",
  "completed",
  "blocked",
  "timed_out",
  "errored",
]);

export const gtmStageEventStatusSchema = z.enum([
  "queued",
  "running",
  "complete",
  "blocked",
  "timed_out",
  "errored",
]);

export const gtmStageEventInsertSchema = z
  .object({
    run_id: z.string().min(1),
    user_id: z.string().min(1),
    stage: z.string().min(1),
    event_type: gtmStageEventTypeSchema,
    message: z.string().min(1),
    status: gtmStageEventStatusSchema,
    metadata: z.record(z.string(), z.unknown()).optional(),
    duration_ms: z.number().int().nonnegative().optional(),
    tool_name: z.string().min(1).optional(),
    artifact_path: z.string().min(1).optional(),
    source_url: z.string().url().optional(),
    error: z.string().min(1).optional(),
    created_at: z.string().datetime().optional(),
  })
  .strict();

export const gtmStageEventSchema = gtmStageEventInsertSchema.extend({
  id: z.string().optional(),
  created_at: z.string().datetime(),
});

export type GtmStageEventInsert = z.infer<typeof gtmStageEventInsertSchema>;
export type GtmStageEvent = z.infer<typeof gtmStageEventSchema>;

export function validateGtmStageEventInsert(
  event: GtmStageEventInsert
): GtmStageEventInsert {
  return gtmStageEventInsertSchema.parse(event);
}
