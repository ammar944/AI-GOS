import { describe, expect, it } from "vitest";

import { buildCommitPatch } from "../commit-patch";

// §4.1 — when an agentic artifact carries body.narrativeMarkdown (GLM's raw
// research), buildCommitPatch must persist THAT (vocab-scrubbed, structure
// preserved) as the section's markdown column — not the 2-line verdict+summary
// synthesis. Non-agentic artifacts (no narrativeMarkdown) keep the deterministic
// verdict+summary join unchanged.
describe("buildCommitPatch narrativeMarkdown", () => {
  const baseArtifact = {
    sectionTitle: "Market & Category Intelligence",
    verdict: "Own the API-first shelf.",
    statusSummary: "Category frame validated against 6 sources.",
    sources: [],
  };

  it("uses GLM narrativeMarkdown as the markdown column, vocab-scrubbed, newlines preserved", () => {
    const patch = buildCommitPatch("positioningMarketCategory", {
      ...baseArtifact,
      body: {
        narrativeMarkdown:
          "## Market & Category Intelligence\n\nWe ran web_search across competitors.\n\n- Brex\n- Navan\n\nThe shelf to own is API-first.",
      },
    });
    expect(patch.markdown).toContain("## Market & Category Intelligence");
    expect(patch.markdown).toContain("The shelf to own is API-first.");
    // multi-line structure survived
    expect((patch.markdown ?? "").split("\n").length).toBeGreaterThan(4);
    // internal tool vocab scrubbed
    expect(patch.markdown).not.toMatch(/web_search/);
    expect(patch.markdown).toContain("web research");
    // it is NOT the 2-line verdict+summary synthesis
    expect(patch.markdown).not.toBe(
      "**Verdict:** Own the API-first shelf.\n\nCategory frame validated against 6 sources.",
    );
    // the clean narrative also survives on data.body so the Audit Reader can
    // render artifact.narrativeMarkdown (newlines preserved, vocab scrubbed).
    const dataBody = (patch.data as { body?: Record<string, unknown> }).body;
    expect(typeof dataBody?.narrativeMarkdown).toBe("string");
    expect(dataBody?.narrativeMarkdown as string).toContain(
      "## Market & Category Intelligence",
    );
    expect((dataBody?.narrativeMarkdown as string).split("\n").length).toBeGreaterThan(4);
    expect(dataBody?.narrativeMarkdown as string).not.toMatch(/web_search/);
  });

  it("falls back to the deterministic verdict+summary join when no narrativeMarkdown", () => {
    const patch = buildCommitPatch("positioningMarketCategory", {
      ...baseArtifact,
      body: { strategicInsight: { headline: "x" } },
    });
    expect(patch.markdown).toBe(
      "**Verdict:** Own the API-first shelf.\n\nCategory frame validated against 6 sources.",
    );
  });

  it("ignores an empty-string narrativeMarkdown (keeps deterministic join)", () => {
    const patch = buildCommitPatch("positioningVoiceOfCustomer", {
      ...baseArtifact,
      sectionTitle: "Voice of the Customer",
      body: { narrativeMarkdown: "" },
    });
    expect(patch.markdown).toBe(
      "**Verdict:** Own the API-first shelf.\n\nCategory frame validated against 6 sources.",
    );
  });
});
