import { artifactEnvelopeSchema } from "../artifacts/artifact-envelope";
import {
  offerDiagnosticBodySchema,
  offerDiagnosticSectionOutputSchema,
  validateOfferDiagnosticMinimums,
  type OfferDiagnosticArtifact,
  type OfferDiagnosticSectionOutput,
} from "../artifacts/schemas/offer-diagnostic";

const observedAt = "2026-05-20T16:40:00.000Z";
const retentionTypes = ["activation", "retention", "first-value-moment"] as const;

export const offerDiagnosticFixtureArtifact = artifactEnvelopeSchema
  .extend({ body: offerDiagnosticBodySchema })
  .parse({
    id: "art_fixture_offer_diagnostic_saaslaunch",
    runId: "run_saaslaunch_fixture",
    sectionId: "positioningOfferDiagnostic",
    sectionTitle: "Offer & Performance Diagnostic",
    verdict: "The offer bottleneck is proof and time-to-value clarity, not top-level category demand.",
    statusSummary:
      "The fixture offer is credible when it promises a weekly operating loop, but proof assets and funnel metrics are thin. The next moves should reduce trust risk and show first value inside one review cycle.",
    confidence: 0.6,
    sources: Array.from({ length: 5 }, (_, index) => ({
      id: `source_offer_${index + 1}`,
      title: `Offer Fixture Source ${index + 1}`,
      url: `https://example.com/offer/source-${index + 1}`,
      publisher: "AI-GOS AI SDK Lab Fixture",
      observedAt,
    })),
    body: {
      offerMarketFit: {
        prose:
          "Offer proof is strongest around workflow clarity, but public performance proof remains incomplete.",
        proofPoints: Array.from({ length: 3 }, (_, index) => ({
          metric: `Proof metric ${index + 1}`,
          value: index === 0 ? "one weekly review cycle" : "not disclosed",
          reportedBy: index === 0 ? "company-own" : "external-source",
          confidence: index === 0 ? "medium" : "low",
          sourceUrl: `https://example.com/offer/proof-${index + 1}`,
        })),
      },
      funnelDiagnosis: {
        prose:
          "The cold-click to paid path lacks enough quantified proof to remove risk for skeptical founders.",
        breaks: Array.from({ length: 2 }, (_, index) => ({
          stageName: index === 0 ? "Cold ad click" : "Demo to paid",
          metric: index === 0 ? "conversion rate" : "close rate",
          magnitude: "not disclosed",
          hypothesis:
            "Missing source-backed example increases trust burden before the buyer sees value.",
          sourceUrl: `https://example.com/offer/funnel-${index + 1}`,
        })),
      },
      channelTruth: {
        prose:
          "Founder community, LinkedIn, and partner-led channels have plausible fit but incomplete quantified proof.",
        channels: [
          ["Founder community", "partial"],
          ["LinkedIn outbound", "unknown"],
          ["Operator partners", "partial"],
        ].map(([channelName, hasWorked], index) => ({
          channelName,
          hasWorked,
          quantifiedEvidence: "not disclosed",
          sourceUrl: `https://example.com/offer/channel-${index + 1}`,
        })),
      },
      retentionHealth: {
        prose:
          "Activation and first-value signals should be made explicit before scaling paid media.",
        signals: Array.from({ length: 3 }, (_, index) => ({
          signalType: retentionTypes[index % retentionTypes.length],
          metric:
            index === 0
              ? "first account focus list"
              : index === 1
                ? "weekly review retained"
                : "first-value moment",
          value: "not disclosed",
          sourceUrl: `https://example.com/offer/retention-${index + 1}`,
        })),
      },
      redFlags: {
        prose:
          "The largest red flags are unproven autonomy claims, missing funnel metrics, and vague ROI language.",
        items: Array.from({ length: 3 }, (_, index) => ({
          claimedMotion:
            index === 0
              ? "AI operating loop"
              : index === 1
                ? "paid acquisition ready"
                : "fast ROI",
          actualEvidence: "Fixture evidence is directional but not quantified.",
          contradiction: "Claim is stronger than the disclosed proof asset.",
          severity: index === 0 ? "high" : "medium",
        })),
      },
    },
    createdAt: observedAt,
  }) as OfferDiagnosticArtifact;

export const offerDiagnosticFixtureSectionOutput =
  offerDiagnosticSectionOutputSchema.parse({
    sectionTitle: offerDiagnosticFixtureArtifact.sectionTitle,
    verdict: offerDiagnosticFixtureArtifact.verdict,
    statusSummary: offerDiagnosticFixtureArtifact.statusSummary,
    confidence: offerDiagnosticFixtureArtifact.confidence,
    sources: offerDiagnosticFixtureArtifact.sources.map(
      ({ title, url, publisher }) => ({ title, url, publisher }),
    ),
    body: offerDiagnosticFixtureArtifact.body,
  }) satisfies OfferDiagnosticSectionOutput;

const offerDiagnosticFixtureMinimums = validateOfferDiagnosticMinimums(
  offerDiagnosticFixtureArtifact,
);

if (!offerDiagnosticFixtureMinimums.ok) {
  throw new Error(
    `offerDiagnosticFixtureArtifact failed minimums: ${offerDiagnosticFixtureMinimums.errors.join("; ")}`,
  );
}
