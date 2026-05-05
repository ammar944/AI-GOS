import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StageEventLog } from "@/components/gtm/StageEventLog";
import type { GtmStageEvent } from "@/lib/gtm/stage-events";

describe("StageEventLog", () => {
  it("renders the empty state", () => {
    render(<StageEventLog events={[]} />);

    expect(screen.getByText("No stage events yet.")).toBeInTheDocument();
  });

  it("groups events by normalized canonical stage label", () => {
    render(
      <StageEventLog
        events={[
          makeEvent({
            id: "event_1",
            stage: "research-icp",
            event_type: "started",
            message: "Started legacy ICP research.",
            created_at: "2026-05-04T10:00:00.000Z",
          }),
          makeEvent({
            id: "event_2",
            stage: "research-buyer-icp",
            event_type: "completed",
            message: "Completed canonical ICP research.",
            status: "complete",
            created_at: "2026-05-04T10:05:00.000Z",
          }),
        ]}
      />,
    );

    expect(screen.getAllByText("research-icp")).toHaveLength(1);
    expect(screen.getByText("2 events")).toBeInTheDocument();
    expect(
      screen.getByText("Completed canonical ICP research."),
    ).toBeInTheDocument();
  });

  it("shows latest event message and event count per stage", () => {
    render(
      <StageEventLog
        events={[
          makeEvent({
            id: "event_1",
            stage: "discover-url",
            event_type: "started",
            message: "Started URL discovery.",
            created_at: "2026-05-04T09:00:00.000Z",
          }),
          makeEvent({
            id: "event_2",
            stage: "discover-url",
            event_type: "completed",
            message: "Completed URL discovery.",
            status: "complete",
            created_at: "2026-05-04T09:02:00.000Z",
          }),
        ]}
      />,
    );

    expect(screen.getByText("discover-url")).toBeInTheDocument();
    expect(screen.getByText("2 events")).toBeInTheDocument();
    expect(screen.getByText("Completed URL discovery.")).toBeInTheDocument();
  });

  it("summarizes tool calls, discovered sources, and output files per stage", () => {
    render(
      <StageEventLog
        events={[
          makeEvent({
            id: "event_tool",
            stage: "research-market",
            event_type: "tool_call",
            message: "Checked public pricing page.",
            tool_name: "agent:browser",
            source_url: "https://airtable.com/pricing",
            created_at: "2026-05-04T09:01:00.000Z",
          }),
          makeEvent({
            id: "event_artifact",
            stage: "research-market-category",
            event_type: "artifact_written",
            message: "report_file artifact recorded.",
            artifact_path: "/tmp/aigos-gtm-runs/run_test/research-market/report.md",
            created_at: "2026-05-04T09:02:00.000Z",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Tool/source context")).toBeInTheDocument();
    expect(screen.getByText("1 tool call")).toBeInTheDocument();
    expect(screen.getByText("1 source")).toBeInTheDocument();
    expect(screen.getByText("1 output file")).toBeInTheDocument();
    expect(screen.getByText("agent:browser")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /airtable.com/i }),
    ).toHaveAttribute("href", "https://airtable.com/pricing");
  });

  it("orders canonical stages before unknown stages", () => {
    render(
      <StageEventLog
        events={[
          makeEvent({
            id: "event_unknown",
            stage: "custom-stage",
            message: "Custom stage ran.",
            created_at: "2026-05-04T09:00:00.000Z",
          }),
          makeEvent({
            id: "event_competitors",
            stage: "research-competitor",
            message: "Competitor research ran.",
            created_at: "2026-05-04T09:01:00.000Z",
          }),
          makeEvent({
            id: "event_url",
            stage: "discover-url",
            message: "URL discovery ran.",
            created_at: "2026-05-04T09:02:00.000Z",
          }),
        ]}
      />,
    );

    const stageNames = screen
      .getAllByTestId("stage-event-log-stage")
      .map((stage) => stage.textContent);

    expect(stageNames).toEqual([
      "discover-url",
      "research-competitor",
      "custom-stage",
    ]);
  });

  it("emphasizes blocked, errored, and timed out events", () => {
    render(
      <StageEventLog
        events={[
          makeEvent({
            id: "event_blocked",
            stage: "discover-url",
            event_type: "blocked",
            message: "URL discovery blocked.",
            status: "blocked",
            created_at: "2026-05-04T09:00:00.000Z",
          }),
          makeEvent({
            id: "event_errored",
            stage: "research-market",
            event_type: "errored",
            message: "Market research errored.",
            status: "errored",
            created_at: "2026-05-04T09:01:00.000Z",
          }),
          makeEvent({
            id: "event_timed_out",
            stage: "research-competitor",
            event_type: "timed_out",
            message: "Competitor research timed out.",
            status: "timed_out",
            created_at: "2026-05-04T09:02:00.000Z",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Timed out")).toBeInTheDocument();
  });

  it("marks rerun queued events as recovery actions", () => {
    render(
      <StageEventLog
        events={[
          makeEvent({
            id: "event_rerun",
            stage: "research-icp",
            event_type: "queued",
            message: "User requested rerun for research-buyer-icp.",
            metadata: { rerun: true },
            created_at: "2026-05-04T09:00:00.000Z",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Recovery")).toBeInTheDocument();
    expect(
      screen.getByText("User requested rerun for research-buyer-icp."),
    ).toBeInTheDocument();
  });

  it("expands a stage to show the full event list in reverse chronological order", () => {
    render(
      <StageEventLog
        events={[
          makeEvent({
            id: "event_1",
            stage: "discover-url",
            event_type: "queued",
            message: "Queued URL discovery.",
            created_at: "2026-05-04T09:00:00.000Z",
          }),
          makeEvent({
            id: "event_2",
            stage: "discover-url",
            event_type: "started",
            message: "Started URL discovery.",
            created_at: "2026-05-04T09:01:00.000Z",
          }),
          makeEvent({
            id: "event_3",
            stage: "discover-url",
            event_type: "completed",
            message: "Completed URL discovery.",
            status: "complete",
            created_at: "2026-05-04T09:02:00.000Z",
          }),
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /expand discover-url event history/i }),
    );

    const list = screen.getByRole("list", {
      name: /discover-url full event history/i,
    });
    const events = within(list).getAllByRole("listitem");

    expect(events.map((event) => event.textContent)).toEqual([
      expect.stringContaining("Completed URL discovery."),
      expect.stringContaining("Started URL discovery."),
      expect.stringContaining("Queued URL discovery."),
    ]);
  });
});

function makeEvent(
  overrides: Partial<GtmStageEvent> & Pick<GtmStageEvent, "id" | "stage" | "message">,
): GtmStageEvent {
  return {
    run_id: "run_test",
    user_id: "user_test",
    event_type: "started",
    status: "running",
    metadata: {},
    created_at: "2026-05-04T09:00:00.000Z",
    ...overrides,
  };
}
