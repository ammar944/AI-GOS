import { describe, expect, it } from "vitest";

import { promoteVerifiedValuationSignal } from "../run-section";
import {
  marketSizeSignalSchema,
  validateMarketCategoryMinimums,
  type MarketCategoryArtifact,
} from "@/lib/lab-engine/artifacts/schemas/market-category";
import { marketCategoryFixtureArtifact } from "@/lib/lab-engine/fixtures/market-category-artifact";

// The real verified $13B valuation claim shape (from
// harness-ramp-2e3adf77/positioningMarketCategory.json) — status verified,
// entailmentVerdict supported, matchedSourceRef.kind corpusExcerpt, claim.kind
// numeric, a billion valuation with a date in raw + a dated sourceUrl slug.
function verifiedValuationClaim() {
  return {
    status: "verified",
    claim: {
      kind: "numeric",
      value: "$13B",
      raw: "The category is in a growth phase with strong tailwinds: $13B valuation (March 2025), 70,000+ customers, product expansion from cards into AP, travel, procurement, and an AI intelligence layer.",
    },
    matchedSourceRef: {
      kind: "corpusExcerpt",
      excerptIndex: 13,
      sourceUrl: "https://ramp.com/blog/behind-the-valuation-march-2025",
    },
    entailmentVerdict: "supported",
  };
}

function oneSignal() {
  return {
    signalType: "public-data" as const,
    name: "Spend management category public data",
    evidence: "Public market data on spend management adoption.",
    trajectory: "expanding" as const,
    methodology: "top-down" as const,
    sourceTitle: "Industry report",
    sourceUrl: "https://example.com/report",
    dateObserved: "2025",
  };
}

describe("promoteVerifiedValuationSignal (§4.3)", (): void => {
  it("promotes a verified corpus-sourced billion valuation into a 2nd funding-flow signal that PARSES", (): void => {
    const body = { marketSize: { signals: [oneSignal()] } };
    promoteVerifiedValuationSignal(body, { claims: [verifiedValuationClaim()] });

    expect(body.marketSize.signals).toHaveLength(2);
    const promoted = body.marketSize.signals[1] as Record<string, unknown>;
    // The pushed signal must be a valid marketSizeSignalSchema row (else
    // buildEnvelope.parse would throw and the section would error to absent-2).
    expect(() => marketSizeSignalSchema.parse(promoted)).not.toThrow();
    expect(promoted.signalType).toBe("funding-flow");
  });

  it("traces EVERY field to the verified claim (no synthesis)", (): void => {
    const claim = verifiedValuationClaim();
    const body = { marketSize: { signals: [oneSignal()] } };
    promoteVerifiedValuationSignal(body, { claims: [claim] });
    const promoted = body.marketSize.signals[1] as Record<string, string>;

    // evidence + sourceUrl copied verbatim from the verified claim
    expect(promoted.evidence).toBe(claim.claim.raw);
    expect(promoted.sourceUrl).toBe(claim.matchedSourceRef.sourceUrl);
    // dateObserved is present in the claim raw (never fabricated)
    expect(claim.claim.raw).toContain(promoted.dateObserved);
    // name tokens ($13B + the date) are all present in the claim text
    expect(promoted.name).toContain("$13B");
    expect(promoted.name).toContain(promoted.dateObserved);
    // trajectory traces to "growth phase ... tailwinds" in the raw
    expect(promoted.trajectory).toBe("expanding");
    // sourceTitle derives from the real sourceUrl slug
    expect(promoted.sourceTitle.toLowerCase()).toContain("valuation");
  });

  it("no-op when marketSize already has >=2 signals", (): void => {
    const body = { marketSize: { signals: [oneSignal(), oneSignal()] } };
    promoteVerifiedValuationSignal(body, { claims: [verifiedValuationClaim()] });
    expect(body.marketSize.signals).toHaveLength(2);
  });

  it("no-op when a funding-flow signal already exists (avoids duplicate signalType)", (): void => {
    const ff = { ...oneSignal(), signalType: "funding-flow" as const };
    const body = { marketSize: { signals: [ff] } };
    promoteVerifiedValuationSignal(body, { claims: [verifiedValuationClaim()] });
    expect(body.marketSize.signals).toHaveLength(1);
  });

  it("no-op for an UNSUPPORTED claim (only verified+supported corpus claims promote)", (): void => {
    const claim = { ...verifiedValuationClaim(), status: "unsupported", entailmentVerdict: undefined };
    const body = { marketSize: { signals: [oneSignal()] } };
    promoteVerifiedValuationSignal(body, { claims: [claim] });
    expect(body.marketSize.signals).toHaveLength(1);
  });

  it("no-op for a non-billion / non-valuation numeric claim", (): void => {
    const claim = verifiedValuationClaim();
    claim.claim.value = "32%";
    claim.claim.raw = "Conversion improved to 32% after the redesign.";
    const body = { marketSize: { signals: [oneSignal()] } };
    promoteVerifiedValuationSignal(body, { claims: [claim] });
    expect(body.marketSize.signals).toHaveLength(1);
  });

  it("no-op when no date is extractable (never fabricate a dateObserved)", (): void => {
    const claim = verifiedValuationClaim();
    claim.claim.raw = "The company reached a $13B valuation amid category tailwinds.";
    claim.matchedSourceRef.sourceUrl = "https://ramp.com/blog/the-valuation";
    const body = { marketSize: { signals: [oneSignal()] } };
    promoteVerifiedValuationSignal(body, { claims: [claim] });
    expect(body.marketSize.signals).toHaveLength(1);
  });

  it("clears the >=2 signals minimums floor on a real market body", (): void => {
    // Reduce the fixture to a single signal so the floor would otherwise fire,
    // then prove promotion lifts it back over the bar.
    const artifact = structuredClone(
      marketCategoryFixtureArtifact,
    ) as MarketCategoryArtifact;
    artifact.body.marketSize.signals = [artifact.body.marketSize.signals[0]];
    promoteVerifiedValuationSignal(artifact.body, {
      claims: [verifiedValuationClaim()],
    });
    expect(artifact.body.marketSize.signals.length).toBeGreaterThanOrEqual(2);
    const result = validateMarketCategoryMinimums(artifact);
    const signalsFloorError = result.errors.find((e) =>
      e.includes("marketSize.signals") && e.includes("need >=2"),
    );
    expect(signalsFloorError).toBeUndefined();
  });

  it("clears a stale marketSize.blockGap when the promotion meets the >=2 floor", (): void => {
    const body = {
      marketSize: {
        signals: [oneSignal()],
        blockGap: {
          summary:
            "Only 1 of the required 2 market trajectory signals could be sourced.",
          foundCount: 1,
          requiredCount: 2,
          sourcingPlan: ["Find a second public trajectory signal."],
        },
      },
    };
    promoteVerifiedValuationSignal(body, { claims: [verifiedValuationClaim()] });

    // The promoted signal lifts the count to 2 — the "only 1 of 2 sourced" card
    // must NOT ride alongside it (self-contradicting artifact).
    expect(body.marketSize.signals).toHaveLength(2);
    expect(
      (body.marketSize as Record<string, unknown>).blockGap,
    ).toBeUndefined();
  });
});
