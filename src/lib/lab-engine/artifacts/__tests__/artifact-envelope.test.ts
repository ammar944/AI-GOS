import { describe, expect, it } from "vitest";

import { verificationReportSchema } from "../artifact-envelope";

describe("verificationReportSchema", (): void => {
  it("accepts user-provided sources and entailment verdict metadata", (): void => {
    const report = verificationReportSchema.parse({
      verifiedCount: 1,
      unsupportedCount: 1,
      claims: [
        {
          status: "verified",
          claim: {
            kind: "numeric",
            value: "$75,000",
            raw: "$75,000 monthly ad budget",
          },
          matchedSourceRef: {
            kind: "userProvided",
            field: "economics.monthlyAdBudget",
          },
          entailmentVerdict: "user_asserted",
        },
        {
          status: "unsupported",
          claim: {
            kind: "numeric",
            value: "$99/mo",
            raw: "$99/mo fabricated price",
          },
          reason: "no_match",
          entailmentVerdict: "refuted",
        },
      ],
    });

    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "verified",
          entailmentVerdict: "user_asserted",
          matchedSourceRef: expect.objectContaining({ kind: "userProvided" }),
        }),
        expect.objectContaining({
          status: "unsupported",
          entailmentVerdict: "refuted",
        }),
      ]),
    );
  });
});
