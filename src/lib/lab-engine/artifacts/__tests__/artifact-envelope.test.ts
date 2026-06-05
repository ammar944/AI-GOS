import { describe, expect, it } from "vitest";

import { crossSectionReasoningFixtureArtifact } from "../../fixtures/cross-section-reasoning-artifact";
import {
  artifactEnvelopeSchema,
  sectionReviewResultSchema,
  verificationReportSchema,
} from "../artifact-envelope";

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

describe("artifactEnvelopeSchema", (): void => {
  it("accepts unavailable review metadata with structured diagnostics", (): void => {
    const review = sectionReviewResultSchema.parse({
      upgradedMarkdown: "Original markdown.",
      tier: "unavailable",
      tierRationale:
        "Agentic review unavailable: Failed to process successful response",
      removedItems: [],
      clientQuestions: [],
      errorDiagnostics: {
        cause: "No object generated",
        message: "Failed to process successful response",
        name: "AI_NoObjectGeneratedError",
        responseBody: '{"finishReason":"stop"}',
        statusCode: 200,
      },
    });

    expect(review.tier).toBe("unavailable");
    expect(review.errorDiagnostics).toEqual(
      expect.objectContaining({
        cause: "No object generated",
        message: "Failed to process successful response",
        name: "AI_NoObjectGeneratedError",
        responseBody: '{"finishReason":"stop"}',
        statusCode: 200,
      }),
    );
  });

  it("accepts optional strategic critic metadata", (): void => {
    const artifact = artifactEnvelopeSchema.parse({
      ...crossSectionReasoningFixtureArtifact,
      strategicCritique: {
        target: "cross_section_reasoning",
        checkedAt: "2026-06-04T13:00:00.000Z",
        modelId: "claude-opus-4-5",
        summary: "The critic deepened one thread and kept the tension.",
        items: [
          {
            action: "deepened",
            path: "body.crossSectionThreads[0].claim",
            rationale:
              "The final claim names the trade-off and consequence.",
            text: "Final cross-section claim.",
            verdict: "passes",
          },
        ],
      },
    });

    expect(artifact.strategicCritique?.target).toBe(
      "cross_section_reasoning",
    );
  });
});
