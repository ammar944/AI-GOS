/**
 * Tests for POST /api/gtm/runs/[runId]/chat (T7).
 *
 * PRD acceptance: 200 happy path, 401 unauth, 403 not-owner.
 *
 * Strategy: mock auth + supabase + runOrchestrator at module boundary; assert
 * the route hits the right status codes and (on happy path) calls the
 * orchestrator and returns its stream response.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { runOrchestrator } from "@/lib/ai/orchestrator";
import { POST } from "./route";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/ai/orchestrator", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/orchestrator")>(
    "@/lib/ai/orchestrator",
  );
  return {
    ...actual,
    runOrchestrator: vi.fn(),
  };
});

const mockAuth = vi.mocked(auth);
const mockCreateClient = vi.mocked(createClient);
const mockRunOrchestrator = vi.mocked(runOrchestrator);

interface RunRow {
  run_id: string;
  user_id: string;
  input_url: string;
  stages: Record<string, unknown> | null;
}

function buildSupabaseMock(run: RunRow | null): unknown {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: run, error: null }),
        })),
      })),
    })),
  };
}

const validRun: RunRow = {
  run_id: "run_1",
  user_id: "user_1",
  input_url: "https://airtable.com/",
  stages: {},
};

function buildRequest(body: unknown = { messages: [] }): Request {
  return new Request("http://localhost/api/gtm/runs/run_1/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const ctx = { params: Promise.resolve({ runId: "run_1" }) };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/gtm/runs/[runId]/chat", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null } as Awaited<
      ReturnType<typeof auth>
    >);

    const response = await POST(buildRequest(), ctx);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("gtm_chat_unauthenticated");
  });

  it("returns 404 when the run does not exist", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" } as Awaited<
      ReturnType<typeof auth>
    >);
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock(null) as Awaited<ReturnType<typeof createClient>>,
    );

    const response = await POST(buildRequest(), ctx);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("gtm_run_not_found");
  });

  it("returns 403 when the run belongs to another user", async () => {
    mockAuth.mockResolvedValue({ userId: "user_2" } as Awaited<
      ReturnType<typeof auth>
    >);
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock(validRun) as Awaited<ReturnType<typeof createClient>>,
    );

    const response = await POST(buildRequest(), ctx);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("gtm_chat_forbidden");
  });

  it("returns 400 when body is missing messages array", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" } as Awaited<
      ReturnType<typeof auth>
    >);
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock(validRun) as Awaited<ReturnType<typeof createClient>>,
    );

    const response = await POST(
      buildRequest({ wrong: "shape" }),
      ctx,
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("gtm_chat_invalid_body");
  });

  it("returns the orchestrator stream response on happy path", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" } as Awaited<
      ReturnType<typeof auth>
    >);
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock(validRun) as Awaited<ReturnType<typeof createClient>>,
    );

    const streamResponse = new Response("ok", { status: 200 });
    const fakeOrchestratorResult = {
      toUIMessageStreamResponse: vi.fn().mockReturnValue(streamResponse),
    };
    mockRunOrchestrator.mockResolvedValue(
      fakeOrchestratorResult as unknown as Awaited<
        ReturnType<typeof runOrchestrator>
      >,
    );

    const response = await POST(buildRequest({ messages: [] }), ctx);
    expect(response).toBe(streamResponse);
    expect(mockRunOrchestrator).toHaveBeenCalledTimes(1);
    const [messages, runId, deps] = mockRunOrchestrator.mock.calls[0]!;
    expect(messages).toEqual([]);
    expect(runId).toBe("run_1");
    expect(deps.userId).toBe("user_1");
    expect(typeof deps.dispatchSkillRun).toBe("function");
    expect(typeof deps.fetchLatestVersion).toBe("function");
    expect(typeof deps.insertSkillArtifact).toBe("function");
    expect(typeof deps.insertPatchedArtifact).toBe("function");
    expect(fakeOrchestratorResult.toUIMessageStreamResponse).toHaveBeenCalled();
  });
});
