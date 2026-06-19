import { describe, expect, it } from "vitest";

import {
  createResearchArtifactsResearchFactStore,
  type ResearchFact,
} from "@/lib/lab-engine/evidence/research-fact";

function makeValidFact(overrides: Partial<ResearchFact> = {}): ResearchFact {
  return {
    runId: "run_123",
    parentAuditRunId: "parent_1",
    sectionId: "positioningBuyerICP",
    factKind: "named_champion",
    sourceUrl: "https://ramp.com/customers/example",
    sourceQuote: "Bill Cox — VP Finance, Example Co",
    claimToken: "Bill Cox",
    createdAt: "2026-06-18T00:00:00.000Z",
    ...overrides,
  };
}

interface CapturedInsert {
  table: string;
  rows: Record<string, unknown>[];
}

function createFakeSupabaseClient(captured: CapturedInsert[]): {
  from: (table: string) => {
    insert: (rows: Record<string, unknown>[]) => Promise<{ error: null }>;
  };
} {
  return {
    from: (table: string) => ({
      insert: async (
        rows: Record<string, unknown>[],
      ): Promise<{ error: null }> => {
        captured.push({ table, rows });
        return { error: null };
      },
    }),
  };
}

describe("createResearchArtifactsResearchFactStore", () => {
  it("issues one insert per fact and every inserted row carries a non-empty source_url", async () => {
    const captured: CapturedInsert[] = [];
    const client = createFakeSupabaseClient(captured);
    const store = createResearchArtifactsResearchFactStore(client);

    await store.appendFacts([
      makeValidFact({ claimToken: "Bill Cox" }),
      makeValidFact({
        claimToken: "Lauren Feeney",
        sourceUrl: "https://ramp.com/customers/other",
      }),
    ]);

    expect(captured).toHaveLength(2);
    for (const insert of captured) {
      expect(insert.table).toBe("research_facts");
      expect(insert.rows).toHaveLength(1);
      const [row] = insert.rows;
      expect(typeof row.source_url).toBe("string");
      expect((row.source_url as string).length).toBeGreaterThan(0);
    }

    expect(captured.map((insert) => insert.rows[0]?.source_url)).toEqual([
      "https://ramp.com/customers/example",
      "https://ramp.com/customers/other",
    ]);
    expect(captured.map((insert) => insert.rows[0]?.claim_token)).toEqual([
      "Bill Cox",
      "Lauren Feeney",
    ]);
  });

  it("maps canonical fact fields onto snake_case columns", async () => {
    const captured: CapturedInsert[] = [];
    const client = createFakeSupabaseClient(captured);
    const store = createResearchArtifactsResearchFactStore(client);

    await store.appendFacts([makeValidFact()]);

    const [row] = captured[0].rows;
    expect(row.run_id).toBe("run_123");
    expect(row.parent_audit_run_id).toBe("parent_1");
    expect(row.section_id).toBe("positioningBuyerICP");
    expect(row.fact_kind).toBe("named_champion");
    expect(row.source_quote).toBe("Bill Cox — VP Finance, Example Co");
    expect(row.claim_token).toBe("Bill Cox");
  });
});
