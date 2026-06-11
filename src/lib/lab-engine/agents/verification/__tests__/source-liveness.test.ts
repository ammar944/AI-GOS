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
  it("strips no-self-serve claims contradicted by observed free signup CTAs", (): void => {
    const observation = extractSubjectSiteObservation({
      sourceUrl: "https://www.airtable.com/pricing",
      text: "[Sign up for free](/signup) [Contact sales](/contact-sales)",
    });
    const result = stripContradictedSubjectCtaClaims({
      body: {
        funnel: {
          claim: "Airtable has no self-serve free signup path and requires a demo for activation.",
        },
      },
      observations: [observation],
    });
    const body = result.body as { funnel?: { claim?: string } };

    expect(body.funnel?.claim).toContain("Evidence gap");
    expect(result.stripped).toEqual([
      expect.objectContaining({
        path: "body.funnel.claim",
        reason: "contradicted-subject-site-cta",
        observedCtas: ["Sign up for free"],
      }),
    ]);
  });
});
