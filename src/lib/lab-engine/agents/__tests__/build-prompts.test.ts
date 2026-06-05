import { describe, expect, it } from "vitest";

import type { ResearchInput } from "@/lib/lab-engine/artifacts/artifact-envelope";
import { saaslaunchResearchInput } from "@/lib/lab-engine/fixtures/saaslaunch";
import {
  buildAnswerToolInstructions,
  buildRepairPrompt,
  buildSectionObjectiveRecap,
  buildStructuredBodyPrompt,
  buildStructuredPrompt,
  type PromptSectionDefinition,
} from "../build-prompts";

const definition = {
  title: "Market & Category Intelligence",
  mission: "Define the category and market forces.",
  outputEmphasis: ["category definition"],
  sectionOutputSchemaName: "MarketCategorySectionOutput",
} satisfies PromptSectionDefinition;

const competitorDefinition = {
  title: "Competitor Landscape & Positioning",
  mission: "Map the competitive set and positioning claims.",
  outputEmphasis: ["competitor set"],
  sectionOutputSchemaName: "CompetitorLandscapeSectionOutput",
} satisfies PromptSectionDefinition;

const paidMediaDefinition = {
  title: "Paid Media Plan",
  mission: "Synthesize the six positioning artifacts.",
  outputEmphasis: ["campaign overview"],
  sectionOutputSchemaName: "PaidMediaPlanSectionOutput",
} satisfies PromptSectionDefinition;

const demandIntentDefinition = {
  title: "Demand Intent",
  mission: "Map keyword demand and intent signals.",
  outputEmphasis: ["keyword demand"],
  sectionOutputSchemaName: "DemandIntentSectionOutput",
} satisfies PromptSectionDefinition;

const synthesisDefinition = {
  title: "Positioning Synthesis",
  mission: "Synthesize the committed positioning artifacts.",
  outputEmphasis: ["recommended move"],
  sectionOutputSchemaName: "PositioningSynthesisSectionOutput",
} satisfies PromptSectionDefinition;

const crossSectionReasoningDefinition = {
  title: "Cross-Section Reasoning",
  mission: "Find non-obvious strategic threads across committed artifacts.",
  outputEmphasis: ["cross-section threads"],
  sectionOutputSchemaName: "CrossSectionReasoningSectionOutput",
} satisfies PromptSectionDefinition;

function buildScopedResearchInput(): ResearchInput {
  const marketExcerpt = {
    id: "excerpt_market",
    sourceId: "source_market",
    sourceUrl: "https://example.com/market",
    title: "Market excerpt",
    text: "Market-only category evidence for the current section.",
    observedAt: "2026-05-25T12:00:00.000Z",
  };
  const buyerExcerpt = {
    id: "excerpt_buyer",
    sourceId: "source_buyer",
    sourceUrl: "https://example.com/buyer",
    title: "Buyer excerpt",
    text: "Buyer-only persona evidence that should not enter the market prompt.",
    observedAt: "2026-05-25T12:00:00.000Z",
  };

  return {
    ...saaslaunchResearchInput,
    onboarding: {
      ...saaslaunchResearchInput.onboarding,
      economics: {
        targetCac: "$4,500",
        avgLtv: "$18,000",
        monthlyAdBudget: "$25,000",
      },
    },
    corpus: {
      excerpts: [marketExcerpt, buyerExcerpt],
      sectionExcerpts: {
        positioningMarketCategory: [marketExcerpt],
        positioningBuyerICP: [buyerExcerpt],
        positioningCompetitorLandscape: [],
        positioningVoiceOfCustomer: [],
        positioningDemandIntent: [],
        positioningOfferDiagnostic: [],
        positioningCrossSectionReasoning: [],
        positioningSynthesis: [],
        positioningPaidMediaPlan: [],
      },
    },
  };
}

describe("buildAnswerToolInstructions", (): void => {
  it("adds schema-bound answer-tool guidance for DeepSeek mode", (): void => {
    const prompt = buildAnswerToolInstructions(
      definition,
      saaslaunchResearchInput,
      undefined,
      { inputSchemaMode: "section-schema" },
    );

    expect(prompt).toContain(
      "The answer tool input schema is bound to the full section schema for this model.",
    );
  });

  it("spells out Market Category validator cardinality minimums", (): void => {
    const prompt = buildAnswerToolInstructions(
      definition,
      saaslaunchResearchInput,
    );

    expect(prompt).toContain(
      "`body.marketSize.signals` must include at least three public trajectory signals",
    );
    expect(prompt).toContain("`body.strategicInsight` is required");
    expect(prompt).toContain("`body.categoryPowerBet { bet, whyNow, riskAccepted }`");
    expect(prompt).toContain("`body.marketSize.bottomUpTam.recipeName`");
    expect(prompt).toContain("keyword-demand-reachable-revenue");
    expect(prompt).toContain(
      "`body.categoryMaturity.classification.supportingSignals` must include at least two maturity signals",
    );
  });

  it("injects only the section-scoped corpus excerpts into the prompt", (): void => {
    const prompt = buildAnswerToolInstructions(
      definition,
      buildScopedResearchInput(),
    );

    expect(prompt).toContain("Market-only category evidence");
    expect(prompt).toContain('"economics"');
    expect(prompt).toContain('"targetCac": "$4,500"');
    expect(prompt).not.toContain("Buyer-only persona evidence");
    expect(prompt).not.toContain("sectionExcerpts");
  });

  it("adds shared capability-gap guidance only when tools are available", (): void => {
    const toolPrompt = buildAnswerToolInstructions(
      definition,
      saaslaunchResearchInput,
      undefined,
      { externalToolNames: ["firecrawl", "web_search"] },
    );
    const noToolPrompt = buildAnswerToolInstructions(
      synthesisDefinition,
      saaslaunchResearchInput,
      undefined,
      { externalToolNames: [] },
    );

    expect(toolPrompt).toContain("Capability gaps:");
    expect(toolPrompt).toContain(
      "share the generic `maxExternalLookups` pool",
    );
    expect(toolPrompt).toContain("additive reserved ad-tool pool");
    expect(toolPrompt).not.toContain("independent per-channel caps");
    expect(toolPrompt).toContain("rate_limited");
    expect(noToolPrompt).not.toContain("Capability gaps:");
    expect(noToolPrompt).not.toContain(
      "share the generic `maxExternalLookups` pool",
    );
  });

  it("spells out Competitor Landscape weakness coverage minimums", (): void => {
    const prompt = buildAnswerToolInstructions(
      competitorDefinition,
      saaslaunchResearchInput,
    );

    expect(prompt).toContain(
      "`body.publicWeaknesses.items` must include at least four verbatim weaknesses",
    );
    expect(prompt).toContain(
      "`body.publicWeaknesses.items` must cover at least two distinct competitors",
    );
  });

  it("spells out Competitor Landscape status-quo bucket guidance", (): void => {
    const prompt = buildAnswerToolInstructions(
      competitorDefinition,
      saaslaunchResearchInput,
    );

    expect(prompt).toContain(
      "`status-quo` means the buyer's current non-purchase workflow",
    );
    expect(prompt).toContain(
      "call out any thin evidence in prose instead of dropping the bucket",
    );
  });

  it("tells Competitor Landscape to avoid unfetched URLs and numerics", (): void => {
    const prompt = buildStructuredBodyPrompt({
      definition: competitorDefinition,
      externalToolNames: ["web_search", "firecrawl"],
      researchInput: saaslaunchResearchInput,
      skillMd: "Use live competitor evidence.",
    });

    expect(prompt).toContain(
      "cite only competitor URLs and numeric pricing/deal values that appear in fetched tool evidence",
    );
    expect(prompt).toContain("mark it as an evidence gap");
  });

  it("repeats Competitor Landscape weakness coverage minimums in repair prompts", (): void => {
    const prompt = buildRepairPrompt({
      definition: competitorDefinition,
      evidenceTranscript: "source evidence",
      issues: [
        "body.publicWeaknesses.items: need weaknesses across >=2 competitors, have 1.",
      ],
      previousOutput: { body: { publicWeaknesses: { items: [] } } },
      researchInput: saaslaunchResearchInput,
      skillMd: "Use the injected corpus only.",
    });

    expect(prompt).toContain(
      "`body.publicWeaknesses.items` must include at least four verbatim weaknesses",
    );
    expect(prompt).toContain(
      "`body.publicWeaknesses.items` must cover at least two distinct competitors",
    );
  });

  it("repeats Competitor Landscape status-quo bucket guidance in repair prompts", (): void => {
    const prompt = buildRepairPrompt({
      definition: competitorDefinition,
      evidenceTranscript: "source evidence",
      issues: [
        "body.competitorSet.competitors: missing competitor types status-quo.",
      ],
      previousOutput: { body: { competitorSet: { competitors: [] } } },
      researchInput: saaslaunchResearchInput,
      skillMd: "Use the injected corpus only.",
    });

    expect(prompt).toContain(
      "`status-quo` means the buyer's current non-purchase workflow",
    );
    expect(prompt).toContain(
      "call out any thin evidence in prose instead of dropping the bucket",
    );
  });

  it("repeats Competitor Landscape incumbent blind-spot strategic repair guidance", (): void => {
    const prompt = buildRepairPrompt({
      definition: competitorDefinition,
      evidenceTranscript: "source evidence",
      issues: [
        "body.incumbentBlindSpot.incumbent: must be a specific strategic judgment or explicit evidence gap, not a summary/restatement.",
      ],
      previousOutput: {
        body: {
          incumbentBlindSpot: {
            incumbent: "This section summarizes the competitive landscape.",
            blindSpot: "This section summarizes the competitive landscape.",
            whyTheyMissIt: "This section summarizes the competitive landscape.",
          },
        },
      },
      researchInput: saaslaunchResearchInput,
      skillMd: "Use the injected corpus only.",
    });

    expect(prompt).toContain("`body.incumbentBlindSpot.incumbent`");
    expect(prompt).toContain("name the incumbent/status-quo");
    expect(prompt).toContain("buyer pain or positioning miss");
    expect(prompt).toContain("`evidence gap: <missing incumbent/status-quo signal>`");
  });

  it("renders unsupported load-bearing claim issues in repair prompts", (): void => {
    const issue =
      'numeric claim "$99/mo" is not supported by any fetched source or corpus excerpt - cite a real source for it or remove it / restate it as a data gap.';
    const prompt = buildRepairPrompt({
      definition,
      evidenceTranscript: "source evidence",
      issues: [issue],
      previousOutput: { body: { marketSize: { signals: [] } } },
      researchInput: saaslaunchResearchInput,
      skillMd: "Use the injected corpus only.",
    });

    expect(prompt).toContain(issue);
  });

  it("spells out Demand Intent keyword numeric sibling contracts", (): void => {
    const prompt = buildAnswerToolInstructions(
      demandIntentDefinition,
      saaslaunchResearchInput,
    );

    expect(prompt).toContain(
      "`body.keywordDemand.keywords[]` keys are `keyword`, `monthlyVolume`, optional `monthlyVolumeValue`, optional `cpc`, optional `cpcValue`, optional `difficulty`",
    );
    expect(prompt).toContain(
      "when `keyword_volume` returns data for a keyword, set `monthlyVolumeValue` to `searchVolume`, `cpcValue` to `cpc`, and `difficulty` to `difficulty` as nonnegative numbers",
    );
    expect(prompt).toContain(
      "If `keyword_volume` returns a gap/rate-limit/no row, call `keyword_trends`",
    );
    expect(prompt).toContain(
      "relative interest 42/100 (SearchAPI Google Trends)",
    );
    expect(prompt).toContain("`body.orderedMoves[]` requires at least two");
    expect(prompt).toContain("`body.provesWrongIf { metric, threshold, window }`");
    expect(prompt).toContain("MUST NOT use model-estimated keyword economics");
    expect(prompt).toContain("Do not invent sortable numbers");
  });

  it("spells out Paid Media Plan nested field contracts", (): void => {
    const prompt = buildRepairPrompt({
      definition: paidMediaDefinition,
      evidenceTranscript: "source evidence",
      issues: ["body.campaignPhases.phases.0.phaseName is required"],
      previousOutput: { body: { campaignPhases: { phases: [] } } },
      researchInput: saaslaunchResearchInput,
      skillMd: "Use the injected corpus only.",
    });

    expect(prompt).toContain(
      "`body.campaignPhases` is an object with `prose` and `phases[]`",
    );
    expect(prompt).toContain(
      "`body.kpis` keys are exactly `prose`, `gtmMotion`, `kpis`",
    );
    expect(prompt).toContain(
      "`body.competitorMarketingInsights.competitors[].anglesTested` is a single string",
    );
    expect(prompt).toContain(
      "Paid-media money fields must include provenance labels",
    );
    expect(prompt).toContain(
      "Optional paid-media numeric siblings are machine-sortable numbers",
    );
    expect(prompt).toContain(
      "add numeric siblings only when they come from user-supplied economics, tool-measured data, source-reported data, or explicit scenario assumptions with corresponding provenance",
    );
    expect(prompt).toContain(
      "Omit numeric siblings when the number is unknown or weakly inferred",
    );
    expect(prompt).toContain(
      "Numeric siblings must not duplicate provenance in strings",
    );
    expect(prompt).toContain(
      "`body.campaignOverview` keys are exactly `prose`, `monthlyBudget`, optional `monthlyBudgetValue`, `monthlyBudgetProvenance`, `totalMonths`, `phaseCount`, `dailySpend`, optional `dailySpendValue`, `dailySpendProvenance`, `primaryKpi`, `platform`",
    );
    expect(prompt).toContain(
      "`body.campaignPhases` is an object with `prose` and `phases[]`; each phase has exactly `phaseName`, `monthsLabel`, `monthlyBudget`, optional `monthlyBudgetValue`, `monthlyBudgetProvenance`, `bullets`",
    );
    expect(prompt).toContain(
      "`body.audienceTypes` is an object with `prose` and `audiences[]`; each audience has exactly `slot`, `archetype`, `dailyBudget`, optional `dailyBudgetValue`, `dailyBudgetProvenance`, `detail`, `sourceSection`, `sourceUrl`",
    );
    expect(prompt).toContain(
      "Competitor `estSpend` remains string-only; never emit `estSpendValue`",
    );
  });
});

describe("buildStructuredBodyPrompt", (): void => {
  it("requires authored verdict and statusSummary alongside body", (): void => {
    const prompt = buildStructuredBodyPrompt({
      definition,
      externalToolNames: [],
      researchInput: saaslaunchResearchInput,
      skillMd: "Use section-specific market guidance.",
    });

    expect(prompt).toContain('"verdict": "..."');
    expect(prompt).toContain('"statusSummary": "..."');
    expect(prompt).toContain('"sources": [{ "title": "...", "url": "https://...", "publisher": "..." }]');
    expect(prompt).toContain('"body": {');
    expect(prompt).toContain(
      "Author `verdict` and `statusSummary` as distinct reader-facing fields",
    );
    expect(prompt).toContain(
      "Author top-level `sources` with distinct cited public URLs",
    );
    expect(prompt).not.toContain("Return ONLY the section body object.");
    expect(prompt).not.toContain("Do not include `sectionTitle`, `verdict`, `statusSummary`");
  });
});

describe("buildStructuredPrompt", (): void => {
  it("adds shared capability-gap guidance only when tools are available", (): void => {
    const toolPrompt = buildStructuredPrompt({
      definition,
      evidenceTranscript: "source evidence",
      externalToolNames: ["firecrawl", "web_search"],
      researchInput: saaslaunchResearchInput,
      skillMd: "Use section-specific market guidance.",
    });
    const noToolPrompt = buildStructuredPrompt({
      definition: synthesisDefinition,
      evidenceTranscript: "source evidence",
      externalToolNames: [],
      researchInput: saaslaunchResearchInput,
      skillMd: "Use committed artifacts only.",
    });

    expect(toolPrompt).toContain("Capability gaps:");
    expect(toolPrompt).toContain(
      "share the generic `maxExternalLookups` pool",
    );
    expect(toolPrompt).toContain("additive reserved ad-tool pool");
    expect(toolPrompt).not.toContain("independent per-channel caps");
    expect(toolPrompt).toContain("rate_limited");
    expect(noToolPrompt).not.toContain("Capability gaps:");
    expect(noToolPrompt).not.toContain(
      "share the generic `maxExternalLookups` pool",
    );
  });

  it("adds Cross-Section Reasoning thinker guidance", (): void => {
    const prompt = buildStructuredPrompt({
      definition: crossSectionReasoningDefinition,
      evidenceTranscript: "Committed artifacts are available in ResearchInput.",
      researchInput: saaslaunchResearchInput,
      skillMd: "# Cross-Section Reasoning",
    });

    expect(prompt).toContain("CrossSectionReasoningSectionOutput");
    expect(prompt).toContain("sourceSections[]");
    expect(prompt).toContain("never use `gtmBrief`");
    expect(prompt).toContain("cover at least four of the six");
  });

  it("adds T9 strategist guidance for synthesis and paid media capstones", (): void => {
    const synthesisPrompt = buildStructuredPrompt({
      definition: synthesisDefinition,
      evidenceTranscript: "Thinker artifact is available in ResearchInput.",
      researchInput: saaslaunchResearchInput,
      skillMd: "# Positioning Synthesis",
    });
    const paidMediaPrompt = buildStructuredPrompt({
      definition: paidMediaDefinition,
      evidenceTranscript: "Thinker artifact is available in ResearchInput.",
      researchInput: saaslaunchResearchInput,
      skillMd: "# Paid Media Plan",
    });

    for (const prompt of [synthesisPrompt, paidMediaPrompt]) {
      expect(prompt).toContain("body.strategicThesis");
      expect(prompt).toContain("body.contradictionReconciliation");
      expect(prompt).toContain("body.orderedMoves");
      expect(prompt).toContain("thesisTrace");
      expect(prompt).toContain("provesWrongIf");
    }
    expect(synthesisPrompt).toContain(
      "this plan bets that [segment] at [awareness]",
    );
    expect(paidMediaPrompt).toContain(
      "Ordered move ranks are positive integers starting at 1",
    );
  });
});

describe("buildSectionObjectiveRecap", (): void => {
  it("recites the section objective and grounding rule for the recent-attention tail", (): void => {
    const recap = buildSectionObjectiveRecap(definition, saaslaunchResearchInput);

    expect(recap).toContain("re-anchor before you answer");
    expect(recap).toContain(definition.title);
    expect(recap).toContain(definition.mission);
    expect(recap).toContain("Ground every card in fetched tool evidence");
  });
});
