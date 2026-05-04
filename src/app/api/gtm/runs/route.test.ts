import { auth } from "@clerk/nextjs/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchGtmWorkerRun } from "@/lib/gtm/worker-dispatch";
import { createClient } from "@/lib/supabase/server";
import { POST } from "./route";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/gtm/worker-dispatch", () => ({
  dispatchGtmWorkerRun: vi.fn(),
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test123456"),
}));

const mockAuth = vi.mocked(auth);
const mockCreateClient = vi.mocked(createClient);
const mockDispatchGtmWorkerRun = vi.mocked(dispatchGtmWorkerRun);

describe("GTM runs route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "user_1" } as Awaited<ReturnType<typeof auth>>);
    mockDispatchGtmWorkerRun.mockResolvedValue({
      run_id: "run_test123456",
      status: "accepted",
    });
  });

  it("creates a queued run and dispatches one full worker run without a stage", async () => {
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
    expect(inserts[0]).toEqual({
      run_id: "run_test123456",
      user_id: "user_1",
      input_url: "https://airtable.com/",
      status: "queued",
      manifest: {},
      stages: {},
    });
    expect(mockDispatchGtmWorkerRun).toHaveBeenCalledTimes(1);
    expect(mockDispatchGtmWorkerRun).toHaveBeenCalledWith({
      runId: "run_test123456",
      userId: "user_1",
      inputUrl: "https://airtable.com/",
    });
    expect(mockDispatchGtmWorkerRun.mock.calls[0]?.[0]).not.toHaveProperty("stage");
  });

  it("returns 502 when the worker does not accept the full run", async () => {
    const inserts: unknown[] = [];
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock({ inserts }) as Awaited<ReturnType<typeof createClient>>
    );
    mockDispatchGtmWorkerRun.mockRejectedValue(new Error("worker down"));

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
    });
    expect(inserts).toHaveLength(1);
    expect(mockDispatchGtmWorkerRun).toHaveBeenCalledTimes(1);
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
