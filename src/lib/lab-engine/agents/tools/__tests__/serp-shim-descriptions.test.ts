import { describe, expect, it } from "vitest";

import { keywordAdProbeAgentTool } from "../keyword-ad-probe";
import { reviewsAgentTool } from "../reviews";

describe("SERP shim tool descriptions", (): void => {
  it("names reviews as SearchAPI Google SERP snippets, not first-party review APIs", (): void => {
    expect(reviewsAgentTool.description).toContain(
      "SearchAPI Google SERP snippets",
    );
    expect(reviewsAgentTool.description).toContain(
      "not direct G2, Capterra, or Trustpilot APIs",
    );
  });

  it("names keyword_ad_probe as SERP counts, not volume or spend metrics", (): void => {
    expect(keywordAdProbeAgentTool.description).toContain(
      "SearchAPI Google SERP organic and ad result counts",
    );
    expect(keywordAdProbeAgentTool.description).toContain(
      "not search-volume or ad-spend metrics",
    );
  });
});
