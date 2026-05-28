import { describe, expect, it } from "vitest";

import { TOOL_CATALOG } from "../index";

describe("TOOL_CATALOG", (): void => {
  it("does not register dead capability tools with no lab-section consumers", (): void => {
    expect(TOOL_CATALOG).not.toHaveProperty("ga4");
    expect(TOOL_CATALOG).not.toHaveProperty("spyfu");
  });
});
