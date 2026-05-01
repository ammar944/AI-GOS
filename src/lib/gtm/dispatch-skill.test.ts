import { generateObject } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchSkill } from "@/lib/gtm/dispatch-skill";
import { IngestUrlOutputValidationError } from "@/lib/gtm/skills/ingest-url";
import type {
  IngestIdentityOutput,
  IngestUrlOutput,
  ResearchCompetitorOutput,
  ResearchIcpOutput,
  ResearchMarketOutput,
  SourceGap,
} from "@/lib/gtm/types";

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@/lib/gtm/skill-model", () => ({
  getGtmSkillLanguageModel: vi.fn(
    () => "mock-ollama:deepseek-v4-flash:cloud"
  ),
}));

const mockGenerateObject = vi.mocked(generateObject);

const sourceGap: SourceGap = {
  field: "pricing",
  reason: "Pricing was not publicly visible.",
  remediation: "Provide pricing material or approve this as a gap.",
  severity: "warn",
  confidence: 7,
};

const validOutput: IngestUrlOutput = {
  run_id: "run_test",
  stage: "discover-url",
  input_url: "https://airtable.com/",
  canonical_url: {
    value: "https://airtable.com/",
    source_url: "https://airtable.com/",
    retrieved_at: "2026-04-30T09:00:00.000Z",
  },
  company_name: {
    value: "Airtable",
    source_url: "https://airtable.com/",
    retrieved_at: "2026-04-30T09:00:00.000Z",
  },
  discovered_pages: [
    {
      url: "https://airtable.com/",
      page_type: "homepage",
      title: {
        value: "Airtable",
        source_url: "https://airtable.com/",
        retrieved_at: "2026-04-30T09:00:00.000Z",
      },
    },
  ],
  prefilled_fields: [
    {
      field_key: "companyName",
      label: "Company Name",
      value: "Airtable",
      confidence: "high",
      evidence: [
        {
          value: "Airtable",
          source_url: "https://airtable.com/",
          retrieved_at: "2026-04-30T09:00:00.000Z",
        },
      ],
      reason: "The homepage names Airtable directly.",
    },
  ],
  unresolved_fields: ["pricingTiers"],
  source_gaps: [
    {
      field: "pricingTiers",
      reason: "Pricing tiers were not verified from a pricing page.",
      remediation: "Fetch the pricing page or provide a pricing sheet.",
      severity: "warn",
      confidence: 8,
    },
  ],
  generated_at: "2026-04-30T09:00:00.000Z",
};

const ingestIdentityOutput: IngestIdentityOutput = {
  run_id: "run_test",
  stage: "ingest-identity",
  company_name: "Airtable",
  domain: "airtable.com",
  category: "Collaborative app platform",
  core_keywords: ["airtable", "collaborative database"],
  negative_keywords: ["air table furniture"],
  sources: [
    {
      source_url: "https://airtable.com/",
      retrieved_at: "2026-04-30T09:00:00.000Z",
      describes: "company identity",
    },
  ],
  source_gaps: [],
  generated_at: "2026-04-30T09:00:00.000Z",
};

const researchMarketOutput: ResearchMarketOutput = {
  run_id: "run_test",
  stage: "research-market",
  source_company_name: "Airtable",
  source_company: {
    name: "Airtable",
    url: "https://airtable.com/",
    declared_category: "Collaborative app platform",
  },
  market_scope: {
    subject_company: "Airtable",
    category: "Collaborative app platform",
    excluded_scopes: ["furniture"],
  },
  category_definition: {
    category_name: "Collaborative app platform",
    status: "direct_sized",
    definition: "Tools for teams to build shared workflows on structured data.",
    adjacent_categories: ["project management"],
    claim: "Airtable competes in collaborative app platforms.",
    source_url: "https://airtable.com/",
    retrieved_at: "2026-04-30T09:00:00.000Z",
  },
  market_size_signals: [
    {
      label: "tam_context",
      market_scope: "collaborative work management",
      value: "$10B+",
      basis: "parent_market_context",
      caveats: ["Parent-market context only."],
      source_url: "https://example.com/market",
      retrieved_at: "2026-04-30T09:00:00.000Z",
    },
  ],
  category_maturity: {
    maturity: "growing",
    observable_signals: ["multiple scaled vendors"],
    claim: "The category has multiple scaled vendors.",
    source_url: "https://example.com/category",
    retrieved_at: "2026-04-30T09:00:00.000Z",
  },
  timing_signals: [],
  demand_drivers: [],
  buying_triggers: [],
  adoption_barriers: [],
  category_pain_points: {
    primary: [],
    secondary: [],
    triggers: [],
  },
  competitive_intensity: {
    intensity: "high",
    observable_signals: [],
    caveats: ["Competitor depth requires the competitor stage."],
  },
  opportunity_candidates: [],
  summary: "Airtable sits in a growing collaborative app platform category.",
  key_findings: ["Category is broad and competitive."],
  source_gaps: [sourceGap],
  generated_at: "2026-04-30T09:00:00.000Z",
};

const researchCompetitorOutput: ResearchCompetitorOutput = {
  run_id: "run_test",
  stage: "research-competitor",
  source_company_name: "Airtable",
  competitor_set: [
    {
      name: "Airtable",
      type: "subject",
      source_url: "https://airtable.com/",
      retrieved_at: "2026-04-30T09:00:00.000Z",
    },
    {
      name: "Notion",
      type: "direct",
      source_url: "https://www.notion.so/",
      retrieved_at: "2026-04-30T09:00:00.000Z",
    },
  ],
  positioning_taxonomy: [],
  pricing_reality: [
    {
      name: "Notion",
      public_prices: ["Plus: $10/user/month"],
      gated_pricing_signals: ["Enterprise requires sales contact"],
      packaging_notes: "AI is sold as an add-on.",
      source_url: "https://www.notion.so/pricing",
      retrieved_at: "2026-04-30T09:00:00.000Z",
    },
  ],
  share_of_voice: {
    search_terms_owned: ["workspace"],
    communities_owned: [],
    publications_owned: [],
    evidence_per_claim: [],
    source_url: "https://example.com/sov",
    retrieved_at: "2026-04-30T09:00:00.000Z",
  },
  review_mined_feedback: [],
  competitor_narrative_arc: [],
  paid_social_ad_inventory: [],
  paid_search_ad_inventory: [],
  ad_activity_signals: [],
  organic_vs_paid_narrative_delta: [],
  source_gaps: [sourceGap],
  generated_at: "2026-04-30T09:00:00.000Z",
};

const researchIcpOutput: ResearchIcpOutput = {
  run_id: "run_test",
  stage: "research-icp",
  company_name: "Airtable",
  category: "Collaborative app platform",
  persona_anchors: [
    {
      persona_name: "Operations leader",
      role_family: "Operations",
      company_context: [
        {
          claim: "Operations teams use Airtable to coordinate workflows.",
          source_url: "https://airtable.com/solutions/operations",
          retrieved_at: "2026-04-30T09:00:00.000Z",
        },
      ],
      pains: [],
      triggers: [],
      objections: [],
      current_alternatives: [],
    },
  ],
  awareness_stages: [
    {
      stage: "solution_aware",
      evidence: [],
      message_implication: "Buyers compare flexible workflow systems.",
    },
  ],
  job_titles: [
    {
      title: "Head of Operations",
      buying_role: "champion",
      source_url: "https://airtable.com/solutions/operations",
      retrieved_at: "2026-04-30T09:00:00.000Z",
    },
  ],
  search_intent: [],
  buying_committee_notes: [],
  exclusions: [],
  source_gaps: [],
  generated_at: "2026-04-30T09:00:00.000Z",
};

describe("dispatchSkill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the validated ingest-url dispatch result shape", async () => {
    mockGenerateObject.mockResolvedValueOnce({ object: validOutput } as never);

    const result = await dispatchSkill("ingest-url", {
      input_url: "https://airtable.com/",
      run_id: "run_test",
    });

    expect(result).toEqual({
      output: validOutput,
      source_gaps: validOutput.source_gaps,
    });
    expect(result.output.stage).toBe("discover-url");
    expect(result.output.run_id).toBe("run_test");
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "mock-ollama:deepseek-v4-flash:cloud",
        schemaName: "IngestUrlOutput",
        temperature: 0,
        experimental_repairText: expect.any(Function),
      })
    );
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(
          "You must return JSON matching this IngestUrlOutput contract"
        ),
      })
    );
  });

  it("throws a typed error when ingest-url output fails schema validation", async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        ...validOutput,
        stage: "ingest-url",
      },
    } as never);

    await expect(
      dispatchSkill("ingest-url", {
        input_url: "https://airtable.com/",
        run_id: "run_test",
      })
    ).rejects.toBeInstanceOf(IngestUrlOutputValidationError);
  });

  it("returns the validated ingest-identity dispatch result shape", async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: ingestIdentityOutput,
    } as never);

    const result = await dispatchSkill("ingest-identity", {
      input_url: "https://airtable.com/",
      run_id: "run_test",
      prior_stages: {
        "ingest-url": {
          status: "complete",
          output: validOutput,
        },
      },
    });

    expect(result).toEqual({
      output: ingestIdentityOutput,
      source_gaps: ingestIdentityOutput.source_gaps,
    });
    expect(result.output.stage).toBe("ingest-identity");
  });

  it("returns the validated research-market dispatch result shape", async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: researchMarketOutput,
    } as never);

    const result = await dispatchSkill("research-market", {
      input_url: "https://airtable.com/",
      run_id: "run_test",
      prior_stages: {},
    });

    expect(result).toEqual({
      output: researchMarketOutput,
      source_gaps: researchMarketOutput.source_gaps,
    });
    expect(result.output.stage).toBe("research-market");
  });

  it("returns the validated research-competitor dispatch result shape", async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: researchCompetitorOutput,
    } as never);

    const result = await dispatchSkill("research-competitor", {
      input_url: "https://airtable.com/",
      run_id: "run_test",
      prior_stages: {},
    });

    expect(result).toEqual({
      output: researchCompetitorOutput,
      source_gaps: researchCompetitorOutput.source_gaps,
    });
    expect(result.output.stage).toBe("research-competitor");
  });

  it("returns the validated research-icp dispatch result shape", async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: researchIcpOutput,
    } as never);

    const result = await dispatchSkill("research-icp", {
      input_url: "https://airtable.com/",
      run_id: "run_test",
      prior_stages: {},
    });

    expect(result).toEqual({
      output: researchIcpOutput,
      source_gaps: researchIcpOutput.source_gaps,
    });
    expect(result.output.stage).toBe("research-icp");
  });

  it("throws not implemented for unknown skill names", async () => {
    await expect(
      dispatchSkill("synthesize-positioning", {
        input_url: "https://airtable.com/",
        run_id: "run_test",
      })
    ).rejects.toThrow("not implemented");
  });
});
