import { describe, expect, it } from "vitest";

import {
  dropConfessedExemplarQuotes,
  stripUngroundedNamedEntityMetrics,
} from "../creative-truth-gate";
import type { VerificationReport } from "../types";

function buildUnsupportedNumericReport(
  values: readonly string[],
): VerificationReport {
  return {
    claims: values.map((value) => ({
      claim: {
        kind: "numeric" as const,
        raw: `Unsupported numeric claim ${value}`,
        value,
      },
      reason: "no_match" as const,
      status: "unsupported" as const,
    })),
    unsupportedCount: values.length,
    verifiedCount: 0,
  };
}

describe("dropConfessedExemplarQuotes", (): void => {
  it("drops a competitor weakness card whose source confesses a fictional exemplar", (): void => {
    const result = dropConfessedExemplarQuotes({
      body: {
        publicWeaknesses: {
          prose: "Onboarding distrust recurs.",
          items: [
            {
              competitor: "Funnelglass",
              verbatimQuote: "took a month before the numbers matched",
              source: "g2",
              sourceUrl: "https://www.g2.com/products/funnelglass/reviews",
              whyItMatters: "Attackable onboarding objection.",
            },
            {
              competitor: "MetricPeak",
              verbatimQuote: "our team gave up on the migration",
              source:
                "note: this quote is from a fictional exemplar pattern, not a retrieved review",
              sourceUrl: "https://example.com/none",
              whyItMatters: "Migration friction.",
            },
          ],
        },
      },
      sectionId: "positioningCompetitorLandscape",
    });

    const items = (
      result.body.publicWeaknesses as { items: Array<{ competitor: string }> }
    ).items;

    expect(items).toHaveLength(1);
    expect(items[0]?.competitor).toBe("Funnelglass");
    expect(result.stripped).toHaveLength(1);
    expect(result.stripped[0]?.field).toBe("body.publicWeaknesses.items[1]");
  });

  it("keeps clean cards: ordinary analyst language about patterns is not a confession", (): void => {
    const body = {
      painLanguage: {
        quotes: [
          {
            verbatimText: "support kept blaming our pixel setup",
            source: "g2",
            sourceUrl: "https://www.g2.com/products/x/reviews",
            painTheme: "a recurring pattern across reviews",
            painIntensity: "high",
          },
        ],
      },
    };

    const result = dropConfessedExemplarQuotes({
      body,
      sectionId: "positioningVoiceOfCustomer",
    });

    expect(result.stripped).toEqual([]);
    expect(result.body).toBe(body);
  });

  it("relabels instead of dropping in the paid-media plan where row counts are pinned", (): void => {
    const result = dropConfessedExemplarQuotes({
      body: {
        competitorReviewInsights: [
          {
            complaint: "setup took our team six weeks (hypothetical example)",
            howWeLeverage: "lead with one-day setup",
            sourceSection: "positioningVoiceOfCustomer",
            grounding: "VoC switching story",
            quote: "setup took our team six weeks",
          },
          {
            complaint: "pricing jumped at renewal",
            howWeLeverage: "transparent pricing angle",
            sourceSection: "positioningCompetitorLandscape",
            grounding: "pricing page capture",
            quote: "pricing jumped at renewal",
          },
          {
            complaint: "no offline mode",
            howWeLeverage: "field-team angle",
            sourceSection: "positioningVoiceOfCustomer",
            grounding: "review quote",
            quote: "no offline mode",
          },
        ],
      },
      sectionId: "positioningPaidMediaPlan",
    });

    const rows = result.body.competitorReviewInsights as Array<
      Record<string, string>
    >;

    expect(rows).toHaveLength(3);
    expect(rows[0]?.complaint).toContain("evidence gap: fabricated exemplar removed");
    expect(rows[0]?.howWeLeverage).toContain("evidence gap:");
    expect(rows[0]?.grounding).toBe("UNVERIFIED");
    expect(rows[1]?.complaint).toBe("pricing jumped at renewal");
    expect(result.stripped).toHaveLength(1);
  });
});

describe("stripUngroundedNamedEntityMetrics", (): void => {
  it("removes the sentence attaching unsupported metrics to a named person, keeps the rest", (): void => {
    const result = stripUngroundedNamedEntityMetrics({
      body: {
        creativeFramework: [
          {
            label: "PST 1",
            hook: "Mara Bright (Houzz) cut reporting from 3 hours to 20 minutes and saved $450/mo across trackers. Built for ops leads who own the Monday report.",
            angleType: "Proof-Stacked",
            executesAngle: "Angle 02",
            sourceSection: "positioningBuyerICP",
            grounding: "persona row",
          },
        ],
      },
      verification: buildUnsupportedNumericReport(["20 minutes", "$450/mo"]),
    });

    const row = (
      result.body.creativeFramework as Array<Record<string, string>>
    )[0];

    expect(row?.hook).toBe(
      "Built for ops leads who own the Monday report.",
    );
    expect(row?.grounding).toBe("UNVERIFIED");
    expect(result.stripped).toHaveLength(1);
    expect(result.stripped[0]?.values).toEqual(["20 minutes", "$450/mo"]);
  });

  it("leaves supported metrics attached to named people untouched", (): void => {
    const body = {
      creativeFramework: [
        {
          label: "PST 2",
          hook: "Mara Bright (Houzz) cut reporting from 3 hours to 20 minutes.",
          angleType: "Proof-Stacked",
          executesAngle: "Angle 02",
          sourceSection: "positioningVoiceOfCustomer",
          grounding: "verbatim quote",
        },
      ],
    };

    const result = stripUngroundedNamedEntityMetrics({
      body,
      verification: buildUnsupportedNumericReport(["$9.2M"]),
    });

    expect(result.stripped).toEqual([]);
    expect(result.body).toBe(body);
  });

  it("leaves unsupported metrics with no named entity to the numeric redactor", (): void => {
    const body = {
      anglesToTest: [
        {
          shortName: "speed",
          description:
            "reporting time drops from 3 hours to 20 minutes for ops teams.",
          angleType: "Mechanism-Led",
          sourceSection: "positioningOfferDiagnostic",
          grounding: "UNVERIFIED",
        },
      ],
    };

    const result = stripUngroundedNamedEntityMetrics({
      body,
      verification: buildUnsupportedNumericReport(["20 minutes"]),
    });

    expect(result.stripped).toEqual([]);
    expect(result.body).toBe(body);
  });

  it("replaces fully poisoned copy with an explicit gap line", (): void => {
    const result = stripUngroundedNamedEntityMetrics({
      body: {
        competitorReviewInsights: [
          {
            complaint:
              "Dana Reyes at BrightOps pays $1,200/mo for 50+ trackers on 10 seats.",
            howWeLeverage: "undercut on price",
            sourceSection: "positioningCompetitorLandscape",
            grounding: "pricing table",
          },
        ],
      },
      verification: buildUnsupportedNumericReport(["$1,200/mo", "50+"]),
    });

    const row = (
      result.body.competitorReviewInsights as Array<Record<string, string>>
    )[0];

    expect(row?.complaint).toContain("evidence gap: copy removed");
    expect(row?.grounding).toBe("UNVERIFIED");
  });

  it("does not strip a grouped-number substring match", (): void => {
    const body = {
      creativeFramework: [
        {
          label: "USP",
          hook: "Acme Corp consolidated 1,300 records in one workspace.",
          angleType: "Mechanism-Led",
          executesAngle: "Angle 01",
          sourceSection: "positioningMarketCategory",
          grounding: "scraped count",
        },
      ],
    };

    const result = stripUngroundedNamedEntityMetrics({
      body,
      verification: buildUnsupportedNumericReport(["300"]),
    });

    expect(result.stripped).toEqual([]);
    expect(result.body).toBe(body);
  });
});
