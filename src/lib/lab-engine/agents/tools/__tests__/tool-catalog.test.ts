import { describe, expect, it } from "vitest";

import { TOOL_CATALOG } from "../index";

describe("TOOL_CATALOG", (): void => {
  it("does not register dead capability tools with no lab-section consumers", (): void => {
    expect(TOOL_CATALOG).not.toHaveProperty("ga4");
    expect(TOOL_CATALOG).not.toHaveProperty("spyfu");
  });

  it("registers keyword_volume (SpyFu volume signal for Demand Intent)", (): void => {
    expect(TOOL_CATALOG).toHaveProperty("keyword_volume");
  });

  it("registers keyword_discovery (SpyFu keyword discovery for Demand Intent)", (): void => {
    expect(TOOL_CATALOG).toHaveProperty("keyword_discovery");
  });

  it("registers keyword_trends (SearchAPI Trends fallback for Demand Intent)", (): void => {
    expect(TOOL_CATALOG).toHaveProperty("keyword_trends");
  });
});
