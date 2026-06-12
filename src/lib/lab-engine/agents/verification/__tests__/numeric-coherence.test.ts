import { describe, expect, it } from "vitest";

import {
  buildSectionNumericTruth,
  enforceBriefNumericFidelity,
  enforceNumericCoherence,
  gateProseNumbers,
  numericCoherenceGapLine,
  scrubBodyInternalJargon,
  scrubInternalJargon,
} from "../numeric-coherence";

// Fixtures mirror run 8081e646 (Airtable E2E, 2026-06-11): the cold judge's
// coherence findings were prose narrating "~5,900 searches/month" while the
// keyword rows sum to ~7,300, "six of twelve pain quotes" over a quote table
// backing no such count, and "CHANNEL POLICY" / "verifiedCount=0" jargon
// shipping inside client prose.

const keywordRows = [
  {
    keyword: "airtable pricing",
    monthlyVolume: "4,800 (SpyFu-estimated)",
    monthlyVolumeValue: 4800,
    sourceUrl: "https://www.spyfu.com/",
  },
  {
    keyword: "airtable alternatives",
    monthlyVolume: "1,900 (SpyFu-estimated)",
    monthlyVolumeValue: 1900,
    sourceUrl: "https://www.spyfu.com/",
  },
  {
    keyword: "database spreadsheet hybrid",
    monthlyVolume: "600 (SpyFu-estimated)",
    monthlyVolumeValue: 600,
    sourceUrl: "https://www.spyfu.com/",
  },
];

function demandBody({ prose, rationale }: { prose: string; rationale: string }) {
  return {
    keywordDemand: {
      prose,
      rows: keywordRows,
    },
    orderedMoves: [{ move: "Launch competitor-alternative search", rationale }],
  };
}

describe("enforceNumericCoherence", () => {
  it("strips the prose sentence whose total contradicts the keyword rows (run 8081e646 5,900-vs-7,300)", () => {
    const body = demandBody({
      prose:
        "The accessible capture ceiling is ~5,900 searches/month across clusters. Pricing intent dominates the mix.",
      rationale: "Total sourced volume ~7,300/mo across these terms.",
    });

    const result = enforceNumericCoherence({
      body,
      sectionId: "positioningDemandIntent",
    });

    const keywordDemand = result.body.keywordDemand as { prose: string };
    const orderedMoves = result.body.orderedMoves as Array<{ rationale: string }>;

    expect(result.stripped).toHaveLength(1);
    expect(result.stripped[0]?.numbers).toContain("5,900");
    expect(keywordDemand.prose).toBe("Pricing intent dominates the mix.");
    // 7,300 traces to the monthlyVolumeValue column sum (4800+1900+600=7300).
    expect(orderedMoves[0]?.rationale).toContain("7,300");
  });

  it("keeps a total that matches a column sum approximately when the claim is hedged", () => {
    const body = demandBody({
      prose: "Roughly 7,400 searches/month are addressable.",
      rationale: "ok",
    });

    const result = enforceNumericCoherence({
      body,
      sectionId: "positioningDemandIntent",
    });

    expect(result.stripped).toHaveLength(0);
  });

  it("keeps a figure that appears verbatim in a structured cell (format-identical fallback)", () => {
    const body = demandBody({
      prose: "The pricing head term carries 4,800 searches.",
      rationale: "ok",
    });

    const result = enforceNumericCoherence({
      body,
      sectionId: "positioningDemandIntent",
    });

    expect(result.stripped).toHaveLength(0);
  });

  it("strips an N-of-M count the quote table cannot back (run 8081e646 six-of-twelve)", () => {
    const quotes = Array.from({ length: 12 }, (_, index) => ({
      theme: index < 3 ? "spreadsheet-collapse" : `other-${"abcdefghi"[index - 3]}`,
      verbatimText: `pain quote ${"abcdefghijkl"[index]}`,
    }));
    const body = {
      painLanguage: {
        prose:
          "The pain that converts is spreadsheet collapse: six of twelve pain quotes describe hitting structural limits. Service failure is the second cluster.",
        quotes,
      },
    };

    const result = enforceNumericCoherence({
      body,
      sectionId: "positioningVoiceOfCustomer",
    });

    expect(result.stripped).toHaveLength(1);
    expect(result.stripped[0]?.numbers[0]).toMatch(/six of twelve/i);

    const painLanguage = result.body.painLanguage as { prose: string };

    expect(painLanguage.prose).toBe("Service failure is the second cluster.");
  });

  it("keeps an N-of-M count backed by a group count over the quote table", () => {
    const quotes = Array.from({ length: 12 }, (_, index) => ({
      theme: index < 6 ? "spreadsheet-collapse" : `other-${"abcdef"[index - 6]}`,
      verbatimText: `pain quote ${"abcdefghijkl"[index]}`,
    }));
    const body = {
      painLanguage: {
        prose: "Six of twelve pain quotes describe spreadsheet collapse.",
        quotes,
      },
    };

    const result = enforceNumericCoherence({
      body,
      sectionId: "positioningVoiceOfCustomer",
    });

    expect(result.stripped).toHaveLength(0);
  });

  it("treats zero claims, years, 24/7, small counts, and URLs as non-claims", () => {
    const body = {
      painLanguage: {
        prose:
          "Zero of twelve quotes mention pricing. Since 2024 support runs 24/7 across two clusters (see https://example.com/5000-guide).",
        quotes: Array.from({ length: 12 }, () => ({ verbatimText: "q" })),
      },
    };

    const result = enforceNumericCoherence({
      body,
      sectionId: "positioningVoiceOfCustomer",
    });

    expect(result.stripped).toHaveLength(0);
  });

  it("strips an unbacked percent and replaces an emptied field with the gap line", () => {
    const body = {
      segments: { prose: "45% of the ICP sits in ops teams.", rows: [] },
    };

    const result = enforceNumericCoherence({
      body,
      sectionId: "positioningBuyerICP",
    });

    expect(result.stripped).toHaveLength(1);

    const segments = result.body.segments as { prose: string };

    expect(segments.prose).toBe(numericCoherenceGapLine);
  });

  it("returns the original body untouched when nothing strikes", () => {
    const body = demandBody({
      prose: "Pricing intent dominates the mix.",
      rationale: "ok",
    });

    const result = enforceNumericCoherence({
      body,
      sectionId: "positioningDemandIntent",
    });

    expect(result.body).toBe(body);
    expect(result.stripped).toHaveLength(0);
  });

  it("rescues a figure backed by the section's research input (corpus-sourced fact)", () => {
    const body = {
      segments: { prose: "50% of the Fortune 500 pay for the product.", rows: [] },
    };

    const result = enforceNumericCoherence({
      auxiliaryEvidence: {
        corpusRows: [
          {
            claim: "50% of the Fortune 500 are paying customers",
            sourceUrl: "https://example.com/customers",
          },
        ],
      },
      body,
      sectionId: "positioningBuyerICP",
    });

    expect(result.stripped).toHaveLength(0);
  });

  it("does not let prose self-vouch through another narrative field", () => {
    const body = {
      overview: { prose: "We see 9,999 monthly searches." },
      detailBlock: { strategicVerdict: "The 9,999 figure anchors the plan." },
    };

    const result = enforceNumericCoherence({
      body,
      sectionId: "positioningDemandIntent",
    });

    expect(result.stripped).toHaveLength(2);
  });

  it("masks product numbers as non-claims (run d838ed4e Microsoft 365 strike)", () => {
    const body = {
      segments: {
        prose:
          "Technographically, they use Google Workspace or Microsoft 365 across teams. Fortune 500 brands and S&P 500 names run 24x7 operations 365 days a year.",
        rows: [],
      },
    };

    const result = enforceNumericCoherence({
      body,
      sectionId: "positioningBuyerICP",
    });

    expect(result.stripped).toHaveLength(0);
  });

  it("rescues a figure the claim verifier graded verified (verifiedClaimValues)", () => {
    const body = {
      segments: { prose: "About 1,200 reviews back this pattern.", rows: [] },
    };

    const struck = enforceNumericCoherence({
      body,
      sectionId: "positioningBuyerICP",
    });
    const rescued = enforceNumericCoherence({
      body,
      sectionId: "positioningBuyerICP",
      verifiedClaimValues: ["1,200 reviews"],
    });

    expect(struck.stripped).toHaveLength(1);
    expect(rescued.stripped).toHaveLength(0);
  });
});

describe("scrubInternalJargon", () => {
  it("removes CHANNEL POLICY and verifiedCount sentences from prose (run 8081e646 leak)", () => {
    const scrubbed = scrubInternalJargon({
      field: "body.campaignOverview.prose",
      value:
        "CHANNEL POLICY: paid social allowed only with verified creative. The wall shows verifiedCount=0 for this advertiser. Meta remains the volume channel.",
    });

    expect(scrubbed.strikes).toHaveLength(2);
    expect(scrubbed.value).toBe("Meta remains the volume channel.");
  });

  it("rewrites raw section ids into human labels instead of stripping", () => {
    const scrubbed = scrubInternalJargon({
      field: "body.prose",
      value: "positioningDemandIntent proves the wedge.",
    });

    expect(scrubbed.value).toBe("the demand intent section proves the wedge.");
    expect(scrubbed.strikes[0]?.pattern).toBe("section-id-humanized");
  });

  it("walks body prose surfaces via scrubBodyInternalJargon", () => {
    const body = {
      campaignOverview: {
        prose: "CHANNEL POLICY: search first. Spend follows demand.",
      },
    };

    const result = scrubBodyInternalJargon({
      body,
      sectionId: "positioningPaidMediaPlan",
    });

    const campaignOverview = result.body.campaignOverview as { prose: string };

    expect(result.stripped).toHaveLength(1);
    expect(campaignOverview.prose).toBe("Spend follows demand.");
  });

  it("strips process-excuse vocabulary leaked into prose (run 314d5f02)", () => {
    const scrubbed = scrubInternalJargon({
      field: "body.prose",
      value: [
        "The tool budget limited retrieval.",
        "Search budgets were exhausted before competitor coverage completed.",
        "The prepass missed two competitors.",
        "The candidate pack held nine quotes.",
        "Only displayable creatives are shown on the wall.",
        "Treat these figures with caution — see section badge.",
        "leadListAvailable was false for this segment.",
        "Volumes are pre-normalized before display.",
        "Several ads were quarantined during identity checks.",
      ].join(" "),
    });

    expect(scrubbed.strikes.map((strike) => strike.pattern)).toEqual([
      "tool-budget",
      "budget-exhausted",
      "prepass",
      "candidate-pack",
      "displayable-creatives",
      "see-section-badge",
      "lead-list-available",
      "pre-normalized",
      "quarantined-pipeline",
    ]);
    expect(scrubbed.value).toBe(
      "evidence gap: narrative removed — internal pipeline vocabulary is not client prose.",
    );
  });

  it("keeps legitimate market prose about budgets and quarantined files", () => {
    const value =
      "The median ad budget for this segment is modest. Media budget allocation favors search. The antivirus quarantined files automatically.";

    const scrubbed = scrubInternalJargon({ field: "body.prose", value });

    expect(scrubbed.strikes).toEqual([]);
    expect(scrubbed.value).toBe(value);
  });
});

describe("gateProseNumbers with section truth (envelope strings)", () => {
  it("gates a statusSummary-style string against the body truth", () => {
    const body = demandBody({ prose: "ok", rationale: "ok" });
    const truth = buildSectionNumericTruth({
      body,
      sectionId: "positioningDemandIntent",
    });

    const gated = gateProseNumbers({
      field: "statusSummary",
      truth,
      value:
        "Committed with ~5,900 searches/month mapped. Keyword rows are SpyFu-sourced.",
    });

    expect(gated.strikes).toHaveLength(1);
    expect(gated.value).toBe("Keyword rows are SpyFu-sourced.");
  });
});

describe("enforceBriefNumericFidelity", () => {
  const sectionBodies = [
    demandBody({
      prose: "Total sourced volume ~7,300/mo.",
      rationale: "ok",
    }),
  ];

  it("strips thesis sentences carrying numbers absent from every section body", () => {
    const result = enforceBriefNumericFidelity({
      moves: ["Launch the competitor-alternative campaign."],
      sectionBodies,
      thesis:
        "Airtable should buy the 7,300 monthly searches it can win. A $30 click is the expected ceiling.",
    });

    expect(result.thesis).toBe(
      "Airtable should buy the 7,300 monthly searches it can win.",
    );
    expect(
      result.strikes.filter((strike) => strike.kind === "number-untraceable"),
    ).toHaveLength(1);
  });

  it("excises untraceable figures from moves but keeps the action", () => {
    const result = enforceBriefNumericFidelity({
      moves: ["Cap bids at $30 on competitor-alternative terms."],
      sectionBodies,
      thesis: "Buy the wedge.",
    });

    expect(result.moves[0]).toBe("Cap bids at on competitor-alternative terms.");
    expect(
      result.strikes.some(
        (strike) =>
          strike.kind === "number-untraceable" && strike.removedText === "$30",
      ),
    ).toBe(true);
  });

  it("humanizes raw section ids in the thesis", () => {
    const result = enforceBriefNumericFidelity({
      moves: [],
      sectionBodies,
      thesis: "positioningVoiceOfCustomer carries the proof.",
    });

    expect(result.thesis).toBe("the voice-of-customer section carries the proof.");
  });
});
