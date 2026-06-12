import { describe, expect, it } from "vitest";

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
  it("accepts paid-media verifier review metadata at the envelope root", (): void => {
    const artifact = artifactEnvelopeSchema.parse({
      id: "artifact-paid-media",
      runId: "run-paid-media",
      sectionId: "positioningPaidMediaPlan",
      sectionTitle: "Paid Media Plan",
      verdict: "Launch with review",
      statusSummary: "Verifier found a soft provenance issue.",
      confidence: 0.82,
      sources: [
        {
          id: "source-1",
          title: "Fixture source",
          url: "https://example.com/source",
          observedAt: "2026-06-09T00:00:00.000Z",
        },
      ],
      body: { campaignOverview: { prose: "Use a bounded launch." } },
      decodeRepairs: [
        {
          path: "body.channelSuggestions[0].verdict",
          action: "snap-enum",
          from: "review",
          to: "REVIEW",
        },
      ],
      needs_review: true,
      verifierSummary: {
        totalClaims: 3,
        needsReviewIds: ["anglesToTest[0].Founder proof"],
      },
      createdAt: "2026-06-09T00:00:00.000Z",
    });

    expect(artifact.needs_review).toBe(true);
    expect(artifact.decodeRepairs).toEqual([
      expect.objectContaining({
        action: "snap-enum",
        path: "body.channelSuggestions[0].verdict",
      }),
    ]);
    expect(artifact.verifierSummary).toEqual(
      expect.objectContaining({
        totalClaims: 3,
        needsReviewIds: ["anglesToTest[0].Founder proof"],
      }),
    );
  });

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

});
