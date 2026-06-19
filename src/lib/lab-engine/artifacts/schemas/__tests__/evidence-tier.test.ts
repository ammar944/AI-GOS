import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  acquisitionGapSchema,
  blockCoverageSchema,
  coverageBlock,
  evidenceMetaSchema,
  evidenceSourceSchema,
  evidenceTierSchema,
  rowVerificationSchema,
  strippedRowSchema,
  withEvidenceMeta,
} from "../strategic-insight";

// A minimal section-specific row payload to wrap with the evidence-meta mixin.
const personaRowPayload = z.object({
  name: z.string().min(1),
  segmentLabel: z.string().min(1),
});

const grounded = coverageBlock(personaRowPayload);

const validSource = {
  url: "https://ramp.com/customers/acme",
  quote: "Bill Cox, VP of Finance, automated his close with Ramp.",
  retrievedVia: "firecrawl",
};

describe("evidence-tier primitives (Phase 1, §4.1–4.5)", () => {
  it("exposes the four-value tier enum exactly", () => {
    expect(evidenceTierSchema.options).toEqual([
      "hard_evidence",
      "directional_signal",
      "strategic_inference",
      "operator_input",
    ]);
  });

  describe("tier ↔ source refinement (withEvidenceMeta)", () => {
    it("hard_evidence REQUIRES a source", () => {
      const ok = withEvidenceMeta(personaRowPayload).safeParse({
        name: "VP Finance",
        segmentLabel: "VP of Finance at mid-market SaaS",
        tier: "hard_evidence",
        source: validSource,
      });
      expect(ok.success).toBe(true);

      const missing = withEvidenceMeta(personaRowPayload).safeParse({
        name: "VP Finance",
        segmentLabel: "VP of Finance at mid-market SaaS",
        tier: "hard_evidence",
        source: null,
      });
      expect(missing.success).toBe(false);
      expect(
        missing.success ? "" : missing.error.issues[0]?.message,
      ).toContain("requires source");
    });

    it("directional_signal REQUIRES a source", () => {
      const ok = withEvidenceMeta(personaRowPayload).safeParse({
        name: "Controllers",
        segmentLabel: "Controllers at 200–1000-employee firms",
        tier: "directional_signal",
        source: validSource,
      });
      expect(ok.success).toBe(true);

      const missing = withEvidenceMeta(personaRowPayload).safeParse({
        name: "Controllers",
        segmentLabel: "Controllers at 200–1000-employee firms",
        tier: "directional_signal",
        source: null,
      });
      expect(missing.success).toBe(false);
    });

    it("strategic_inference FORBIDS a source but REQUIRES derivedFrom", () => {
      const ok = withEvidenceMeta(personaRowPayload).safeParse({
        name: "Pain-moment buyer",
        segmentLabel: "Finance leader at the moment manual processes break",
        tier: "strategic_inference",
        source: null,
        derivedFrom: "case-study role lines + about-us positioning",
      });
      expect(ok.success).toBe(true);

      const missingDerived = withEvidenceMeta(personaRowPayload).safeParse({
        name: "Pain-moment buyer",
        segmentLabel: "Finance leader at the moment manual processes break",
        tier: "strategic_inference",
        source: null,
      });
      expect(missingDerived.success).toBe(false);
      expect(
        missingDerived.success ? "" : missingDerived.error.issues[0]?.message,
      ).toContain("derivedFrom");
    });

    it("operator_input FORBIDS a source", () => {
      const ok = withEvidenceMeta(personaRowPayload).safeParse({
        name: "Budget input",
        segmentLabel: "$25k/mo budget operator brief",
        tier: "operator_input",
        source: null,
      });
      expect(ok.success).toBe(true);

      const withSource = withEvidenceMeta(personaRowPayload).safeParse({
        name: "Budget input",
        segmentLabel: "$25k/mo budget operator brief",
        tier: "operator_input",
        source: validSource,
      });
      expect(withSource.success).toBe(false);
      expect(
        withSource.success ? "" : withSource.error.issues[0]?.message,
      ).toContain("must not carry a source");
    });
  });

  describe("coverageBlock", () => {
    it("accepts an EMPTY rows array when coverage.readiness === 'gap'", () => {
      const parsed = grounded.safeParse({
        prose:
          "No venue-discovery tool is wired for cluster mining; sourcing plan attached.",
        rows: [],
        coverage: {
          byTier: {
            hard_evidence: 0,
            directional_signal: 0,
            strategic_inference: 0,
            operator_input: 0,
          },
          acquisitionGaps: [
            {
              whatWasSought: "buyer venue clusters",
              reason: "no_tool_wired",
              sourcingPlan: ["Wire a venue-discovery tool (PAA/Reddit)."],
            },
          ],
          strippedByVerifier: [],
          readiness: "gap",
        },
      });
      expect(parsed.success).toBe(true);
    });

    it("accepts a populated block with a downgraded verification meta", () => {
      const parsed = grounded.safeParse({
        prose: "One promoted champion, source unreachable, kept as directional.",
        rows: [
          {
            name: "Bill Cox",
            segmentLabel: "VP of Finance at mid-market SaaS",
            tier: "directional_signal",
            source: validSource,
            verification: {
              reach: "unreachable",
              outcome: "downgraded",
              method: "node-fetch re-check",
              note: "Redirected to interstitial; kept, not refuted.",
            },
          },
        ],
        coverage: {
          byTier: {
            hard_evidence: 0,
            directional_signal: 1,
            strategic_inference: 0,
            operator_input: 0,
          },
          acquisitionGaps: [],
          strippedByVerifier: [],
          readiness: "thin",
        },
      });
      expect(parsed.success).toBe(true);
    });
  });

  describe("gap + stripped row schemas", () => {
    it("acquisitionGapSchema requires a non-empty sourcingPlan", () => {
      expect(
        acquisitionGapSchema.safeParse({
          whatWasSought: "share of voice",
          reason: "no_tool_wired",
          sourcingPlan: [],
        }).success,
      ).toBe(false);
      expect(
        acquisitionGapSchema.safeParse({
          whatWasSought: "share of voice",
          reason: "no_tool_wired",
          sourcingPlan: ["Wire SpyFu SOV pull."],
        }).success,
      ).toBe(true);
    });

    it("strippedRowSchema records originalTier + droppedReason", () => {
      expect(
        strippedRowSchema.safeParse({
          summary: "Real force dropped on containment mismatch",
          originalTier: "hard_evidence",
          droppedReason: "containment-mismatch",
          sourceUrl: "https://example.com/page",
        }).success,
      ).toBe(true);
    });
  });

  it("blockCoverageSchema / evidenceSource / rowVerification parse the documented shapes", () => {
    expect(evidenceSourceSchema.safeParse(validSource).success).toBe(true);
    expect(
      rowVerificationSchema.safeParse({
        reach: "contained",
        outcome: "verified",
        method: "node-fetch",
      }).success,
    ).toBe(true);
    expect(
      blockCoverageSchema.safeParse({
        byTier: {
          hard_evidence: 1,
          directional_signal: 2,
          strategic_inference: 3,
          operator_input: 0,
        },
        readiness: "rich",
      }).success,
    ).toBe(true);
    // evidenceMetaSchema is the mixin shape; it parses standalone too.
    expect(
      evidenceMetaSchema.safeParse({
        tier: "strategic_inference",
        source: null,
        derivedFrom: "synthesis of the rows below",
      }).success,
    ).toBe(true);
  });
});
