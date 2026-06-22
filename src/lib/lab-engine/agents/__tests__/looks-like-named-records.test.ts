/**
 * Pins the looksLikeNamedRecords contract (LOCUS B reverted): the predicate
 * admits ONLY arrays of rows keyed on name OR competitor. It rejects
 * keyword-keyed / term-keyed rows (DemandIntent keywordDemand rows) and any row
 * carrying neither name nor competitor. Guards against re-introducing LOCUS B
 * (re-widening to keyword/term) — those rows carry no (sourceUrl, quote) pair,
 * so binding them turns a bind-rate cap into a hard fabrication-cap at the
 * deck-ledger gate.
 */

import { describe, expect, it } from "vitest";

import { looksLikeNamedRecords } from "../paid-media-evidence-pack";

describe("looksLikeNamedRecords", () => {
  it("returns false for keyword-keyed rows (LOCUS B reverted)", () => {
    expect(
      looksLikeNamedRecords([
        { keyword: "expense management software", monthlyVolume: 14800 },
        { keyword: "corporate card platform", monthlyVolume: 3600 },
      ]),
    ).toBe(false);
  });

  it("returns false for term-keyed rows", () => {
    expect(
      looksLikeNamedRecords([{ term: "spend control", weight: 0.4 }]),
    ).toBe(false);
  });

  it("returns true for name-keyed and competitor-keyed rows (unchanged)", () => {
    expect(looksLikeNamedRecords([{ name: "Dana Ruiz" }])).toBe(true);
    expect(looksLikeNamedRecords([{ competitor: "Brex" }])).toBe(true);
  });

  it("returns false for rows with none of {name, competitor}", () => {
    expect(
      looksLikeNamedRecords([{ value: "10-2,000 employees", source: "G2" }]),
    ).toBe(false);
  });

  it("returns false for a non-array or empty array", () => {
    expect(looksLikeNamedRecords([])).toBe(false);
    expect(looksLikeNamedRecords({ keyword: "x" })).toBe(false);
    expect(looksLikeNamedRecords(undefined)).toBe(false);
  });
});
