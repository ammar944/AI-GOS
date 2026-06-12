import { describe, expect, it } from "vitest";

import type { StructuredCaller } from "../../section-agent";
import { runExecutiveBrief } from "../../executive-brief";
import {
  findContradictions,
  reconcileFactLedgerForMemo,
} from "../contradictions";
import {
  buildFactLedger,
  type SynthesisSectionInput,
} from "../fact-ledger";
import {
  auditPaidMediaFeasibility,
  closeFunnelMath,
  maxAbsorbableSpend,
} from "../feasibility";

function buildCaller(result: unknown): StructuredCaller {
  return async () => result;
}

function baseDecision(decision: string): {
  bestEvidence: { statement: string; sectionRef: string };
  confidenceBasis: string;
  confidenceGrade: "A";
  cost: string;
  decision: string;
  provesWrongIf: { metric: string; threshold: string; window: string };
} {
  return {
    bestEvidence: {
      sectionRef: "positioningDemandIntent",
      statement: "Demand section carries the evidence.",
    },
    confidenceBasis: "Fact ledger and feasibility audit agree.",
    confidenceGrade: "A",
    cost: "operator effort",
    decision,
    provesWrongIf: {
      metric: "trial starts",
      threshold: "below target",
      window: "30 days",
    },
  };
}

describe("Wave 3 synthesis layer", (): void => {
  it("selects subject-page pricing over model-stated readings and marks the price disputed", (): void => {
    const ledger = buildFactLedger({
      sections: [
        {
          body: {
            prose:
              "Airtable Business plan at $20/seat fits mid-market operators.",
          },
          sectionId: "positioningBuyerICP",
        },
        {
          body: {
            pricingReality: {
              prose:
                "Airtable publishes a Business plan at $45/seat billed annually.",
              sourceUrl: "https://airtable.com/pricing",
            },
          },
          sectionId: "positioningOfferDiagnostic",
        },
      ],
      subjectName: "Airtable",
      subjectWebsiteUrl: "https://airtable.com",
    });
    const fact = ledger.facts.find(
      (candidate) => candidate.factKey === "subject-price:business",
    );

    expect(fact?.disputed).toBe(true);
    expect(fact?.winner?.value).toBe("$45/seat");
    expect(fact?.winner?.basis).toBe("subject-own-page-sourced");
  });

  it("catches the $540 vs $5,400 ACV slip inside the market-category fixture shape", (): void => {
    const ledger = buildFactLedger({
      sections: [
        {
          body: {
            marketSize: {
              bottomUpTam: {
                inputs: [
                  {
                    inputType: "acv",
                    label: "Average annual contract value",
                    sourceUrl: "https://airtable.com/pricing",
                    value:
                      "$5,400 (Business plan at $45/seat x 10 seats x 12 months)",
                  },
                ],
              },
              prose:
                "Airtable paid-search revenue assumes a $540 ACV for the Business plan.",
            },
          },
          sectionId: "positioningMarketCategory",
        },
      ],
      subjectName: "Airtable",
      subjectWebsiteUrl: "https://airtable.com",
    });
    const acv = ledger.facts.find((fact) => fact.factKey === "acv");

    expect(acv?.disputed).toBe(true);
    expect(acv?.winner?.value).toBe("$5,400");
  });

  it("flags a higher-volume recommendation against a measured 90/mo category keyword", (): void => {
    const sections: SynthesisSectionInput[] = [
      {
        body: {
          keywordDemand: {
            keywords: [
              {
                intentType: "commercial",
                keyword: "low code app builder",
                monthlyVolumeValue: 90,
              },
            ],
          },
        },
        sectionId: "positioningDemandIntent",
      },
      {
        body: {
          strategicInsight: {
            keyTension: {
              side:
                "Buy the broader no-code app builder terms that carry higher volume.",
            },
          },
        },
        sectionId: "positioningMarketCategory",
      },
    ];
    const ledger = buildFactLedger({ sections, subjectName: "Airtable" });
    const contradictions = findContradictions({ ledger, sections });

    expect(
      contradictions.some(
        (contradiction) =>
          contradiction.kind === "strategic" &&
          contradiction.severity === "critical",
      ),
    ).toBe(true);
  });

  it("does not ingest review.removedItems as stripped claims", (): void => {
    // removedItems are model-asserted removal claims (often phantom), not
    // deterministic verifier strips — they must never seed the
    // inherited-stripped-claim scan.
    const sections: SynthesisSectionInput[] = [
      {
        body: { prose: "Demand source body." },
        review: {
          upgradedMarkdown: "Reviewed demand markdown.",
          tier: "needs_review",
          tierRationale: "Reviewer asserted a removal.",
          removedItems: ['Removed unsupported CPC claim: "$30 CPC"'],
          clientQuestions: [],
        },
        sectionId: "positioningDemandIntent",
      },
      {
        body: {
          campaignOverview: {
            prose: "Scale the campaign assuming $30 CPC.",
          },
        },
        sectionId: "positioningPaidMediaPlan",
      },
    ];
    const ledger = buildFactLedger({ sections, subjectName: "Airtable" });
    const contradictions = findContradictions({ ledger, sections });

    expect(
      contradictions.some(
        (contradiction) =>
          contradiction.kind === "inherited-stripped-claim",
      ),
    ).toBe(false);
  });

  it("flags a paid-media statement inherited from a stripped home-section claim", (): void => {
    const sections: SynthesisSectionInput[] = [
      {
        body: { prose: "Demand source body." },
        sectionId: "positioningDemandIntent",
        verifierSummary: {
          strippedNumericClaims: [
            {
              field: "body.keywordDemand.prose",
              value: "$30 CPC",
            },
          ],
        },
      },
      {
        body: {
          campaignOverview: {
            prose: "Scale the campaign assuming $30 CPC.",
          },
        },
        sectionId: "positioningPaidMediaPlan",
      },
    ];
    const ledger = buildFactLedger({ sections, subjectName: "Airtable" });
    const contradictions = findContradictions({ ledger, sections });

    expect(
      contradictions.some(
        (contradiction) =>
          contradiction.kind === "inherited-stripped-claim" &&
          contradiction.sections.includes("positioningPaidMediaPlan"),
      ),
    ).toBe(true);
  });

  it("regression: collapses five identical inherited price contradictions into one occurrence-counted contradiction", (): void => {
    const sections: SynthesisSectionInput[] = [
      {
        body: { prose: "Buyer source body." },
        sectionId: "positioningBuyerICP",
        verifierSummary: {
          strippedNumericClaims: [
            { field: "body.price.prose", value: "$20-$45" },
            { field: "body.price.prose", value: "$20-$45" },
            { field: "body.price.prose", value: "$20-$45" },
            { field: "body.price.prose", value: "$20-$45" },
            { field: "body.price.prose", value: "$20-$45" },
          ],
        },
      },
      {
        body: {
          pricing: {
            prose: "The memo should not reuse the $20-$45 price range.",
          },
        },
        sectionId: "positioningOfferDiagnostic",
      },
    ];
    const ledger = buildFactLedger({ sections, subjectName: "Airtable" });
    const contradictions = findContradictions({ ledger, sections });
    const inherited = contradictions.filter(
      (contradiction) =>
        contradiction.kind === "inherited-stripped-claim" &&
        contradiction.description.includes("$20-$45"),
    );

    expect(inherited).toHaveLength(1);
    expect(inherited[0]?.occurrenceCount).toBe(5);
    expect(inherited[0]?.resolution).toContain("set aside");
  });

  it("regression: keeps percentage readings out of customer-count contradictions", (): void => {
    const sections: SynthesisSectionInput[] = [
      {
        body: {
          buyerSignal: {
            prose: "Airtable says 50% of customers use workflow automation.",
          },
        },
        sectionId: "positioningBuyerICP",
      },
      {
        body: {
          companyScale: {
            prose: "Airtable serves 500,000 customers worldwide.",
          },
        },
        sectionId: "positioningOfferDiagnostic",
      },
    ];
    const ledger = buildFactLedger({ sections, subjectName: "Airtable" });
    const memoLedger = reconcileFactLedgerForMemo(ledger);
    const customerCount = memoLedger.facts.find(
      (fact) => fact.factKey === "customer-count",
    );
    const contradictions = findContradictions({ ledger, sections });

    expect(customerCount?.readings.map((reading) => reading.value)).toEqual([
      "500,000",
    ]);
    expect(
      contradictions.some(
        (contradiction) => contradiction.id === "numeric:customer-count",
      ),
    ).toBe(false);
  });

  it("regression: selects brief-supplied monthly budget over benchmark readings", (): void => {
    const sections: SynthesisSectionInput[] = [
      {
        body: {
          budget: {
            prose: "Client brief monthly media budget is $25,000.",
          },
        },
        sectionId: "positioningPaidMediaPlan",
      },
      {
        body: {
          benchmark: {
            prose: "Industry benchmark launch spend is $3,000 per month.",
          },
        },
        sectionId: "positioningMarketCategory",
      },
    ];
    const ledger = buildFactLedger({ sections, subjectName: "Airtable" });
    const memoLedger = reconcileFactLedgerForMemo(ledger);
    const monthlyBudget = memoLedger.facts.find(
      (fact) => fact.factKey === "monthly-budget",
    );
    const contradictions = findContradictions({ ledger, sections });
    const budgetContradiction = contradictions.find(
      (contradiction) => contradiction.id === "numeric:monthly-budget",
    );

    expect(monthlyBudget?.winner?.value).toBe("$25,000");
    expect(monthlyBudget?.winnerBasis).toContain("brief-supplied");
    expect(budgetContradiction?.resolution).toContain("$25,000");
    expect(budgetContradiction?.resolution).not.toContain("We use $3,000");
  });

  it("proves 2,820 searches cannot absorb a $10K monthly allocation under benchmark search math", (): void => {
    const ceiling = maxAbsorbableSpend({
      cpcRange: { basis: "benchmark", max: 12, min: 5 },
      ctrRange: { basis: "benchmark", max: 0.08, min: 0.02 },
      volume: 2_820,
    });
    const closure = closeFunnelMath({
      allocation: 10_000,
      cpcRange: { basis: "benchmark", max: 12, min: 5 },
      targetCostPerConversion: 150,
    });

    expect(ceiling.max).toBeLessThan(10_000);
    expect(closure.breakEvenConversionRate).toBeCloseTo(0.08);
  });

  it("audits paid-media audiences as exceeds when allocation is larger than the measured keyword ceiling", (): void => {
    const sections: SynthesisSectionInput[] = [
      {
        body: {
          keywordDemand: {
            keywords: [
              {
                intentType: "commercial",
                keyword: "airtable alternatives",
                monthlyVolumeValue: 930,
              },
              {
                intentType: "commercial",
                keyword: "airtable vs notion",
                monthlyVolumeValue: 660,
              },
              {
                intentType: "commercial",
                keyword: "notion vs airtable",
                monthlyVolumeValue: 540,
              },
              {
                intentType: "commercial",
                keyword: "airtable vs smartsheet",
                monthlyVolumeValue: 320,
              },
              {
                intentType: "commercial",
                keyword: "low code app builder",
                monthlyVolumeValue: 370,
              },
            ],
          },
        },
        sectionId: "positioningDemandIntent",
      },
    ];
    const ledger = buildFactLedger({ sections, subjectName: "Airtable" });
    const audit = auditPaidMediaFeasibility({
      factLedger: ledger,
      paidMediaBody: {
        audienceTypes: [
          {
            archetype: "Solution-aware search themes",
            dailyBudget: "$333/day",
            detail:
              "Buy 'airtable alternatives', 'airtable vs notion', 'notion vs airtable', 'airtable vs smartsheet', and 'low code app builder'.",
            grounding: "Combined ~2,820/mo search volume.",
          },
        ],
        projectedResults: [{ kpiCostValue: 150 }],
      },
    });

    expect(audit.verdicts[0]?.measuredVolume).toBe(2_820);
    expect(audit.verdicts[0]?.verdict).toBe("exceeds");
  });

  it("strips phantom memo numbers after one regenerate attempt", async (): Promise<void> => {
    const sections = [
      {
        body: { keyFindings: ["Demand exists."] },
        sectionId: "positioningDemandIntent",
        sectionTitle: "Demand",
        statusSummary: "Demand exists.",
        verdict: "Proceed carefully.",
      },
    ];
    const ledger = buildFactLedger({
      requiredSectionIds: ["positioningDemandIntent"],
      sections,
      subjectName: "Airtable",
    });
    const result = await runExecutiveBrief({
      callStructured: buildCaller({
        assumptionsToConfirm: [],
        decisions: [
          baseDecision("Buy the theme at $30 CPC."),
          baseDecision("Publish the comparison page."),
          baseDecision("Confirm the funnel."),
        ],
        thesis: "Spend into the wedge at $30 CPC. Move now.",
      }),
      companyName: "Airtable",
      companyWebsiteUrl: "https://airtable.com",
      conflicts: [],
      factLedger: ledger,
      model: {} as never,
      sections,
    });

    expect(result.thesis).not.toContain("$30");
    expect(result.decisions[0]?.decision).not.toContain("$30");
    expect(result.fidelityStrikes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "number-untraceable" }),
      ]),
    );
  });

  it("includes the run-level evidence pool in the executive memo prompt", async (): Promise<void> => {
    const sections = [
      {
        body: { keyFindings: ["Demand exists."] },
        sectionId: "positioningDemandIntent",
        sectionTitle: "Demand",
        statusSummary: "Demand exists.",
        verdict: "Proceed carefully.",
      },
    ];
    let capturedPrompt = "";
    const result = await runExecutiveBrief({
      callStructured: async (params) => {
        capturedPrompt = params.prompt;
        return {
          assumptionsToConfirm: [],
          decisions: [
            baseDecision("Publish the comparison page."),
            baseDecision("Confirm the funnel."),
            baseDecision("Measure trial quality."),
          ],
          thesis: "The report supports a cautious demand capture thesis.",
        };
      },
      companyName: "Airtable",
      companyWebsiteUrl: "https://airtable.com",
      conflicts: [],
      evidencePoolBlock:
        "Run-level evidence pool for executive memo\nEvidence 1: corpusExcerpt",
      model: {} as never,
      sections,
    });

    expect(result.thesis).toContain("cautious demand capture");
    expect(capturedPrompt).toContain("RUN-LEVEL EVIDENCE POOL:");
    expect(capturedPrompt).toContain(
      "Run-level evidence pool for executive memo",
    );
  });

  it("renders a memo with one required section absent and records the absence in the appendix ledger", async (): Promise<void> => {
    const sections = [
      {
        body: { keyFindings: ["Demand exists."] },
        sectionId: "positioningDemandIntent",
        sectionTitle: "Demand",
        statusSummary: "Demand exists.",
        verdict: "Proceed carefully.",
      },
    ];
    const ledger = buildFactLedger({
      requiredSectionIds: [
        "positioningDemandIntent",
        "positioningOfferDiagnostic",
      ],
      sections,
      subjectName: "Airtable",
    });
    const result = await runExecutiveBrief({
      callStructured: buildCaller({
        assumptionsToConfirm: [],
        decisions: [
          baseDecision("Publish the comparison page."),
          baseDecision("Confirm the funnel."),
          baseDecision("Measure trial quality."),
        ],
        thesis: "The report supports a cautious demand capture thesis.",
      }),
      companyName: "Airtable",
      companyWebsiteUrl: "https://airtable.com",
      conflicts: [],
      factLedger: ledger,
      model: {} as never,
      sections,
    });

    expect(result.thesis).toContain("cautious demand capture");
    expect(result.appendix.factLedger.absentSections).toContain(
      "positioningOfferDiagnostic",
    );
  });
});
