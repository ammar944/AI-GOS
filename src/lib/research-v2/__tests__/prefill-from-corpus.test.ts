import { describe, expect, it } from "vitest";

import { prefillFromCorpus } from "../prefill-from-corpus";

describe("prefillFromCorpus non-answer normalization", () => {
  it("drops corpus non-answer tokens so the brief form shows blank, not 'idk'/'none'", () => {
    const data = prefillFromCorpus({
      topCompetitors: { value: "idk" },
      industryVertical: { value: "none" },
      jobTitles: { value: "N/A" },
      companyName: { value: "Acme Inc" },
    });

    // Non-answers must NOT prefill the form (they would poison the ad probe /
    // display literal junk the run path already drops to null).
    expect(data.topCompetitors).toBeUndefined();
    expect(data.industry).toBeUndefined();
    expect(data.jobTitles).toBeUndefined();

    // Genuine values still flow through.
    expect(data.companyName).toBe("Acme Inc");
  });

  it("keeps genuine values and trims surrounding whitespace", () => {
    const data = prefillFromCorpus({
      companyName: { value: "  Acme  " },
      topCompetitors: { value: "Notion, Monday, ClickUp" },
    });

    expect(data.companyName).toBe("Acme");
    expect(data.topCompetitors).toBe("Notion, Monday, ClickUp");
  });

  it("snaps a corpus ACV dollar amount to the radio band (W4)", () => {
    expect(prefillFromCorpus({ acv: { value: "$12,000/yr" } }).acv).toBe(
      "10k_50k",
    );
    expect(prefillFromCorpus({ acv: { value: "$2,400 per year" } }).acv).toBe(
      "1k_10k",
    );
    expect(prefillFromCorpus({ acv: { value: "$49/mo" } }).acv).toBe("lt_1k");
    expect(prefillFromCorpus({ acv: { value: "$499/mo" } }).acv).toBe(
      "1k_10k",
    );
    expect(prefillFromCorpus({ acv: { value: "60k" } }).acv).toBe("gt_50k");
  });

  it("skips ACV prefill when the corpus value is unparseable or a non-answer", () => {
    expect(
      prefillFromCorpus({ acv: { value: "enterprise pricing on request" } })
        .acv,
    ).toBeUndefined();
    expect(prefillFromCorpus({ acv: { value: "idk" } }).acv).toBeUndefined();
    expect(prefillFromCorpus({}).acv).toBeUndefined();
  });

  it("passes monthlyAdBudget through as text (W4)", () => {
    expect(
      prefillFromCorpus({ monthlyAdBudget: { value: "$15,000/mo" } })
        .monthlyAdBudget,
    ).toBe("$15,000/mo");
    expect(
      prefillFromCorpus({ monthlyAdBudget: { value: "none" } }).monthlyAdBudget,
    ).toBeUndefined();
  });
});
