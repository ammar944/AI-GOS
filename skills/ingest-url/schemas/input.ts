import { z } from "zod";

const forbiddenInputValues = new Set([
  "unknown",
  "tbd",
  "n/a",
  "na",
  "not found",
  "scaffold",
]);

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isLinkedInCompanyUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    return (
      (hostname === "linkedin.com" || hostname === "www.linkedin.com") &&
      parsed.pathname.startsWith("/company/") &&
      parsed.pathname.split("/").filter(Boolean).length >= 2
    );
  } catch {
    return false;
  }
}

const nonPlaceholderStringSchema = z.string().min(1).superRefine((value, context) => {
  if (forbiddenInputValues.has(value.trim().toLowerCase())) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Placeholder value is not allowed: ${value}`,
    });
  }
});

const httpUrlSchema = nonPlaceholderStringSchema.superRefine((value, context) => {
  if (!isHttpUrl(value)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "URL must use http or https and include a valid host.",
    });
  }
});

export const ingestUrlInputSchema = z
  .object({
    run_id: nonPlaceholderStringSchema.optional(),
    brief_id: nonPlaceholderStringSchema.optional(),
    client_id: nonPlaceholderStringSchema.optional(),
    stage: z.literal("discover-url").optional(),
    url: httpUrlSchema,
    linkedin_url: httpUrlSchema
      .superRefine((value, context) => {
        if (!isLinkedInCompanyUrl(value)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "linkedin_url must be a LinkedIn company page URL.",
          });
        }
      })
      .optional(),
    user_notes: nonPlaceholderStringSchema.optional(),
  })
  .strict();

export type IngestUrlInput = z.infer<typeof ingestUrlInputSchema>;
