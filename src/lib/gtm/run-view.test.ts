import { describe, expect, it } from "vitest";
import type { GtmAgentMessage } from "@/lib/gtm/agent-messages";
import type { GtmStageEvent } from "@/lib/gtm/stage-events";
import {
  buildGtmRunView,
  getGtmRunViewForUser,
  type GtmRunSourceLedgerGroup,
  type GtmRunViewQueryBuilder,
  type GtmRunViewQueryResult,
  type GtmRunViewRunRecord,
  type GtmRunViewSupabaseClient,
  type GtmRunViewTable,
  type GtmRunViewTableBuilder,
} from "@/lib/gtm/run-view";
import type { GtmArtifact } from "@/lib/types/gtm-artifact";
import type { ResearchEvidence, SourceGap } from "@/lib/gtm/schemas/evidence";

describe("buildGtmRunView", () => {
  it("normalizes an empty queued run with no related rows", () => {
    const view = buildGtmRunView({
      run: makeRun({
        status: "queued",
        stages: null,
      }),
      events: null,
      artifacts: null,
      messages: null,
    });

    expect(view.run.status).toBe("queued");
    expect(view.run.derived_status).toBe("queued");
    expect(view.events_by_stage["discover-url"]).toEqual([]);
    expect(view.artifacts_by_stage["discover-url"]).toEqual([]);
    expect(view.messages).toEqual([]);
    expect(view.stages.map((stage) => stage.status)).toEqual([
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
    expect(view.pending_dependency_reasons["discover-url"]).toBe(
      "Waiting for discover-url to start.",
    );
  });

  it("returns a completed stage with its artifact and latest event", () => {
    const startedEvent = makeEvent({
      id: "event-started",
      event_type: "started",
      message: "Started URL discovery.",
      status: "running",
      created_at: "2026-05-01T10:00:00.000Z",
    });
    const completedEvent = makeEvent({
      id: "event-completed",
      event_type: "completed",
      message: "Completed URL discovery.",
      status: "complete",
      created_at: "2026-05-01T10:01:00.000Z",
    });
    const artifact = makeArtifact({
      skill: "discover-url",
      version: 1,
      content_md: "# URL audit",
      created_at: "2026-05-01T10:01:30.000Z",
    });
    const olderMessage = makeMessage({
      id: "message-older",
      created_at: "2026-05-01T10:01:15.000Z",
    });
    const newerMessage = makeMessage({
      id: "message-newer",
      created_at: "2026-05-01T10:02:00.000Z",
    });

    const view = buildGtmRunView({
      run: makeRun({
        status: "partial",
        stages: {
          "discover-url": {
            status: "complete",
            duration_ms: 60_000,
          },
        },
      }),
      events: [completedEvent, startedEvent],
      artifacts: [artifact],
      messages: [newerMessage, olderMessage],
    });

    const discoverUrlStage = view.stages[0];

    expect(discoverUrlStage?.status).toBe("complete");
    expect(discoverUrlStage?.latest_event?.id).toBe("event-completed");
    expect(view.latest_event_by_stage["discover-url"]?.message).toBe(
      "Completed URL discovery.",
    );
    expect(discoverUrlStage?.artifacts).toEqual([artifact]);
    expect(view.artifacts_by_skill).toEqual([
      {
        skill: "discover-url",
        stage: "discover-url",
        latest_artifact: artifact,
        artifacts: [artifact],
      },
    ]);
    expect(view.messages.map((message) => message.id)).toEqual([
      "message-older",
      "message-newer",
    ]);
  });

  it("derives blockers and downstream pending dependency reasons", () => {
    const blockedEvent = makeEvent({
      id: "event-blocked",
      event_type: "blocked",
      message: "Cannot verify company identity.",
      status: "blocked",
      error: "Missing source coverage for legal company identity.",
      created_at: "2026-05-01T11:00:00.000Z",
    });

    const view = buildGtmRunView({
      run: makeRun({
        status: "awaiting_user",
        stages: {
          "discover-url": {
            status: "blocked",
            error: "Missing source coverage for legal company identity.",
            source_gaps: [
              {
                severity: "blocker",
                field: "company_identity",
                remediation: "Provide a reliable company source URL.",
              },
            ],
          },
        },
      }),
      events: [blockedEvent],
    });

    expect(view.run.status).toBe("awaiting_user");
    expect(view.run.derived_status).toBe("awaiting_user");
    expect(view.blockers[0]).toMatchObject({
      stage: "discover-url",
      reason: "Missing source coverage for legal company identity.",
      source: "stage_status",
    });
    expect(view.stages[0]?.blocker?.reason).toBe(
      "Missing source coverage for legal company identity.",
    );
    expect(view.stages[1]?.pending_dependency_reason).toBe(
      "Waiting because discover-url is blocked.",
    );
  });

  it("keeps worker output-contract blockers visible for research-icp", () => {
    const blockerReason =
      "Agent command completed with exit_code=0 but no usable output was produced. run_id=run_mddxbSjH2K stage=research-buyer-icp run_dir=/tmp/aigos-gtm-runs/run_mddxbSjH2K/06-research-buyer-icp expected_output=/tmp/aigos-gtm-runs/run_mddxbSjH2K/06-research-buyer-icp/output.json expected_fragments=/tmp/aigos-gtm-runs/run_mddxbSjH2K/06-research-buyer-icp/fragments Next action: fix the agent-owned collection step to write output.json or fragments/*.json, then rerun this stage through the existing dispatch path.";
    const blockedEvent = makeEvent({
      id: "event-icp-blocked",
      stage: "research-icp",
      event_type: "blocked",
      message: `Worker blocked research-buyer-icp: ${blockerReason}`,
      status: "blocked",
      error: blockerReason,
      created_at: "2026-05-04T05:10:00.000Z",
    });

    const view = buildGtmRunView({
      run: makeRun({
        run_id: "run_mddxbSjH2K",
        status: "awaiting_user",
        stages: {
          "research-buyer-icp": {
            status: "blocked",
            error: blockerReason,
            source_gaps: [
              {
                field: "worker",
                reason: blockerReason,
                remediation:
                  "Inspect the worker event log and rerun the stage after resolving the blocker.",
                severity: "blocker",
                confidence: 10,
              },
            ],
            artifacts: {
              run_dir:
                "/tmp/aigos-gtm-runs/run_mddxbSjH2K/06-research-buyer-icp",
              input_file:
                "/tmp/aigos-gtm-runs/run_mddxbSjH2K/06-research-buyer-icp/input.json",
            },
          },
        },
      }),
      events: [blockedEvent],
    });

    const icpStage = view.stages.find((stage) => {
      return stage.stage === "research-buyer-icp";
    });

    expect(view.run.derived_status).toBe("awaiting_user");
    expect(icpStage?.status).toBe("blocked");
    expect(icpStage?.blocker).toMatchObject({
      stage: "research-buyer-icp",
      source: "stage_status",
      reason: blockerReason,
    });
    expect(icpStage?.state.artifacts).not.toHaveProperty("output_file");
  });

  it("handles missing related rows without crashing", () => {
    const view = buildGtmRunView({
      run: makeRun({
        status: "completed",
        stages: {
          "discover-url": { status: "complete" },
          "discover-identity": { status: "complete" },
          "research-market-category": { status: "complete" },
          "research-competitors": { status: "complete" },
          "research-buyer-icp": { status: "complete" },
        },
      }),
    });

    expect(view.run.status).toBe("completed");
    expect(view.run.derived_status).toBe("completed");
    expect(view.blockers).toEqual([]);
    expect(view.stages.every((stage) => stage.latest_event === null)).toBe(true);
    expect(view.artifacts_by_skill).toEqual([]);
    expect(view.messages).toEqual([]);
  });

  it("builds a source ledger from valid evidence and gaps without citing model-only output", () => {
    const duplicateWebEvidence = makeEvidence({
      id: "evidence-company-name",
      label: "Example homepage",
      url: "https://example.com/",
      claim_path: ["companyIdentity", "companyName"],
    });
    const duplicateWebEvidenceForSecondClaim = makeEvidence({
      id: "evidence-job-titles",
      label: "Example homepage",
      url: "https://example.com/",
      claim_path: ["icp", "jobTitles"],
    });
    const userProvidedEvidence = makeEvidence({
      id: "evidence-user-goal",
      source_type: "user_input",
      label: "Founder kickoff answer",
      url: undefined,
      retrieved_at: undefined,
      claim_path: ["goal", "campaignObjective"],
    });
    const sourceGap = makeSourceGap({
      id: "gap-market-category",
      claim_path: ["market", "category"],
      severity: "degraded",
      reason: "No third-party category source was attached.",
    });

    const view = buildGtmRunView({
      run: makeRun({
        status: "partial",
        stages: {
          "research-market-category": {
            status: "complete",
            output: {
              summary: "Model synthesis mentions https://model-only.example/claim.",
              evidenceSet: {
                evidence: [
                  duplicateWebEvidence,
                  duplicateWebEvidenceForSecondClaim,
                  userProvidedEvidence,
                ],
                source_gaps: [sourceGap],
              },
            },
          },
        },
      }),
    });

    expect(view.source_ledger.source_count).toBe(2);
    expect(view.source_ledger.evidence_count).toBe(3);
    expect(view.source_ledger.source_gap_count).toBe(1);
    expect(getLedgerGroup(view.source_ledger.groups, "web_page")?.sources).toHaveLength(1);

    const webSource = getLedgerGroup(view.source_ledger.groups, "web_page")?.sources[0];
    expect(webSource?.url).toBe("https://example.com/");
    expect(webSource?.evidence_ids).toEqual([
      "evidence-company-name",
      "evidence-job-titles",
    ]);
    expect(webSource?.claim_refs.map((ref) => ref.claim_path_label)).toEqual([
      "companyIdentity.companyName",
      "icp.jobTitles",
    ]);

    const userSource = getLedgerGroup(view.source_ledger.groups, "user_input")?.sources[0];
    expect(userSource).toMatchObject({
      label: "Founder kickoff answer",
      trust_level: "user_provided",
      trust_label: "User-provided provenance",
    });

    expect(view.source_ledger.source_gaps[0]).toMatchObject({
      id: "gap-market-category",
      claim_path_label: "market.category",
      reason: "No third-party category source was attached.",
    });
    expect(
      view.source_ledger.groups.flatMap((group) => {
        return group.sources.map((source) => source.url);
      }),
    ).not.toContain("https://model-only.example/claim");
  });
});

describe("getGtmRunViewForUser", () => {
  it("scopes each server query by run_id and Clerk user_id", async () => {
    const client = new FakeSupabaseClient({
      gtm_runs: {
        data: makeRun({
          run_id: "run_scope",
          user_id: "user_scope",
        }),
        error: null,
      },
      gtm_stage_events: { data: [], error: null },
      gtm_artifacts: { data: [], error: null },
      gtm_messages: { data: [], error: null },
    });

    const view = await getGtmRunViewForUser({
      runId: "run_scope",
      userId: "user_scope",
      supabase: client,
    });

    expect(view?.run.run_id).toBe("run_scope");
    expect(client.queries).toHaveLength(4);
    for (const table of [
      "gtm_runs",
      "gtm_stage_events",
      "gtm_artifacts",
      "gtm_messages",
    ] as const) {
      const query = client.queries.find((candidate) => {
        return candidate.table === table;
      });
      expect(query?.filters).toEqual(
        expect.arrayContaining([
          { column: "run_id", value: "run_scope" },
          { column: "user_id", value: "user_scope" },
        ]),
      );
    }
  });
});

interface RecordedFilter {
  column: string;
  value: string;
}

interface RecordedOrder {
  column: string;
  ascending: boolean;
}

interface RecordedQuery {
  table: GtmRunViewTable;
  selectColumns: string | null;
  filters: RecordedFilter[];
  orders: RecordedOrder[];
}

type FakeResponseMap = Partial<
  Record<GtmRunViewTable, GtmRunViewQueryResult<unknown>>
>;

class FakeSupabaseClient implements GtmRunViewSupabaseClient {
  readonly queries: RecordedQuery[] = [];

  constructor(private readonly responses: FakeResponseMap) {}

  from(table: GtmRunViewTable): GtmRunViewTableBuilder {
    const query: RecordedQuery = {
      table,
      selectColumns: null,
      filters: [],
      orders: [],
    };
    this.queries.push(query);
    return new FakeQueryBuilder(table, query, this.responses);
  }
}

class FakeQueryBuilder implements GtmRunViewTableBuilder, GtmRunViewQueryBuilder {
  constructor(
    private readonly table: GtmRunViewTable,
    private readonly query: RecordedQuery,
    private readonly responses: FakeResponseMap,
  ) {}

  select(columns: string): GtmRunViewQueryBuilder {
    this.query.selectColumns = columns;
    return this;
  }

  eq(column: string, value: string): GtmRunViewQueryBuilder {
    this.query.filters.push({ column, value });
    return this;
  }

  order(
    column: string,
    options: { ascending?: boolean } = {},
  ): GtmRunViewQueryBuilder {
    this.query.orders.push({
      column,
      ascending: options.ascending ?? true,
    });
    return this;
  }

  maybeSingle<T>(): PromiseLike<GtmRunViewQueryResult<T | null>> {
    return Promise.resolve(this.getResult<T | null>());
  }

  returns<T>(): PromiseLike<GtmRunViewQueryResult<T>> {
    return Promise.resolve(this.getResult<T>());
  }

  private getResult<T>(): GtmRunViewQueryResult<T> {
    const response = this.responses[this.table] ?? {
      data: null,
      error: null,
    };
    return {
      data: response.data as T | null,
      error: response.error,
    };
  }
}

function makeRun(
  overrides: Partial<GtmRunViewRunRecord> = {},
): GtmRunViewRunRecord {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    run_id: "run_test",
    user_id: "user_test",
    input_url: "https://example.com",
    status: "queued",
    manifest: {},
    stages: {},
    created_at: "2026-05-01T09:00:00.000Z",
    updated_at: "2026-05-01T09:00:00.000Z",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<GtmStageEvent> = {}): GtmStageEvent {
  return {
    id: "event-test",
    run_id: "run_test",
    user_id: "user_test",
    stage: "discover-url",
    event_type: "queued",
    message: "Queued URL discovery.",
    status: "queued",
    metadata: {},
    created_at: "2026-05-01T09:00:00.000Z",
    ...overrides,
  };
}

function makeArtifact(overrides: Partial<GtmArtifact> = {}): GtmArtifact {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    run_id: "run_test",
    user_id: "user_test",
    skill: "discover-url",
    version: 1,
    parent_id: null,
    content_md: "",
    source: "skill_output",
    created_by: "worker",
    metadata: {},
    created_at: "2026-05-01T09:00:00.000Z",
    ...overrides,
  };
}

function makeMessage(overrides: Partial<GtmAgentMessage> = {}): GtmAgentMessage {
  return {
    id: "message-test",
    run_id: "run_test",
    user_id: "user_test",
    role: "assistant",
    message_type: "text",
    content: {
      text: "Run updated.",
    },
    status: "complete",
    metadata: {},
    created_at: "2026-05-01T09:00:00.000Z",
    ...overrides,
  };
}

function makeEvidence(overrides: Partial<ResearchEvidence> = {}): ResearchEvidence {
  return {
    id: "evidence-test",
    source_type: "web_page",
    label: "Example source",
    url: "https://example.com/",
    retrieved_at: "2026-05-01T09:00:00.000Z",
    confidence: "high",
    claim_path: ["companyIdentity", "companyName"],
    ...overrides,
  };
}

function makeSourceGap(overrides: Partial<SourceGap> = {}): SourceGap {
  return {
    id: "gap-test",
    claim_path: ["companyIdentity", "companyName"],
    severity: "degraded",
    reason: "No source evidence attached.",
    ...overrides,
  };
}

function getLedgerGroup(
  groups: readonly GtmRunSourceLedgerGroup[],
  sourceType: ResearchEvidence["source_type"],
): GtmRunSourceLedgerGroup | undefined {
  return groups.find((group) => {
    return group.source_type === sourceType;
  });
}
