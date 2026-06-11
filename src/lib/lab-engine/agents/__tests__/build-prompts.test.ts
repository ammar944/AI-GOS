import { describe, expect, it } from "vitest";

import type { ResearchInput } from "@/lib/lab-engine/artifacts/artifact-envelope";
import type { CompetitorAdEvidenceGroup } from "@/lib/lab-engine/artifacts/schemas/competitor-landscape";
import { saaslaunchResearchInput } from "@/lib/lab-engine/fixtures/saaslaunch";
import { SECTION_REGISTRY } from "@/lib/lab-engine/sections/section-registry";
import {
  buildAnswerToolInstructions,
  buildClientIdentityPin,
  buildOnboardingStrategicFrame,
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

const buyerICPDefinition = {
  title: "Buyer & ICP Validation",
  mission: "Pin down validated named buyer identities and buying context.",
  outputEmphasis: ["validated ICP"],
  sectionOutputSchemaName: "BuyerICPSectionOutput",
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
        positioningPaidMediaPlan: [],
      },
    },
  };
}

describe("buildAnswerToolInstructions", (): void => {
  it("pins the client identity beside section context for every registered section", (): void => {
    const expectedPin = buildClientIdentityPin(saaslaunchResearchInput);

    for (const sectionDefinition of Object.values(SECTION_REGISTRY)) {
      const answerPrompt = buildAnswerToolInstructions(
        sectionDefinition,
        saaslaunchResearchInput,
      );
      const structuredBodyPrompt = buildStructuredBodyPrompt({
        definition: sectionDefinition,
        researchInput: saaslaunchResearchInput,
        skillMd: "Use section-specific guidance.",
      });
      const structuredPrompt = buildStructuredPrompt({
        definition: sectionDefinition,
        evidenceTranscript: "source evidence",
        researchInput: saaslaunchResearchInput,
        skillMd: "Use section-specific guidance.",
      });

      expect(answerPrompt).toContain(expectedPin);
      expect(structuredBodyPrompt).toContain(expectedPin);
      expect(structuredPrompt).toContain(expectedPin);
      expect(answerPrompt.indexOf(expectedPin)).toBeLessThan(
        answerPrompt.indexOf("ResearchInput JSON:"),
      );
      expect(structuredBodyPrompt.indexOf(expectedPin)).toBeLessThan(
        structuredBodyPrompt.indexOf("ResearchInput JSON:"),
      );
      expect(structuredPrompt.indexOf(expectedPin)).toBeLessThan(
        structuredPrompt.indexOf("ResearchInput JSON:"),
      );
    }
  });

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

  it("spells out the Market Category reader contract without quota floors", (): void => {
    const prompt = buildAnswerToolInstructions(
      definition,
      saaslaunchResearchInput,
    );

    expect(prompt).toContain("Reader contract:");
    expect(prompt).not.toContain("Validator checklist:");
    expect(prompt).toContain("Lead the body with `keyFindings`");
    expect(prompt).toContain(
      "Populate adjacent categories, market signals, structural forces, and maturity signals only when fetched evidence supports them",
    );
    expect(prompt).toContain("`body.strategicInsight` is required");
    expect(prompt).toContain("`body.categoryPowerBet { bet, whyNow, riskAccepted }`");
    expect(prompt).toContain("`body.marketSize.bottomUpTam.recipeName`");
    expect(prompt).toContain("keyword-demand-reachable-revenue");
    expect(prompt).toContain(
      "If multiple inputs are gaps, state `directional only — not computed`",
    );
  });

  it("injects only the section-scoped corpus excerpts into the prompt", (): void => {
    const prompt = buildAnswerToolInstructions(
      definition,
      buildScopedResearchInput(),
    );

    expect(prompt).toContain("Market-only category evidence");
    expect(prompt).toContain("onboardingStrategicFrame");
    expect(prompt).toContain("target CAC=$4,500");
    expect(prompt).toContain("sets the paid-learning efficiency boundary");
    expect(prompt).not.toContain('"onboarding":');
    expect(prompt).not.toContain('"economics":');
    expect(prompt).not.toContain("Buyer-only persona evidence");
    expect(prompt).not.toContain("sectionExcerpts");
  });

  it("builds a bounded strategic frame from onboarding economics", (): void => {
    const frame = buildOnboardingStrategicFrame(buildScopedResearchInput());

    expect(frame).toContain("Primary objective:");
    expect(frame).toContain("monthly ad budget=$25,000");
    expect(frame).toContain("target CAC=$4,500");
    expect(frame).toContain("(unknown)");
    expect(frame).toContain("sets the paid-learning efficiency boundary");
    expect(frame).not.toContain('"economics"');
    expect(frame).not.toContain("{");
  });

  it("adds shared capability-gap guidance only when tools are available", (): void => {
    const toolPrompt = buildAnswerToolInstructions(
      definition,
      saaslaunchResearchInput,
      undefined,
      { externalToolNames: ["firecrawl", "web_search"] },
    );
    const noToolPrompt = buildAnswerToolInstructions(
      paidMediaDefinition,
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
    // Budget exhaustion is its own honest reason, never narrated as rate limiting.
    expect(toolPrompt).toContain("budget_exhausted");
    expect(toolPrompt).toContain("do not narrate this in prose");
    expect(noToolPrompt).not.toContain("Capability gaps:");
    expect(noToolPrompt).not.toContain(
      "share the generic `maxExternalLookups` pool",
    );
  });

  it("spells out Competitor Landscape weakness gap guidance", (): void => {
    const prompt = buildAnswerToolInstructions(
      competitorDefinition,
      saaslaunchResearchInput,
    );

    expect(prompt).toContain(
      "Populate positioning axes, pricing reality, share of voice, public weaknesses, narrative arcs, ad presence, and ad evidence only when evidence supports them",
    );
    expect(prompt).toContain(
      "use the block gap otherwise",
    );
  });

  it("spells out Competitor Landscape subject-derived competitor guidance", (): void => {
    const prompt = buildAnswerToolInstructions(
      competitorDefinition,
      saaslaunchResearchInput,
    );

    expect(prompt).toContain(
      "Competitor categories are evidence claims",
    );
    expect(prompt).toContain(
      "Subject-derived current-workflow competitors must come from this subject's actual buyer context",
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

  it("carries ad identity metadata in the compact ad evidence prompt", (): void => {
    const normalizedAdEvidenceGroups: CompetitorAdEvidenceGroup[] = [
      {
        advertiserName: "Notion",
        domain: "notion.so",
        platforms: ["meta"],
        rawCounts: { google: 0, meta: 41, linkedin: 0 },
        displayableCounts: { google: 0, meta: 41, linkedin: 0 },
        displayableTotal: 41,
        returnedCreativeCount: 1,
        verifiedCount: 0,
        quarantinedCount: 41,
        identityConfidence: "low",
        creatives: [
          {
            id: "notion-q1",
            platform: "meta",
            advertiserName: "Notion",
            headline: "All-in-one workspace",
            body: null,
            landingUrl: null,
            creativeUrl: null,
            imageUrl: null,
            videoUrl: null,
            detailsUrl: null,
            sourceUrl: "https://www.facebook.com/ads/library/?id=notion-q1",
            firstSeen: null,
            lastSeen: null,
            format: "text",
            isActive: true,
            source: null,
            transcript: null,
            cta: null,
            verified: false,
            identityBasis: "name_only",
          },
        ],
        libraryLinks: {
          meta: "https://www.facebook.com/ads/library/?q=Notion",
        },
        rawSourceSamples: [],
        dataGaps: [
          {
            reason:
              "Identity-unverified ad signals only: verifiedCount=0; quarantinedCount=41.",
          },
        ],
        sourceErrors: [],
        observedAt: "2026-06-10T00:00:00.000Z",
      },
    ];
    const prompt = buildStructuredBodyPrompt({
      definition: competitorDefinition,
      externalToolNames: ["meta_ads"],
      normalizedAdEvidenceGroups,
      researchInput: saaslaunchResearchInput,
      skillMd: "Use live competitor evidence.",
    });

    expect(prompt).toContain(
      "Quarantine-tier creatives are identity-unverified signals",
    );
    expect(prompt).toContain('"identityConfidence": "low"');
    expect(prompt).toContain('"verifiedCount": 0');
    expect(prompt).toContain('"quarantinedCount": 41');
    expect(prompt).toContain('"verified": false');
    expect(prompt).toContain('"identityBasis": "name_only"');
  });

  it("repeats Competitor Landscape weakness gap guidance in repair prompts", (): void => {
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
      "Populate positioning axes, pricing reality, share of voice, public weaknesses, narrative arcs, ad presence, and ad evidence only when evidence supports them",
    );
    expect(prompt).toContain(
      "use the block gap otherwise",
    );
  });

  it("repeats Competitor Landscape subject-derived competitor guidance in repair prompts", (): void => {
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
      "Competitor categories are evidence claims",
    );
    expect(prompt).toContain(
      "Subject-derived current-workflow competitors must come from this subject's actual buyer context",
    );
  });

  it("forbids BuyerICP role-label persona padding in prompt guidance", (): void => {
    const prompt = buildAnswerToolInstructions(
      buyerICPDefinition,
      saaslaunchResearchInput,
    );

    expect(prompt).not.toContain(
      "If evidence has only a role or segment, make `name` a role/segment label",
    );
    expect(prompt).toContain(
      "`body.personaReality.personas[].name` must be a named person, public reviewer handle, or named source identity present in fetched evidence",
    );
    expect(prompt).toContain(
      "Each persona row is allowed only when the exact `name` string appears in fetched tool evidence or a corpus excerpt",
    );
    expect(prompt).toContain(
      "Role labels, segments, departments, seniority labels, and company names do not satisfy `body.personaReality.personas[].name`",
    );
    expect(prompt).toContain(
      "If no named buyer identity exists in the fetched evidence, use `body.personaReality.blockGap` instead of padding persona rows",
    );
  });

  it("adds BuyerICP persona-name repair guidance when validation flags placeholder names", (): void => {
    const prompt = buildRepairPrompt({
      definition: buyerICPDefinition,
      evidenceTranscript: "source evidence",
      issues: [
        "body.personaReality.personas[4].name: must be a named person, public reviewer handle, or named source identity; generic role/segment/company labels do not qualify.",
      ],
      previousOutput: {
        body: {
          personaReality: {
            personas: [{ name: "Finance leaders" }],
          },
        },
      },
      researchInput: saaslaunchResearchInput,
      skillMd: "Use the injected corpus only.",
    });

    expect(prompt).toContain("BuyerICP persona-name repair");
    expect(prompt).toContain(
      "Replace invalid persona rows only with another exact identity observed",
    );
    expect(prompt).toContain(
      "Never repair by copying `title`, `role`, `seniority`, `company`, `targetCustomer`, or `targetSegments` into `name`",
    );
  });

  it("repeats Competitor Landscape incumbent blind-spot strategic repair guidance", (): void => {
    const prompt = buildRepairPrompt({
      definition: competitorDefinition,
      evidenceTranscript: "source evidence",
      issues: [
        'body.incumbentBlindSpot.incumbent: must be a specific strategic judgment or write exactly `evidence gap: <missing signal>`, not a summary/restatement. Do not satisfy "specific" with numbers that are not in fetched evidence - unsupported numeric precision is treated as fabrication.',
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
      issues: ["body.campaignPhases.0.phaseName is required"],
      previousOutput: { body: { campaignPhases: [] } },
      researchInput: saaslaunchResearchInput,
      skillMd: "Use the injected corpus only.",
    });

    expect(prompt).toContain(
      "Emit the lean 12-block body only",
    );
    expect(prompt).toContain(
      "Do NOT emit `strategicThesis`, `contradictionReconciliation`, or `orderedMoves`",
    );
    expect(prompt).toContain(
      "`body.crossSectionInsight[]` carries tensions",
    );
    expect(prompt).toContain(
      "`body.campaignPhases[]` rows have",
    );
    expect(prompt).toContain(
      "`body.audienceTypes[]` rows have",
    );
    expect(prompt).toContain(
      "`body.creativeFramework[]` rows have",
    );
    expect(prompt).toContain(
      "`body.channelSuggestions[]` rows use verdict `FIX`, `REWORK`, `REVIEW`, `KEEP`, `ADD`, `KILL`, or `SCALE`",
    );
    expect(prompt).toContain(
      "Paid-media money provenance fields are free strings; prefer",
    );
    expect(prompt).toContain(
      "Omit numeric siblings when the number is unknown or weakly inferred",
    );
    expect(prompt).toContain(
      "`body.salesProcess[]` should use supplied sales assets; if none were supplied, emit one explicit gap asset",
    );
    expect(prompt).toContain("never invent spend");
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
      definition: paidMediaDefinition,
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
    // Budget exhaustion is its own honest reason, never narrated as rate limiting.
    expect(toolPrompt).toContain("budget_exhausted");
    expect(toolPrompt).toContain("do not narrate this in prose");
    expect(noToolPrompt).not.toContain("Capability gaps:");
    expect(noToolPrompt).not.toContain(
      "share the generic `maxExternalLookups` pool",
    );
  });

  it("adds lean strategist guidance for paid media", (): void => {
    const paidMediaPrompt = buildStructuredPrompt({
      definition: paidMediaDefinition,
      evidenceTranscript: "Committed artifacts are available in ResearchInput.",
      researchInput: saaslaunchResearchInput,
      skillMd: "# Paid Media Plan",
    });

    expect(paidMediaPrompt).toContain("Emit the lean 12-block body only");
    expect(paidMediaPrompt).toContain(
      "Do NOT emit `strategicThesis`, `contradictionReconciliation`, or `orderedMoves`",
    );
    expect(paidMediaPrompt).toContain("body.crossSectionInsight[]");
    expect(paidMediaPrompt).toContain("contrarianInversion");
    expect(paidMediaPrompt).toContain(
      "`body.anglesToTest[]` contains distinct creative angles",
    );
    expect(paidMediaPrompt).toContain(
      "`body.creativeFramework[]` rows have",
    );
    expect(paidMediaPrompt).toContain(
      "`body.channelSuggestions[]` rows use verdict `FIX`, `REWORK`, `REVIEW`, `KEEP`, `ADD`, `KILL`, or `SCALE`",
    );
    expect(paidMediaPrompt).toContain(
      "Each angle row has `shortName`, `description`, free-string `angleType`, `sourceSection`, and exact `grounding`",
    );
    expect(paidMediaPrompt).toContain(
      "`body.creativeFramework[]` rows have `label`, `angleType`, deployable `hook`, `executesAngle`, `sourceSection`, and `grounding`",
    );
    expect(paidMediaPrompt).toContain("never invent quotes");
  });

  it("carries paid-media budget and platform constraints through the real prompt chain", (): void => {
    const researchInput: ResearchInput = {
      ...buildScopedResearchInput(),
      onboarding: {
        ...buildScopedResearchInput().onboarding,
        distributionChannels: ["Meta Ads", "LinkedIn Ads"],
        gtmMotion: "PLG",
      },
    };
    const paidMediaPrompt = buildStructuredPrompt({
      definition: paidMediaDefinition,
      evidenceTranscript: "Committed artifacts are available in ResearchInput.",
      researchInput,
      skillMd: "# Paid Media Plan",
    });

    expect(paidMediaPrompt).toContain("monthly ad budget=$25,000");
    expect(paidMediaPrompt).toContain(
      "sets the paid-learning efficiency boundary",
    );
    expect(paidMediaPrompt).toContain(
      "Distribution channels: Meta Ads, LinkedIn Ads.",
    );
    expect(paidMediaPrompt).toContain("GTM motion: PLG.");
    expect(paidMediaPrompt).toContain("body.campaignOverview");
    expect(paidMediaPrompt).toContain("platform");
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
