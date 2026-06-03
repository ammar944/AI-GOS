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

    describe("page_alias domain corroboration (verified-domain spine)", (): void => {
      it("does not verify a same-name page whose page_alias contradicts the domain", (): void => {
        // Live failure: meta page-search for "Gong"/gong.io returned the Croatian
        // NGO page (name "Gong", page_alias "gong.hr"). The name-containment
        // heuristic treated it as domain-corroborated and accepted it. With the
        // real alias present, gong.hr must NOT corroborate gong.io.
        const result = resolveBestCandidate(
          [{ id: "hr", name: "Gong", pageAlias: "gong.hr" }],
          "Gong",
          "gong.io",
          true,
        );

        expect(result.verdict).not.toBe("accepted");
      });

      it("selects the page whose page_alias matches the verified domain over a same-name decoy", (): void => {
        const result = resolveBestCandidate(
          [
            { id: "hr", name: "Gong", pageAlias: "gong.hr" },
            { id: "io", name: "Gong", pageAlias: "gong.io" },
          ],
          "Gong",
          "gong.io",
          true,
        );

        expect(result).toMatchObject({
          verdict: "accepted",
          candidate: { id: "io", name: "Gong" },
        });
      });

      it("treats www and subdomain aliases as the same registrable domain", (): void => {
        expect(
          resolveBestCandidate(
            [{ id: "io", name: "Gong", pageAlias: "www.gong.io" }],
            "Gong",
            "gong.io",
            true,
          ),
        ).toMatchObject({ verdict: "accepted", candidate: { id: "io" } });

        expect(
          resolveBestCandidate(
            [{ id: "io", name: "Gong", pageAlias: "ads.gong.io" }],
            "Gong",
            "gong.io",
            true,
          ),
        ).toMatchObject({ verdict: "accepted", candidate: { id: "io" } });
      });

      it("picks the alias-matched page out of a mixed collision set", (): void => {
        const result = resolveBestCandidate(
          [
            { id: "hr", name: "Gong", pageAlias: "gong.hr" },
            { id: "band", name: "Gong", pageAlias: "officialgong" },
            { id: "io", name: "Gong", pageAlias: "gong.io" },
          ],
          "Gong",
          "gong.io",
          true,
        );

        expect(result).toMatchObject({
          verdict: "accepted",
          candidate: { id: "io" },
        });
      });

      it("ignores non-domain-shaped aliases (no over-rejection when there is no real domain signal)", (): void => {
        // "officialgong" is not domain-shaped, so it carries no corroboration
        // signal. Resolution must fall back to the existing name-based path,
        // not hard-reject a legitimate short brand.
        const result = resolveBestCandidate(
          [{ id: "band", name: "Gong", pageAlias: "officialgong" }],
          "Gong",
          "gong.io",
          true,
        );

        expect(result.verdict).toBe("accepted");
      });

      it("leaves alias-free candidates on the existing name-based path", (): void => {
        // Backward compatibility: when SearchAPI returns no alias fields the
        // resolver behaves exactly as before the spine landed.
        const result = resolveBestCandidate(
          [{ id: "io", name: "Gong" }],
          "Gong",
          "gong.io",
          true,
        );

        expect(result).toMatchObject({
          verdict: "accepted",
          candidate: { id: "io", name: "Gong" },
        });
      });

      it("never verifies a non-short exact-name page whose alias contradicts the domain", (): void => {
        // "Acmecorp" (>6 chars) is not gated by the short-name corroboration
        // blocks, so the exact-name branch would accept it. The final guard must
        // still downgrade it: its own alias says it is a different domain.
        const result = resolveBestCandidate(
          [{ id: "de", name: "Acmecorp", pageAlias: "acmecorp.de" }],
          "Acmecorp",
          "acmecorp.io",
          true,
        );

        expect(result.verdict).not.toBe("accepted");
      });

      it("stays conservative when a decoy alias poisons a mixed same-name set", (): void => {
        // Documented trade-off: an alias-free real page sharing the set with a
        // domain-aliased decoy cannot be positively confirmed, so it resolves to
        // ambiguous (quarantine) rather than being verified on a bare name match.
        const result = resolveBestCandidate(
          [
            { id: "real", name: "Notion", pageAlias: "notion" },
            { id: "decoy", name: "Notion", pageAlias: "notion.com" },
          ],
          "Notion",
          "notion.so",
          true,
        );

        expect(result.verdict).not.toBe("accepted");
      });

      it("corroborates through a target domain that carries a port", (): void => {
        const result = resolveBestCandidate(
          [{ id: "io", name: "Gong", pageAlias: "gong.io" }],
          "Gong",
          "gong.io:443",
          true,
        );

        expect(result).toMatchObject({
          verdict: "accepted",
          candidate: { id: "io" },
        });
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
      expect(normalizeDomain("gong.io:443")).toBe("gong.io");
      expect(normalizeDomain("gong.io.")).toBe("gong.io");
      expect(normalizeDomain("gong.io?ref=x")).toBe("gong.io");
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
