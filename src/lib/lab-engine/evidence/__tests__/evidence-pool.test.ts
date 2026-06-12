import { describe, expect, it } from "vitest";

import {
  EVIDENCE_POOL_DATA_KEY,
  EVIDENCE_POOL_VERSION,
  appendEvidencePoolEntries,
  createResearchArtifactsEvidencePoolStore,
  formatEvidencePoolSlice,
  mergeEvidencePoolEntries,
  readEvidencePoolFromArtifactData,
  selectEvidencePoolEntriesForSection,
  writeEvidencePoolToArtifactData,
  type EvidencePool,
  type EvidencePoolEntry,
  type EvidencePoolStore,
  type EvidencePoolStoreReadInput,
  type EvidencePoolStoreWriteInput,
  type SupabaseEvidencePoolClient,
  type SupabaseMaybeSingleResult,
  type SupabaseResearchArtifactsFilterBuilder,
  type SupabaseResearchArtifactsQueryBuilder,
} from "../evidence-pool";

const fixedNow = new Date("2026-06-12T10:00:00.000Z");
const runInput = {
  parentAuditRunId: "00000000-0000-4000-8000-000000000001",
  runId: "run_123",
};

function now(): Date {
  return fixedNow;
}

function createEntry(
  overrides: Partial<EvidencePoolEntry> = {},
): EvidencePoolEntry {
  return {
    kind: "webSearchResult",
    sourceUrl: "https://example.com/source",
    fetchedAt: "2026-06-12T09:00:00.000Z",
    toolName: "web_search",
    payload: { title: "Example", snippet: "Observed evidence." },
    sectionId: "positioningMarketCategory",
    ...overrides,
  };
}

function createPool(entries: readonly EvidencePoolEntry[]): EvidencePool {
  return {
    version: EVIDENCE_POOL_VERSION,
    entries: [...entries],
    updatedAt: fixedNow.toISOString(),
  };
}

class ConvergingEvidencePoolStore implements EvidencePoolStore {
  private artifactData: unknown;
  private writes = 0;

  public constructor(artifactData: unknown) {
    this.artifactData = artifactData;
  }

  public get writeCount(): number {
    return this.writes;
  }

  public async readArtifactData(
    _input: EvidencePoolStoreReadInput,
  ): Promise<unknown> {
    return this.artifactData;
  }

  public async writeArtifactData(
    input: EvidencePoolStoreWriteInput,
  ): Promise<unknown> {
    this.writes += 1;

    if (this.writes === 1) {
      return {
        [EVIDENCE_POOL_DATA_KEY]: createPool([]),
      };
    }

    this.artifactData = input.data;
    return this.artifactData;
  }
}

class FakeFilterBuilder
  implements
    SupabaseResearchArtifactsFilterBuilder,
    SupabaseResearchArtifactsQueryBuilder
{
  private readonly client: FakeSupabaseEvidencePoolClient;
  private pendingUpdate: { data: Record<string, unknown> } | null = null;

  public constructor(client: FakeSupabaseEvidencePoolClient) {
    this.client = client;
  }

  public select(_columns: string): SupabaseResearchArtifactsFilterBuilder {
    return this;
  }

  public update(values: {
    data: Record<string, unknown>;
  }): SupabaseResearchArtifactsFilterBuilder {
    this.pendingUpdate = values;
    return this;
  }

  public eq(
    _column: string,
    _value: string,
  ): SupabaseResearchArtifactsFilterBuilder {
    return this;
  }

  public async maybeSingle(): Promise<SupabaseMaybeSingleResult> {
    if (this.pendingUpdate !== null) {
      this.client.row = { data: this.pendingUpdate.data };
    }

    return { data: this.client.row, error: null };
  }
}

class FakeSupabaseEvidencePoolClient implements SupabaseEvidencePoolClient {
  public row: { data: unknown } | null = { data: { existing: true } };

  public from(table: "research_artifacts"): SupabaseResearchArtifactsQueryBuilder {
    if (table !== "research_artifacts") {
      throw new Error(`Unexpected table ${table}`);
    }

    return new FakeFilterBuilder(this);
  }
}

describe("evidence pool artifact data storage", (): void => {
  it("reads an empty versioned pool when the artifact data has no pool key", (): void => {
    const pool = readEvidencePoolFromArtifactData({ existing: true }, now);

    expect(pool).toEqual({
      version: EVIDENCE_POOL_VERSION,
      entries: [],
      updatedAt: fixedNow.toISOString(),
    });
  });

  it("writes the pool without dropping unrelated artifact data keys", (): void => {
    const pool = createPool([createEntry()]);
    const artifactData = writeEvidencePoolToArtifactData(
      { existing: true },
      pool,
    );

    expect(artifactData).toEqual({
      existing: true,
      [EVIDENCE_POOL_DATA_KEY]: pool,
    });
  });

  it("deduplicates repeated entries by stable content signature", (): void => {
    const entry = createEntry({
      payload: { b: "second", a: "first" },
    });
    const duplicate = createEntry({
      payload: { a: "first", b: "second" },
    });

    const pool = mergeEvidencePoolEntries(createPool([entry]), [duplicate], now);

    expect(pool.entries).toHaveLength(1);
  });
});

describe("evidence pool section routing", (): void => {
  it("selects run-level relevant evidence and same-section evidence by recency", (): void => {
    const marketEntry = createEntry({
      fetchedAt: "2026-06-12T09:00:00.000Z",
      payload: { snippet: "Market evidence" },
      sectionId: "positioningMarketCategory",
    });
    const keywordEntry = createEntry({
      kind: "spyfuKeywordTable",
      fetchedAt: "2026-06-12T09:30:00.000Z",
      payload: { rows: [{ keyword: "crm automation", volume: 1000 }] },
      sectionId: undefined,
      toolName: "spyfu",
    });
    const competitorAdEntry = createEntry({
      kind: "adLibraryPull",
      fetchedAt: "2026-06-12T09:45:00.000Z",
      payload: { ads: ["Competitor ad"] },
      sectionId: "positioningCompetitorLandscape",
      toolName: "meta_ads",
    });

    const selected = selectEvidencePoolEntriesForSection({
      pool: createPool([marketEntry, keywordEntry, competitorAdEntry]),
      sectionId: "positioningDemandIntent",
    });

    expect(selected).toEqual([keywordEntry]);
  });

  it("gives paid media the full pool", (): void => {
    const entries = [
      createEntry({ sectionId: "positioningMarketCategory" }),
      createEntry({
        kind: "adLibraryPull",
        sectionId: "positioningCompetitorLandscape",
        toolName: "meta_ads",
      }),
      createEntry({
        kind: "admittedQuote",
        sectionId: "positioningVoiceOfCustomer",
        toolName: "reviews",
      }),
    ];

    const selected = selectEvidencePoolEntriesForSection({
      pool: createPool(entries),
      sectionId: "positioningPaidMediaPlan",
    });

    expect(selected).toHaveLength(entries.length);
  });

  it("formats a bounded prompt evidence block with provenance fields", (): void => {
    const formatted = formatEvidencePoolSlice({
      maxChars: 500,
      pool: createPool([
        createEntry({
          sourceUrl: "https://example.com/category",
          payload: { snippet: "Category evidence" },
        }),
      ]),
      sectionId: "positioningMarketCategory",
    });

    expect(formatted).toContain("Run-level evidence pool");
    expect(formatted).toContain("sourceUrl: https://example.com/category");
    expect(formatted).toContain("toolName: web_search");
    expect(formatted).toContain("Category evidence");
  });
});

describe("appendEvidencePoolEntries", (): void => {
  it("retries until appended entries are visible after a concurrent overwrite", async (): Promise<void> => {
    const store = new ConvergingEvidencePoolStore({ existing: true });
    const entry = createEntry();

    const pool = await appendEvidencePoolEntries({
      ...runInput,
      entries: [entry],
      maxAttempts: 2,
      now,
      store,
    });

    expect(pool.entries).toEqual([entry]);
    expect(store.writeCount).toBe(2);
  });
});

describe("createResearchArtifactsEvidencePoolStore", (): void => {
  it("reads and writes research_artifacts.data through the Supabase adapter", async (): Promise<void> => {
    const client = new FakeSupabaseEvidencePoolClient();
    const store = createResearchArtifactsEvidencePoolStore(client);

    await expect(store.readArtifactData(runInput)).resolves.toEqual({
      existing: true,
    });

    await expect(
      store.writeArtifactData({ ...runInput, data: { next: true } }),
    ).resolves.toEqual({ next: true });
    expect(client.row).toEqual({ data: { next: true } });
  });
});
