import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourceLedger } from "@/components/gtm/SourceLedger";
import type { GtmRunSourceLedger } from "@/lib/gtm/source-ledger";

const ledger: GtmRunSourceLedger = {
  evidence_count: 3,
  source_count: 2,
  source_gap_count: 1,
  groups: [
    {
      source_type: "web_page",
      label: "Web pages",
      source_count: 1,
      sources: [
        {
          key: "url:https://example.com/",
          source_type: "web_page",
          label: "Example homepage",
          origin_label: "example.com",
          url: "https://example.com/",
          confidence: "high",
          trust_level: "external",
          trust_label: "External source",
          retrieved_at: "2026-05-01T09:00:00.000Z",
          observed_at: undefined,
          evidence_ids: ["evidence-company", "evidence-icp"],
          quote_snippets: ["Example is an AI GTM workspace."],
          claim_refs: [
            {
              claim_path: ["companyIdentity", "companyName"],
              claim_path_label: "companyIdentity.companyName",
              section: "companyIdentity",
              section_label: "Company Identity",
            },
            {
              claim_path: ["icp", "jobTitles"],
              claim_path_label: "icp.jobTitles",
              section: "icp",
              section_label: "ICP",
            },
          ],
        },
      ],
    },
    {
      source_type: "user_input",
      label: "User input",
      source_count: 1,
      sources: [
        {
          key: "user:evidence-user-goal",
          source_type: "user_input",
          label: "Founder kickoff answer",
          origin_label: "User provided",
          confidence: "medium",
          trust_level: "user_provided",
          trust_label: "User-provided provenance",
          retrieved_at: undefined,
          observed_at: undefined,
          evidence_ids: ["evidence-user-goal"],
          quote_snippets: [],
          claim_refs: [
            {
              claim_path: ["goal", "campaignObjective"],
              claim_path_label: "goal.campaignObjective",
              section: "goal",
              section_label: "Goal",
            },
          ],
        },
      ],
    },
  ],
  source_gaps: [
    {
      id: "gap-market",
      claim_path: ["market", "category"],
      claim_path_label: "market.category",
      section: "market",
      section_label: "Market",
      severity: "degraded",
      reason: "No third-party category source was attached.",
    },
  ],
};

describe("SourceLedger", () => {
  it("groups sources by type and shows claim path references", () => {
    render(<SourceLedger ledger={ledger} />);

    expect(
      screen.getByRole("heading", { name: /source ledger/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Web pages")).toBeInTheDocument();
    expect(screen.getByText("Example homepage")).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();
    expect(screen.getByText("companyIdentity.companyName")).toBeInTheDocument();
    expect(screen.getByText("icp.jobTitles")).toBeInTheDocument();
  });

  it("differentiates user input from external verification", () => {
    render(<SourceLedger ledger={ledger} />);

    expect(screen.getByText("Founder kickoff answer")).toBeInTheDocument();
    expect(screen.getByText("User-provided provenance")).toBeInTheDocument();
    expect(screen.getByText("Not external verification")).toBeInTheDocument();
  });

  it("keeps source details inspectable without showing raw JSON by default", () => {
    render(<SourceLedger ledger={ledger} />);

    expect(screen.queryByText("evidence-company")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /inspect example homepage/i }));
    expect(screen.getByText("evidence-company")).toBeInTheDocument();
    expect(screen.getByText("Example is an AI GTM workspace.")).toBeInTheDocument();
  });

  it("renders source gaps as explicit unsupported claim states", () => {
    render(<SourceLedger ledger={ledger} />);

    expect(screen.getByText("Source gaps")).toBeInTheDocument();
    expect(screen.getByText("market.category")).toBeInTheDocument();
    expect(
      screen.getByText("No third-party category source was attached."),
    ).toBeInTheDocument();
  });

  it("renders a clear empty state when no evidence is attached yet", () => {
    render(
      <SourceLedger
        ledger={{
          evidence_count: 0,
          source_count: 0,
          source_gap_count: 0,
          groups: [],
          source_gaps: [],
        }}
      />,
    );

    expect(screen.getByText("No source evidence attached yet")).toBeInTheDocument();
  });
});
