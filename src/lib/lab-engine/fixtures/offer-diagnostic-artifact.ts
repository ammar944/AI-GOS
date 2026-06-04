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
      strategicInsight: {
        strategicVerdict:
          "The offer bottleneck is not demand; it is proving first value quickly enough for skeptical founder buyers.",
        nonObviousRead:
          "The offer should sell proof of a calmer weekly review before it sells a larger revenue-operations transformation.",
        secondOrderImplication:
          "Paid traffic should be routed to proof-first assets that shorten trust formation rather than broad feature demos.",
        keyTension: {
          tension:
            "The product wants to promise GTM leverage, but the buyer first needs evidence that the workflow will not create more work.",
          side:
            "Take the first-value proof side and make the initial offer narrower than the full platform story.",
          costOfPosition:
            "This delays the bigger transformation narrative until the pilot proves the weekly operating loop.",
        },
      },
      orderedMoves: [
        {
          rank: 1,
          move:
            "Ship a proof-first landing path that shows one weekly review moving from stale accounts to sourced next actions.",
          dependsOn: [],
          rationale:
            "The fixture offer has plausible fit but thin proof, so the first move must reduce trust risk before scale.",
        },
        {
          rank: 2,
          move:
            "Add a reversible pilot offer that promises a first account-focus list inside one review cycle.",
          dependsOn: [1],
          rationale:
            "The pilot depends on the proof path because founder buyers need to see the workflow before changing ritual.",
        },
      ],
      provesWrongIf: {
        metric: "proof-first landing path booked-call rate",
        threshold: "below 2 percent booked-call rate from qualified paid sessions",
        window: "first 30 days after proof-path launch",
      },
      singleBindingConstraint: {
        constraint:
          "The binding constraint is trust in first value, not awareness or broad feature completeness.",
        whyBinding:
          "Fixture proof assets and funnel metrics are thin, so paid media will amplify skepticism unless proof arrives early.",
        unlockCondition:
          "Show a source-backed weekly review transformation and a reversible pilot before asking for platform commitment.",
      },
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
