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
});
