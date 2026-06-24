import { describe, expect, it, vi } from "vitest";

import {
  generateAgenticGLMOrchestrator,
  orchestratorGtmFieldsSchema,
  buildOrchestratorFactsFromTranscript,
  buildOrchestratorTools,
  IDENTITY_LOCK_PREAMBLE,
  ORCHESTRATOR_MAX_STEPS,
} from "@/lib/lab-engine/agents/orchestrator-glm";
import type { TranscriptRecord } from "@/lib/lab-engine/agents/verification/provenance-detect";

// parseOrchestratorGtmFieldsFromText is not exported (internal); test via the
// schema + the public promoter/tools builder instead. The live harness
// (scripts/zz-orchestrator-glm.ts) covers the end-to-end text parse.

describe("orchestrator-glm — schema", () => {
  it("admits a complete GTM fields object", () => {
    const parsed = orchestratorGtmFieldsSchema.safeParse({
      companyName: "Clay",
      category: "GTM Data Infrastructure",
      productDescription: "A GTM platform.",
      targetCustomer: "GTM engineers",
      topCompetitors: ["ZoomInfo", "Apollo.io"],
      marketProblem: "Stitched-together point tools.",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a missing required field", () => {
    const parsed = orchestratorGtmFieldsSchema.safeParse({
      companyName: "Clay",
      category: "GTM Data Infrastructure",
      // productDescription missing
      targetCustomer: "GTM engineers",
      topCompetitors: ["ZoomInfo"],
      marketProblem: "x",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a non-array topCompetitors", () => {
    const parsed = orchestratorGtmFieldsSchema.safeParse({
      companyName: "Clay",
      category: "x",
      productDescription: "y",
      targetCustomer: "z",
      topCompetitors: "ZoomInfo",
      marketProblem: "w",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("orchestrator-glm — buildOrchestratorTools", () => {
  it("includes web_search + firecrawl when FIRECRAWL_API_KEY is set", () => {
    const tools = buildOrchestratorTools({ FIRECRAWL_API_KEY: "k" });
    expect(Object.keys(tools).sort()).toEqual(["firecrawl", "web_search"]);
  });

  it("includes perplexity_research when PERPLEXITY_API_KEY is set", () => {
    const tools = buildOrchestratorTools({
      FIRECRAWL_API_KEY: "k",
      PERPLEXITY_API_KEY: "p",
    });
    expect(tools.perplexity_research).toBeDefined();
    expect(tools.web_search).toBeDefined();
    expect(tools.firecrawl).toBeDefined();
  });

  it("drops every tool when no credentials are present", () => {
    const tools = buildOrchestratorTools({});
    expect(Object.keys(tools)).toEqual([]);
  });
});

describe("orchestrator-glm — buildOrchestratorFactsFromTranscript", () => {
  it("promotes each URL-bearing successful tool result to one ledger fact", () => {
    const transcript: TranscriptRecord[] = [
      {
        step: 0,
        toolName: "firecrawl",
        toolCallId: "call_1",
        input: { url: "https://www.clay.com" },
        output: {
          url: "https://www.clay.com",
          title: "Clay homepage",
          markdown: "Build systems to grow revenue.",
        },
        isError: false,
      },
      {
        step: 1,
        toolName: "web_search",
        toolCallId: "call_2",
        input: { query: "clay vs zoominfo" },
        output: {
          url: "https://g2.com/products/clay-com-clay/reviews",
          title: "Clay reviews on G2",
          text: "Clay has become the orchestration layer for everything GTM.",
        },
        isError: false,
      },
    ];

    const facts = buildOrchestratorFactsFromTranscript(transcript, {
      runId: "run_1",
      createdAt: "2026-06-24T00:00:00.000Z",
    });

    expect(facts).toHaveLength(2);
    expect(facts[0].sectionId).toBe("orchestrator");
    expect(facts[0].factKind).toBe("corpus_excerpt");
    expect(facts[0].sourceUrl).toBe("https://www.clay.com");
    expect(facts[1].sourceUrl).toBe("https://g2.com/products/clay-com-clay/reviews");
  });

  it("drops entries with no URL, non-http URLs, errors, and duplicate URLs", () => {
    const transcript: TranscriptRecord[] = [
      {
        step: 0,
        toolName: "firecrawl",
        toolCallId: "call_a",
        input: {},
        output: { title: "no url here", text: "x" },
        isError: false,
      },
      {
        step: 1,
        toolName: "web_search",
        toolCallId: "call_b",
        input: {},
        output: { url: "ftp://not-http.example", title: "x", text: "y" },
        isError: false,
      },
      {
        step: 2,
        toolName: "perplexity_research",
        toolCallId: "call_c",
        input: {},
        output: { url: "https://www.clay.com", title: "dup", text: "y" },
        isError: true,
      },
      {
        step: 3,
        toolName: "firecrawl",
        toolCallId: "call_d",
        input: {},
        output: { url: "https://www.clay.com", title: "first", text: "y" },
        isError: false,
      },
      {
        step: 4,
        toolName: "firecrawl",
        toolCallId: "call_e",
        input: {},
        output: { url: "https://www.clay.com", title: "dup url", text: "y" },
        isError: false,
      },
    ];

    const facts = buildOrchestratorFactsFromTranscript(transcript, {
      runId: "run_2",
      createdAt: "2026-06-24T00:00:00.000Z",
    });

    expect(facts).toHaveLength(1);
    expect(facts[0].sourceUrl).toBe("https://www.clay.com");
  });

  it("threads parentAuditRunId onto every promoted fact when provided", () => {
    const transcript: TranscriptRecord[] = [
      {
        step: 0,
        toolName: "firecrawl",
        toolCallId: "call_x",
        input: {},
        output: { url: "https://example.com", title: "x", text: "y" },
        isError: false,
      },
    ];

    const facts = buildOrchestratorFactsFromTranscript(transcript, {
      runId: "run_3",
      createdAt: "2026-06-24T00:00:00.000Z",
      parentAuditRunId: "parent_3",
    });

    expect(facts).toHaveLength(1);
    expect(facts[0].parentAuditRunId).toBe("parent_3");
  });
});

describe("orchestrator-glm — constants + preamble", () => {
  it("ORCHESTRATOR_MAX_STEPS is bounded (<=16, the proven cap)", () => {
    expect(ORCHESTRATOR_MAX_STEPS).toBeLessThanOrEqual(16);
    expect(ORCHESTRATOR_MAX_STEPS).toBeGreaterThan(0);
  });

  it("IDENTITY_LOCK_PREAMBLE names the disambiguator", () => {
    expect(IDENTITY_LOCK_PREAMBLE).toContain("website");
    expect(IDENTITY_LOCK_PREAMBLE.toLowerCase()).toContain("identity");
  });
});

describe("orchestrator-glm — onStepFinish progress hook", () => {
  it("threads onStepFinish into generateText and surfaces each step", async () => {
    const onStepFinish = vi.fn();
    // DI seam: a fake generateText that drives two steps through the callback,
    // then returns the minimal shape the orchestrator reads (text + steps).
    const generateTextImpl = vi.fn(async (options: { onStepFinish?: unknown }) => {
      const cb = options.onStepFinish as
        | ((step: unknown) => void | Promise<void>)
        | undefined;
      await cb?.({ stepNumber: 0 });
      await cb?.({ stepNumber: 1 });
      return { text: "", steps: [{}, {}] };
    }) as unknown as Parameters<
      typeof generateAgenticGLMOrchestrator
    >[0]["generateTextImpl"];

    const result = await generateAgenticGLMOrchestrator({
      websiteUrl: "https://clay.com",
      onboardingBrief: "{}",
      env: {},
      tools: {},
      onStepFinish,
      generateTextImpl,
    });

    expect(onStepFinish).toHaveBeenCalledTimes(2);
    expect(onStepFinish).toHaveBeenNthCalledWith(1, { stepNumber: 0 });
    expect(result.stepCount).toBe(2);
  });

  it("omits onStepFinish from the generateText call when not supplied", async () => {
    let receivedKeys: string[] = [];
    const generateTextImpl = vi.fn(async (options: Record<string, unknown>) => {
      receivedKeys = Object.keys(options);
      return { text: "", steps: [] };
    }) as unknown as Parameters<
      typeof generateAgenticGLMOrchestrator
    >[0]["generateTextImpl"];

    await generateAgenticGLMOrchestrator({
      websiteUrl: "https://clay.com",
      onboardingBrief: "{}",
      env: {},
      tools: {},
      generateTextImpl,
    });

    expect(receivedKeys).not.toContain("onStepFinish");
  });
});