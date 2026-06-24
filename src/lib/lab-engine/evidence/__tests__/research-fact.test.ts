import { describe, expect, it } from "vitest";

import {
  appendResearchFactsBestEffort,
  createInMemoryResearchFactStore,
  createNoopResearchFactStore,
  getResearchFactStorageContext,
  readResearchFactsFromStore,
  researchFactSchema,
  type ResearchFact,
} from "@/lib/lab-engine/evidence/research-fact";

function makeValidFact(overrides: Partial<ResearchFact> = {}): ResearchFact {
  return {
    runId: "run_123",
    sectionId: "positioningBuyerICP",
    factKind: "named_champion",
    sourceUrl: "https://ramp.com/customers/example",
    sourceQuote: "Bill Cox — VP Finance, Example Co",
    claimToken: "Bill Cox",
    createdAt: "2026-06-18T00:00:00.000Z",
    ...overrides,
  };
}

describe("researchFactSchema", () => {
  it("accepts a full valid fact", () => {
    const result = researchFactSchema.safeParse(makeValidFact());
    expect(result.success).toBe(true);
  });

  it("rejects a missing source_url", () => {
    const { sourceUrl: _omit, ...withoutUrl } = makeValidFact();
    const result = researchFactSchema.safeParse(withoutUrl);
    expect(result.success).toBe(false);
  });

  it("rejects a non-http source_url", () => {
    const result = researchFactSchema.safeParse(
      makeValidFact({ sourceUrl: "ftp://example.com/file" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an empty-string source_url", () => {
    const result = researchFactSchema.safeParse(
      makeValidFact({ sourceUrl: "" }),
    );
    expect(result.success).toBe(false);
  });
});

describe("createInMemoryResearchFactStore", () => {
  it("round-trips appended facts", async () => {
    const store = createInMemoryResearchFactStore();
    const factA = makeValidFact({ claimToken: "Bill Cox" });
    const factB = makeValidFact({ claimToken: "Lauren Feeney" });

    await store.appendFacts([factA]);
    await store.appendFacts([factB]);

    const stored = await store.getFacts();
    expect(stored).toHaveLength(2);
    expect(stored.map((fact) => fact.claimToken)).toEqual([
      "Bill Cox",
      "Lauren Feeney",
    ]);
  });
});

describe("readResearchFactsFromStore", () => {
  it("validates getFacts output before callers consume ledger rows", async () => {
    const store = createInMemoryResearchFactStore();
    const fact = makeValidFact({ claimToken: "Validated" });
    store.appendFacts([fact]);

    expect(await readResearchFactsFromStore(store)).toEqual([fact]);
  });

  it("throws an actionable error for malformed ledger facts", async () => {
    const malformedStore = {
      getFacts: async (): Promise<ResearchFact[]> =>
        [
          {
            ...makeValidFact(),
            sourceUrl: "",
          },
        ] as ResearchFact[],
    };

    await expect(readResearchFactsFromStore(malformedStore)).rejects.toThrow(
      "research_facts getFacts returned invalid facts",
    );
  });
});

describe("getResearchFactStorageContext", () => {
  it("returns null when factStore is missing", () => {
    expect(
      getResearchFactStorageContext({ parentAuditRunId: "parent_1" }),
    ).toBeNull();
  });

  it("returns null when parentAuditRunId is missing", () => {
    expect(
      getResearchFactStorageContext({
        factStore: createInMemoryResearchFactStore(),
      }),
    ).toBeNull();
  });

  it("returns the context when both are present", () => {
    const store = createInMemoryResearchFactStore();
    const context = getResearchFactStorageContext({
      parentAuditRunId: "parent_1",
      factStore: store,
    });
    expect(context).not.toBeNull();
    expect(context?.parentAuditRunId).toBe("parent_1");
    expect(context?.store).toBe(store);
  });
});

describe("appendResearchFactsBestEffort", () => {
  it("swallows a throwing store and never rethrows", async () => {
    const throwingStore = {
      appendFacts: (): void => {
        throw new Error("boom");
      },
      getFacts: async (): Promise<ResearchFact[]> => [],
    };

    await expect(
      appendResearchFactsBestEffort(throwingStore, [makeValidFact()]),
    ).resolves.toBeUndefined();
  });

  it("is a no-op for the noop store", async () => {
    const store = createNoopResearchFactStore();
    await expect(
      appendResearchFactsBestEffort(store, [makeValidFact()]),
    ).resolves.toBeUndefined();
    expect(await store.getFacts()).toEqual([]);
  });
});
