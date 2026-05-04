import { describe, expect, it } from "vitest";
import {
  getGtmStageLabel,
  getInvocationSkillForStage,
  normalizeGtmLighthouseStage,
} from "@/lib/gtm/stage-mapping";

describe("GTM stage mapping", () => {
  it("normalizes legacy frontend names to canonical worker stage keys", () => {
    expect(normalizeGtmLighthouseStage("ingest-url")).toBe("discover-url");
    expect(normalizeGtmLighthouseStage("ingest-identity")).toBe(
      "discover-identity"
    );
    expect(normalizeGtmLighthouseStage("research-market")).toBe(
      "research-market-category"
    );
    expect(normalizeGtmLighthouseStage("research-competitor")).toBe(
      "research-competitors"
    );
    expect(normalizeGtmLighthouseStage("research-icp")).toBe(
      "research-buyer-icp"
    );
  });

  it("maps canonical worker stage keys back to friendly invocation labels", () => {
    expect(getInvocationSkillForStage("research-competitors")).toBe(
      "research-competitor"
    );
    expect(getGtmStageLabel("research-buyer-icp")).toBe("research-icp");
  });
});
