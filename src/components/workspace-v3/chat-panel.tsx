"use client";

import { useEffect, useRef, useState } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  messages?: ChatMessage[];
  onSubmit?: (text: string) => void;
}

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    role: "assistant",
    text: "Ask about Nike Direct — I can pull sources, refine a card, or summarize cross-section themes.",
  },
  {
    role: "user",
    text: "What platforms did we rank highest for them?",
  },
  {
    role: "assistant",
    text: "Meta (primary, 60% of wave-1 budget) and TikTok (secondary, scale-or-kill gate at 3.0x ROAS). See Platform Strategy block in the draft media plan.",
  },
];

export function ChatPanel({
  open,
  onClose,
  messages = DEFAULT_MESSAGES,
  onSubmit,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    onSubmit?.(value);
    setInput("");
  };

  return (
    <aside
      ref={panelRef}
      className={`v3-chat-panel${open ? " v3-chat-panel-open" : ""}`}
      role="complementary"
      aria-label="Side chat"
      aria-hidden={!open}
    >
      <div className="v3-chat-panel-head">
        <span className="v3-mono-label">Chat</span>
        <button
          type="button"
          className="v3-chat-panel-close"
          onClick={onClose}
          aria-label="Close chat"
        >
          ✕
        </button>
      </div>

      <div className="v3-chat-panel-messages">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`v3-chat-message v3-chat-message-${m.role}`}
          >
            <div className="v3-mono-label">
              {m.role === "user" ? "you" : "claude"}
            </div>
            <div className="v3-chat-message-text">{m.text}</div>
          </div>
        ))}
      </div>

      <form
        className="v3-chat-panel-form"
        onSubmit={handleSubmit}
      >
        <input
          ref={inputRef}
          type="text"
          className="v3-chat-input"
          placeholder="Ask about this session…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </form>
    </aside>
  );
}
