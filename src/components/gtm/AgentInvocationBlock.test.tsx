import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AgentInvocationBlock,
  type IngestUrlOutput,
} from "@/components/gtm/AgentInvocationBlock";
import type {
  IngestIdentityOutput,
  ResearchCompetitorOutput,
  ResearchIcpOutput,
  ResearchMarketOutput,
  SourceGap,
} from "@/lib/gtm/types";
import discoverUrlFixture from "@/components/gtm/__fixtures__/discover-url.airtable.example.json";

const discoverUrlOutput = discoverUrlFixture as IngestUrlOutput;

const outputWithoutSourceGaps: IngestUrlOutput = {
  ...discoverUrlOutput,
  source_gaps: [],
};

const sourceGap: SourceGap = {
  field: "market_size",
  reason: "No direct sizing source was found.",
  remediation: "Provide an analyst report or accept parent-market context.",
  severity: "warn",
  confidence: 7,
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
  market_size_signals: [],
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
  positioning_taxonomy: [
    {
      name: "Notion",
      problem_framing_verbatim: "One workspace for every team.",
      solution_framing_verbatim:
        "Your connected workspace for wiki, docs, and projects.",
      source_url: "https://www.notion.so/",
      retrieved_at: "2026-04-30T09:00:00.000Z",
    },
  ],
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
  review_mined_feedback: [
    {
      name: "Notion",
      verbatim_quote: "Easy to organize team docs.",
      source_site: "g2",
      polarity: "positive",
      source_url: "https://www.g2.com/products/notion/reviews",
      retrieved_at: "2026-04-30T09:00:00.000Z",
    },
  ],
  competitor_narrative_arc: [],
  paid_social_ad_inventory: [
    {
      name: "Notion",
      active_ad_count: 3,
      run_duration_range: "2026-04",
      formats: ["image"],
      hook_strings_verbatim: ["One workspace"],
      cta_patterns: ["Get started"],
      ad_library_url: "https://www.facebook.com/ads/library/",
      source_url: "https://www.facebook.com/ads/library/",
      retrieved_at: "2026-04-30T09:00:00.000Z",
    },
  ],
  paid_search_ad_inventory: [],
  ad_activity_signals: [],
  organic_vs_paid_narrative_delta: [],
  source_gaps: [],
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

describe("AgentInvocationBlock", () => {
  it("renders the skill name", () => {
    render(
      <AgentInvocationBlock
        status="running"
        invocation={{ skill: "discover-url" }}
      />
    );

    expect(screen.getByText("discover-url")).toBeInTheDocument();
  });

  it("shows live research affordance with tool, source, and gap context", () => {
    render(
      <AgentInvocationBlock
        status="running"
        invocation={{
          skill: "research-competitor",
          summary: "Mining competitor sources.",
          output: researchCompetitorOutput,
          toolCalls: [{ name: "agent:browser" }],
        }}
      />,
    );

    expect(screen.getByText("Researching")).toBeInTheDocument();
    expect(screen.getByText("Mining competitor sources.")).toBeInTheDocument();
    expect(screen.getByText("1 tool call")).toBeInTheDocument();
    expect(screen.getByText(/sources checked/i)).toBeInTheDocument();
    expect(screen.getByText("No source gaps reported")).toBeInTheDocument();
  });

  it("does not make completed model-only output look source-backed", () => {
    render(
      <AgentInvocationBlock
        status="complete"
        invocation={{
          skill: "research-market",
          output: {
            run_id: "run_test",
            stage: "research-market",
            generated_at: "2026-04-30T09:00:00.000Z",
            source_gaps: [],
            insights: [],
            key_facts: {},
          },
        }}
      />,
    );

    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.getByText("No source evidence attached")).toBeInTheDocument();
    expect(screen.getByText("No source gaps reported")).toBeInTheDocument();
  });

  it("surfaces worker errors instead of saying output was omitted", () => {
    render(
      <AgentInvocationBlock
        status="errored"
        invocation={{
          skill: "discover-url",
          error:
            "GTM worker is unreachable at http://localhost:3001 while dispatching stage=discover-url run_id=run_test.",
        }}
      />
    );

    expect(
      screen.getByText(
        "Worker failed before discover-url produced validated output."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Run Details")).toBeInTheDocument();
    expect(
      screen.getByText(
        "GTM worker is unreachable at http://localhost:3001 while dispatching stage=discover-url run_id=run_test."
      )
    ).toBeInTheDocument();
  });

  it("keeps the body hidden when collapsed", () => {
    render(
      <AgentInvocationBlock
        status="complete"
        invocation={{ skill: "discover-url", output: outputWithoutSourceGaps }}
      />
    );

    expect(screen.queryByText("Prefilled Fields")).not.toBeInTheDocument();
    expect(screen.queryByText("Company Name")).not.toBeInTheDocument();
  });

  it("shows prefilled values after expansion", () => {
    render(
      <AgentInvocationBlock
        status="complete"
        invocation={{ skill: "discover-url", output: outputWithoutSourceGaps }}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Expand discover-url" })
    );

    expect(screen.getByText("Prefilled Fields")).toBeInTheDocument();
    expect(screen.getByText("Company Name")).toBeInTheDocument();
    expect(screen.getByText("Company URL")).toBeInTheDocument();
  });

  it("default-expands complete output with blocker source gaps", () => {
    render(
      <AgentInvocationBlock
        status="complete"
        invocation={{ skill: "discover-url", output: discoverUrlOutput }}
      />
    );

    expect(screen.getByText("Source Gaps")).toBeInTheDocument();
    expect(screen.getByText("productDescription")).toBeInTheDocument();
  });

  it("renders ingest-identity key fields", () => {
    render(
      <AgentInvocationBlock
        status="complete"
        invocation={{ skill: "ingest-identity", output: ingestIdentityOutput }}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Expand ingest-identity" })
    );

    expect(screen.getByText("Airtable")).toBeInTheDocument();
    expect(screen.getByText("airtable.com")).toBeInTheDocument();
    expect(screen.getByText("Collaborative app platform")).toBeInTheDocument();
  });

  it("renders research-market key fields", () => {
    render(
      <AgentInvocationBlock
        status="complete"
        invocation={{ skill: "research-market", output: researchMarketOutput }}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Expand research-market" })
    );

    expect(screen.getByText("Market Summary")).toBeInTheDocument();
    expect(screen.getByText("Category is broad and competitive.")).toBeInTheDocument();
    expect(screen.getByText(/market_size/)).toBeInTheDocument();
  });

  it("renders research-competitor key fields", () => {
    render(
      <AgentInvocationBlock
        status="complete"
        invocation={{
          skill: "research-competitor",
          output: researchCompetitorOutput,
        }}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Expand research-competitor" })
    );

    expect(screen.getByText("Competitor Table")).toBeInTheDocument();
    expect(screen.getAllByText("Notion").length).toBeGreaterThan(0);
    expect(screen.getByText("Plus: $10/user/month")).toBeInTheDocument();
    expect(screen.getByText("Positioning")).toBeInTheDocument();
    expect(screen.getByText("Review Signals")).toBeInTheDocument();
    expect(screen.getByText("Ad Signals")).toBeInTheDocument();
  });

  it("renders worker artifact details", () => {
    render(
      <AgentInvocationBlock
        status="complete"
        invocation={{
          skill: "research-competitor",
          output: researchCompetitorOutput,
          artifacts: {
            report_file: "/tmp/aigos-gtm-runs/run_test/report.html",
            output_file: "/tmp/aigos-gtm-runs/run_test/output.json",
          },
          toolCalls: [{ name: "agent:agent-api" }],
          durationMs: 12_000,
        }}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Expand research-competitor" })
    );

    expect(screen.getByText("Run Details")).toBeInTheDocument();
    expect(screen.getByText("report_file")).toBeInTheDocument();
    expect(
      screen.getByText("/tmp/aigos-gtm-runs/run_test/report.html")
    ).toBeInTheDocument();
  });

  it("renders research-icp key fields", () => {
    render(
      <AgentInvocationBlock
        status="complete"
        invocation={{ skill: "research-icp", output: researchIcpOutput }}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Expand research-icp" })
    );

    expect(screen.getByText("Persona Anchors")).toBeInTheDocument();
    expect(screen.getByText("Operations leader")).toBeInTheDocument();
    expect(screen.getByText("Head of Operations")).toBeInTheDocument();
  });

  it("renders a fallback for non-lighthouse skill arms", () => {
    render(
      <AgentInvocationBlock
        status="complete"
        invocation={{ skill: "synthesize-positioning" }}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Expand synthesize-positioning" })
    );

    expect(
      screen.getByText("synthesize-positioning rendering is not wired.")
    ).toBeInTheDocument();
  });
});
