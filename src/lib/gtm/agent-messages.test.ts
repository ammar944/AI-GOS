import { describe, expect, it } from "vitest";
import {
  getGtmAgentMessageDisplayText,
  isMissingGtmMessagesTableError,
  type GtmAgentMessage,
} from "@/lib/gtm/agent-messages";

describe("isMissingGtmMessagesTableError", () => {
  it("recognizes PostgREST schema-cache misses for gtm_messages", () => {
    expect(
      isMissingGtmMessagesTableError({
        code: "PGRST205",
        message:
          "Could not find the table 'public.gtm_messages' in the schema cache",
      }),
    ).toBe(true);
  });

  it("recognizes postgres missing-relation errors for gtm_messages", () => {
    expect(
      isMissingGtmMessagesTableError({
        code: "42P01",
        message: 'relation "public.gtm_messages" does not exist',
      }),
    ).toBe(true);
  });

  it("does not hide unrelated table errors", () => {
    expect(
      isMissingGtmMessagesTableError({
        code: "PGRST205",
        message:
          "Could not find the table 'public.gtm_artifacts' in the schema cache",
      }),
    ).toBe(false);
  });
});

describe("getGtmAgentMessageDisplayText", () => {
  it("returns text content for transcript text messages", () => {
    expect(
      getGtmAgentMessageDisplayText(
        makeMessage({
          role: "assistant",
          content: { text: "I queued a competitor rerun." },
        }),
      ),
    ).toBe("I queued a competitor rerun.");
  });

  it("formats tool group messages from stable content fields", () => {
    expect(
      getGtmAgentMessageDisplayText(
        makeMessage({
          role: "tool",
          message_type: "tool_group",
          content: {
            label: "research-competitor",
            stage: "research-competitors",
            status: "queued",
          },
        }),
      ),
    ).toBe("research-competitor queued for research-competitors.");
  });

  it("does not stringify raw JSON content as a fallback", () => {
    expect(
      getGtmAgentMessageDisplayText(
        makeMessage({
          role: "tool",
          message_type: "tool_group",
          content: {
            payload: {
              stage: "research-competitors",
            },
          },
        }),
      ),
    ).toBe("");
  });
});

function makeMessage(overrides: Partial<GtmAgentMessage> = {}): GtmAgentMessage {
  return {
    id: "message_test",
    run_id: "run_test",
    user_id: "user_test",
    role: "user",
    message_type: "text",
    content: { text: "Run the audit." },
    status: "complete",
    metadata: {},
    created_at: "2026-05-01T12:00:00.000Z",
    ...overrides,
  };
}
