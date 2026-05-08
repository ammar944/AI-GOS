import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeAll } from "vitest";

import { JourneyAgentChat } from "@/components/journey/journey-agent-chat";

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const baseProps = {
  websiteUrl: "research airtable.com",
  onWebsiteUrlChange: vi.fn(),
  onSubmitWebsite: vi.fn(),
  activeRunId: "journey-test-123",
  companyName: "Airtable",
  phase: "workspace" as const,
  deepResearchStatus: "complete" as const,
  deepResearchError: null,
  deepResearchFields: {},
  researchActivity: {},
  researchResults: {},
  messages: [],
};

describe("JourneyAgentChat — 3-stage artifact rendering", () => {
  it("Stage 1 (corpus-building): renders chain-of-thought + terminal, no report artifact", () => {
    render(
      <JourneyAgentChat
        {...baseProps}
        deepResearchStatus="starting"
        artifactStage="corpus-building"
        researchActivity={{
          deepResearchProgram: {
            jobId: "job-deep",
            section: "deepResearchProgram",
            status: "running",
            tool: "runDeepResearchProgram",
            startedAt: "2026-05-07T09:00:00.000Z",
            updates: [
              {
                at: "2026-05-07T09:00:01.000Z",
                id: "tool-log-1",
                message: "Opened Airtable product page.",
                phase: "tool",
                meta: {
                  toolName: "web_search",
                  url: "https://www.airtable.com/product",
                },
              },
            ],
          },
        }}
      />,
    );

    // The user URL command bubble is always present
    expect(screen.getByTestId("journey-user-command")).toBeInTheDocument();

    // Stage 1 surfaces: chain-of-thought + corpus terminal
    expect(screen.getByTestId("journey-chain-of-thought")).toBeInTheDocument();
    expect(screen.getByTestId("journey-corpus-terminal")).toBeInTheDocument();
    expect(screen.getByTestId("journey-corpus-terminal")).toHaveTextContent(
      "https://www.airtable.com/product",
    );

    // The report artifact pane MUST NOT render in corpus-building
    expect(
      screen.queryByTestId("deep-research-report-artifact"),
    ).not.toBeInTheDocument();
    // Nor the section queue
    expect(screen.queryByTestId("journey-section-queue")).not.toBeInTheDocument();
  });

  it("Stage 2 (onboarding-review): renders the field review card with AI-filled badges", () => {
    render(
      <JourneyAgentChat
        {...baseProps}
        artifactStage="onboarding-review"
        deepResearchFields={{
          companyName: "Airtable",
          businessModel: "B2B SaaS",
        }}
        nextSectionLabel="Industry Research"
        onRunNextSection={vi.fn()}
      />,
    );

    const reviewCard = screen.getByTestId("journey-onboarding-review");
    expect(reviewCard).toBeInTheDocument();

    // Both prefilled values render
    expect(reviewCard).toHaveTextContent("Airtable");
    expect(reviewCard).toHaveTextContent("B2B SaaS");

    // Each populated field is wrapped in a labelled testid
    expect(
      screen.getByTestId("journey-onboarding-field-companyName"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("journey-onboarding-field-businessModel"),
    ).toBeInTheDocument();

    // The "AI filled" badge appears for each filled field
    expect(screen.getAllByText(/AI filled/i).length).toBeGreaterThanOrEqual(2);

    // The corpus terminal does NOT render — corpus is done
    expect(screen.queryByTestId("journey-corpus-terminal")).not.toBeInTheDocument();
    // The section queue does NOT render until a section starts
    expect(screen.queryByTestId("journey-section-queue")).not.toBeInTheDocument();
  });

  it("Stage 3 (section-streaming): renders queue with 7 entries and the artifact panel", () => {
    render(
      <JourneyAgentChat
        {...baseProps}
        artifactStage="section-streaming"
        nextSectionLabel="ICP Validation"
        onRunNextSection={vi.fn()}
        deepResearchFields={{ companyName: "Airtable" }}
        researchResults={{
          industryMarket: {
            status: "complete",
            section: "industryMarket",
            durationMs: 12,
            data: {
              statusSummary: "Market section saved.",
            },
          },
        }}
      />,
    );

    const queue = screen.getByTestId("journey-section-queue");
    expect(queue).toBeInTheDocument();

    // All 7 boundary-id sections appear
    const expectedSections = [
      "industryMarket",
      "icpValidation",
      "competitors",
      "offerAnalysis",
      "keywordIntel",
      "crossAnalysis",
      "mediaPlan",
    ];
    for (const section of expectedSections) {
      expect(
        screen.getByTestId(`journey-queue-item-${section}`),
      ).toBeInTheDocument();
    }

    // industryMarket should reflect a completed state
    expect(
      screen.getByTestId("journey-queue-item-industryMarket"),
    ).toHaveAttribute("data-state", "complete");

    // The artifact panel renders in Stage 3
    expect(
      screen.getByTestId("deep-research-report-artifact"),
    ).toBeInTheDocument();
  });

  it("Operator-click contract: clicking Run section calls onRunNextSection exactly once", () => {
    const onRunNextSection = vi.fn();

    render(
      <JourneyAgentChat
        {...baseProps}
        artifactStage="section-streaming"
        nextSectionLabel="Industry Research"
        onRunNextSection={onRunNextSection}
        researchResults={{}}
      />,
    );

    const runButton = screen.getByRole("button", {
      name: /Run next research section: Industry Research/i,
    });

    fireEvent.click(runButton);

    expect(onRunNextSection).toHaveBeenCalledTimes(1);
  });
});
