import { describe, expect, it } from "vitest";
import {
  determineGtmRunStatus,
  recoverStaleRunningStages,
  type GtmStoredStageState,
} from "@/lib/gtm/stage-state";

describe("GTM stage state", () => {
  it("marks stale running stages as timed_out", () => {
    const stages: Record<string, GtmStoredStageState> = {
      "research-competitors": {
        status: "running",
        started_at: "2026-04-30T10:00:00.000Z",
      },
    };

    const result = recoverStaleRunningStages({
      stages,
      now: new Date("2026-04-30T10:11:00.000Z"),
      timeoutMs: 10 * 60 * 1000,
    });

    expect(result.recovered).toEqual([
      {
        stage: "research-competitors",
        started_at: "2026-04-30T10:00:00.000Z",
        timed_out_at: "2026-04-30T10:11:00.000Z",
      },
    ]);
    expect(result.stages["research-competitors"]?.status).toBe("timed_out");
  });

  it("keeps a run running when any lighthouse stage is active", () => {
    expect(
      determineGtmRunStatus(
        {
          "discover-url": { status: "complete" },
          "discover-identity": { status: "running" },
        },
        ["discover-url", "discover-identity"]
      )
    ).toBe("running");
  });
});
