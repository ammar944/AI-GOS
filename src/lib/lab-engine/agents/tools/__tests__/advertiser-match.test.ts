import { describe, expect, it } from "vitest";

import {
  calculateSimilarity,
  cleanAdvertiserQuery,
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

    it("accepts a long name that contains the domain base as a whole word", (): void => {
      // "Acme Mixpanel Inc" does not start with "mixpanel" but contains it.
      expect(
        isAdvertiserMatch("Acme Mixpanel Inc", "Mixpanel", "mixpanel.com"),
      ).toBe(true);
    });

    it("still rejects unrelated short names (Brex is not Ramp)", (): void => {
      expect(isAdvertiserMatch("Brex", "Ramp")).toBe(false);
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

    it("prefers a not-top candidate that corroborates the verified domain", (): void => {
      // "Facebook Marketplace" scores highest against "Facebook" but is the wrong
      // entity; "Meta Platforms" carries the verified domain base "meta".
      const result = resolveBestCandidate(
        [
          { id: "fb-wrong", name: "Facebook Marketplace" },
          { id: "meta-right", name: "Meta Platforms" },
        ],
        "Facebook",
        "meta.com",
        true,
      );

      expect(result).toMatchObject({
        verdict: "accepted",
        candidate: { id: "meta-right", name: "Meta Platforms" },
      });
    });

    it("does not confidently corroborate a short brand from a bare name-substring", (): void => {
      // None of these IS "ramp" — they merely contain it. With a verified domain
      // we must not accept a coincidental match (would serve a wrong company's ads).
      const result = resolveBestCandidate(
        [
          { id: "fr", name: "The Ramp" },
          { id: "us", name: "RAMPD LLC" },
        ],
        "Ramp",
        "ramp.com",
        true,
      );

      expect(result.verdict).not.toBe("accepted");
    });

    it("still corroborates a short brand whose candidate adds only a corporate suffix", (): void => {
      const result = resolveBestCandidate(
        [{ id: "brex", name: "Brex Inc." }],
        "Brex",
        "brex.com",
        true,
      );

      expect(result).toMatchObject({
        verdict: "accepted",
        candidate: { id: "brex", name: "Brex Inc." },
      });
    });

    it("keeps a bare short name with an exact-name candidate ambiguous-with-candidate (not rejected)", (): void => {
      // Hypothesis B refutation: a bare short name like "Ramp" (no domain,
      // not domain-verified) with an exact-name candidate is NOT rejected. It
      // resolves to "ambiguous" WITH the candidate attached, so the probe
      // proceeds rather than dropping the advertiser. The 0-creatives outcome
      // therefore is NOT explained by short-name rejection.
      const result = resolveBestCandidate([{ id: "ramp", name: "Ramp" }], "Ramp");

      expect(result.verdict).toBe("ambiguous");
      expect(result.verdict).not.toBe("rejected");
      expect(result.candidate).toMatchObject({ id: "ramp", name: "Ramp" });
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

  describe("cleanAdvertiserQuery", (): void => {
    it("strips descriptor suffixes and parentheticals to the brand token", (): void => {
      // Live 2026-06-01 audit: the probe queried this literal and matched nothing.
      expect(
        cleanAdvertiserQuery("Confluence (Atlassian) - enterprise wiki/docs"),
      ).toBe("Confluence");
      expect(cleanAdvertiserQuery("Notion (Notion Labs, Inc.)")).toBe("Notion");
      expect(cleanAdvertiserQuery("Asana — work management")).toBe("Asana");
      expect(
        cleanAdvertiserQuery("1. Brex (acquired by Capital One, closed Apr 7"),
      ).toBe("Brex");
    });

    it("rejects Brex fixture fragments that are not plausible brand queries", (): void => {
      expect(cleanAdvertiserQuery("closed Apr 7")).toBe("");
      expect(cleanAdvertiserQuery("2026 — $5.15B deal")).toBe("");
      expect(cleanAdvertiserQuery("— $5.15B deal")).toBe("");
      expect(cleanAdvertiserQuery("$5.15B deal")).toBe("");
    });

    it("keeps alphanumeric brands whose first token starts with a digit", (): void => {
      // FIX2-1: a blanket leading-digit reject dropped real brands (-> 0 creatives).
      // The reject must fire only for letter-free fragments ("2026", "4,200+"), not brands.
      expect(cleanAdvertiserQuery("3M")).toBe("3M");
      expect(cleanAdvertiserQuery("23andMe")).toBe("23andMe");
      expect(cleanAdvertiserQuery("7-Eleven")).toBe("7-Eleven");
      expect(cleanAdvertiserQuery("1Password")).toBe("1Password");
      // ...while still rejecting letter-free numeric fragments:
      expect(cleanAdvertiserQuery("4,200+ switches to Ramp")).toBe("");
    });

    it("leaves clean multi-word brands and bare names untouched", (): void => {
      expect(cleanAdvertiserQuery("Microsoft Loop")).toBe("Microsoft Loop");
      expect(cleanAdvertiserQuery("Coda")).toBe("Coda");
      expect(cleanAdvertiserQuery("Monday.com")).toBe("Monday.com");
    });

    it("falls back to the trimmed original when cleaning empties it", (): void => {
      expect(cleanAdvertiserQuery("  (parenthetical only)  ")).toBe(
        "(parenthetical only)",
      );
    });
  });
});
