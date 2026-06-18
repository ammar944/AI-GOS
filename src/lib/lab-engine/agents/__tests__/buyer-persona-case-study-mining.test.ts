import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  acquireCaseStudyChampionCandidates,
  deriveCustomerCompanyFromCaseStudyUrl,
  extractCaseStudyChampions,
  isCaseStudyUrl,
} from "../buyer-persona-case-study-mining";

describe("isCaseStudyUrl", (): void => {
  const subjectDomain = "ramp.com";

  it("accepts a subject-domain customer/case-study leaf page", (): void => {
    expect(isCaseStudyUrl("https://ramp.com/customers/wizehire", subjectDomain)).toBe(true);
    expect(isCaseStudyUrl("https://ramp.com/case-studies/new-way", subjectDomain)).toBe(true);
    expect(isCaseStudyUrl("https://ramp.com/customer-stories/studs", subjectDomain)).toBe(true);
    expect(isCaseStudyUrl("https://next.ramp.com/customers/perplexity", subjectDomain)).toBe(true);
  });

  it("rejects the bare customers/case-study index (no slug)", (): void => {
    expect(isCaseStudyUrl("https://ramp.com/customers", subjectDomain)).toBe(false);
    expect(isCaseStudyUrl("https://ramp.com/customers/", subjectDomain)).toBe(false);
    expect(isCaseStudyUrl("https://ramp.com/case-studies/", subjectDomain)).toBe(false);
  });

  it("rejects non-subject domains and non-case-study paths", (): void => {
    expect(isCaseStudyUrl("https://competitor.com/customers/acme", subjectDomain)).toBe(false);
    expect(isCaseStudyUrl("https://ramp.com/pricing", subjectDomain)).toBe(false);
    expect(isCaseStudyUrl("https://ramp.com/blog/behind-the-valuation", subjectDomain)).toBe(false);
  });
});

describe("deriveCustomerCompanyFromCaseStudyUrl", (): void => {
  it("titleizes the trailing slug", (): void => {
    expect(deriveCustomerCompanyFromCaseStudyUrl("https://ramp.com/customers/new-way-landscape")).toBe(
      "New Way Landscape",
    );
    expect(deriveCustomerCompanyFromCaseStudyUrl("https://ramp.com/customers/wizehire")).toBe("Wizehire");
  });

  it("returns null when there is no usable slug", (): void => {
    expect(deriveCustomerCompanyFromCaseStudyUrl("https://ramp.com/customers")).toBeNull();
  });
});

describe("extractCaseStudyChampions", (): void => {
  it("extracts a named champion with a buyer-role title", (): void => {
    const md = [
      "# How New Way Landscape scaled with Ramp",
      "",
      '"Ramp gave us control we never had," said Bill Cox, VP of Finance at New Way Landscape.',
    ].join("\n");

    const champs = extractCaseStudyChampions(md, "New Way Landscape");
    expect(champs).toContainEqual(
      expect.objectContaining({ name: "Bill Cox", title: expect.stringMatching(/VP of Finance/i) }),
    );
  });

  it("extracts a quote-attribution dash form", (): void => {
    const md = '> "Closing the books used to take a week."\n\n— Sarah Nguyen, Controller, Studs';
    const champs = extractCaseStudyChampions(md, "Studs");
    expect(champs.some((c) => c.name === "Sarah Nguyen" && /Controller/i.test(c.title))).toBe(true);
  });

  it("drops generic non-name labels and titleless mentions", (): void => {
    const md = "Marketing Operations Manager at WizeHire helped roll this out. Our team loves it.";
    const champs = extractCaseStudyChampions(md, "Wizehire");
    expect(champs).toEqual([]);
  });

  it("extracts an em-dash attribution with a trailing 'at <company>' title", (): void => {
    // Real server-rendered shape on ramp.com/customers/wizehire — name and title
    // separated by an em dash, no comma. The comma-only pattern missed this and
    // dropped the only external champion on the page.
    const md = "Alicia Coleman — Marketing Operations Manager at WizeHire";
    const champs = extractCaseStudyChampions(md, "Wizehire");
    expect(champs).toContainEqual(
      expect.objectContaining({
        name: "Alicia Coleman",
        title: expect.stringMatching(/Marketing Operations Manager/i),
        company: expect.stringMatching(/WizeHire/i),
      }),
    );
  });

  it("extracts an em-dash attribution with a comma-delimited '<title>, <company>'", (): void => {
    // Real shape on next.ramp.com/customers/perplexity.
    const md = "Lauren Feeney — Controller, Perplexity";
    const champs = extractCaseStudyChampions(md, "Perplexity");
    expect(champs).toContainEqual(
      expect.objectContaining({
        name: "Lauren Feeney",
        title: expect.stringMatching(/Controller/i),
        company: expect.stringMatching(/Perplexity/i),
      }),
    );
  });

  it("sanitizes a company name that runs into serialized markup junk", (): void => {
    // next.ramp.com renders the attribution inside a Next.js RSC payload, so the
    // raw HTML-stripped text reads: Lauren Feeney — Controller, Perplexity"]}],[...
    // The company field must be the clean "Perplexity", not the markup tail.
    const md = 'Lauren Feeney — Controller, Perplexity"]}],["$","p","bf87"';
    const champ = extractCaseStudyChampions(md, "Perplexity").find(
      (c) => c.name === "Lauren Feeney",
    );
    expect(champ?.company).toBe("Perplexity");
  });
});

describe("acquireCaseStudyChampionCandidates", (): void => {
  const subject = { name: "Ramp", websiteUrl: "https://ramp.com" };

  // These tests inject a stub fetch that simulates an AUTHENTICATED Firecrawl;
  // the production guard short-circuits when FIRECRAWL_API_KEY is unset, so the
  // key must be present for the map/scrape path to run.
  beforeEach((): void => {
    vi.stubEnv("FIRECRAWL_API_KEY", "test-firecrawl-key");
  });
  afterEach((): void => {
    vi.unstubAllEnvs();
  });

  it("emits a FIRECRAWL_API_KEY credential gap and no candidates when the key is unset", async (): Promise<void> => {
    vi.stubEnv("FIRECRAWL_API_KEY", "");
    let fetchCalls = 0;
    const fetchImpl = (async (): Promise<Response> => {
      fetchCalls += 1;
      return new Response(JSON.stringify({ success: true, links: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await acquireCaseStudyChampionCandidates({ subject, fetchImpl });

    expect(result.candidates).toEqual([]);
    expect(result.pages).toEqual([]);
    expect(result.credentialGap).toEqual(
      expect.objectContaining({
        type: "gap",
        reason: "missing_credential",
        envVar: "FIRECRAWL_API_KEY",
      }),
    );
    // Never reaches the network without a key.
    expect(fetchCalls).toBe(0);
  });

  function stubFetch(
    map: string[],
    pages: Record<string, string>,
  ): typeof fetch {
    return (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/v2/map")) {
        return new Response(JSON.stringify({ success: true, links: map }), { status: 200 });
      }
      if (url.includes("/v2/scrape")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as { url: string };
        const markdown = pages[body.url] ?? "";
        return new Response(JSON.stringify({ success: true, data: { markdown } }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;
  }

  it("maps the subject site, scrapes case-study pages, and emits champion leads", async (): Promise<void> => {
    const fetchImpl = stubFetch(
      [
        "https://ramp.com/customers/new-way-landscape",
        "https://ramp.com/customers/wizehire",
        "https://ramp.com/pricing",
        "https://ramp.com/customers",
      ],
      {
        "https://ramp.com/customers/new-way-landscape":
          'Bill Cox, VP of Finance at New Way Landscape, said Ramp changed everything.',
        "https://ramp.com/customers/wizehire":
          '"We move faster now," said Sid Upadhyay, CEO of WizeHire.',
      },
    );

    const result = await acquireCaseStudyChampionCandidates({ subject, fetchImpl });

    expect(result.candidates.length).toBeGreaterThanOrEqual(2);
    const names = result.candidates.map((c) => c.name);
    expect(names).toContain("Bill Cox");
    expect(names).toContain("Sid Upadhyay");
    for (const c of result.candidates) {
      expect(c.venue).toBe("case_study_champions");
      expect(c.url).toMatch(/ramp\.com\/customers\//);
      // company is the CUSTOMER, never the subject
      expect(c.company.toLowerCase()).not.toBe("ramp");
    }
    // scraped pages surfaced for the agent's evidence pool
    expect(result.pages.length).toBeGreaterThanOrEqual(2);
  });

  it("falls back to a plain GET when firecrawl scrape returns empty markdown", async (): Promise<void> => {
    // next.ramp.com/customers/perplexity returns nothing through Firecrawl scrape
    // but is plainly fetchable (HTTP 200, server-rendered) — the same method the
    // source-liveness gate uses. The champion on it must still be acquired and
    // the page must still enter the evidence pool.
    const pageUrl = "https://next.ramp.com/customers/perplexity";
    const pageHtml =
      "<html><body><blockquote>Ramp gave us real-time control.</blockquote>" +
      "<p>Lauren Feeney — Controller, Perplexity</p></body></html>";
    let plainGetCalls = 0;
    const fetchImpl = (async (
      input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/v2/map")) {
        return new Response(JSON.stringify({ success: true, links: [pageUrl] }), {
          status: 200,
        });
      }
      if (url.includes("/v2/scrape")) {
        return new Response(
          JSON.stringify({ success: true, data: { markdown: "" } }),
          { status: 200 },
        );
      }
      // plain GET of the page itself
      plainGetCalls += 1;
      expect(init?.method ?? "GET").toBe("GET");
      return new Response(pageHtml, { status: 200 });
    }) as unknown as typeof fetch;

    const result = await acquireCaseStudyChampionCandidates({ subject, fetchImpl });

    expect(plainGetCalls).toBeGreaterThanOrEqual(1);
    const lauren = result.candidates.find((c) => c.name === "Lauren Feeney");
    expect(lauren).toBeDefined();
    expect(lauren?.company).toMatch(/Perplexity/i);
    expect(lauren?.url).toBe(pageUrl);
    expect(result.pages.some((p) => p.url === pageUrl)).toBe(true);
  });

  it("drops champions whose company reconciles with the subject (defensive own-company guard)", async (): Promise<void> => {
    const fetchImpl = stubFetch(["https://ramp.com/customers/internal"], {
      "https://ramp.com/customers/internal": "Eric Glyman, CEO of Ramp, presented the roadmap.",
    });
    const result = await acquireCaseStudyChampionCandidates({ subject, fetchImpl });
    expect(result.candidates.find((c) => c.name === "Eric Glyman")).toBeUndefined();
  });

  it("returns nothing when no case-study URLs are found (never throws)", async (): Promise<void> => {
    const fetchImpl = stubFetch(["https://ramp.com/pricing", "https://ramp.com/blog/x"], {});
    const result = await acquireCaseStudyChampionCandidates({ subject, fetchImpl });
    expect(result.candidates).toEqual([]);
    expect(result.pages).toEqual([]);
  });

  it("returns empty and performs no fetches when handed an already-aborted signal", async (): Promise<void> => {
    let fetchCalls = 0;
    const fetchImpl = (async (): Promise<Response> => {
      fetchCalls += 1;
      return new Response(JSON.stringify({ success: true, links: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    const controller = new AbortController();
    controller.abort();

    const result = await acquireCaseStudyChampionCandidates({
      subject,
      fetchImpl,
      signal: controller.signal,
    });

    expect(result.candidates).toEqual([]);
    expect(result.pages).toEqual([]);
    expect(fetchCalls).toBe(0);
  });
});
