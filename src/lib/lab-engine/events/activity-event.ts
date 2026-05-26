import { z } from "zod";

export const sectionIds = [
  "positioningMarketCategory",
  "positioningBuyerICP",
  "positioningCompetitorLandscape",
  "positioningVoiceOfCustomer",
  "positioningDemandIntent",
  "positioningOfferDiagnostic",
] as const;

export const activityEventTypes = [
  "run-created",
  "section-started",
  "skill-loaded",
  "tool-started",
  "tool-finished",
  "structured-output-started",
  "validation-failed",
  "repair-started",
  "sub-section-committed",
  "artifact-saved",
  "section-completed",
  "section-failed",
] as const;

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date");

export const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: "Expected ISO datetime with offset" });

export const sectionIdSchema = z.enum(sectionIds);
export const activityEventTypeSchema = z.enum(activityEventTypes);

const activityBaseFields = {
  id: z.string().min(1),
  runId: z.string().min(1),
  sectionId: sectionIdSchema.optional(),
  message: z.string().min(1),
  createdAt: isoDateTimeSchema,
} as const;

const sectionMetadataSchema = z
  .object({
    sectionTitle: z.string().min(1),
  })
  .strict();

const toolMetadataSchema = z
  .object({
    toolName: z.string().min(1),
  })
  .strict();

const toolFinishedGapMetadataSchema = z
  .object({
    reason: z.enum([
      "missing_credential",
      "api_error",
      "rate_limited",
      "not_implemented",
      "aborted",
    ]),
    envVar: z.string().min(1).optional(),
    message: z.string().min(1).optional(),
  })
  .strict();

export const activityEventSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...activityBaseFields,
      type: z.literal("run-created"),
      metadata: z
        .object({
          fixtureId: z.string().min(1),
          selectedSectionIds: z.array(sectionIdSchema).min(1),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...activityBaseFields,
      type: z.literal("section-started"),
      sectionId: sectionIdSchema,
      metadata: sectionMetadataSchema,
    })
    .strict(),
  z
    .object({
      ...activityBaseFields,
      type: z.literal("skill-loaded"),
      sectionId: sectionIdSchema,
      metadata: z
        .object({
          skillSlug: z.string().min(1),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...activityBaseFields,
      type: z.literal("tool-started"),
      sectionId: sectionIdSchema,
      metadata: toolMetadataSchema,
    })
    .strict(),
  z
    .object({
      ...activityBaseFields,
      type: z.literal("tool-finished"),
      sectionId: sectionIdSchema,
      metadata: toolMetadataSchema.extend({
        outputSummary: z.string().min(1).optional(),
        gap: toolFinishedGapMetadataSchema.optional(),
      }),
    })
    .strict(),
  z
    .object({
      ...activityBaseFields,
      type: z.literal("structured-output-started"),
      sectionId: sectionIdSchema,
      metadata: z
        .object({
          schemaName: z.string().min(1),
          attempt: z.number().int().min(1),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...activityBaseFields,
      type: z.literal("validation-failed"),
      sectionId: sectionIdSchema,
      metadata: z
        .object({
          attempt: z.number().int().min(1),
          issues: z.array(z.string().min(1)).min(1),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...activityBaseFields,
      type: z.literal("repair-started"),
      sectionId: sectionIdSchema,
      metadata: z
        .object({
          reason: z.string().min(1),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...activityBaseFields,
      type: z.literal("sub-section-committed"),
      sectionId: sectionIdSchema,
      metadata: z
        .object({
          subSectionKey: z.string().min(1),
          status: z.literal("committed"),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...activityBaseFields,
      type: z.literal("artifact-saved"),
      sectionId: sectionIdSchema,
      metadata: z
        .object({
          artifactId: z.string().min(1),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...activityBaseFields,
      type: z.literal("section-completed"),
      sectionId: sectionIdSchema,
      metadata: sectionMetadataSchema.extend({
        durationMs: z.number().int().min(0).optional(),
      }),
    })
    .strict(),
  z
    .object({
      ...activityBaseFields,
      type: z.literal("section-failed"),
      sectionId: sectionIdSchema,
      metadata: z
        .object({
          error: z.string().min(1),
        })
        .strict(),
    })
    .strict(),
]);

export type SectionId = z.infer<typeof sectionIdSchema>;
export type ActivityEventType = z.infer<typeof activityEventTypeSchema>;
export type ActivityEvent = z.infer<typeof activityEventSchema>;
