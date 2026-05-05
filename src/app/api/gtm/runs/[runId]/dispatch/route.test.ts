import { auth } from "@clerk/nextjs/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchSkill } from "@/lib/gtm/dispatch-skill";
import {
  buildGtmPrefillManifestFromDiscovery,
  confirmGtmPrefillManifest,
} from "@/lib/gtm/onboarding/prefill";
import { dispatchGtmWorkerStage } from "@/lib/gtm/worker-dispatch";
import { createClient } from "@/lib/supabase/server";
import { POST } from "./route";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/gtm/worker-dispatch", () => ({
  dispatchGtmWorkerStage: vi.fn(),
}));

vi.mock("@/lib/gtm/dispatch-skill", () => ({
  dispatchSkill: vi.fn(),
}));

const mockAuth = vi.mocked(auth);
const mockCreateClient = vi.mocked(createClient);
const mockDispatchGtmWorkerStage = vi.mocked(dispatchGtmWorkerStage);
const mockDispatchSkill = vi.mocked(dispatchSkill);
const NOW = "2026-05-04T12:00:00.000Z";

describe("GTM run dispatch route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "user_1" } as Awaited<ReturnType<typeof auth>>);
    mockDispatchGtmWorkerStage.mockResolvedValue({
      run_id: "run_1",
      stage: "research-competitors",
      status: "accepted",
    });
  });

  it("returns 202 and dispatches discover-url without requiring prefill review", async () => {
    const updates: unknown[] = [];
    const inserts: unknown[] = [];
    mockDispatchGtmWorkerStage.mockResolvedValue({
      run_id: "run_1",
      stage: "discover-url",
      status: "accepted",
    });
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock({
        updates,
        inserts,
        run: makeRun({ status: "queued", stages: {} }),
      }) as Awaited<ReturnType<typeof createClient>>
    );

    const response = await POST(
      new Request("http://localhost/api/gtm/runs/run_1/dispatch", {
        method: "POST",
        body: JSON.stringify({ stage: "discover-url" }),
      }),
      { params: Promise.resolve({ runId: "run_1" }) }
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(202);
    expect(payload).toEqual({
      run_id: "run_1",
      stage: "discover-url",
      status: "accepted",
    });
    expect(mockDispatchGtmWorkerStage).toHaveBeenCalledWith({
      runId: "run_1",
      userId: "user_1",
      inputUrl: "https://airtable.com/",
      stage: "discover-url",
    });
    expect(mockDispatchSkill).not.toHaveBeenCalled();
    expect(updates).toHaveLength(1);
    expect(inserts).toHaveLength(1);
  });

  it("reruns a blocked stage by clearing its error and queueing the canonical worker stage", async () => {
    const updates: unknown[] = [];
    const inserts: unknown[] = [];
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock({
        updates,
        inserts,
        run: makeRun({
          status: "awaiting_user",
          manifest: {
            gtm_prefill: buildConfirmedPrefill(),
          },
          stages: {
            "research-buyer-icp": {
              status: "blocked",
              error:
                "Agent exited 0 but produced no output.json or fragments.",
              artifacts: {
                run_dir:
                  "/tmp/aigos-gtm-runs/run_1/06-research-buyer-icp",
              },
            },
          },
        }),
      }) as Awaited<ReturnType<typeof createClient>>
    );

    const response = await POST(
      new Request("http://localhost/api/gtm/runs/run_1/dispatch", {
        method: "POST",
        body: JSON.stringify({ stage: "research-icp", rerun: true }),
      }),
      { params: Promise.resolve({ runId: "run_1" }) }
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(202);
    expect(payload).toEqual({
      run_id: "run_1",
      stage: "research-buyer-icp",
      status: "accepted",
      rerun: true,
    });
    expect(mockDispatchGtmWorkerStage).toHaveBeenCalledWith({
      runId: "run_1",
      userId: "user_1",
      inputUrl: "https://airtable.com/",
      stage: "research-buyer-icp",
    });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      status: "running",
      stages: {
        "research-buyer-icp": {
          status: "queued",
          artifacts: {
            run_dir: "/tmp/aigos-gtm-runs/run_1/06-research-buyer-icp",
          },
        },
      },
    });
    const queuedStage = getUpdatedStage(updates[0], "research-buyer-icp");
    expect(queuedStage).not.toHaveProperty("error");
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      run_id: "run_1",
      user_id: "user_1",
      stage: "research-buyer-icp",
      event_type: "queued",
      status: "queued",
      metadata: {
        input_url: "https://airtable.com/",
        rerun: true,
        previous_status: "blocked",
      },
    });
  });

  it("rejects rerun for a complete stage without dispatching", async () => {
    const updates: unknown[] = [];
    const inserts: unknown[] = [];
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock({
        updates,
        inserts,
        run: makeRun({
          status: "completed",
          stages: {
            "discover-url": {
              status: "complete",
            },
          },
        }),
      }) as Awaited<ReturnType<typeof createClient>>
    );

    const response = await POST(
      new Request("http://localhost/api/gtm/runs/run_1/dispatch", {
        method: "POST",
        body: JSON.stringify({ stage: "discover-url", rerun: true }),
      }),
      { params: Promise.resolve({ runId: "run_1" }) }
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: "gtm_run_stage_rerun_conflict",
      run_id: "run_1",
      stage: "discover-url",
      stage_status: "complete",
    });
    expect(mockDispatchGtmWorkerStage).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
    expect(inserts).toEqual([]);
  });

  it("blocks locked research stages when the run has no manifest", async () => {
    const updates: unknown[] = [];
    const inserts: unknown[] = [];
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock({
        updates,
        inserts,
        run: makeRun({
          status: "partial",
          manifest: null,
          stages: {
            "discover-url": {
              status: "complete",
            },
          },
        }),
      }) as Awaited<ReturnType<typeof createClient>>
    );

    const response = await POST(
      new Request("http://localhost/api/gtm/runs/run_1/dispatch", {
        method: "POST",
        body: JSON.stringify({ stage: "research-competitor" }),
      }),
      { params: Promise.resolve({ runId: "run_1" }) }
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: "gtm_prefill_review_required",
      run_id: "run_1",
      stage: "research-competitors",
      prefill_status: "missing",
    });
    expect(mockDispatchGtmWorkerStage).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
    expect(inserts).toEqual([]);
  });

  it("blocks locked research stages when gtm_prefill is missing from the manifest", async () => {
    const updates: unknown[] = [];
    const inserts: unknown[] = [];
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock({
        updates,
        inserts,
        run: makeRun({
          status: "partial",
          manifest: {},
          stages: {
            "discover-url": {
              status: "complete",
            },
          },
        }),
      }) as Awaited<ReturnType<typeof createClient>>
    );

    const response = await POST(
      new Request("http://localhost/api/gtm/runs/run_1/dispatch", {
        method: "POST",
        body: JSON.stringify({ stage: "research-competitor" }),
      }),
      { params: Promise.resolve({ runId: "run_1" }) }
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: "gtm_prefill_review_required",
      run_id: "run_1",
      stage: "research-competitors",
      prefill_status: "missing",
    });
    expect(mockDispatchGtmWorkerStage).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
    expect(inserts).toEqual([]);
  });

  it("blocks locked research stages when gtm_prefill is malformed", async () => {
    const updates: unknown[] = [];
    const inserts: unknown[] = [];
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock({
        updates,
        inserts,
        run: makeRun({
          status: "partial",
          manifest: {
            gtm_prefill: {
              status: "confirmed",
              researchUnlocked: true,
            },
          },
          stages: {
            "discover-url": {
              status: "complete",
            },
          },
        }),
      }) as Awaited<ReturnType<typeof createClient>>
    );

    const response = await POST(
      new Request("http://localhost/api/gtm/runs/run_1/dispatch", {
        method: "POST",
        body: JSON.stringify({ stage: "research-competitor" }),
      }),
      { params: Promise.resolve({ runId: "run_1" }) }
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: "gtm_prefill_review_required",
      run_id: "run_1",
      stage: "research-competitors",
      prefill_status: "confirmed",
    });
    expect(mockDispatchGtmWorkerStage).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
    expect(inserts).toEqual([]);
  });

  it("blocks downstream research stages until website prefill review is confirmed", async () => {
    const updates: unknown[] = [];
    const inserts: unknown[] = [];
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock({
        updates,
        inserts,
        run: makeRun({
          status: "partial",
          manifest: {
            gtm_prefill: {
              status: "ready_for_review",
              reviewRequired: true,
              researchUnlocked: false,
            },
          },
          stages: {
            "discover-url": {
              status: "complete",
            },
          },
        }),
      }) as Awaited<ReturnType<typeof createClient>>
    );

    const response = await POST(
      new Request("http://localhost/api/gtm/runs/run_1/dispatch", {
        method: "POST",
        body: JSON.stringify({ stage: "research-competitor" }),
      }),
      { params: Promise.resolve({ runId: "run_1" }) }
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: "gtm_prefill_review_required",
      run_id: "run_1",
      stage: "research-competitors",
      prefill_status: "ready_for_review",
    });
    expect(mockDispatchGtmWorkerStage).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
    expect(inserts).toEqual([]);
  });

  it("allows locked research stages after website prefill review is confirmed", async () => {
    const updates: unknown[] = [];
    const inserts: unknown[] = [];
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock({
        updates,
        inserts,
        run: makeRun({
          status: "partial",
          manifest: {
            gtm_prefill: buildConfirmedPrefill(),
          },
          stages: {
            "discover-url": {
              status: "complete",
            },
          },
        }),
      }) as Awaited<ReturnType<typeof createClient>>
    );

    const response = await POST(
      new Request("http://localhost/api/gtm/runs/run_1/dispatch", {
        method: "POST",
        body: JSON.stringify({ stage: "research-competitor" }),
      }),
      { params: Promise.resolve({ runId: "run_1" }) }
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(202);
    expect(payload).toEqual({
      run_id: "run_1",
      stage: "research-competitors",
      status: "accepted",
    });
    expect(mockDispatchGtmWorkerStage).toHaveBeenCalledWith({
      runId: "run_1",
      userId: "user_1",
      inputUrl: "https://airtable.com/",
      stage: "research-competitors",
    });
    expect(updates).toHaveLength(1);
    expect(inserts).toHaveLength(1);
  });
});

function buildSupabaseMock(input: {
  updates: unknown[];
  inserts: unknown[];
  run: GtmRunDispatchTestRow | null;
}): unknown {
  const selectBuilder = {
    eq: vi.fn(() => selectBuilder),
    maybeSingle: vi.fn(async () => ({
      data: input.run,
      error: null,
    })),
  };
  const updateBuilder = {
    error: null,
    eq: vi.fn(() => updateBuilder),
  };

  return {
    from(table: string) {
      if (table === "gtm_runs") {
        return {
          select: vi.fn(() => selectBuilder),
          update: vi.fn((payload: unknown) => {
            input.updates.push(payload);
            return updateBuilder;
          }),
        };
      }

      return {
        insert: vi.fn(async (payload: unknown) => {
          input.inserts.push(payload);
          return { error: null };
        }),
      };
    },
  };
}

interface GtmRunDispatchTestRow {
  run_id: string;
  user_id: string;
  input_url: string;
  status: string;
  manifest: Record<string, unknown> | null;
  stages: Record<string, unknown> | null;
}

function makeRun(
  overrides: Partial<GtmRunDispatchTestRow>,
): GtmRunDispatchTestRow {
  return {
    run_id: "run_1",
    user_id: "user_1",
    input_url: "https://airtable.com/",
    status: "queued",
    manifest: null,
    stages: {},
    ...overrides,
  };
}

function buildConfirmedPrefill(): ReturnType<typeof confirmGtmPrefillManifest> {
  return confirmGtmPrefillManifest({
    prefill: buildGtmPrefillManifestFromDiscovery({
      runId: "run_1",
      inputUrl: "https://airtable.com/",
      output: buildDiscoverUrlOutput(),
      now: NOW,
    }),
    fields: {
      companyName: "Airtable",
    },
    now: NOW,
  });
}

function buildDiscoverUrlOutput(): Record<string, unknown> {
  return {
    run_id: "run_1",
    stage: "discover-url",
    input_url: "https://airtable.com/",
    canonical_url: {
      value: "https://airtable.com/",
      source_url: "https://airtable.com/",
      retrieved_at: NOW,
    },
    company_name: {
      value: "Airtable",
      source_url: "https://airtable.com/",
      retrieved_at: NOW,
    },
    discovered_pages: [],
    prefilled_fields: [
      {
        field_key: "companyName",
        label: "Company Name",
        value: "Airtable",
        confidence: "high",
        evidence: [
          {
            value: "Airtable is the AI-native app platform.",
            source_url: "https://airtable.com/",
            retrieved_at: NOW,
          },
        ],
        reason: "Homepage names the company.",
      },
    ],
    unresolved_fields: [],
    source_gaps: [],
    generated_at: NOW,
  };
}

function getUpdatedStage(
  update: unknown,
  stage: string,
): Record<string, unknown> {
  if (!isRecord(update) || !isRecord(update.stages)) {
    throw new Error("Expected update payload with stages record.");
  }

  const stageState = update.stages[stage];
  if (!isRecord(stageState)) {
    throw new Error(`Expected updated stage state for ${stage}.`);
  }

  return stageState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
