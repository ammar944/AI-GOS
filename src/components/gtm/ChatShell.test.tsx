/**
 * Tests for ChatShell.tsx (T10).
 *
 * Verifies the post-T10 contract:
 *   - Input is always enabled (not gated on currentRun.status)
 *   - Submitting a message calls sendMessage({text})
 *   - initialArtifacts render as ArtifactCards grouped by skill
 *
 * useChat / DefaultChatTransport are mocked at the module boundary —
 * we only assert wiring, not real streaming.
 */

import type { UIMessage } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

const { liveMessages, sendMessage, supabaseChannel, removeChannel } = vi.hoisted(() => {
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);
  return {
    liveMessages: [] as UIMessage[],
    sendMessage: vi.fn(),
    supabaseChannel: channel,
    removeChannel: vi.fn(),
  };
});

vi.mock("@ai-sdk/react", () => ({
  useChat: (options?: { messages?: UIMessage[] }) => ({
    messages: [...(options?.messages ?? []), ...liveMessages],
    sendMessage,
    status: "ready" as const,
  }),
}));

vi.mock("ai", () => ({
  DefaultChatTransport: class DefaultChatTransport {
    api?: string;
    constructor(options?: { api?: string }) {
      this.api = options?.api;
    }
  },
}));

vi.mock("@/lib/supabase/hooks", () => ({
  useSupabaseClient: () => ({
    channel: vi.fn(() => supabaseChannel),
    removeChannel,
  }),
}));

import { ChatShell, type ChatShellRun } from "./ChatShell";
import type { GtmAgentMessage } from "@/lib/gtm/agent-messages";
import type { GtmStageEvent } from "@/lib/gtm/stage-events";
import type { GtmArtifact } from "@/lib/types/gtm-artifact";

const baseRun: ChatShellRun = {
  run_id: "run_test",
  input_url: "https://airtable.com/",
  status: "completed",
  stages: {},
  created_at: "2026-05-01T12:00:00.000Z",
};

const baseArtifact: GtmArtifact = {
  id: "11111111-1111-1111-1111-111111111111",
  run_id: "run_test",
  user_id: "user_test",
  skill: "research-icp",
  version: 1,
  parent_id: null,
  content_md: "## ICP\n\nMid-market.\n",
  source: "skill_output",
  created_by: "orchestrator",
  metadata: {},
  created_at: "2026-05-01T12:00:00.000Z",
};

function makeMessage(
  overrides: Partial<GtmAgentMessage> = {},
): GtmAgentMessage {
  return {
    id: "message_1",
    run_id: "run_test",
    user_id: "user_test",
    role: "user",
    message_type: "text",
    content: { text: "Rerun competitors with G2-only sources." },
    status: "complete",
    metadata: {},
    created_at: "2026-05-01T12:05:00.000Z",
    ...overrides,
  };
}

describe("ChatShell (T10 wiring)", () => {
  beforeEach(() => {
    liveMessages.length = 0;
    sendMessage.mockClear();
  });

  it("renders an always-enabled chat input", () => {
    render(<ChatShell run={baseRun} />);
    const input = screen.getByLabelText(/chat input/i) as HTMLInputElement;
    expect(input.disabled).toBe(false);
  });

  it("disables Send when input is empty", () => {
    render(<ChatShell run={baseRun} />);
    const sendButton = screen.getByRole("button", { name: /^send$/i });
    expect(sendButton).toBeDisabled();
  });

  it("calls sendMessage({text}) on form submit", () => {
    sendMessage.mockClear();
    const { container } = render(<ChatShell run={baseRun} />);
    const input = screen.getByLabelText(/chat input/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "run the audit" } });
    const form = container.querySelector("form")!;
    fireEvent.submit(form);
    expect(sendMessage).toHaveBeenCalledWith({ text: "run the audit" });
  });

  it("renders ArtifactCard for each skill in initialArtifacts", () => {
    render(<ChatShell run={baseRun} initialArtifacts={[baseArtifact]} />);
    expect(
      screen.getAllByText("research-icp", { exact: false }).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("run-artifact-preview")).toHaveTextContent(
      "ICP",
    );
  });

  it("passes stage artifact events into the run artifact fallback", () => {
    const events: GtmStageEvent[] = [
      {
        id: "event_report",
        run_id: "run_test",
        user_id: "user_test",
        stage: "research-competitors",
        event_type: "artifact_written",
        message: "report_file artifact recorded.",
        status: "complete",
        metadata: {},
        artifact_path:
          "/tmp/aigos-gtm-runs/run_test/research-competitor/report.md",
        created_at: "2026-05-01T13:00:00.000Z",
      },
    ];

    render(<ChatShell run={baseRun} initialEvents={events} />);
    const artifactsSection = screen
      .getByRole("heading", { name: /run artifacts/i })
      .closest("section") as HTMLElement;
    const artifacts = within(artifactsSection);

    expect(
      artifacts.getByText("No canvas artifacts persisted yet."),
    ).toBeInTheDocument();
    expect(artifacts.getByText("research-competitor")).toBeInTheDocument();
    expect(
      artifacts.getByText(
        "/tmp/aigos-gtm-runs/run_test/research-competitor/report.md",
      ),
    ).toBeInTheDocument();
  });

  it("groups multiple versions of the same skill under one card", () => {
    const v2: GtmArtifact = {
      ...baseArtifact,
      id: "22222222-2222-2222-2222-222222222222",
      version: 2,
      parent_id: baseArtifact.id,
      source: "agent_patch",
      created_by: "user_test",
    };
    const { container } = render(
      <ChatShell run={baseRun} initialArtifacts={[baseArtifact, v2]} />,
    );
    expect(container.querySelectorAll('[data-testid="run-artifact-group"]')).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: /open in canvas/i })).toHaveLength(1);
    expect(screen.getByText("v2")).toBeInTheDocument();
  });

  it("renders the run state sections and queued transcript state", () => {
    render(<ChatShell run={baseRun} />);

    expect(
      screen.getByRole("heading", { name: /stage event log/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /run artifacts/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Run queued. Waiting for orchestrator to start..."),
    ).toBeInTheDocument();
  });

  it("renders persisted transcript messages after refresh", () => {
    const persistedMessage = makeMessage();

    render(<ChatShell run={baseRun} initialMessages={[persistedMessage]} />);
    expect(
      screen.getByText("Rerun competitors with G2-only sources."),
    ).toBeInTheDocument();
  });

  it("renders persisted assistant text messages after refresh", () => {
    render(
      <ChatShell
        run={baseRun}
        initialMessages={[
          makeMessage({
            id: "message_assistant",
            role: "assistant",
            content: { text: "I queued a competitor rerun with G2-only sources." },
            created_at: "2026-05-01T12:06:00.000Z",
          }),
        ]}
      />,
    );

    expect(
      screen.getByText("I queued a competitor rerun with G2-only sources."),
    ).toBeInTheDocument();
  });

  it("renders useful persisted tool and system messages without raw JSON dumps", () => {
    render(
      <ChatShell
        run={baseRun}
        initialMessages={[
          makeMessage({
            id: "message_tool",
            role: "tool",
            message_type: "tool_group",
            content: {
              label: "research-competitor",
              stage: "research-competitors",
              status: "queued",
            },
            created_at: "2026-05-01T12:07:00.000Z",
          }),
          makeMessage({
            id: "message_system",
            role: "system",
            message_type: "system",
            content: { text: "Worker accepted research-competitors." },
            created_at: "2026-05-01T12:08:00.000Z",
          }),
        ]}
      />,
    );

    expect(
      screen.getByText("research-competitor queued for research-competitors."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Worker accepted research-competitors."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/"stage"/)).not.toBeInTheDocument();
  });

  it("renders persisted transcript messages chronologically", () => {
    const { container } = render(
      <ChatShell
        run={baseRun}
        initialMessages={[
          makeMessage({
            id: "message_newer",
            content: { text: "Second persisted message." },
            created_at: "2026-05-01T12:08:00.000Z",
          }),
          makeMessage({
            id: "message_older",
            role: "assistant",
            content: { text: "First persisted message." },
            created_at: "2026-05-01T12:06:00.000Z",
          }),
        ]}
      />,
    );

    const text = container.textContent ?? "";
    expect(text.indexOf("First persisted message.")).toBeLessThan(
      text.indexOf("Second persisted message."),
    );
  });

  it("does not duplicate a persisted message returned by the chat hook", () => {
    const message = makeMessage();
    liveMessages.push({
      id: message.id,
      role: "user",
      parts: [{ type: "text", text: "Rerun competitors with G2-only sources." }],
    });

    render(<ChatShell run={baseRun} initialMessages={[message]} />);

    expect(
      screen.getAllByText("Rerun competitors with G2-only sources."),
    ).toHaveLength(1);
  });

  it("shows stage event, artifact, and blocked stage details", () => {
    const runWithStages: ChatShellRun = {
      ...baseRun,
      status: "awaiting_user",
      stages: {
        "discover-url": {
          status: "complete",
          artifacts: {
            output_file: "/tmp/aigos-gtm-runs/run_test/discover-url/output.json",
          },
          validation: {
            commands: [
              {
                label: "output-schema",
                status: "passed",
                command: "npm run validate:output",
              },
            ],
          },
        },
        "discover-identity": {
          status: "blocked",
          error: "Missing verified identity evidence.",
        },
      },
    };
    const events: GtmStageEvent[] = [
      {
        id: "event_1",
        run_id: "run_test",
        user_id: "user_test",
        stage: "discover-identity",
        event_type: "blocked",
        message: "Worker blocked discover-identity: Missing verified identity evidence.",
        status: "blocked",
        metadata: {},
        created_at: "2026-05-01T12:06:00.000Z",
      },
    ];

    render(<ChatShell run={runWithStages} initialEvents={events} />);

    expect(
      screen.getAllByText("Worker blocked discover-identity: Missing verified identity evidence.").length,
    ).toBeGreaterThanOrEqual(1);

    fireEvent.click(
      screen.getByRole("button", {
        name: /^expand discover-url$/i,
      }),
    );

    expect(
      screen.getByText("/tmp/aigos-gtm-runs/run_test/discover-url/output.json"),
    ).toBeInTheDocument();
  });
});
