import { describe, expect, it } from "vitest";
import { validateGtmStageEventInsert } from "@/lib/gtm/stage-events";

describe("GTM stage events", () => {
  it("accepts a valid stage event", () => {
    expect(
      validateGtmStageEventInsert({
        run_id: "run_test",
        user_id: "user_test",
        stage: "research-competitors",
        event_type: "started",
        message: "Worker started research-competitors.",
        status: "running",
        created_at: "2026-04-30T10:00:00.000Z",
      })
    ).toMatchObject({
      run_id: "run_test",
      event_type: "started",
      status: "running",
    });
  });

  it("rejects an unknown event type", () => {
    expect(() =>
      validateGtmStageEventInsert({
        run_id: "run_test",
        user_id: "user_test",
        stage: "research-competitors",
        event_type: "thinking" as "started",
        message: "Invalid event.",
        status: "running",
      })
    ).toThrow();
  });
});
