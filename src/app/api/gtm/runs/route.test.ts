import { auth } from "@clerk/nextjs/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test123456"),
}));

const mockAuth = vi.mocked(auth);
const mockCreateClient = vi.mocked(createClient);
const mockDispatchGtmWorkerStage = vi.mocked(dispatchGtmWorkerStage);

describe("GTM runs route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "user_1" } as Awaited<ReturnType<typeof auth>>);
    mockDispatchGtmWorkerStage.mockResolvedValue({
      run_id: "run_test123456",
      stage: "discover-url",
      status: "accepted",
    });
  });

  it("creates a source-backed prefill draft and dispatches only discover-url", async () => {
    const inserts: unknown[] = [];
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock({ inserts }) as Awaited<ReturnType<typeof createClient>>
    );

    const response = await POST(
      new Request("http://localhost/api/gtm/runs", {
        method: "POST",
        body: JSON.stringify({ input_url: "https://airtable.com" }),
      })
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(payload).toEqual({
      run_id: "run_test123456",
      url: "/gtm/run_test123456",
    });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      run_id: "run_test123456",
      user_id: "user_1",
      input_url: "https://airtable.com/",
      status: "queued",
      stages: {},
      manifest: {
        gtm_prefill: {
          version: 1,
          status: "discovering",
          reviewRequired: true,
          researchUnlocked: false,
          websiteUrl: "https://airtable.com/",
          sourceGaps: [],
          questions: [],
        },
      },
    });
    expect(getManifest(inserts[0]).gtm_prefill.draft.fields.companyUrl).toMatchObject({
      value: "https://airtable.com/",
      status: "confirmed",
      confidence: "high",
      updatedBy: "user",
    });
    expect(mockDispatchGtmWorkerStage).toHaveBeenCalledTimes(1);
    expect(mockDispatchGtmWorkerStage).toHaveBeenCalledWith({
      runId: "run_test123456",
      userId: "user_1",
      inputUrl: "https://airtable.com/",
      stage: "discover-url",
    });
  });

  it("returns 502 when the worker does not accept discover-url", async () => {
    const inserts: unknown[] = [];
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock({ inserts }) as Awaited<ReturnType<typeof createClient>>
    );
    mockDispatchGtmWorkerStage.mockRejectedValue(new Error("worker down"));

    const response = await POST(
      new Request("http://localhost/api/gtm/runs", {
        method: "POST",
        body: JSON.stringify({ input_url: "https://airtable.com" }),
      })
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(502);
    expect(payload).toEqual({
      error: "gtm_worker_dispatch_failed",
      message: "worker down",
      run_id: "run_test123456",
      user_id: "user_1",
      stage: "discover-url",
    });
    expect(inserts).toHaveLength(1);
    expect(mockDispatchGtmWorkerStage).toHaveBeenCalledTimes(1);
  });
});

function buildSupabaseMock(input: { inserts: unknown[] }): unknown {
  const singleBuilder = {
    single: vi.fn(async () => ({
      data: { run_id: "run_test123456" },
      error: null,
    })),
  };
  const insertBuilder = {
    select: vi.fn(() => singleBuilder),
  };

  return {
    from(table: string) {
      if (table !== "gtm_runs") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        insert: vi.fn((payload: unknown) => {
          input.inserts.push(payload);
          return insertBuilder;
        }),
      };
    },
  };
}

function getManifest(value: unknown): {
  gtm_prefill: {
    draft: {
      fields: {
        companyUrl: Record<string, unknown>;
      };
    };
  };
} {
  if (!isRecord(value) || !isRecord(value.manifest) || !isRecord(value.manifest.gtm_prefill)) {
    throw new Error("Expected inserted run to include manifest.gtm_prefill.");
  }

  const prefill = value.manifest.gtm_prefill;
  if (!isRecord(prefill.draft) || !isRecord(prefill.draft.fields)) {
    throw new Error("Expected inserted run to include manifest.gtm_prefill.draft.fields.");
  }

  return {
    gtm_prefill: {
      draft: {
        fields: {
          companyUrl: prefill.draft.fields.companyUrl as Record<string, unknown>,
        },
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
