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

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const { sendMessage } = vi.hoisted(() => ({
  sendMessage: vi.fn(),
}));

vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({
    messages: [],
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

import { ChatShell, type ChatShellRun } from "./ChatShell";
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

describe("ChatShell (T10 wiring)", () => {
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
    expect(screen.getByText("research-icp", { exact: false })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /ICP/ }),
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
    render(<ChatShell run={baseRun} initialArtifacts={[baseArtifact, v2]} />);
    expect(screen.getAllByText("research-icp", { exact: false }).length).toBe(1);
    expect(screen.getByText("v2")).toBeInTheDocument();
  });
});
