import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatMessage } from "@/components/gtm/ChatMessage";

describe("ChatMessage", () => {
  it("right-aligns user messages", () => {
    render(<ChatMessage variant="user">Research https://airtable.com</ChatMessage>);

    const message = screen.getByText("Research https://airtable.com");
    const wrapper = message.closest("[data-variant='user']");

    expect(wrapper).toHaveClass("justify-end");
    expect(screen.getByLabelText("U avatar")).toBeInTheDocument();
  });

  it("renders agent text messages", () => {
    render(
      <ChatMessage variant="agent-text">
        Run queued. Waiting for orchestrator to start...
      </ChatMessage>
    );

    expect(
      screen.getByText("Run queued. Waiting for orchestrator to start...")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("A avatar")).toBeInTheDocument();
  });

  it("embeds an agent invocation block", () => {
    render(
      <ChatMessage
        variant="agent-block"
        status="running"
        invocation={{ skill: "research-market" }}
      />
    );

    expect(screen.getByText("research-market")).toBeInTheDocument();
    expect(screen.getByText("Researching")).toBeInTheDocument();
  });
});
