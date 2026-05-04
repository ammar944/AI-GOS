import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  GtmRunVisibilityPanel,
  type GtmRunVisibilityPanelData,
  type GtmRunVisibilityStageStatus,
} from "@/components/gtm/GtmRunVisibilityPanel";

describe("GtmRunVisibilityPanel rerun action", () => {
  it.each(["blocked", "errored", "timed_out"] as const)(
    "renders Rerun stage for %s stages",
    (status) => {
      render(<GtmRunVisibilityPanel visibility={makeVisibility(status)} />);

      expect(
        screen.getByRole("button", { name: /rerun stage/i }),
      ).toBeInTheDocument();
    },
  );

  it.each(["complete", "running", "queued", "pending"] as const)(
    "does not render Rerun stage for %s stages",
    (status) => {
      render(<GtmRunVisibilityPanel visibility={makeVisibility(status)} />);

      expect(
        screen.queryByRole("button", { name: /rerun stage/i }),
      ).not.toBeInTheDocument();
    },
  );

  it("calls onRerunStage with the target stage key", () => {
    const onRerunStage = vi.fn();

    render(
      <GtmRunVisibilityPanel
        visibility={makeVisibility("blocked")}
        onRerunStage={onRerunStage}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /rerun stage/i }));

    expect(onRerunStage).toHaveBeenCalledWith("research-buyer-icp");
  });

  it("shows loading and inline error state for the rerunning stage", () => {
    render(
      <GtmRunVisibilityPanel
        visibility={makeVisibility("blocked")}
        rerunningStage="research-buyer-icp"
        rerunError="Stage is already queued."
      />,
    );

    expect(
      screen.getByRole("button", { name: /rerunning/i }),
    ).toBeDisabled();
    expect(screen.getByText("Stage is already queued.")).toBeInTheDocument();
  });
});

function makeVisibility(
  status: GtmRunVisibilityStageStatus,
): GtmRunVisibilityPanelData {
  return {
    runStatus: status === "complete" ? "completed" : "awaiting_user",
    eventCount: 1,
    blockerCount:
      status === "blocked" || status === "errored" || status === "timed_out"
        ? 1
        : 0,
    stages: [
      {
        stage: "research-buyer-icp",
        label: "research-icp",
        status,
        latestEvent: {
          message: "Worker blocked research-buyer-icp.",
          createdAt: "2026-05-04T05:10:00.000Z",
          eventType: "blocked",
        },
        blocker:
          status === "blocked"
            ? {
                title: "Stage blocked",
                reason: "Agent exited 0 but produced no output.",
              }
            : null,
        pendingDependencyReason: null,
        elapsedMs: null,
      },
    ],
  };
}
