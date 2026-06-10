import { describe, expect, it } from "vitest";

import { isNonAnswer } from "../non-answer";

describe("isNonAnswer", () => {
  it("treats classic non-answers as non-answers", () => {
    expect(isNonAnswer("idk")).toBe(true);
    expect(isNonAnswer("N/A")).toBe(true);
    expect(isNonAnswer("tbd")).toBe(true);
    expect(isNonAnswer("")).toBe(true);
  });

  it("treats unfilled template tokens as non-answers ($[Budget] leak regression, B3)", () => {
    expect(isNonAnswer("$[Budget]")).toBe(true);
    expect(isNonAnswer("$[Budget] / Month")).toBe(true);
    expect(isNonAnswer("[budget]")).toBe(true);
    expect(isNonAnswer("[Budget]")).toBe(true);
    expect(isNonAnswer("{Budget}")).toBe(true);
    expect(isNonAnswer("$[X]")).toBe(true);
  });

  it("keeps real answers", () => {
    expect(isNonAnswer("$10,000/mo")).toBe(false);
    expect(isNonAnswer("6000")).toBe(false);
    expect(isNonAnswer("Starter $49/mo [annual billing]")).toBe(false);
    expect(isNonAnswer("We budget around $5k monthly")).toBe(false);
  });
});
