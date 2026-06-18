import { describe, expect, it, vi } from "vitest";

import {
  applySourceLivenessGate,
  collectPreverifiedSourceUrlsFromSteps,
  extractSubjectSiteObservation,
  stripContradictedSubjectCtaClaims,
} from "../source-liveness";

function response({
  body = "",
  status = 200,
}: {
  body?: string;
  status?: number;
}): Response {
  return new Response(body, { status });
}

describe("applySourceLivenessGate", (): void => {
  it("drops rows whose source URL returns an HTTP error", async (): Promise<void> => {
    const fetchImpl = vi.fn(async (): Promise<Response> => response({ status: 404 }));
    const result = await applySourceLivenessGate({
      body: {
        findings: [
          {
            evidence: "Airtable pricing starts at $20",
            sourceUrl: "https://example.com/dead-pricing",
          },
        ],
      },
      fetchImpl,
    });
    const body = result.body as { findings?: unknown[] };

    expect(body.findings).toEqual([]);
    expect(result.droppedRows).toEqual([
      expect.objectContaining({
        path: "body.findings[0]",
        reason: "http-error",
        sourceUrl: "https://example.com/dead-pricing",
      }),
    ]);
  });

  it("drops rows when fetched text does not contain the attributed number or entity", async (): Promise<void> => {
    const fetchImpl = vi
      .fn(
        async (_input: string, _init?: RequestInit): Promise<Response> =>
          response({ status: 200 }),
      )
      .mockResolvedValueOnce(response({ status: 200 }))
      .mockResolvedValueOnce(
        response({
          body: "The page mentions Airtable pricing but no community member count.",
          status: 200,
        }),
      );
    const result = await applySourceLivenessGate({
      body: {
        observations: [
          {
            evidence: "MOPs Weekly has 112,403 members.",
            sourceUrl: "https://mopsweekly.com/",
          },
        ],
      },
      fetchImpl,
    });
    const body = result.body as { observations?: unknown[] };

    expect(body.observations).toEqual([]);
    expect(result.droppedRows[0]).toEqual(
      expect.objectContaining({ reason: "containment-mismatch" }),
    );
  });

  it("accepts normalized number containment", async (): Promise<void> => {
    const fetchImpl = vi
      .fn(
        async (_input: string, _init?: RequestInit): Promise<Response> =>
          response({ status: 200 }),
      )
      .mockResolvedValueOnce(response({ status: 200 }))
      .mockResolvedValueOnce(
        response({
          body: "MOPs Weekly says the community now has 112403 members.",
          status: 200,
        }),
      );
    const result = await applySourceLivenessGate({
      body: {
        observations: [
          {
            evidence: "MOPs Weekly has 112,403 members.",
            sourceUrl: "https://mopsweekly.com/",
          },
        ],
      },
      fetchImpl,
    });
    const body = result.body as { observations?: unknown[] };

    expect(body.observations).toHaveLength(1);
    expect(result.droppedRows).toEqual([]);
    expect(result.containmentPassRate).toBe(1);
  });

  it("treats a global network outage as inconclusive without dropping rows", async (): Promise<void> => {
    const fetchImpl = vi.fn(async (): Promise<Response> => {
      throw new Error("fetch failed");
    });
    const result = await applySourceLivenessGate({
      body: {
        findings: [
          {
            evidence: "Airtable pricing starts at $20.",
            sourceUrl: "https://www.airtable.com/pricing",
          },
          {
            evidence: "MOPs Weekly mentions 112,403 members.",
            sourceUrl: "https://mopsweekly.com/",
          },
        ],
      },
      fetchImpl,
    });
    const body = result.body as { findings?: unknown[] };

    expect(body.findings).toHaveLength(2);
    expect(result.droppedRows).toEqual([]);
    expect(result.livenessPassRate).toBeNull();
    expect(result.containmentPassRate).toBeNull();
    expect(result.networkUnavailable).toBe(true);
  });

  it("still drops a fetch-error row when another URL returns an HTTP status", async (): Promise<void> => {
    const fetchImpl = vi.fn(
      async (input: string, init?: RequestInit): Promise<Response> => {
        if (input.includes("offline")) {
          throw new Error("ENOTFOUND");
        }

        if (init?.method === "HEAD") {
          return response({ status: 200 });
        }

        return response({
          body: "Airtable pricing starts at $20 for the team plan.",
          status: 200,
        });
      },
    );
    const result = await applySourceLivenessGate({
      body: {
        findings: [
          {
            evidence: "Offline Co has 42 buyers.",
            sourceUrl: "https://offline.example/reviews/one",
          },
          {
            evidence: "Airtable pricing starts at $20.",
            sourceUrl: "https://www.airtable.com/pricing",
          },
        ],
      },
      fetchImpl,
    });
    const body = result.body as { findings?: unknown[] };

    expect(body.findings).toHaveLength(1);
    expect(result.droppedRows).toEqual([
      expect.objectContaining({
        reason: "fetch-error",
        sourceUrl: "https://offline.example/reviews/one",
      }),
    ]);
    expect(result.networkUnavailable).toBe(false);
    expect(result.livenessPassRate).toBe(0.5);
  });

  it("keeps rows from bot-hostile review hosts on 403 as liveness-unknown", async (): Promise<void> => {
    const fetchImpl = vi.fn(
      async (input: string): Promise<Response> =>
        response({ status: input.includes("trustpilot") ? 403 : 404 }),
    );
    const result = await applySourceLivenessGate({
      body: {
        questions: [
          {
            evidence: "Reviewers report sync failures.",
            sourceUrl: "https://www.trustpilot.com/review/airtable.com",
          },
          {
            evidence: "Airtable pricing starts at $20",
            sourceUrl: "https://example.com/dead-pricing",
          },
        ],
      },
      fetchImpl,
    });
    const body = result.body as { questions?: unknown[] };

    // The 403 from Trustpilot means "probe blocked", not "evidence dead":
    // the row survives, is recorded as liveness-unknown, and stays out of
    // the passRate denominator (only the 404 row counts — and fails).
    expect(body.questions).toHaveLength(1);
    expect(result.livenessUnknownRows).toEqual([
      {
        path: "body.questions[0]",
        sourceUrl: "https://www.trustpilot.com/review/airtable.com",
        status: 403,
      },
    ]);
    expect(result.droppedRows).toEqual([
      expect.objectContaining({
        path: "body.questions[1]",
        reason: "http-error",
      }),
    ]);
    expect(result.livenessPassRate).toBe(0);
  });

  it("still drops a 403 from a host outside the bot-hostile set", async (): Promise<void> => {
    const fetchImpl = vi.fn(async (): Promise<Response> => response({ status: 403 }));
    const result = await applySourceLivenessGate({
      body: {
        findings: [
          {
            evidence: "Airtable pricing starts at $20",
            sourceUrl: "https://example.com/blocked-pricing",
          },
        ],
      },
      fetchImpl,
    });
    const body = result.body as { findings?: unknown[] };

    expect(body.findings).toEqual([]);
    expect(result.livenessUnknownRows).toEqual([]);
    expect(result.droppedRows).toEqual([
      expect.objectContaining({ reason: "http-error" }),
    ]);
  });

  it("replaces the prose of a fully-emptied block with the blockGap summary", async (): Promise<void> => {
    const fetchImpl = vi.fn(async (): Promise<Response> => response({ status: 404 }));
    const result = await applySourceLivenessGate({
      body: {
        shareOfVoice: {
          prose:
            "Smartsheet leads the share of voice with 42 creatives across Google and Meta.",
          slices: [
            {
              evidence: "Smartsheet runs 42 creatives.",
              sourceUrl: "https://example.com/dead-share-of-voice",
            },
          ],
        },
      },
      fetchImpl,
    });
    const shareOfVoice = (result.body as Record<string, unknown>)
      .shareOfVoice as Record<string, unknown>;

    // Prose narrating the dropped rows may not keep asserting the dropped
    // numbers over an empty table: it carries the same honest gap summary.
    expect(shareOfVoice.slices).toEqual([]);
    expect(shareOfVoice.prose).toBe(
      "Public sources for this block could not be independently verified, so those rows are not shown.",
    );
    expect((shareOfVoice.blockGap as Record<string, unknown>).summary).toBe(
      shareOfVoice.prose,
    );
  });

  it("exempts preverified URLs without fetching", async (): Promise<void> => {
    const fetchImpl = vi.fn(async (): Promise<Response> => response({ status: 500 }));
    const result = await applySourceLivenessGate({
      body: {
        proof: {
          evidence: "Airtable pricing source was fetched by the tool.",
          sourceUrl: "https://www.airtable.com/pricing",
        },
      },
      fetchImpl,
      preverifiedUrls: new Set(["https://www.airtable.com/pricing"]),
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.droppedRows).toEqual([]);
    expect(result.checkedUrls[0]).toEqual(
      expect.objectContaining({
        livenessPassed: true,
        sourceUrl: "https://www.airtable.com/pricing",
      }),
    );
  });

  it("caps URL checks at the configured budget", async (): Promise<void> => {
    const fetchImpl = vi.fn(async (): Promise<Response> => response({ status: 200 }));
    const result = await applySourceLivenessGate({
      body: {
        sources: Array.from({ length: 5 }, (_, index) => ({
          sourceUrl: `https://example.com/source-${index}`,
        })),
      },
      fetchImpl,
      maxChecks: 2,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.checkedUrls).toHaveLength(2);
    expect(result.droppedRows).toEqual([]);
  });

  it("drops a fabricated-name persona row on a LIVE page while keeping the real one", async (): Promise<void> => {
    // Both URLs are HTTP 200 case-study pages on the SAME real company (West
    // Elm). The fabricated persona names a human who is NOT on the page; the
    // real persona names the human who IS. Before the requiredEntities fix,
    // the shared real company name "West Elm" carried the fabricated row past
    // .some()-over-all-entities containment.
    const fetchImpl = vi.fn(
      async (input: string, init?: RequestInit): Promise<Response> => {
        if (init?.method === "HEAD") {
          return response({ status: 200 });
        }

        if (input.includes("fabricated")) {
          return response({
            body: "West Elm uses Airtable. Read how Korin Thorig leads the team.",
            status: 200,
          });
        }

        return response({
          body: "Korin Thorig at West Elm built the base on Airtable.",
          status: 200,
        });
      },
    );
    const result = await applySourceLivenessGate({
      body: {
        personas: [
          {
            name: "Rachel Pleasants McLean",
            company: "West Elm",
            sourceUrl: "https://www.airtable.com/customer-stories/fabricated",
          },
          {
            name: "Korin Thorig",
            company: "West Elm",
            sourceUrl: "https://www.airtable.com/customer-stories/west-elm",
          },
        ],
      },
      fetchImpl,
    });
    const body = result.body as {
      personas?: Array<{ name?: string }>;
    };

    expect(body.personas).toHaveLength(1);
    expect(body.personas?.[0]?.name).toBe("Korin Thorig");
    expect(result.droppedRows).toEqual([
      expect.objectContaining({
        path: "body.personas[0]",
        reason: "containment-mismatch",
        sourceUrl: "https://www.airtable.com/customer-stories/fabricated",
      }),
    ]);
  });

  it("keeps a persona whose name and company BOTH appear on the live page", async (): Promise<void> => {
    const fetchImpl = vi.fn(
      async (_input: string, init?: RequestInit): Promise<Response> => {
        if (init?.method === "HEAD") {
          return response({ status: 200 });
        }

        return response({
          body: "Stephanie Hartgrove at Baker Hughes scaled Airtable across teams.",
          status: 200,
        });
      },
    );
    const result = await applySourceLivenessGate({
      body: {
        personas: [
          {
            name: "Stephanie Hartgrove",
            company: "Baker Hughes",
            sourceUrl: "https://www.airtable.com/customer-stories/baker-hughes",
          },
        ],
      },
      fetchImpl,
    });
    const body = result.body as { personas?: unknown[] };

    expect(body.personas).toHaveLength(1);
    expect(result.droppedRows).toEqual([]);
    expect(result.containmentPassRate).toBe(1);
  });

  it("grounds a named persona on a PREVERIFIED live page (preverified spares the probe, never the name containment)", async (): Promise<void> => {
    // Reproduces run c9bc2056: the agent fetched airtable.com/breakthroughs during
    // generation, so the URL is preverified. The live page is HTTP 200 but its
    // text does NOT contain "Sarah Koo". A preverified URL means "real/live", not
    // "this row's named human is on it" — the persona must still be name-grounded
    // and dropped when absent.
    const fetchImpl = vi.fn(
      async (_input: string, _init?: RequestInit): Promise<Response> =>
        response({
          body: "Airtable Breakthroughs showcases how teams build with Airtable.",
          status: 200,
        }),
    );
    const result = await applySourceLivenessGate({
      body: {
        personas: [
          {
            name: "Sarah Koo",
            company: "Salesforce",
            sourceUrl: "https://www.airtable.com/breakthroughs",
          },
        ],
      },
      fetchImpl,
      preverifiedUrls: new Set(["https://www.airtable.com/breakthroughs"]),
    });
    const body = result.body as { personas?: unknown[] };

    expect(body.personas).toEqual([]);
    expect(result.droppedRows).toEqual([
      expect.objectContaining({
        path: "body.personas[0]",
        reason: "containment-mismatch",
        sourceUrl: "https://www.airtable.com/breakthroughs",
      }),
    ]);
  });

  it("keeps a preverified named persona whose name IS on the live page", async (): Promise<void> => {
    const fetchImpl = vi.fn(
      async (_input: string, _init?: RequestInit): Promise<Response> =>
        response({
          body: "Sarah Koo of Salesforce shares how her team adopted Airtable.",
          status: 200,
        }),
    );
    const result = await applySourceLivenessGate({
      body: {
        personas: [
          {
            name: "Sarah Koo",
            company: "Salesforce",
            sourceUrl: "https://www.airtable.com/breakthroughs",
          },
        ],
      },
      fetchImpl,
      preverifiedUrls: new Set(["https://www.airtable.com/breakthroughs"]),
    });
    const body = result.body as { personas?: unknown[] };

    expect(body.personas).toHaveLength(1);
    expect(result.droppedRows).toEqual([]);
  });

  it("keeps a preverified named persona when the verify-time probe fetch-errors (URL is known-real)", async (): Promise<void> => {
    // A preverified URL was already fetched by the agent; a transient verify-time
    // network failure must NOT drop the row (route to livenessUnknown, not drop).
    const fetchImpl = vi.fn(async (): Promise<Response> => {
      throw new Error("network down");
    });
    const result = await applySourceLivenessGate({
      body: {
        personas: [
          {
            name: "Sarah Koo",
            company: "Salesforce",
            sourceUrl: "https://www.airtable.com/breakthroughs",
          },
        ],
      },
      fetchImpl,
      preverifiedUrls: new Set(["https://www.airtable.com/breakthroughs"]),
    });
    const body = result.body as { personas?: unknown[] };

    expect(body.personas).toHaveLength(1);
    expect(result.droppedRows).toEqual([]);
  });

  it("accepts a word-form magnitude claim against an abbreviated page form", async (): Promise<void> => {
    const fetchImpl = vi
      .fn(
        async (_input: string, _init?: RequestInit): Promise<Response> =>
          response({ status: 200 }),
      )
      .mockResolvedValueOnce(response({ status: 200 }))
      .mockResolvedValueOnce(
        response({
          body: "Ramp processes $13B in annualized card spend.",
          status: 200,
        }),
      );
    const result = await applySourceLivenessGate({
      body: {
        observations: [
          {
            evidence: "Ramp processes $13 billion in annualized card spend.",
            sourceUrl: "https://ramp.com/spend",
          },
        ],
      },
      fetchImpl,
    });
    const body = result.body as { observations?: unknown[] };

    expect(body.observations).toHaveLength(1);
    expect(result.droppedRows).toEqual([]);
  });

  it("accepts an abbreviated magnitude claim against a word-form page form", async (): Promise<void> => {
    const fetchImpl = vi
      .fn(
        async (_input: string, _init?: RequestInit): Promise<Response> =>
          response({ status: 200 }),
      )
      .mockResolvedValueOnce(response({ status: 200 }))
      .mockResolvedValueOnce(
        response({
          body: "Ramp processes $13 billion in annualized card spend.",
          status: 200,
        }),
      );
    const result = await applySourceLivenessGate({
      body: {
        observations: [
          {
            evidence: "Ramp processes $13B in annualized card spend.",
            sourceUrl: "https://ramp.com/spend",
          },
        ],
      },
      fetchImpl,
    });
    const body = result.body as { observations?: unknown[] };

    expect(body.observations).toHaveLength(1);
    expect(result.droppedRows).toEqual([]);
  });

  it("drops an abbreviated magnitude claim when the live page shows a different magnitude", async (): Promise<void> => {
    const fetchImpl = vi
      .fn(
        async (_input: string, _init?: RequestInit): Promise<Response> =>
          response({ status: 200 }),
      )
      .mockResolvedValueOnce(response({ status: 200 }))
      .mockResolvedValueOnce(
        response({
          body: "Ramp processes $13M in annualized card spend.",
          status: 200,
        }),
      );
    const result = await applySourceLivenessGate({
      body: {
        observations: [
          {
            evidence: "Ramp processes $13B in annualized card spend.",
            sourceUrl: "https://ramp.com/spend",
          },
        ],
      },
      fetchImpl,
    });
    const body = result.body as { observations?: unknown[] };

    expect(body.observations).toEqual([]);
    expect(result.droppedRows).toHaveLength(1);
  });

  it("drops a bare-integer claim that only substring-matches a larger magnitude on the page", async (): Promise<void> => {
    const fetchImpl = vi
      .fn(
        async (_input: string, _init?: RequestInit): Promise<Response> =>
          response({ status: 200 }),
      )
      .mockResolvedValueOnce(response({ status: 200 }))
      .mockResolvedValueOnce(
        response({
          body: "Ramp raised $13M in seed funding.",
          status: 200,
        }),
      );
    const result = await applySourceLivenessGate({
      body: {
        observations: [
          {
            evidence: "Ramp operates 13 distinct product lines.",
            sourceUrl: "https://ramp.com/products",
          },
        ],
      },
      fetchImpl,
    });
    const body = result.body as { observations?: unknown[] };

    expect(body.observations).toEqual([]);
    expect(result.droppedRows).toHaveLength(1);
  });
});

describe("collectPreverifiedSourceUrlsFromSteps", (): void => {
  it("collects URLs from successful tool inputs and outputs", (): void => {
    const urls = collectPreverifiedSourceUrlsFromSteps({
      steps: [
        {
          toolResults: [
            {
              input: { url: "https://www.airtable.com/pricing" },
              output: {
                sourceUrl: "https://www.g2.com/products/airtable/reviews/one",
              },
              type: "tool-result",
            },
            {
              output: { sourceUrl: "https://example.com/error" },
              type: "tool-error",
            },
          ],
        },
      ],
    });

    expect(Array.from(urls).sort()).toEqual([
      "https://www.airtable.com/pricing",
      "https://www.g2.com/products/airtable/reviews/one",
    ]);
  });
});

describe("subject CTA observation", (): void => {
  function freeSignupObservation(): ReturnType<typeof extractSubjectSiteObservation> {
    return extractSubjectSiteObservation({
      sourceUrl: "https://www.airtable.com/pricing",
      text: "[Sign up for free](/signup) [Contact sales](/contact-sales)",
    });
  }

  it("strips no-self-serve claims contradicted by observed free signup CTAs", (): void => {
    const result = stripContradictedSubjectCtaClaims({
      body: {
        funnel: {
          claim: "Airtable has no self-serve free signup path and requires a demo for activation.",
        },
      },
      observations: [freeSignupObservation()],
    });
    const body = result.body as { funnel?: { claim?: string } };

    expect(body.funnel?.claim).toContain("free, self-serve signup");
    expect(result.stripped).toEqual([
      expect.objectContaining({
        path: "body.funnel.claim",
        reason: "contradicted-subject-site-cta",
        observedCtas: ["Sign up for free"],
      }),
    ]);
  });

  it("strips affirmative demo-gate assertions contradicted by an observed free CTA", (): void => {
    const result = stripContradictedSubjectCtaClaims({
      body: {
        funnel: { claim: "Every CTA on the site routes to a demo." },
      },
      observations: [freeSignupObservation()],
    });
    const body = result.body as { funnel?: { claim?: string } };

    expect(body.funnel?.claim).toContain("free, self-serve signup");
    expect(result.stripped).toHaveLength(1);
  });

  it("never strikes funnel-arithmetic or free-tier analysis (run d838ed4e false positives)", (): void => {
    const body = {
      funnelDiagnosis: {
        prose:
          "The funnel converts 4% visitor-to-signup, but 94% of those signups never convert to paid.",
      },
      strategicInsight: {
        nonObviousRead:
          "Users can stay on the free tier indefinitely without hitting a paywall, so free users never experience a first-value-moment.",
      },
      redFlags: {
        items: [
          { actualEvidence: "No public breakdown of free vs. paid accounts." },
        ],
      },
    };

    const result = stripContradictedSubjectCtaClaims({
      body,
      observations: [freeSignupObservation()],
    });

    expect(result.stripped).toEqual([]);
    expect(result.body).toEqual(body);
  });

  it("strikes only the offending sentence, keeping the rest of the field", (): void => {
    const result = stripContradictedSubjectCtaClaims({
      body: {
        funnel: {
          claim:
            "The pricing ladder anchors on the Team plan. The website has no self-serve signup path. Expansion revenue follows seat growth.",
        },
      },
      observations: [freeSignupObservation()],
    });
    const body = result.body as { funnel?: { claim?: string } };

    expect(body.funnel?.claim).toBe(
      "The pricing ladder anchors on the Team plan. Expansion revenue follows seat growth.",
    );
    expect(result.stripped).toEqual([
      expect.objectContaining({
        path: "body.funnel.claim",
        removedText: "The website has no self-serve signup path.",
      }),
    ]);
  });

  it("ships the gap placeholder into at most one field per section", (): void => {
    const result = stripContradictedSubjectCtaClaims({
      body: {
        first: { claim: "The website offers no self-serve signup path." },
        second: { claim: "Every CTA on the homepage routes to a demo." },
      },
      observations: [freeSignupObservation()],
    });
    const body = result.body as {
      first?: { claim?: string };
      second?: { claim?: string };
    };

    // run d838ed4e pasted the identical placeholder into five strategic
    // fields. Only the FIRST fully-offending field carries it now; the
    // second keeps its text (the strike machinery records only real strips).
    expect(body.first?.claim).toContain("free, self-serve signup");
    expect(body.second?.claim).toBe(
      "Every CTA on the homepage routes to a demo.",
    );
    expect(result.stripped).toHaveLength(1);
  });

  it("emits reader-clean placeholder prose with no internal jargon (W4 E-CTA)", (): void => {
    const result = stripContradictedSubjectCtaClaims({
      body: {
        offer: {
          whyBinding: "Every CTA on the site routes to a demo.",
        },
      },
      observations: [freeSignupObservation()],
    });
    const body = result.body as { offer?: { whyBinding?: string } };
    const placeholder = body.offer?.whyBinding ?? "";

    expect(placeholder.trim().length).toBeGreaterThan(0);
    expect(placeholder).not.toMatch(/CTA|fetched|subject pages|prepass|evidence gap:/i);
    expect(result.stripped).toHaveLength(1);
  });
});
