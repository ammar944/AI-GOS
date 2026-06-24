import { describe, expect, it } from "vitest";
import type { ZodIssue } from "zod";

import { buyerICPBodySchema } from "../buyer-icp";
import { competitorLandscapeBodySchema } from "../competitor-landscape";
import { demandIntentBodySchema } from "../demand-intent";
import { marketCategoryBodySchema } from "../market-category";
import { offerDiagnosticBodySchema } from "../offer-diagnostic";
import { voiceOfCustomerBodySchema } from "../voice-of-customer";

// §4.1 — narrativeMarkdown is an additive, optional key on the .strict() body
// schemas so GLM's raw research markdown rides ON the typed artifact body and
// survives assertSectionArtifactPersistable's strict re-validation at persist.
// A .strict() schema rejects unknown keys with an "unrecognized_keys" issue;
// proving narrativeMarkdown is NOT reported as unrecognized proves it is an
// accepted key (the missing-required-field issues are expected and ignored).
function reportsNarrativeAsUnrecognized(
  schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: ZodIssue[] } } },
): boolean {
  const result = schema.safeParse({ narrativeMarkdown: "# Real GLM section\n\nbody" });
  if (result.success) return false;
  return (result.error?.issues ?? []).some(
    (issue) =>
      issue.code === "unrecognized_keys" &&
      ((issue as unknown as { keys?: string[] }).keys ?? []).includes(
        "narrativeMarkdown",
      ),
  );
}

// Every PROJECTABLE section schema must accept narrativeMarkdown: the agentic
// path attaches it to whichever section's artifact it commits, and
// assertSectionArtifactPersistable re-validates against the strict body schema.
// A missing field on any projectable section = a persist crash for that section.
const PROJECTABLE_BODY_SCHEMAS: ReadonlyArray<[string, Parameters<typeof reportsNarrativeAsUnrecognized>[0]]> = [
  ["marketCategory", marketCategoryBodySchema],
  ["voiceOfCustomer", voiceOfCustomerBodySchema],
  ["buyerICP", buyerICPBodySchema],
  ["competitorLandscape", competitorLandscapeBodySchema],
  ["demandIntent", demandIntentBodySchema],
  ["offerDiagnostic", offerDiagnosticBodySchema],
];

describe("narrativeMarkdown additive field", () => {
  for (const [name, schema] of PROJECTABLE_BODY_SCHEMAS) {
    it(`is accepted (not unrecognized) by the strict ${name} body schema`, () => {
      expect(reportsNarrativeAsUnrecognized(schema)).toBe(false);
    });
  }

  it("rejects a non-string narrativeMarkdown on marketCategory", () => {
    const result = marketCategoryBodySchema.safeParse({ narrativeMarkdown: 42 });
    expect(result.success).toBe(false);
    const issues = result.success ? [] : result.error.issues;
    // there is a type error on narrativeMarkdown specifically
    expect(
      issues.some((i) => i.path.includes("narrativeMarkdown")),
    ).toBe(true);
  });
});
