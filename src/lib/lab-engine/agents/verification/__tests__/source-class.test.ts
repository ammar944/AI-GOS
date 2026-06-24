import { describe, expect, it } from "vitest";

import type { TranscriptRecord } from "../provenance-detect";
import {
  annotateSourceProvenance,
  buildTranscriptUrlClassMap,
  classifyMarkdownCitations,
  classifyUrl,
} from "../source-class";

// Fixtures mirror the verified live shapes in tmp/zz-agentic-glm/*/transcript.json
// (web_search.results[].url, perplexity_research.citations[].url,
// reviews.excerpts[].url, firecrawl.output.url, keyword_volume.sourceUrl).
function rec(
  toolName: string,
  output: unknown,
  isError = false,
): TranscriptRecord {
  return { step: 0, toolName, toolCallId: "c", input: {}, output, isError };
}

const transcript: TranscriptRecord[] = [
  rec("web_search", {
    type: "result",
    results: [
      { title: "x", url: "https://www.brex.com/spend-trends/ramp-competitors" },
    ],
  }),
  rec("reviews", {
    type: "result",
    brand: "Brex",
    attempts: [
      { url: "https://www.capterra.com/p/182054/Brex/reviews/", status: "succeeded" },
      // A FAILED fetch attempt: we never got this page. It must NOT be verbatim.
      { url: "https://www.failedfetch.com/never/got/this", status: "failed" },
    ],
    excerpts: [
      {
        source: "Capterra",
        url: "https://www.capterra.com/p/182054/Brex/reviews/",
        reviewText: "“They only support a USD account.“",
      },
    ],
  }),
  rec("perplexity_research", {
    type: "result",
    answer: "...",
    citations: [
      { url: "https://www.g2.com/products/brex/reviews?page=2", title: "G2" },
      { url: "https://old.reddit.com/r/cfo/comments/abc123/", title: "Reddit" },
    ],
  }),
  rec("firecrawl", {
    type: "result",
    url: "https://ramp.com/blog/customers-who-switched-from-brex-to-ramp",
    markdown: "# Customers who switched",
  }),
  rec("keyword_volume", {
    type: "result",
    source: "SpyFu",
    sourceUrl: "https://www.spyfu.com/",
    keywords: [
      {
        keyword: "ramp competitors",
        sourceUrl: "https://www.spyfu.com/keyword/overview/us?query=ramp%20competitors",
      },
    ],
  }),
  // A firecrawl FAILURE has no url and is flagged isError — contributes nothing.
  rec("firecrawl", { type: "error", error: "timeout" }, true),
];

describe("buildTranscriptUrlClassMap", () => {
  const map = buildTranscriptUrlClassMap(transcript);

  it("labels directly-fetched review pages verbatim", () => {
    expect(classifyUrl("https://www.capterra.com/p/182054/Brex/reviews/", map)).toBe(
      "verbatim",
    );
  });

  it("labels directly-fetched firecrawl pages verbatim", () => {
    expect(
      classifyUrl(
        "https://ramp.com/blog/customers-who-switched-from-brex-to-ramp",
        map,
      ),
    ).toBe("verbatim");
  });

  it("labels perplexity citations reported (paraphrase, not fetched)", () => {
    expect(classifyUrl("https://www.g2.com/products/brex/reviews?page=2", map)).toBe(
      "reported",
    );
    expect(classifyUrl("https://old.reddit.com/r/cfo/comments/abc123/", map)).toBe(
      "reported",
    );
  });

  it("labels web_search results reported", () => {
    expect(
      classifyUrl("https://www.brex.com/spend-trends/ramp-competitors", map),
    ).toBe("reported");
  });

  it("labels keyword_volume sources as data-table", () => {
    expect(
      classifyUrl(
        "https://www.spyfu.com/keyword/overview/us?query=ramp competitors",
        map,
      ),
    ).toBe("data-table");
  });

  it("returns ungrounded for a URL absent from the transcript", () => {
    expect(classifyUrl("https://fabricated.example.com/made-up", map)).toBe(
      "ungrounded",
    );
  });

  it("does not crash and contributes no URL from an isError record", () => {
    // The error firecrawl record has no url; map only carries grounded URLs.
    expect([...map.values()]).not.toContain("ungrounded");
  });

  it("does NOT badge a FAILED reviews fetch attempt as verbatim (it was never fetched)", () => {
    // The only anti-fab on the un-caged path: a URL we attempted but failed to
    // fetch must classify ungrounded, never 'verbatim — quote reproduced'.
    expect(classifyUrl("https://www.failedfetch.com/never/got/this", map)).toBe(
      "ungrounded",
    );
  });

  it("matches URLs ignoring scheme/www/trailing-slash differences", () => {
    expect(classifyUrl("http://capterra.com/p/182054/Brex/reviews", map)).toBe(
      "verbatim",
    );
  });
});

describe("classifyMarkdownCitations", () => {
  it("classifies every cited URL in a markdown body", () => {
    const map = buildTranscriptUrlClassMap(transcript);
    const md =
      "Buyers complain ([Capterra](https://www.capterra.com/p/182054/Brex/reviews/)) and per G2 (https://www.g2.com/products/brex/reviews?page=2) churn is high. Search volume from https://www.spyfu.com/keyword/overview/us?query=ramp%20competitors.";
    const cites = classifyMarkdownCitations(md, map);
    const byUrl = new Map(cites.map((c) => [c.url, c.sourceClass]));
    expect([...byUrl.values()]).toContain("verbatim");
    expect([...byUrl.values()]).toContain("reported");
    expect([...byUrl.values()]).toContain("data-table");
  });
});

describe("annotateSourceProvenance", () => {
  it("appends a deterministic provenance footer distinguishing verbatim from reported", () => {
    const md = "Brex buyers churn ([Capterra](https://www.capterra.com/p/182054/Brex/reviews/)); G2 agrees (https://www.g2.com/products/brex/reviews?page=2).";
    const out = annotateSourceProvenance(md, transcript);
    expect(out.startsWith(md)).toBe(true);
    expect(out.toLowerCase()).toContain("source provenance");
    expect(out.toLowerCase()).toContain("verbatim");
    expect(out.toLowerCase()).toContain("reported");
    expect(out).toContain("capterra.com");
  });

  it("returns the body unchanged when it cites nothing", () => {
    const md = "A paragraph with zero citations.";
    expect(annotateSourceProvenance(md, transcript)).toBe(md);
  });
});
