import { describe, expect, it } from "vitest";

import {
  calculateSimilarity,
  extractCompanyFromDomain,
  isAdvertiserMatch,
  normalizeDomain,
  resolveBestCandidate,
} from "../advertiser-match";

describe("advertiser match relevance engine", (): void => {
  describe("isAdvertiserMatch", (): void => {
    it("accepts exact and corporate-suffix matches", (): void => {
      expect(isAdvertiserMatch("Buffer Inc", "Buffer")).toBe(true);
      expect(isAdvertiserMatch("Fathom", "Fathom")).toBe(true);
    });

    it("rejects short-name false positives and first-word collisions", (): void => {
      expect(isAdvertiserMatch("Atlas VPN", "Atlas")).toBe(false);
      expect(isAdvertiserMatch("Direct Metals", "Directive")).toBe(false);
    });

    it("uses the short-name URL guard when a verified domain is available", (): void => {
      expect(
        isAdvertiserMatch(
          "Fathom",
          "Fathom",
          "fathom.video",
          "https://fathomdem.com/example-ad",
        ),
      ).toBe(false);
      expect(
        isAdvertiserMatch(
          "Fathom",
          "Fathom",
          "fathom.video",
          "https://fathom.video/demo",
        ),
      ).toBe(true);
    });
  });

  describe("resolveBestCandidate", (): void => {
    it("rejects empty candidate lists", (): void => {
      expect(resolveBestCandidate([], "Buffer")).toMatchObject({
        verdict: "rejected",
      });
    });

    it("accepts a clear long-name winner", (): void => {
      expect(
        resolveBestCandidate(
          [
            { id: "wrong", name: "Acme Widgets" },
            { id: "right", name: "RevenueHero Inc" },
          ],
          "RevenueHero",
        ),
      ).toMatchObject({
        verdict: "accepted",
        candidate: { id: "right", name: "RevenueHero Inc" },
      });
    });

    it("keeps a verified-domain short-name no-corroboration match ambiguous", (): void => {
      expect(
        resolveBestCandidate(
          [{ id: "atlas", name: "Atlas" }],
          "Atlas",
          "runatlas.com",
          true,
        ),
      ).toMatchObject({
        verdict: "ambiguous",
        candidate: { id: "atlas", name: "Atlas" },
      });
    });

    it("rejects candidates below the 0.8 threshold", (): void => {
      expect(
        resolveBestCandidate([{ id: "wrong", name: "Northwind Traders" }], "Directive"),
      ).toMatchObject({
        verdict: "rejected",
      });
    });
  });

  describe("utility helpers", (): void => {
    it("calculates expected similarity extremes", (): void => {
      expect(calculateSimilarity("Fathom", "Fathom")).toBe(1);
      expect(calculateSimilarity("Northwind Traders", "Directive")).toBeLessThan(0.5);
    });

    it("extracts and normalizes domains", (): void => {
      expect(extractCompanyFromDomain("https://www.amazon.com/path")).toBe("amazon");
      expect(normalizeDomain("https://www.Gong.io/demo")).toBe("gong.io");
    });
  });
});
