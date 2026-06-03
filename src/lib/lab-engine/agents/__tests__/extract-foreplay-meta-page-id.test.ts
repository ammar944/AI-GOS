import { describe, expect, it } from "vitest";

import { extractForeplayMetaPageId } from "../run-section";

describe("extractForeplayMetaPageId", (): void => {
  it("returns the numeric Meta page_id", (): void => {
    expect(extractForeplayMetaPageId({ page_id: "103437121012366" })).toBe(
      "103437121012366",
    );
  });

  it("falls back to ad_library_id when page_id is absent", (): void => {
    expect(
      extractForeplayMetaPageId({ ad_library_id: "135611546456409" }),
    ).toBe("135611546456409");
  });

  it("prefers page_id over ad_library_id", (): void => {
    expect(
      extractForeplayMetaPageId({
        page_id: "111111111",
        ad_library_id: "222222222",
      }),
    ).toBe("111111111");
  });

  it("rejects non-numeric aliases (e.g. rampcard) and empty values", (): void => {
    expect(extractForeplayMetaPageId({ page_id: "rampcard" })).toBeUndefined();
    expect(extractForeplayMetaPageId({})).toBeUndefined();
    expect(extractForeplayMetaPageId({ page_id: "   " })).toBeUndefined();
  });
});
