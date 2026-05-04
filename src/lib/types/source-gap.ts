import { z } from "zod";

export const sourceGapSeveritySchema = z.enum(["info", "warn", "blocker"]);

export const sourceGapSchema = z
  .object({
    field: z.string().min(1),
    reason: z.string().min(1),
    remediation: z.string().min(1),
    severity: sourceGapSeveritySchema,
    confidence: z
      .number()
      .describe("Integer confidence score from 0 to 10 inclusive."),
  })
  .strict()
  .superRefine((sourceGap, context) => {
    if (
      !Number.isInteger(sourceGap.confidence) ||
      sourceGap.confidence < 0 ||
      sourceGap.confidence > 10
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confidence"],
        message: "confidence must be an integer from 0 to 10 inclusive.",
      });
    }
  });

export const sourceGapsArraySchema = z.array(sourceGapSchema);

export type SourceGapSeverity = z.infer<typeof sourceGapSeveritySchema>;
export type SourceGap = z.infer<typeof sourceGapSchema>;
