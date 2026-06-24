import { describe, expect, it } from "vitest";

import {
  decodePaidMediaPlanFromText,
  parsePaidMediaPlanFromText,
  stripPaidMediaPlanFence,
  composerStripFloor,
  COMPOSER_MAX_STEPS,
  COMPOSER_COHERENCE_LAW,
} from "@/lib/lab-engine/agents/composer-glm";
import type { PaidMediaPlanBody } from "@/lib/lab-engine/artifacts/schemas/paid-media-plan";
import { paidMediaPlanFixtureArtifact } from "@/lib/lab-engine/fixtures/paid-media-plan-artifact";

// A schema-DRIFTED but content-rich GLM deck: wrapper objects ({audiences:[...]}),
// renamed/aliased keys (recommendations / suggestions / insights wrappers), an
// overshoot funnel list, and a <2-leg cross-section insight. The OLD strict
// parser nulled this whole billable deck; the tolerant decoder must snap it.
const DRIFTED_DECK_JSON = JSON.stringify({
  campaignOverview: { objective: "Book qualified demos", primaryKpi: "Demos booked" },
  campaignPhases: { phases: [{ phaseName: "Phase 1 - Testing", monthsLabel: "Months 1-2" }] },
  audienceTypes: { audiences: [{ archetype: "RevOps leaders" }, { archetype: "Finance ops" }] },
  anglesToTest: { angles: [{ hypothesis: "Speed-to-close wins" }, { hypothesis: "Audit-ready by default" }] },
  creativeStrategy: { summary: "Lead with proof" },
  creativeFramework: { creatives: [{ format: "video", hook: "30s teardown" }] },
  funnelIdeation: { recommendations: [{ funnelStage: "TOFU", recommendation: "Problem-aware" }] },
  salesProcess: { assets: [] },
  competitorMarketingInsights: { competitors: [{ competitor: "Ramp" }, { competitor: "Brex" }] },
  competitorReviewInsights: {
    insights: [{ complaint: "Slow onboarding" }, { complaint: "Hidden fees" }, { complaint: "Poor support" }],
  },
  channelSuggestions: { suggestions: [{ channel: "LinkedIn", verdict: "ADD", rationale: "ICP lives here" }] },
  projectedResults: { rows: [{ targetIcp: "RevOps", kpi: "Demos", objective: "Test", durationLabel: "Months 1-2", kpiCostProvenance: "unknown", sourceSection: "gtmBrief" }] },
  kpis: { kpis: [{ metric: "CAC" }, { metric: "Demos booked" }] },
  // 1-leg insight: the tolerant decoder keeps it by adding the brief as the 2nd leg.
  crossSectionInsight: { insights: [{ tension: "ICP says X, competitors say Y", sourceSections: ["positioningBuyerICP"] }] },
});

describe("composer-glm — decodePaidMediaPlanFromText (tolerant decoder)", () => {
  it("decodes a schema-DRIFTED GLM deck (wrapper keys, 1-leg insight) into a non-null deck via the tolerant path", () => {
    const text = "```paid-media-plan\n" + DRIFTED_DECK_JSON + "\n```\n\n## Deck readout\nThe plan...";
    const { deck, deckSource } = decodePaidMediaPlanFromText(text);
    expect(deckSource).toBe("decoded");
    expect(deck.campaignOverview.primaryKpi.length).toBeGreaterThan(0); // overview present
    // wrapper keys snapped into real arrays
    expect(deck.audienceTypes.length).toBeGreaterThanOrEqual(1);
    expect(deck.anglesToTest.length).toBeGreaterThanOrEqual(2);
    expect(deck.competitorReviewInsights.length).toBe(3);
    expect(deck.channelSuggestions.length).toBeGreaterThanOrEqual(1);
    // 1-leg cross-section insight survives (brief added as 2nd leg, not dropped)
    expect(deck.crossSectionInsight.length).toBeGreaterThanOrEqual(1);
    expect(deck.crossSectionInsight[0]!.sourceSections.length).toBeGreaterThanOrEqual(2);
    // a drifted-but-valid deck passes the strip floor (no content lost)
    expect(composerStripFloor(deck).admitted).toBe(true);
  });

  it("returns an honest-gap body (never content-losing null) when the JSON is unparseable", () => {
    const text = "```paid-media-plan\n{ not valid json at all }\n```\n\n## Deck readout\nThe GLM narrative...";
    const { deck, deckSource } = decodePaidMediaPlanFromText(text);
    expect(deckSource).toBe("honest_gap");
    // honest-gap body is schema-valid (NOT null) so the operator still gets a deck shell
    expect(deck.competitorReviewInsights.length).toBe(3);
    expect(deck.anglesToTest.length).toBeGreaterThanOrEqual(2);
    expect(deck.kpis.length).toBeGreaterThanOrEqual(2);
    // its load-bearing text is honestly flagged as a gap, not fabricated
    expect(deck.crossSectionInsight[0]!.tension.toLowerCase()).toContain("gap");
  });

  it("returns an honest-gap body when no fenced JSON block is present at all", () => {
    const { deck, deckSource } = decodePaidMediaPlanFromText("just prose, the model forgot the fence");
    expect(deckSource).toBe("honest_gap");
    expect(deck.competitorReviewInsights.length).toBe(3);
  });

  it("returns an honest-gap body when valid JSON cannot be normalized into a deck (empty object)", () => {
    const text = "```paid-media-plan\n{}\n```";
    const { deck, deckSource } = decodePaidMediaPlanFromText(text);
    expect(deckSource).toBe("honest_gap");
    expect(deck.competitorReviewInsights.length).toBe(3);
  });
});

describe("composer-glm — parsePaidMediaPlanFromText (back-compat strict view)", () => {
  it("returns null for empty text", () => {
    expect(parsePaidMediaPlanFromText("")).toBeNull();
  });

  it("returns null when no fenced block is present", () => {
    expect(parsePaidMediaPlanFromText("just prose, no json here")).toBeNull();
  });

  it("returns null for a fenced block that is not valid JSON", () => {
    const text = "```paid-media-plan\n{not valid json}\n```";
    expect(parsePaidMediaPlanFromText(text)).toBeNull();
  });

  it("DECODES drifted JSON that the old strict parser nulled (cage removed)", () => {
    const text = "```paid-media-plan\n" + DRIFTED_DECK_JSON + "\n```";
    const deck = parsePaidMediaPlanFromText(text);
    expect(deck).not.toBeNull();
    expect(deck!.competitorReviewInsights.length).toBe(3);
  });
});

describe("composer-glm — stripPaidMediaPlanFence", () => {
  it("removes the paid-media-plan fence and keeps the prose", () => {
    const text =
      "```paid-media-plan\n{ \"x\": 1 }\n```\n\n## Deck readout\nThe plan...";
    expect(stripPaidMediaPlanFence(text)).toBe("## Deck readout\nThe plan...");
  });

  it("falls back to removing a generic json fence", () => {
    const text = "```json\n{ \"x\": 1 }\n```\n\nprose";
    expect(stripPaidMediaPlanFence(text)).toBe("prose");
  });

  it("returns the text unchanged when no fence is present", () => {
    expect(stripPaidMediaPlanFence("just prose")).toBe("just prose");
  });

  it("preserves [grounded]/[inferred]/[gap] markers in the readout", () => {
    const text =
      "```paid-media-plan\n{ \"x\": 1 }\n```\n\n## Block 1 [grounded]\nReason [inferred] and a [gap] here.";
    const out = stripPaidMediaPlanFence(text);
    expect(out).toContain("[grounded]");
    expect(out).toContain("[inferred]");
    expect(out).toContain("[gap]");
  });
});

describe("composer-glm — composerStripFloor", () => {
  it("rejects a null deck", () => {
    const verdict = composerStripFloor(null);
    expect(verdict.admitted).toBe(false);
    expect(verdict.reasons).toContain("deck_body_missing");
  });

  it("admits a full valid deck body", () => {
    // Use the schema to build a minimally-valid body the strip floor accepts.
    // The fixture is heavy; construct via the schema's known-required fields
    // by parsing a complete object. Easiest path: re-parse the fixture if
    // present, else build inline. Keep it self-contained here.
    const body = buildValidDeckBody();
    const verdict = composerStripFloor(body);
    expect(verdict.admitted).toBe(true);
    expect(verdict.reasons).toEqual([]);
  });

  it("flags angles below floor (<2)", () => {
    const body = buildValidDeckBody();
    body.anglesToTest = [body.anglesToTest[0]!];
    const verdict = composerStripFloor(body);
    expect(verdict.admitted).toBe(false);
    expect(verdict.reasons).toContain("angles_below_floor");
  });

  it("flags competitorReviewInsights not exactly 3", () => {
    const body = buildValidDeckBody();
    body.competitorReviewInsights = [body.competitorReviewInsights[0]!];
    const verdict = composerStripFloor(body);
    expect(verdict.admitted).toBe(false);
    expect(verdict.reasons).toContain("competitor_review_insights_not_exactly_3");
  });

  it("flags kpis below floor (<2)", () => {
    const body = buildValidDeckBody();
    body.kpis = [body.kpis[0]!];
    const verdict = composerStripFloor(body);
    expect(verdict.admitted).toBe(false);
    expect(verdict.reasons).toContain("kpis_below_floor");
  });
});

describe("composer-glm — constants + law", () => {
  it("COMPOSER_MAX_STEPS is small (synthesis, not gather)", () => {
    expect(COMPOSER_MAX_STEPS).toBeLessThanOrEqual(6);
    expect(COMPOSER_MAX_STEPS).toBeGreaterThan(0);
  });

  it("COMPOSER_COHERENCE_LAW names the cross-section coherence rule", () => {
    expect(COMPOSER_COHERENCE_LAW.toLowerCase()).toContain("coherence");
    expect(COMPOSER_COHERENCE_LAW).toContain("ICP");
    expect(COMPOSER_COHERENCE_LAW).toContain("competitors");
  });
});

// Use the repo's own schema-valid fixture for the strip-floor tests.
function buildValidDeckBody(): PaidMediaPlanBody {
  return structuredClone(paidMediaPlanFixtureArtifact.body);
}
