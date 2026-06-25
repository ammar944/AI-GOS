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

interface CapturedSelect {
  table: string;
  columns: string;
  column: string;
  value: unknown;
}

function createFakeSupabaseClient(captured: CapturedInsert[]): {
  from: (table: string) => {
    insert: (rows: Record<string, unknown>[]) => Promise<{ error: null }>;
    select: (columns: string) => {
      eq: (
        column: string,
        value: unknown,
      ) => Promise<{ data: Record<string, unknown>[]; error: null }>;
    };
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
      // These insert-only tests never call getFacts; stub select to satisfy
      // the (now select-capable) ResearchFactsSupabaseClient interface.
      select: (_columns: string) => ({
        eq: async (): Promise<{
          data: Record<string, unknown>[];
          error: null;
        }> => ({ data: [], error: null }),
      }),
    }),
  };
}

// A fake client backed by an in-memory rows table so a SELECT issued by one
// store instance returns rows INSERTed by a different (sibling) store instance
// — the cross-instance case the in-process echo array structurally cannot
// cover. Mirrors the real Supabase `.select(cols).eq(col, val)` builder shape.
function createBackedSupabaseClient(table: Record<string, unknown>[]): {
  capturedSelects: CapturedSelect[];
  client: {
    from: (table: string) => {
      insert: (rows: Record<string, unknown>[]) => Promise<{ error: null }>;
      select: (columns: string) => {
        eq: (
          column: string,
          value: unknown,
        ) => Promise<{
          data: Record<string, unknown>[];
          error: null;
        }>;
      };
    };
  };
} {
  const capturedSelects: CapturedSelect[] = [];
  return {
    capturedSelects,
    client: {
      from: (tableName: string) => ({
        insert: async (
          rows: Record<string, unknown>[],
        ): Promise<{ error: null }> => {
          for (const row of rows) table.push(row);
          return { error: null };
        },
        select: (columns: string) => ({
          eq: async (
            column: string,
            value: unknown,
          ): Promise<{ data: Record<string, unknown>[]; error: null }> => {
            capturedSelects.push({ table: tableName, columns, column, value });
            return {
              data: table.filter((row) => row[column] === value),
              error: null,
            };
          },
        }),
      }),
    },
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

  it("getFacts SELECTs research_facts by parent_audit_run_id and returns a SIBLING-written fact (cross-instance)", async () => {
    const table: Record<string, unknown>[] = [];
    const { client, capturedSelects } = createBackedSupabaseClient(table);

    // Sibling instance A (e.g. the orchestrator) writes a fact.
    const writerStore = createResearchArtifactsResearchFactStore(
      client,
      "parent_xyz",
    );
    await writerStore.appendFacts([
      makeValidFact({
        runId: "orchestrator_run",
        parentAuditRunId: "parent_xyz",
        claimToken: "Sibling Fact",
        sourceQuote: "Sibling Fact — written by instance A",
      }),
    ]);

    // Instance B (a section) has an EMPTY in-process array but must still see
    // the sibling fact via the DB SELECT.
    const readerStore = createResearchArtifactsResearchFactStore(
      client,
      "parent_xyz",
    );
    const facts = await readerStore.getFacts();

    expect(capturedSelects).toEqual([
      expect.objectContaining({
        table: "research_facts",
        column: "parent_audit_run_id",
        value: "parent_xyz",
      }),
    ]);
    expect(facts.map((f) => f.claimToken)).toContain("Sibling Fact");
    const sibling = facts.find((f) => f.claimToken === "Sibling Fact");
    expect(sibling?.parentAuditRunId).toBe("parent_xyz");
    expect(sibling?.sourceUrl).toBe("https://ramp.com/customers/example");
  });

  it("getFacts returns the UNION of in-process appended facts AND DB-selected facts, deduped", async () => {
    const table: Record<string, unknown>[] = [];
    const { client } = createBackedSupabaseClient(table);

    // A pre-existing DB row written by a sibling under the same parent.
    table.push({
      run_id: "sibling_run",
      parent_audit_run_id: "parent_xyz",
      section_id: "positioningVoiceOfCustomer",
      fact_kind: "voc_quote",
      source_url: "https://example.com/review",
      source_quote: "DB-only fact",
      claim_token: "DB-only",
      payload: null,
      created_at: "2026-06-24T00:00:00.000Z",
    });

    const store = createResearchArtifactsResearchFactStore(client, "parent_xyz");

    // This store appends its OWN in-process fact (which is also written to the
    // backing table, so it would appear in BOTH the appended array AND the
    // SELECT — the dedup must collapse it to one).
    await store.appendFacts([
      makeValidFact({
        runId: "own_run",
        parentAuditRunId: "parent_xyz",
        claimToken: "Own Fact",
        sourceQuote: "Own Fact — appended in-process",
      }),
    ]);

    const facts = await store.getFacts();
    const tokens = facts.map((f) => f.claimToken).sort();

    // Union: both the DB-only fact and the own appended fact are present.
    expect(tokens).toContain("DB-only");
    expect(tokens).toContain("Own Fact");
    // Dedup: the own fact (in BOTH appended array and SELECT) appears once.
    expect(facts.filter((f) => f.claimToken === "Own Fact")).toHaveLength(1);
  });

  it("getFacts falls back to in-process facts when the research_facts table is absent", async () => {
    const table: Record<string, unknown>[] = [];
    const client = {
      from: (tableName: string) => ({
        insert: async (
          rows: Record<string, unknown>[],
        ): Promise<{ error: null }> => {
          expect(tableName).toBe("research_facts");
          for (const row of rows) table.push(row);
          return { error: null };
        },
        select: (_columns: string) => ({
          eq: async (): Promise<{
            data: null;
            error: { code: string; message: string };
          }> => ({
            data: null,
            error: {
              code: "PGRST205",
              message:
                "Could not find the table 'public.research_facts' in the schema cache",
            },
          }),
        }),
      }),
    };
    const store = createResearchArtifactsResearchFactStore(
      client,
      "parent_xyz",
    );

    await store.appendFacts([
      makeValidFact({
        parentAuditRunId: "parent_xyz",
        claimToken: "Own Fact",
        sourceQuote: "Own Fact — appended in-process",
      }),
    ]);

    await expect(store.getFacts()).resolves.toMatchObject([
      { claimToken: "Own Fact" },
    ]);
  });

  it("getFacts returns ONLY in-process appended facts when no parentAuditRunId is supplied (no SELECT)", async () => {
    const table: Record<string, unknown>[] = [];
    const { client, capturedSelects } = createBackedSupabaseClient(table);

    // A row exists under some parent, but this store was constructed WITHOUT a
    // parentAuditRunId, so it must not issue a SELECT.
    table.push({
      run_id: "other_run",
      parent_audit_run_id: "parent_other",
      section_id: "positioningVoiceOfCustomer",
      fact_kind: "voc_quote",
      source_url: "https://example.com/review",
      source_quote: "Unrelated DB fact",
      claim_token: "Unrelated",
      payload: null,
      created_at: "2026-06-24T00:00:00.000Z",
    });

    const store = createResearchArtifactsResearchFactStore(client);
    await store.appendFacts([
      makeValidFact({ claimToken: "Echo Only", sourceQuote: "Echo Only fact" }),
    ]);

    const facts = await store.getFacts();
    expect(capturedSelects).toHaveLength(0);
    expect(facts.map((f) => f.claimToken)).toEqual(["Echo Only"]);
  });
});
