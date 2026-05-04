/**
 * Tests for POST /api/gtm/runs/[runId]/chat (T7).
 *
 * PRD acceptance: 200 happy path, 401 unauth, 403 not-owner.
 *
 * Strategy: mock auth + supabase + runOrchestrator at module boundary; assert
 * the route hits the right status codes and (on happy path) calls the
 * orchestrator and returns its stream response.
 */

import type { UIMessage } from "ai";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { runOrchestrator } from "@/lib/ai/orchestrator";
import { dispatchGtmWorkerStage } from "@/lib/gtm/worker-dispatch";
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

vi.mock("@/lib/gtm/worker-dispatch", () => ({
  dispatchGtmWorkerStage: vi.fn(),
}));

const mockAuth = vi.mocked(auth);
const mockCreateClient = vi.mocked(createClient);
const mockRunOrchestrator = vi.mocked(runOrchestrator);
const mockDispatchGtmWorkerStage = vi.mocked(dispatchGtmWorkerStage);

interface RunRow {
  run_id: string;
  user_id: string;
  input_url: string;
  stages: Record<string, unknown> | null;
}

const insertGtmMessage = vi.fn();

interface BuildSupabaseMockOptions {
  gtmMessageInsertError?: {
    code?: string;
    message: string;
  } | null;
}

function buildSupabaseMock(
  run: RunRow | null,
  options: BuildSupabaseMockOptions = {},
): unknown {
  return {
    from: vi.fn((table: string) => {
      if (table === "gtm_runs") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: run, error: null }),
            })),
          })),
        };
      }

      if (table === "gtm_messages") {
        return {
          insert: insertGtmMessage.mockResolvedValue({
            error: options.gtmMessageInsertError ?? null,
          }),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                })),
              })),
            })),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: "artifact_1", version: 1 },
              error: null,
            }),
          })),
        })),
      };
    }),
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

function buildUserMessageRequest(): Request {
  return buildRequest({
    messages: [
      {
        id: "message_user_1",
        role: "user",
        parts: [{ type: "text", text: "Rerun competitor research with G2 only." }],
      },
    ],
  });
}

const ctx = { params: Promise.resolve({ runId: "run_1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockDispatchGtmWorkerStage.mockResolvedValue({
    run_id: "run_1",
    stage: "research-competitors",
    status: "accepted",
  });
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

    const response = await POST(buildUserMessageRequest(), ctx);
    expect(response).toBe(streamResponse);
    expect(insertGtmMessage).toHaveBeenCalledWith({
      run_id: "run_1",
      user_id: "user_1",
      role: "user",
      message_type: "text",
      content: { text: "Rerun competitor research with G2 only." },
      status: "complete",
      metadata: {},
    });
    expect(mockRunOrchestrator).toHaveBeenCalledTimes(1);
    const [messages, runId, deps] = mockRunOrchestrator.mock.calls[0]!;
    expect(messages).toEqual([
      {
        id: "message_user_1",
        role: "user",
        parts: [{ type: "text", text: "Rerun competitor research with G2 only." }],
      },
    ]);
    expect(runId).toBe("run_1");
    expect(deps.userId).toBe("user_1");
    expect(typeof deps.dispatchSkillRun).toBe("function");
    expect(typeof deps.fetchLatestVersion).toBe("function");
    expect(typeof deps.insertSkillArtifact).toBe("function");
    expect(typeof deps.insertPatchedArtifact).toBe("function");
    expect(fakeOrchestratorResult.toUIMessageStreamResponse).toHaveBeenCalled();
  });

  it("persists final assistant text when the UI stream finishes", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" } as Awaited<
      ReturnType<typeof auth>
    >);
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock(validRun) as Awaited<ReturnType<typeof createClient>>,
    );

    const streamResponse = new Response("ok", { status: 200 });
    let finishPromise: PromiseLike<void> | void;
    const responseMessage: UIMessage = {
      id: "message_assistant_1",
      role: "assistant",
      parts: [{ type: "text", text: "I queued competitor research." }],
    };
    const fakeOrchestratorResult = {
      toUIMessageStreamResponse: vi.fn(
        (options?: {
          onFinish?: (event: {
            messages: UIMessage[];
            isContinuation: boolean;
            isAborted: boolean;
            responseMessage: UIMessage;
            finishReason?: string;
          }) => PromiseLike<void> | void;
        }) => {
          finishPromise = options?.onFinish?.({
            messages: [responseMessage],
            isContinuation: false,
            isAborted: false,
            responseMessage,
            finishReason: "stop",
          });
          return streamResponse;
        },
      ),
    };
    mockRunOrchestrator.mockResolvedValue(
      fakeOrchestratorResult as unknown as Awaited<
        ReturnType<typeof runOrchestrator>
      >,
    );

    const response = await POST(buildUserMessageRequest(), ctx);
    await finishPromise;

    expect(response).toBe(streamResponse);
    expect(insertGtmMessage).toHaveBeenCalledWith({
      run_id: "run_1",
      user_id: "user_1",
      role: "assistant",
      message_type: "text",
      content: { text: "I queued competitor research." },
      status: "complete",
      metadata: {
        source: "orchestrator_stream_finish",
        finish_reason: "stop",
      },
    });
  });

  it("throws non-missing gtm_messages insert errors with run context", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" } as Awaited<
      ReturnType<typeof auth>
    >);
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock(validRun, {
        gtmMessageInsertError: {
          code: "23505",
          message: "duplicate key value violates unique constraint",
        },
      }) as Awaited<ReturnType<typeof createClient>>,
    );

    await expect(POST(buildUserMessageRequest(), ctx)).rejects.toThrow(
      "gtm_messages insert failed for run_id=run_1 role=user: duplicate key value violates unique constraint",
    );
    expect(mockRunOrchestrator).not.toHaveBeenCalled();
  });

  it("queues dispatch_skill through the worker-backed stage path", async () => {
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

    await POST(buildUserMessageRequest(), ctx);
    const [, , deps] = mockRunOrchestrator.mock.calls[0]!;
    const result = await deps.dispatchSkillRun({
      skill: "research-competitor",
      refinement_context: "Use G2 only.",
    });

    expect(result).toEqual({
      status: "queued",
      output: {
        run_id: "run_1",
        stage: "research-competitors",
        worker_status: "accepted",
      },
    });
    expect(mockDispatchGtmWorkerStage).toHaveBeenCalledWith({
      runId: "run_1",
      userId: "user_1",
      inputUrl: "https://airtable.com/",
      stage: "research-competitors",
    });
  });

  it("continues when the gtm_messages table has not been migrated yet", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" } as Awaited<
      ReturnType<typeof auth>
    >);
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock(validRun, {
        gtmMessageInsertError: {
          code: "PGRST205",
          message:
            "Could not find the table 'public.gtm_messages' in the schema cache",
        },
      }) as Awaited<ReturnType<typeof createClient>>,
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

    const response = await POST(buildUserMessageRequest(), ctx);

    expect(response).toBe(streamResponse);
    expect(mockRunOrchestrator).toHaveBeenCalledTimes(1);
  });
});
